import { useState } from "react";
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
      <h3>{task.title}</h3>
      <div className="tags">
        <span className="tag scope">{task.scope}</span>
        {task.priority !== "Normal" && (
          <span className={`tag ${task.priority === "High" ? "high" : ""}`}>
            {task.priority}
          </span>
        )}
      </div>
      <div className="task-foot">
        <Person members={members} email={task.assignee_email} />
        {task.due_date && (
          <time dateTime={task.due_date}>{displayDue(task.due_date)}</time>
        )}
      </div>
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
      className={`task ${isDragging ? "is-dragging" : ""}`}
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
        ⠿
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
}) {
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const filtered = filterTasks(tasks, members, filter);
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
