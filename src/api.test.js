import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, bucket, client } = vi.hoisted(() => {
  const query = {};
  for (const key of [
    "update",
    "eq",
    "is",
    "select",
    "insert",
    "order",
    "delete",
    "range",
  ])
    query[key] = vi.fn(() => query);
  const bucket = {
    upload: vi.fn(),
    remove: vi.fn(),
    download: vi.fn(),
    createSignedUrl: vi.fn(),
  };
  const client = {
    from: vi.fn(() => query),
    rpc: vi.fn(),
    storage: { from: vi.fn(() => bucket) },
  };
  return { query, bucket, client };
});
vi.mock("@supabase/supabase-js", () => ({ createClient: () => client }));
import {
  updateTask,
  uploadDocuments,
  deleteMember,
  deleteDocument,
  loadBoardTasks,
  uploadTaskPhotos,
  deleteTaskPhoto,
} from "./api";

beforeEach(() => {
  vi.clearAllMocks();
  delete query.then;
  for (const key of [
    "update",
    "eq",
    "is",
    "select",
    "insert",
    "order",
    "delete",
    "range",
  ])
    query[key].mockReturnValue(query);
});

describe("Deletion API", () => {
  const doc = { id: "one", path: "shared/one.md" };
  it("uses the transactional member-removal RPC", async () => {
    client.rpc.mockResolvedValue({
      data: "member@roster.invalid",
      error: null,
    });
    await deleteMember("member@roster.invalid");
    expect(client.rpc).toHaveBeenCalledWith("edge_remove_member", {
      member_email: "member@roster.invalid",
    });
  });
  it("explains the missing migration instead of claiming deletion succeeded", async () => {
    client.rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Missing function" },
    });
    await expect(deleteMember("member@roster.invalid")).rejects.toThrow(
      "001_delete_actions.sql",
    );
  });
  it("removes metadata before its file and checks that a row was actually deleted", async () => {
    query.select.mockResolvedValue({ data: [{ id: "one" }], error: null });
    bucket.remove.mockResolvedValue({ data: [], error: null });
    expect(await deleteDocument(doc)).toEqual({});
    expect(query.eq).toHaveBeenCalledWith("id", "one");
    expect(query.eq).toHaveBeenCalledWith("path", doc.path);
    expect(bucket.remove).toHaveBeenCalledWith([doc.path]);
    expect(query.delete.mock.invocationCallOrder[0]).toBeLessThan(
      bucket.remove.mock.invocationCallOrder[0],
    );
  });
  it("never deletes the file if row permissions filtered out the document", async () => {
    query.select.mockResolvedValue({ data: [], error: null });
    await expect(deleteDocument(doc)).rejects.toThrow("not deleted");
    expect(bucket.remove).not.toHaveBeenCalled();
  });
  it("reports a file-cleanup failure separately from a completed metadata deletion", async () => {
    query.select.mockResolvedValue({ data: [{ id: "one" }], error: null });
    bucket.remove.mockResolvedValue({
      data: null,
      error: { message: "Storage offline" },
    });
    expect(await deleteDocument(doc)).toEqual({
      cleanupError: "Storage offline",
    });
  });
  it("does not try to delete the app-bundled release document", async () => {
    await expect(deleteDocument({ builtin: true })).rejects.toThrow(
      "part of the app",
    );
    expect(query.delete).not.toHaveBeenCalled();
  });
});

