import { useEffect, useState } from "react";
import { getHistory } from "../api";
import TaskPhotos from "./TaskPhotos";
import { PHOTO_ACCEPT, PHOTO_HINT } from "../photos";
import { defaultSchedule, toScheduleInput } from "../schedule";
import {
  FIELD_LABELS,
  PRIORITIES,
  STATUSES,
  displayDate,
  memberName,
  safeUrl,
  taskPayload,
} from "../model";

function Field({ label, name, value, ...props }) {
  return (
    <label>
      {label}
      <input
        className="field"
        name={name}
        defaultValue={value || ""}
        {...props}
      />
    </label>
  );
}
function Choice({ label, name, value, values }) {
  return (
    <label>
      {label}
      <select className="field" name={name} defaultValue={value}>
        {values.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}
function TaskHistory({ task, members }) {
  const [result, setResult] = useState({ loading: true });
  useEffect(() => {
    let active = true;
    getHistory(task.id)
      .then((items) => {
        if (active) setResult({ items });
      })
      .catch((error) => {
        if (active) setResult({ error: error.message });
      });
    return () => {
      active = false;
    };
  }, [task.id, task.revision]);
  if (result.loading) return <p className="hint">Loading history…</p>;
  if (result.error) return <p role="alert">{result.error}</p>;
  const describe = (field, value) =>
    field === "assignee_email" ? memberName(members, value) : value || "Empty";
  return result.items.length ? (
    <ol className="history">
      {result.items.map((item) => (
        <li key={item.id}>
          <strong>
            {item.field === "created"
              ? "Task created"
              : `${FIELD_LABELS[item.field] || item.field} · ${describe(item.field, item.old_value)} → ${describe(item.field, item.new_value)}`}
          </strong>
          <br />
          <time dateTime={item.created_at}>
            {displayDate(item.created_at)}
          </time>{" "}
          · {item.actor ? memberName(members, item.actor) : "Anonymous edit"}
        </li>
      ))}
    </ol>
  ) : (
    <p className="hint">No changes recorded.</p>
  );
}

export default function TaskEditor({
  task,
  status,
  members,
  onSave,
  onArchive,
  busy,
  inform,
}) {
  const value = task || {
    status: status || "To Do",
    priority: "Normal",
    scope: "Shared",
  };
  const [initialSchedule] = useState(defaultSchedule);
  const submit = (event) => {
    event.preventDefault();
    try {
      const files = Array.from(
        event.currentTarget.elements.namedItem("photos")?.files || [],
      ).filter((file) => file.size);
      onSave(taskPayload(event.currentTarget), task, files);
    } catch (error) {
      inform(error.message, true);
    }
  };
  const link = (url, label) =>
    safeUrl(url) ? (
      <a href={safeUrl(url)} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    ) : (
      <span className="hint">{label} not added</span>
    );
  return (
    <>
      <a href="#tasks" className="back">
        Back to Tasks
      </a>
      <header className="heading">
        <h1>{task ? task.title : "New task"}</h1>
      </header>
      <div className="ticket-grid">
        <div className="stack">
          <form className="panel" onSubmit={submit} aria-label="Task details">
            <h2>Task details</h2>
            <div className="form-grid">
              <div className="full">
                <Field
                  label="Title"
                  name="title"
                  value={value.title}
                  required
                  maxLength={160}
                />
              </div>
              <Field
                label="App view / scope"
                name="scope"
                value={value.scope}
                required
                maxLength={100}
              />
              <Choice
                label="Priority"
                name="priority"
                values={PRIORITIES}
                value={value.priority}
              />
              <Choice
                label="Status"
                name="status"
                values={STATUSES}
                value={value.status}
              />
              <label>
                Assignee
                <select
                  name="assignee_email"
                  className="field"
                  defaultValue={value.assignee_email || ""}
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.email} value={member.email}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Due date"
                name="due_date"
                value={value.due_date}
                type="date"
              />
              <div />
              <Field
                label="Start date and time (IST)"
                name="starts_at"
                value={
                  task
                    ? toScheduleInput(task.starts_at)
                    : initialSchedule.starts_at
                }
                type="datetime-local"
              />
              <Field
                label="End date and time (IST)"
                name="ends_at"
                value={
                  task ? toScheduleInput(task.ends_at) : initialSchedule.ends_at
                }
                type="datetime-local"
              />
              <p className="full hint">
                Today shows issues scheduled for that day. Clear both times to
                leave an issue unscheduled.
              </p>
              <Field
                label="Backend URL"
                name="backend_url"
                value={value.backend_url}
                type="url"
                placeholder="https://…"
              />
              <Field
                label="Frontend URL"
                name="frontend_url"
                value={value.frontend_url}
                type="url"
                placeholder="https://…"
              />
              <label className="full">
                Work details
                <textarea
                  className="field"
                  name="description"
                  defaultValue={value.description || ""}
                />
              </label>
              {!task && (
                <label className="full">
                  Photos (optional)
                  <input
                    className="field"
                    type="file"
                    name="photos"
                    accept={PHOTO_ACCEPT}
                    multiple
                  />
                  <span className="hint">{PHOTO_HINT}</span>
                </label>
              )}
              <label className="full">
                Done when
                <textarea
                  className="field"
                  name="acceptance"
                  defaultValue={value.acceptance || ""}
                />
              </label>
            </div>
            <div className="form-foot">
              {task && (
                <button
                  type="button"
                  className="btn archive-task"
                  disabled={busy}
                  onClick={() => onArchive(task)}
                >
                  Archive task
                </button>
              )}
              <a className="btn" href="#tasks">
                Back to board
              </a>
              <button className="btn primary" disabled={busy}>
                {busy ? "Saving…" : task ? "Save changes" : "Create task"}
              </button>
            </div>
          </form>
          {task && (
            <TaskPhotos
              key={task.id}
              taskId={task.id}
              parentBusy={busy}
              inform={inform}
            />
          )}
        </div>
        <aside className="stack">
          {task && (
            <section className="panel issue-timestamps">
              <h2>Issue timeline</h2>
              <dl>
                <div>
                  <dt>Created</dt>
                  <dd>
                    {displayDate(task.created_at) || "Not recorded"}
                    {task.created_at ? " IST" : ""}
                  </dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>
                    {displayDate(task.updated_at) || "Not recorded"}
                    {task.updated_at ? " IST" : ""}
                  </dd>
                </div>
              </dl>
            </section>
          )}
          <section className="panel">
            <h2>Links</h2>
            <div className="link-list">
              {link(value.backend_url, "Backend")}
              {link(value.frontend_url, "Frontend")}
            </div>
          </section>
          <section className="panel">
            <h2>History</h2>
            {task ? (
              <TaskHistory task={task} members={members} />
            ) : (
              <p className="hint">History starts after this task is created.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
