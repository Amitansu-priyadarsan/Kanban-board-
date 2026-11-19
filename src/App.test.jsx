import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import * as api from "./api";

vi.mock("./api", () => ({
  loadWorkspace: vi.fn(),
  updateTask: vi.fn(),
  createTask: vi.fn(),
  getHistory: vi.fn(),
  addMember: vi.fn(),
  uploadDocuments: vi.fn(),
  downloadDocument: vi.fn(),
  deleteMember: vi.fn(),
  deleteDocument: vi.fn(),
  cleanupDocumentFile: vi.fn(),
  getTaskPhotos: vi.fn(),
  getPhotoUrl: vi.fn(),
  uploadTaskPhotos: vi.fn(),
  deleteTaskPhoto: vi.fn(),
  cleanupPhotoFile: vi.fn(),
}));
const member = { email: "amit@roster.invalid", name: "Amit" };
const task = {
  id: "first",
  title: "Track replay",
  scope: "Frontend",
  status: "To Do",
  priority: "High",
  revision: 3,
  assignee_email: member.email,
  description: "Keep replay working",
  acceptance: "Tabs stay available",
  due_date: "2026-11-22",
  starts_at: new Date().toISOString(),
  ends_at: new Date(Date.now() + 3600000).toISOString(),
};
const other = {
  ...task,
  id: "second",
  title: "Add API filter",
  scope: "Backend",
  status: "In Review",
  assignee_email: null,
};
const workspace = { tasks: [task, other], members: [member], docs: [] };
async function navigate(hash) {
  await act(async () => {
    location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  history.replaceState(null, "", "/#tasks");
  api.loadWorkspace.mockResolvedValue(workspace);
  api.getHistory.mockResolvedValue([]);
  api.getTaskPhotos.mockResolvedValue([]);
});

describe("Member and document deletion", () => {
  const doc = {
    id: "upload",
    title: "Delivery notes",
    kind: "md",
    file_name: "notes.md",
    path: "shared/upload.md",
  };

  it("deletes a member after confirmation and refreshes unassigned tasks", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.deleteMember.mockResolvedValue();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Members" }));
    api.loadWorkspace.mockResolvedValue({
      ...workspace,
      members: [],
      tasks: workspace.tasks.map((item) => ({ ...item, assignee_email: null })),
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete Amit" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Delete Amit" }),
      ).not.toBeInTheDocument(),
    );
    expect(api.deleteMember).toHaveBeenCalledWith(member.email);
    expect(
      screen.getByRole("heading", { name: "Track replay" }),
    ).toBeInTheDocument();
  });

  it("does not call the database when member deletion is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Members" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Amit" }));
    expect(api.deleteMember).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Delete Amit" }),
    ).toBeInTheDocument();
  });

  it("keeps the member visible if Supabase rejects deletion", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.deleteMember.mockRejectedValue(new Error("Deletion is not enabled"));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Members" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Amit" }));
    await screen.findByText("Deletion is not enabled");
    expect(
      screen.getByRole("button", { name: "Delete Amit" }),
    ).toBeInTheDocument();
  });

  it("removes an uploaded document after confirmation and preserves the included release", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.deleteDocument.mockResolvedValue({});
    api.loadWorkspace.mockResolvedValue({ ...workspace, docs: [doc] });
    render(<App />);
    await screen.findByRole("heading", { name: "Tasks" });
    await navigate("#docs");
    api.loadWorkspace.mockResolvedValue(workspace);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Delivery notes" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Delivery notes" }),
      ).not.toBeInTheDocument(),
    );
    expect(api.deleteDocument).toHaveBeenCalledWith(doc);
    expect(
      screen.getByRole("heading", { name: "22 Nov Driver App Release" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Delete 22 Nov Driver App Release",
      }),
    ).not.toBeInTheDocument();
  });

  it("keeps document cards when deletion fails and offers retry for file cleanup only", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.loadWorkspace.mockResolvedValue({ ...workspace, docs: [doc] });
    api.deleteDocument
      .mockRejectedValueOnce(new Error("Not permitted"))
      .mockResolvedValueOnce({ cleanupError: "Storage offline" });
    api.cleanupDocumentFile.mockResolvedValue();
    render(<App />);
    await screen.findByRole("heading", { name: "Tasks" });
    await navigate("#docs");
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Delivery notes" }),
    );
    await screen.findByText("Not permitted");
    expect(
      screen.getByRole("heading", { name: "Delivery notes" }),
    ).toBeInTheDocument();
    api.loadWorkspace.mockResolvedValue(workspace);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Delivery notes" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Retry file cleanup" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Retry file cleanup" }),
      ).not.toBeInTheDocument(),
    );
    expect(api.cleanupDocumentFile).toHaveBeenCalledWith(doc.path);
  });
});

