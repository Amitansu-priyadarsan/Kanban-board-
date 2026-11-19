export function toScheduleInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  // datetime-local has no zone. The form explicitly labels these values IST.
  return new Date(date.getTime() + 330 * 60000).toISOString().slice(0, 16);
}
export function defaultSchedule(now = new Date()) {
  const start = new Date(Math.floor(new Date(now).getTime() / 60000) * 60000);
  return {
    starts_at: toScheduleInput(start),
    ends_at: toScheduleInput(new Date(start.getTime() + 3600000)),
  };
}
export function parseSchedule(start, end) {
  if (!start && !end) return { starts_at: null, ends_at: null };
  if (!start || !end)
    throw new Error(
      "Choose both a start and an end time, or clear both to leave the issue unscheduled.",
    );
  const from = new Date(`${start}+05:30`);
  const to = new Date(`${end}+05:30`);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    to <= from
  )
    throw new Error("The end time must be after the start time.");
  return { starts_at: from.toISOString(), ends_at: to.toISOString() };
}
export function scheduleTime(value) {
  return value
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "";
}
export function scheduleDay(value) {
  return value
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
      }).format(new Date(value))
    : "";
}
