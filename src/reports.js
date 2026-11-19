import { displayDate, memberName } from "./model";

export const REPORT_PRESETS = [
  ["all", "All time"],
  ["today", "Today"],
  ["week", "Last 7 days"],
  ["custom", "Custom range"],
];

export function istDay(value = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function daysBefore(day, days) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
export function reportRange(selection, now = new Date()) {
  const today = istDay(now);
  if (selection.preset === "today") return { from: today, to: today };
  if (selection.preset === "week")
    return { from: daysBefore(today, 6), to: today };
  if (selection.preset === "custom")
    return { from: selection.from, to: selection.to };
  return null;
}
export function customRangeDefaults(now = new Date()) {
  const to = istDay(now);
  return { from: daysBefore(to, 6), to };
}
export function validReportRange(range) {
  return !range || Boolean(range.from && range.to && range.from <= range.to);
}
export function filterBySchedule(tasks, range) {
  if (!range) return tasks;
  if (!validReportRange(range)) return [];
  const from = new Date(`${range.from}T00:00:00+05:30`).getTime();
  const until = new Date(`${range.to}T00:00:00+05:30`).getTime() + 86400000;
  return tasks.filter((task) => {
    const start = new Date(task.starts_at).getTime();
    const end = new Date(task.ends_at).getTime();
    return (
      task.starts_at &&
      task.ends_at &&
      end > start &&
      start < until &&
      end > from
    );
  });
}
function csvCell(value) {
  let text = String(value ?? "");
  // Keep user-entered titles/notes from becoming formulas in spreadsheets.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function issuesCsv(tasks, members) {
  const rows = [
    [
      "Issue ID",
      "Title",
      "App view / scope",
      "Status",
      "Priority",
      "Assignee",
      "Starts (IST)",
      "Ends (IST)",
      "Created (IST)",
      "Updated (IST)",
      "Due date",
      "Work details",
      "Done when",
      "Backend URL",
      "Frontend URL",
    ],
  ];
  for (const task of tasks)
    rows.push([
      task.id,
      task.title,
      task.scope,
      task.status,
      task.priority,
      memberName(members, task.assignee_email),
      displayDate(task.starts_at),
      displayDate(task.ends_at),
      displayDate(task.created_at),
      displayDate(task.updated_at),
      task.due_date,
      task.description,
      task.acceptance,
      task.backend_url,
      task.frontend_url,
    ]);
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function downloadReport(tasks, members, selection, now = new Date()) {
  const range = reportRange(selection, now);
  const suffix = range ? `${range.from}_to_${range.to}` : "all-time";
  const url = URL.createObjectURL(
    new Blob([issuesCsv(tasks, members)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `gnb-edge-issues-${suffix}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
