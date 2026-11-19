import { createClient } from "@supabase/supabase-js";
import { validatePhotoFiles } from "./photos";

const client = createClient(
  import.meta.env.VITE_SUPABASE_URL ||
    "https://rqozyhhzosvcohtiybqo.supabase.co",
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_TP9DnsXbTohgSbmckxf6ZQ_QeoYfRCU",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
const bucket = client.storage.from("gnb-edge-docs");
function decode(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// Supabase caps an unpaginated read. Reports must cover the entire current board.
export async function loadBoardTasks() {
  const tasks = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const rows = decode(
      await client
        .from("edge_tasks")
        .select()
        .is("archived_at", null)
        .order("created_at")
        .order("id")
        .range(offset, offset + size - 1),
    );
    tasks.push(...rows);
    if (rows.length < size) return tasks;
  }
}

export async function loadWorkspace() {
  const results = await Promise.all([
    client.from("edge_members").select("email,name,role").order("name"),
    loadBoardTasks(),
    client.from("edge_docs").select().order("created_at", { ascending: false }),
  ]);
  const [memberResult, tasks, docResult] = results;
  const members = decode(memberResult);
  const docs = decode(docResult);
  return { members, tasks, docs };
}

const photoBucket = client.storage.from("gnb-edge-issue-photos");
function decodePhotos(result) {
  if (["PGRST205", "42P01", "42501"].includes(result.error?.code)) {
    throw new Error("Photo uploads are not enabled for this workspace yet.");
  }
  return decode(result);
}
export async function getTaskPhotos(taskId) {
  return decodePhotos(
    await client
      .from("edge_task_photos")
      .select()
      .eq("task_id", taskId)
      .order("created_at")
      .order("id"),
  );
}
export async function getPhotoUrl(path) {
  const result = decodePhotos(await photoBucket.createSignedUrl(path, 3600));
  return result.signedUrl;
}
export async function cleanupPhotoFile(path) {
  decode(await photoBucket.remove([path]));
}
export async function uploadTaskPhotos(taskId, files) {
  const prepared = await validatePhotoFiles(files);
  if (!prepared.length) throw new Error("Choose at least one photo.");
  let uploaded = 0;
  try {
    for (const { file, extension } of prepared) {
      const id = crypto.randomUUID();
      const path = `issues/${taskId}/${id}.${extension}`;
      decodePhotos(
        await photoBucket.upload(path, file, {
          contentType: file.type,
          upsert: false,
        }),
      );
      const result = await client.from("edge_task_photos").insert({
        id,
        task_id: taskId,
        path,
        file_name: file.name.slice(0, 255),
        content_type: file.type,
        bytes: file.size,
      });
      if (result.error) {
        const cleanup = await photoBucket.remove([path]);
        const suffix = cleanup.error
          ? ` File cleanup also failed: ${cleanup.error.message}`
          : "";
        try {
          decodePhotos(result);
        } catch (error) {
          throw new Error(error.message + suffix);
        }
      }
      uploaded++;
    }
  } catch (error) {
    if (!uploaded) throw error;
    return { uploaded, error: error.message };
  }
  return { uploaded };
}
export async function deleteTaskPhoto(photo) {
  const removed = decodePhotos(
    await client
      .from("edge_task_photos")
      .delete()
      .eq("id", photo.id)
      .eq("task_id", photo.task_id)
      .select("id"),
  );
  if (removed.length !== 1)
    throw new Error(
      "Photo was not deleted. Refresh the issue before trying again.",
    );
  try {
    await cleanupPhotoFile(photo.path);
    return {};
  } catch (error) {
    return { cleanupError: error.message };
  }
}
export async function updateTask(id, revision, payload) {
  const changed = decode(
    await client
      .from("edge_tasks")
      .update(payload)
      .eq("id", id)
      .eq("revision", revision)
      .is("archived_at", null)
      .select(),
  );
  if (changed.length !== 1)
    throw new Error("This task changed elsewhere. Refresh before editing.");
  return changed[0];
}
export async function createTask(payload) {
  return decode(
    await client
      .from("edge_tasks")
      .insert({ id: crypto.randomUUID(), ...payload })
      .select()
      .single(),
  );
}
export async function getHistory(id) {
  return decode(
    await client
      .from("edge_history")
      .select()
      .eq("task_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(100),
  );
}
export async function addMember(name) {
  name = name.trim();
  if (!name) throw new Error("Enter a name.");
  decode(
    await client.from("edge_members").insert({
      name,
      email: `${crypto.randomUUID()}@roster.invalid`,
      role: "member",
    }),
  );
}

function decodeDeletion(result) {
  if (["PGRST202", "42501"].includes(result.error?.code)) {
    throw new Error(
      "Deletion is not enabled in Supabase yet. Run supabase/migrations/001_delete_actions.sql in the SQL Editor.",
    );
  }
  return decode(result);
}

export async function deleteMember(email) {
  const removed = decodeDeletion(
    await client.rpc("edge_remove_member", { member_email: email }),
  );
  if (removed !== email)
    throw new Error(
      "Member was not deleted. Refresh the roster before trying again.",
    );
}

export async function cleanupDocumentFile(path) {
  decode(await bucket.remove([path]));
}

export async function deleteDocument(doc) {
  if (doc.builtin)
    throw new Error("The included release document is part of the app.");
  const removed = decodeDeletion(
    await client
      .from("edge_docs")
      .delete()
      .eq("id", doc.id)
      .eq("path", doc.path)
      .select("id"),
  );
  if (removed.length !== 1)
    throw new Error(
      "Document was not deleted. Refresh the list or apply the Supabase deletion setup.",
    );
  // Keeping the file until the row is removed prevents a failed row deletion
  // from leaving a document card pointing at a missing file.
  try {
    await cleanupDocumentFile(doc.path);
    return {};
  } catch (error) {
    return { cleanupError: error.message };
  }
}

export async function downloadDocument(path) {
  const file = decode(await bucket.download(path));
  if (!file) throw new Error("Document content is unavailable.");
  return file;
}
export async function uploadDocuments(files, title) {
  // Validate the entire batch before the first upload.
  const prepared = [];
  for (const file of files) {
    const extension = file.name.split(".").pop().toLowerCase();
    const kind = {
      md: "md",
      markdown: "md",
      pdf: "pdf",
      html: "html",
      htm: "html",
    }[extension];
    if (!kind || !file.size || file.size > 10485760)
      throw new Error("Choose HTML, Markdown or PDF files up to 10 MB each.");
    if (kind === "pdf" && !(await file.slice(0, 5).text()).startsWith("%PDF-"))
      throw new Error("The PDF file is invalid.");
    const id = crypto.randomUUID();
    prepared.push({
      file,
      doc: {
        id,
        title: (
          (files.length === 1 && title.trim()) ||
          file.name.replace(/\.[^.]+$/, "") ||
          file.name
        ).slice(0, 160),
        path: `shared/${id}.${kind}`,
        kind,
        file_name: file.name,
        created_at: new Date().toISOString(),
      },
      type: { pdf: "application/pdf", md: "text/markdown", html: "text/html" }[
        kind
      ],
    });
  }
  if (!prepared.length) throw new Error("Choose at least one document.");
  let uploaded = 0;
  try {
    for (const { file, doc, type } of prepared) {
      decode(
        await bucket.upload(doc.path, file, {
          contentType: type,
          upsert: false,
        }),
      );
      const result = await client.from("edge_docs").insert(doc);
      if (result.error) {
        await bucket.remove([doc.path]);
        decode(result);
      }
      uploaded++;
    }
  } catch (error) {
    if (!uploaded) throw error;
    return { uploaded, error: error.message };
  }
  return { uploaded };
}
