import { parseSchedule } from "./schedule";

export const STATUSES = ["To Do", "In Progress", "In Review", "Done"];
export const PRIORITIES = ["High", "Normal", "Low"];
export const FIELDS = [
  "title",
  "scope",
  "priority",
  "status",
  "description",
  "acceptance",
  "assignee_email",
  "backend_url",
  "frontend_url",
  "due_date",
];
export const FIELD_LABELS = {
  title: "Title",
  scope: "App view",
  priority: "Priority",
  status: "Status",
  description: "Work details",
  acceptance: "Done when",
  assignee_email: "Assignee",
  backend_url: "Backend URL",
  frontend_url: "Frontend URL",
  due_date: "Due date",
  archived_at: "Archived",
  created: "Created",
  starts_at: "Start time",
  ends_at: "End time",
};
export const BUILTIN_DOC = {
  id: "release",
  title: "22 Nov Driver App Release",
  kind: "html",
  file_name: "Release handoff",
  builtin: true,
};
export const memberName = (members, email) =>
  members.find((member) => member.email === email)?.name ||
  email ||
  "Unassigned";
export const initials = (value) =>
  String(value)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
export const displayDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }).format(new Date(value))
    : "";
export const displayDue = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(value))
    : "";

export function safeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}

export function taskPayload(form) {
  const data = new FormData(form);
  const payload = Object.fromEntries(
    FIELDS.map((name) => [name, String(data.get(name) || "").trim()]),
  );
  if (!payload.title || !payload.scope)
    throw new Error("Enter a title and app view.");
  for (const name of ["backend_url", "frontend_url"]) {
    if (payload[name] && !safeUrl(payload[name]))
      throw new Error("Use an HTTP or HTTPS URL without embedded credentials.");
    payload[name] = safeUrl(payload[name]) || null;
  }
  for (const name of ["assignee_email", "due_date"]) payload[name] ||= null;
  return {
    ...payload,
    ...parseSchedule(
      String(data.get("starts_at") || ""),
      String(data.get("ends_at") || ""),
    ),
  };
}

export function filterTasks(tasks, members, { search, assignee }) {
  const term = search.trim().toLowerCase();
  return tasks.filter(
    (task) =>
      (!assignee ||
        (assignee === "unassigned"
          ? !task.assignee_email
          : task.assignee_email === assignee)) &&
      (!term ||
        [task.title, task.scope, memberName(members, task.assignee_email)].some(
          (value) =>
            String(value || "")
              .toLowerCase()
              .includes(term),
        )),
  );
}