describe("Existing board workflows in React", () => {
  it("composes task search with assignee filtering and restores cards when cleared", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Track replay" });
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "api" },
    });
    expect(
      screen.queryByRole("heading", { name: "Track replay" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Add API filter" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter by assignee"), {
      target: { value: member.email },
    });
    expect(
      screen.queryByRole("heading", { name: "Add API filter" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(
      screen.getByRole("heading", { name: "Track replay" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter by assignee"), {
      target: { value: "" },
    });
    expect(
      screen.getByRole("heading", { name: "Add API filter" }),
    ).toBeInTheDocument();
  });

  it("starts a task using its saved revision and updates the correct lane", async () => {
    api.updateTask.mockResolvedValue({
      ...task,
      status: "In Progress",
      revision: 4,
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Start task" }));
    await waitFor(() =>
      expect(api.updateTask).toHaveBeenCalledWith(task.id, 3, {
        status: "In Progress",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Start task" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      within(
        screen.getByRole("heading", { name: "In Progress" }).closest("section"),
      ).getByRole("heading", { name: "Track replay" }),
    ).toBeInTheDocument();
  });

  it("creates a task, returns to the board and refreshes persisted data", async () => {
    const created = {
      ...task,
      id: "new",
      title: "New work",
      scope: "Shared",
      priority: "Normal",
    };
    api.createTask.mockResolvedValue(created);
    render(<App />);
    await screen.findByRole("heading", { name: "Tasks" });
    await navigate("#new/0");
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "New work" },
    });
    api.loadWorkspace.mockResolvedValue({
      ...workspace,
      tasks: [...workspace.tasks, created],
    });
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    await screen.findByRole("heading", { name: "New work" });
    expect(api.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New work",
        scope: "Shared",
        status: "To Do",
        assignee_email: null,
      }),
    );
    expect(location.hash).toBe("#tasks");
    expect(api.loadWorkspace).toHaveBeenCalledTimes(2);
  });

  it("keeps an edited form open when another person has changed the task", async () => {
    api.updateTask.mockRejectedValue(
      new Error("This task changed elsewhere. Refresh before editing."),
    );
    render(<App />);
    await screen.findByRole("heading", { name: "Tasks" });
    await navigate("#task/first");
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Keep my edit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText(
      "This task changed elsewhere. Refresh before editing.",
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Keep my edit");
    expect(location.hash).toBe("#task/first");
    expect(api.updateTask).toHaveBeenCalledWith(
      "first",
      3,
      expect.objectContaining({ title: "Keep my edit" }),
    );
  });

  it("archives without deleting history and returns to the board", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.updateTask.mockResolvedValue({
      ...task,
      archived_at: "2026-11-19T00:00:00Z",
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Tasks" });
    await navigate("#task/first");
    api.loadWorkspace.mockResolvedValue({ ...workspace, tasks: [other] });
    fireEvent.click(screen.getByRole("button", { name: "Archive task" }));
    await screen.findByRole("heading", { name: "Tasks" });
    expect(api.updateTask).toHaveBeenCalledWith("first", 3, {
      archived_at: expect.any(String),
    });
    expect(
      screen.queryByRole("heading", { name: "Track replay" }),
    ).not.toBeInTheDocument();
  });

  it("loads the included release document without depending on the old standalone HTML", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Tasks" });
    await navigate("#docs");
    expect(
      screen.getByRole("heading", { name: "22 Nov Driver App Release" }),
    ).toBeInTheDocument();
    await navigate("#doc/release");
    expect(screen.getByTitle("22 Nov Driver App Release")).toHaveAttribute(
      "src",
      "/release-handoff.html",
    );
    expect(screen.getByTitle("22 Nov Driver App Release")).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-popups",
    );
  });

  it("adds a member and reloads the shared roster", async () => {
    api.addMember.mockResolvedValue();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Members" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Eric" },
    });
    api.loadWorkspace.mockResolvedValue({
      ...workspace,
      members: [member, { name: "Eric", email: "eric@roster.invalid" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    expect(
      await within(screen.getByRole("dialog")).findByText("Eric"),
    ).toBeInTheDocument();
    expect(api.addMember).toHaveBeenCalledWith("Eric");
  });

  it("offers retry when the initial connection fails", async () => {
    api.loadWorkspace.mockRejectedValueOnce(new Error("Offline"));
    render(<App />);
    await screen.findByRole("heading", { name: "Workspace unavailable" });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("heading", { name: "Track replay" }),
    ).toBeInTheDocument();
  });
});

