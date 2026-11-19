import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "./api";
import { useHashRoute, useWorkspace } from "./hooks";
import { BUILTIN_DOC, STATUSES } from "./model";
import Board from "./components/Board";
import TaskEditor from "./components/TaskEditor";
import { Documents, DocumentViewer } from "./components/Documents";
import WorkspaceDialog from "./components/WorkspaceDialog";

export default function App() {
  const [route, go] = useHashRoute();
  const [page, encodedId] = route.split("/");
  const id = decodeId(encodedId);
  const workspace = useWorkspace();
  const {
    tasks,
    members,
    docs,
    ready,
    error,
    loading,
    refresh,
    applyTask,
    removeDocument,
    removeMember,
  } = workspace;
  const [filter, setFilter] = useState({ search: "", assignee: "" });
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(new Set());
  const pendingRef = useRef(new Set());
  const mutationRef = useRef(false);
  const [notice, setNotice] = useState(null);
  const [cleanupQueue, setCleanupQueue] = useState([]);
  const noticeTimer = useRef();
  const [menuOpen, setMenuOpen] = useState(false);
  const main = useRef(null);
  const inform = useCallback((message, isError = false) => {
    clearTimeout(noticeTimer.current);
    setNotice({ message, error: isError });
    noticeTimer.current = setTimeout(
      () => setNotice(null),
      isError ? 9000 : 3200,
    );
  }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  useEffect(() => {
    setMenuOpen(false);
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [route]);

  const run = async (action) => {
    if (mutationRef.current) return;
    mutationRef.current = true;
    setBusy(true);
    try {
      await action();
    } catch (err) {
      inform(err.message, true);
    } finally {
      mutationRef.current = false;
      setBusy(false);
    }
  };
  const refreshBoard = async () => {
    try {
      await refresh();
    } catch (err) {
      inform(err.message, true);
    }
  };
  const refreshAfterSave = async () => {
    try {
      await refresh();
    } catch (err) {
      inform(`Saved. Board refresh failed: ${err.message}`, true);
    }
  };
  const saveTask = (payload, task) =>
    run(async () => {
      const saved = task
        ? await api.updateTask(task.id, task.revision, payload)
        : await api.createTask(payload);
      applyTask(saved);
      if (!task) setFilter({ search: "", assignee: "" });
      go("tasks");
      inform("Task saved.");
      await refreshAfterSave();
    });
  const moveTask = async (taskId, status) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === status || pendingRef.current.has(taskId))
      return;
    pendingRef.current.add(taskId);
    setPending(new Set(pendingRef.current));
    try {
      applyTask(await api.updateTask(task.id, task.revision, { status }));
      inform(`Moved to ${status}.`);
    } catch (err) {
      inform(err.message, true);
    } finally {
      pendingRef.current.delete(taskId);
      setPending(new Set(pendingRef.current));
    }
  };
  const archiveTask = (task) => {
    if (
      !window.confirm(
        "Archive this task? It will leave the board and its history will be retained.",
      )
    )
      return;
    return run(async () => {
      applyTask(
        await api.updateTask(task.id, task.revision, {
          archived_at: new Date().toISOString(),
        }),
      );
      go("tasks");
      inform("Task archived.");
      await refreshAfterSave();
    });
  };
  const addMember = (name, reset) =>
    run(async () => {
      await api.addMember(name);
      reset();
      inform("Member added.");
      await refreshAfterSave();
    });
  const upload = (files, title) =>
    run(async () => {
      const result = await api.uploadDocuments(files, title);
      setDialog(null);
      inform(
        result.error
          ? `${result.uploaded} uploaded. Remaining files stopped: ${result.error}`
          : result.uploaded === 1
            ? "Document uploaded."
            : `${result.uploaded} documents uploaded.`,
        Boolean(result.error),
      );
      await refreshAfterSave();
    });

  const deleteMember = (member) => {
    if (
      !window.confirm(
        `Delete ${member.name}? Their tasks will become unassigned. Task history will be kept.`,
      )
    )
      return;
    return run(async () => {
      await api.deleteMember(member.email);
      removeMember(member.email);
      setFilter((current) =>
        current.assignee === member.email
          ? { ...current, assignee: "" }
          : current,
      );
      inform("Member deleted. Their tasks are now unassigned.");
      await refreshAfterSave();
    });
  };
  const deleteDocument = (doc) => {
    if (
      !window.confirm(
        `Delete “${doc.title}” and its uploaded file? This cannot be undone.`,
      )
    )
      return;
    return run(async () => {
      const result = await api.deleteDocument(doc);
      removeDocument(doc.id);
      if (page === "doc") go("docs");
      if (result.cleanupError) {
        setCleanupQueue((current) => [
          ...current.filter((item) => item.id !== doc.id),
          doc,
        ]);
        inform(
          `Document removed. File cleanup failed: ${result.cleanupError}`,
          true,
        );
      } else inform("Document and uploaded file deleted.");
      await refreshAfterSave();
    });
  };
  const retryCleanup = (doc) =>
    run(async () => {
      await api.cleanupDocumentFile(doc.path);
      setCleanupQueue((current) =>
        current.filter((item) => item.id !== doc.id),
      );
      inform("Uploaded file deleted.");
    });

  const documentOpen = ready && page === "doc";
  const task = tasks.find((item) => item.id === id);
  const doc = [BUILTIN_DOC, ...docs].find((item) => item.id === id);
  let content;
  if (!ready && loading) content = <p>Loading workspace…</p>;
  else if (!ready && error)
    content = (
      <section className="panel">
        <h2>Workspace unavailable</h2>
        <p role="alert">{error}</p>
        <button className="btn" onClick={refreshBoard}>
          Retry
        </button>
      </section>
    );
  else if (page === "docs")
    content = (
      <Documents
        docs={docs}
        onUpload={() => setDialog("upload")}
        onDelete={deleteDocument}
        busy={busy}
      />
    );
  else if (page === "new" || (page === "task" && task))
    content = (
      <TaskEditor
        key={page === "new" ? route : task.id}
        task={page === "task" ? task : null}
        status={STATUSES[Number(id)]}
        members={members}
        onSave={saveTask}
        onArchive={archiveTask}
        busy={busy}
        inform={inform}
      />
    );
  else if (page === "task")
    content = (
      <>
        <a href="#tasks" className="back">
          Back to Tasks
        </a>
        <h1>Task unavailable</h1>
      </>
    );
  else if (page === "doc")
    content = doc ? (
      <DocumentViewer doc={doc} onDelete={deleteDocument} busy={busy} />
    ) : (
      <>
        <a href="#docs" className="back">
          Back to Docs
        </a>
        <h1>Document unavailable</h1>
      </>
    );
  else
    content = (
      <Board
        tasks={tasks}
        members={members}
        filter={filter}
        setFilter={setFilter}
        onMove={moveTask}
        pending={pending}
        refresh={refreshBoard}
        refreshing={loading}
        onMembers={() => setDialog("members")}
      />
    );

  return (
    <>
      <div className={`workspace ${documentOpen ? "document-open" : ""}`}>
        <aside className="sidebar" aria-label="Workspace sidebar">
          <a className="brand" href="#tasks">
            <span className="mark" aria-hidden="true">
              G
            </span>
            GNB Edge
          </a>
          <button
            className="btn menu-toggle"
            type="button"
            aria-controls="workspace-nav"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
          </button>
          <nav
            id="workspace-nav"
            aria-label="Workspace"
            data-open={menuOpen ? "" : undefined}
          >
            <a
              href="#tasks"
              aria-current={
                !["docs", "doc"].includes(page) ? "page" : undefined
              }
            >
              Tasks
            </a>
            <a
              href="#docs"
              aria-current={["docs", "doc"].includes(page) ? "page" : undefined}
            >
              Docs
            </a>
          </nav>
          <div className="account">
            {!ready ? (error ? "Unavailable" : "Connecting…") : "Shared board"}
          </div>
        </aside>
        <main
          ref={main}
          tabIndex={-1}
          className={
            documentOpen ? "doc-view" : page === "docs" ? "docs-list-view" : ""
          }
        >
          {content}
          {cleanupQueue.length > 0 && (
            <section
              className="panel cleanup-notice"
              aria-label="Pending file cleanup"
            >
              <p>
                These documents were removed, but their uploaded files still
                need cleanup.
              </p>
              {cleanupQueue.map((doc) => (
                <div key={doc.id}>
                  <span>{doc.title}</span>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => retryCleanup(doc)}
                  >
                    Retry file cleanup
                  </button>
                </div>
              ))}
            </section>
          )}
        </main>
      </div>
      <div
        id="notice"
        role="status"
        aria-live="polite"
        className={notice?.error ? "error" : ""}
      >
        {notice?.message}
      </div>
      {dialog && (
        <WorkspaceDialog
          key={dialog}
          type={dialog}
          members={members}
          busy={busy}
          onClose={() => setDialog(null)}
          onMember={addMember}
          onUpload={upload}
          onDeleteMember={deleteMember}
        />
      )}
    </>
  );
}

function decodeId(value) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return "";
  }
}