describe("Supabase mutation safeguards", () => {
  it("guards updates by task id, revision and archived state", async () => {
    query.select.mockResolvedValue({
      data: [{ id: "one", revision: 8 }],
      error: null,
    });
    expect(await updateTask("one", 7, { status: "Done" })).toEqual({
      id: "one",
      revision: 8,
    });
    expect(query.eq).toHaveBeenCalledWith("id", "one");
    expect(query.eq).toHaveBeenCalledWith("revision", 7);
    expect(query.is).toHaveBeenCalledWith("archived_at", null);
  });
  it("reports a conflict instead of treating a zero-row update as saved", async () => {
    query.select.mockResolvedValue({ data: [], error: null });
    await expect(updateTask("one", 7, { title: "Change" })).rejects.toThrow(
      "changed elsewhere",
    );
  });
  it("rejects an invalid batch before uploading any file", async () => {
    const valid = new File(["# Note"], "note.md");
    const invalid = new File(["no"], "bad.exe");
    await expect(uploadDocuments([valid, invalid], "")).rejects.toThrow(
      "Choose HTML",
    );
    expect(bucket.upload).not.toHaveBeenCalled();
  });
  it("removes an uploaded blob if saving its document record fails", async () => {
    bucket.upload.mockResolvedValue({ data: {}, error: null });
    bucket.remove.mockResolvedValue({ data: {}, error: null });
    query.insert.mockResolvedValue({ error: { message: "Record rejected" } });
    await expect(
      uploadDocuments([new File(["# Note"], "note.md")], ""),
    ).rejects.toThrow("Record rejected");
    expect(bucket.remove).toHaveBeenCalledWith([
      expect.stringMatching(/^shared\/.+\.md$/),
    ]);
  });
  it("reports how many documents were persisted when a later upload fails", async () => {
    bucket.upload
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ error: { message: "Upload failed" } });
    query.insert.mockResolvedValue({ data: null, error: null });
    const files = [new File(["one"], "one.md"), new File(["two"], "two.md")];
    expect(await uploadDocuments(files, "")).toEqual({
      uploaded: 1,
      error: "Upload failed",
    });
  });
});

describe("Photo uploads and complete board reads", () => {
  const photo = () =>
    new File(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])],
      "issue.png",
      { type: "image/png" },
    );
  it("continues past the API page limit before returning report tasks", async () => {
    const first = Array.from({ length: 500 }, (_, id) => ({ id }));
    query.range
      .mockResolvedValueOnce({ data: first })
      .mockResolvedValueOnce({ data: [{ id: 500 }] });
    expect(await loadBoardTasks()).toHaveLength(501);
    expect(query.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(query.range).toHaveBeenNthCalledWith(2, 500, 999);
  });
  it("attaches a validated image to its issue and private storage path", async () => {
    bucket.upload.mockResolvedValue({ data: {}, error: null });
    query.insert.mockResolvedValue({ data: null, error: null });
    expect(await uploadTaskPhotos("issue-id", [photo()])).toEqual({
      uploaded: 1,
    });
    expect(bucket.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^issues\/issue-id\/.+\.png$/),
      expect.any(File),
      { contentType: "image/png", upsert: false },
    );
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        task_id: "issue-id",
        file_name: "issue.png",
        content_type: "image/png",
        bytes: 9,
      }),
    );
  });
  it("cleans up storage if attaching the photo record fails", async () => {
    bucket.upload.mockResolvedValue({ data: {}, error: null });
    bucket.remove.mockResolvedValue({ data: [], error: null });
    query.insert.mockResolvedValue({
      data: null,
      error: { message: "Issue archived" },
    });
    await expect(uploadTaskPhotos("issue-id", [photo()])).rejects.toThrow(
      "Issue archived",
    );
    expect(bucket.remove).toHaveBeenCalledWith([
      expect.stringMatching(/^issues\/issue-id\/.+\.png$/),
    ]);
  });
  it("does not remove a photo file if the metadata deletion failed", async () => {
    query.select.mockResolvedValue({ data: [], error: null });
    await expect(
      deleteTaskPhoto({
        id: "p",
        task_id: "issue-id",
        path: "issues/issue-id/p.png",
      }),
    ).rejects.toThrow("not deleted");
    expect(bucket.remove).not.toHaveBeenCalled();
  });
  it("preserves successful uploads and reports where a batch stopped", async () => {
    bucket.upload
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ error: { message: "Offline" } });
    query.insert.mockResolvedValue({ data: null, error: null });
    expect(await uploadTaskPhotos("issue-id", [photo(), photo()])).toEqual({
      uploaded: 1,
      error: "Offline",
    });
  });
});