describe("Scheduled views and new-issue photos", () => {
  it("defaults to today and exposes unscheduled and future work under All time", async () => {
    const later = {
      ...other,
      id: "future",
      title: "Future issue",
      starts_at: new Date(Date.now() + 172800000).toISOString(),
      ends_at: new Date(Date.now() + 176400000).toISOString(),
    };
    const unscheduled = {
      ...other,
      id: "unscheduled",
      title: "No schedule",
      starts_at: null,
      ends_at: null,
    };
    api.loadWorkspace.mockResolvedValue({
      ...workspace,
      tasks: [task, later, unscheduled],
    });
    render(<App />);
    await screen.findByRole("heading", { name: task.title });
    expect(
      screen.getByRole("button", { name: "Today", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("heading", { name: "Future issue" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "No schedule" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "All time", exact: true }),
    );
    expect(
      screen.getByRole("heading", { name: "Future issue" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No schedule" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Custom range", exact: true }),
    );
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "" } });
    expect(
      screen.getByRole("button", { name: "Download report (CSV)" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Choose both dates");
  });
  it("prevents saving backwards schedule times", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Tasks" });
    await navigate("#new/0");
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Bad time" },
    });
    fireEvent.change(screen.getByLabelText("Start date and time (IST)"), {
      target: { value: "2026-11-20T10:00" },
    });
    fireEvent.change(screen.getByLabelText("End date and time (IST)"), {
      target: { value: "2026-11-20T09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    await screen.findByText("The end time must be after the start time.");
    expect(api.createTask).not.toHaveBeenCalled();
  });
  it("retains the saved issue and opens its photos when an upload fails", async () => {
    const saved = { ...task, id: "photo-task", title: "Issue with screenshot" };
    api.createTask.mockResolvedValue(saved);
    api.uploadTaskPhotos.mockRejectedValue(new Error("Storage offline"));
    render(<App />);
    await screen.findByRole("heading", { name: "Tasks" });
    await navigate("#new/0");
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: saved.title },
    });
    const file = new File(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
      "screen.png",
      { type: "image/png" },
    );
    fireEvent.change(screen.getByLabelText(/Photos \(optional\)/), {
      target: { files: [file] },
    });
    api.loadWorkspace.mockResolvedValue({ ...workspace, tasks: [saved] });
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    await screen.findByRole("button", { name: "Upload photos" });
    expect(api.createTask).toHaveBeenCalledTimes(1);
    expect(api.uploadTaskPhotos).toHaveBeenCalledWith("photo-task", [file]);
    expect(location.hash).toBe("#task/photo-task");
    expect(
      screen.getByRole("form", { name: "Task details" }),
    ).toBeInTheDocument();
  });
});
