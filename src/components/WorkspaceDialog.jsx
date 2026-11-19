import { useEffect, useRef } from "react";

export default function WorkspaceDialog({
  type,
  members,
  busy,
  onClose,
  onMember,
  onUpload,
  onDeleteMember,
}) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  const submit = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (type === "members")
      onMember(String(data.get("name") || ""), () => form.reset());
    else onUpload(data.getAll("file"), String(data.get("title") || ""));
  };
  return (
    <dialog ref={ref} onCancel={onClose} aria-labelledby="dialog-title">
      <div className="dialog-head">
        <h2 id="dialog-title">
          {type === "members" ? "Members" : "Upload document"}
        </h2>
        <button
          className="btn"
          onClick={onClose}
          aria-label="Close dialog"
          disabled={busy}
        >
          Close
        </button>
      </div>
      {type === "members" ? (
        <>
          <ul className="member-list">
            {members.map((member) => (
              <li key={member.email}>
                <strong>{member.name}</strong>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={() => onDeleteMember(member)}
                  aria-label={`Delete ${member.name}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <form className="stack" onSubmit={submit}>
            <label>
              Name
              <input className="field" name="name" required maxLength={100} />
            </label>
            <button className="btn primary" disabled={busy}>
              {busy ? "Adding…" : "Add member"}
            </button>
          </form>
        </>
      ) : (
        <form className="stack" onSubmit={submit}>
          <label>
            Title
            <input
              className="field"
              name="title"
              maxLength={160}
              placeholder="Use the file name"
            />
          </label>
          <label>
            Files
            <input
              name="file"
              className="field"
              type="file"
              required
              accept=".html,.htm,.md,.markdown,.pdf"
              multiple
            />
          </label>
          <p className="hint">HTML, Markdown or PDF. Up to 10 MB per file.</p>
          <button className="btn primary" disabled={busy}>
            {busy ? "Uploading…" : "Upload"}
          </button>
        </form>
      )}
    </dialog>
  );
}
