import {
  REPORT_PRESETS,
  customRangeDefaults,
  validReportRange,
} from "../reports";
import { STATUSES } from "../model";

export default function ReportFilters({
  selection,
  setSelection,
  range,
  tasks,
  onDownload,
  loading,
}) {
  const valid = validReportRange(range);
  return (
    <section className="report-controls" aria-label="Issue report">
      <div className="report-toolbar">
        <div className="period-tabs" role="group" aria-label="Report period">
          {REPORT_PRESETS.map(([preset, label]) => (
            <button
              key={preset}
              className="btn"
              aria-pressed={selection.preset === preset}
              onClick={() =>
                setSelection((current) => ({
                  ...customRangeDefaults(),
                  ...current,
                  preset,
                  ...(preset === "custom" && (!current.from || !current.to)
                    ? customRangeDefaults()
                    : {}),
                }))
              }
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="btn"
          disabled={!valid || !tasks.length || loading}
          onClick={onDownload}
        >
          Download report (CSV)
        </button>
      </div>
      {selection.preset === "custom" && (
        <div className="report-dates">
          <label>
            From
            <input
              className="field"
              type="date"
              value={selection.from || ""}
              max={selection.to || undefined}
              onChange={(event) =>
                setSelection((current) => ({
                  ...current,
                  from: event.target.value,
                }))
              }
            />
          </label>
          <label>
            To
            <input
              className="field"
              type="date"
              value={selection.to || ""}
              min={selection.from || undefined}
              onChange={(event) =>
                setSelection((current) => ({
                  ...current,
                  to: event.target.value,
                }))
              }
            />
          </label>
        </div>
      )}
      {!valid && (
        <p role="alert">
          Choose both dates, with the start date on or before the end date.
        </p>
      )}
      <p className="hint">
        Current board · Scheduled time · IST
        {range && valid ? ` · ${range.from} to ${range.to}` : ""}
        {selection.preset === "all"
          ? " · Includes unscheduled issues"
          : " · Find unscheduled issues under All time"}
      </p>
      <div className="report-summary" aria-label="Report summary">
        <strong>{tasks.length} issues</strong>
        {STATUSES.map((status) => (
          <span key={status}>
            {status}:{" "}
            <strong>
              {tasks.filter((task) => task.status === status).length}
            </strong>
          </span>
        ))}
      </div>
    </section>
  );
}
