import { useEffect, useState } from "react";
import {
  Clock3,
  ArrowRight,
  GripVertical,
  Flag,
  CalendarDays,
} from "lucide-react";
import { displayDate } from "../model";
import { downloadReport, filterBySchedule, reportRange } from "../reports";
import ReportFilters from "./ReportFilters";
import { scheduleDay, scheduleTime } from "../schedule";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  STATUSES,
  displayDue,
  filterTasks,
  initials,
  memberName,
} from "../model";

export function Person({ members, email }) {
  const name = memberName(members, email);
  return (
    <span className="person">
      {email && (
        <span className="avatar" aria-hidden="true">
          {initials(name)}
        </span>
      )}
      <span className="truncated">{name}</span>
    </span>
  );
}

function CardContent({ task, members }) {
  return (
    <>
      <div className="task-eyebrow">
        <span className="task-scope">{task.scope}</span>
      </div>
      <h3>{task.title}</h3>
      <div className="task-badges">
        <span
          className={`task-priority priority-${task.priority.toLowerCase()}`}
        >
          <Flag size={11} aria-hidden="true" />
          {task.priority}
        </span>
        {task.due_date && (
          <span className="task-due">
            <CalendarDays size={11} aria-hidden="true" />
            Due {displayDue(task.due_date)}
          </span>
        )}
      </div>
      {task.starts_at && task.ends_at ? (
        <div className="task-schedule">
          <div>
            <span>
              <Clock3 size={11} aria-hidden="true" />
              Starts
            </span>
            <strong>{scheduleTime(task.starts_at)}</strong>
            <small>{scheduleDay(task.starts_at)}</small>
          </div>
          <ArrowRight size={14} aria-hidden="true" />
          <div>
            <span>Ends</span>
            <strong>{scheduleTime(task.ends_at)}</strong>
            <small>{scheduleDay(task.ends_at)}</small>
          </div>
        </div>
      ) : (
        <p className="task-unscheduled">
          <Clock3 size={13} aria-hidden="true" />
          No time set
        </p>
      )}
      <div className="task-foot">
        <Person members={members} email={task.assignee_email} />
        <span className="task-open">
          Details <ArrowRight size={12} aria-hidden="true" />
        </span>
      </div>
      {task.created_at && (
        <div className="task-created">
          Created{" "}
          <time dateTime={task.created_at}>
            {displayDate(task.created_at)} IST
          </time>
        </div>
      )}
    </>
  );
}

function TaskCard({ task, members, onMove, pending }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: pending,
  });
  return (
    <article
      ref={setNodeRef}
      className={`task status-${task.status.toLowerCase().replaceAll(" ", "-")} ${isDragging ? "is-dragging" : ""}`}
    >
      <a
        className="task-link"
        draggable={false}
        href={`#task/${encodeURIComponent(task.id)}`}
      >
        <CardContent task={task} members={members} />
      </a>
      <button
        type="button"
        className="drag-handle"
        {...attributes}
        {...listeners}
        aria-label={`Move ${task.title}`}
        title="Drag to another column"
        disabled={pending}
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>
      {task.status === "To Do" && (
        <button
          className="btn start-task"
          type="button"
          disabled={pending}
          onClick={() => onMove(task.id, "In Progress")}
        >
          Start task
        </button>
      )}
    </article>
  );
}

function Lane({ status, tasks, members, onMove, pending }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={`lane ${isOver ? "drop-target" : ""}`}
      data-status={status}
    >
      <header className="lane-head">
        <span className="dot" aria-hidden="true" />
        <h2>{status}</h2>
        <span className="count" aria-label={`${tasks.length} tasks`}>
          {tasks.length}
        </span>
        <a
          className="btn add"
          href={`#new/${STATUSES.indexOf(status)}`}
          aria-label={`Add task to ${status}`}
        >
          +
        </a>
      </header>
      {tasks.length ? (
        tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            members={members}
            onMove={onMove}
            pending={pending.has(task.id)}
          />
        ))
      ) : (
        <p className="empty">No tasks</p>
      )}
    </section>
  );
}

export default function Board({
  tasks,
  members,
  filter,
  setFilter,
  onMove,
  pending,
  refresh,
  refreshing,
  onMembers,
  reportSelection,
  setReportSelection,
}) {
  const [activeId, setActiveId] = useState(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 60000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const range = reportRange(reportSelection, now);
  const filtered = filterBySchedule(filterTasks(tasks, members, filter), range);
  const active = tasks.find((task) => task.id === activeId);
  return (
    <>
      <header className="heading">
        <h1>Tasks</h1>
        <div className="actions">
          <button className="btn" onClick={onMembers}>
            Members
          </button>
          <a className="btn primary" href="#new/0">
            + New task
          </a>
        </div>
      </header>
      <div className="toolbar">
        <input
          className="field"
          type="search"
          aria-label="Search tasks"
          placeholder="Search tasks"
          value={filter.search}
          onChange={(event) =>
            setFilter((current) => ({ ...current, search: event.target.value }))
          }
        />
        <select
          className="field assignee-filter"
          aria-label="Filter by assignee"
          value={filter.assignee}
          onChange={(event) =>
            setFilter((current) => ({
              ...current,
              assignee: event.target.value,
            }))
          }
        >
          <option value="">All assignees</option>
          {members.map((member) => (
            <option key={member.email} value={member.email}>
              {member.name}
            </option>
          ))}
          <option value="unassigned">Unassigned</option>
        </select>
        <button className="btn push" disabled={refreshing} onClick={refresh}>
          Refresh
        </button>
      </div>
      <ReportFilters
        selection={reportSelection}
        setSelection={setReportSelection}
        range={range}
        tasks={filtered}
        loading={refreshing}
        onDownload={() =>
          downloadReport(filtered, members, reportSelection, now)
        }
      />
      {!filtered.length && tasks.length > 0 && (
        <div className="board-empty">
          <CalendarDays size={22} aria-hidden="true" />
          <div>
            <strong>No issues match this view</strong>
            <p>Use All time to see existing issues and set their schedule.</p>
          </div>
          <button
            className="btn"
            onClick={() => {
              setFilter({ search: "", assignee: "" });
              setReportSelection((current) => ({ ...current, preset: "all" }));
            }}
          >
            Show all issues
          </button>
        </div>
      )}
      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={({ active, over }) => {
          setActiveId(null);
          if (over && STATUSES.includes(over.id)) onMove(active.id, over.id);
        }}
      >
        <div id="board" className="board">
          {STATUSES.map((status) => (
            <Lane
              key={status}
              status={status}
              tasks={filtered.filter((task) => task.status === status)}
              members={members}
              onMove={onMove}
              pending={pending}
            />
          ))}
        </div>
        <DragOverlay>
          {active && (
            <article className="task drag-preview">
              <CardContent task={active} members={members} />
            </article>
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}
