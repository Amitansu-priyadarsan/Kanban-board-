import { useCallback, useEffect, useRef, useState } from "react";
import { loadWorkspace } from "./api";

export function useHashRoute() {
  const read = () => location.hash.slice(1) || "tasks";
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const go = useCallback((hash) => {
    history.pushState(null, "", `#${hash}`);
    setRoute(hash);
  }, []);
  return [route, go];
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState({
    tasks: [],
    members: [],
    docs: [],
  });
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const version = useRef(0);
  const invalidateRead = useCallback(() => {
    version.current++;
  }, []);
  const refresh = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    try {
      const next = await loadWorkspace();
      if (current !== version.current) return;
      setWorkspace(next);
      setError("");
      setReady(true);
    } catch (err) {
      if (current === version.current) setError(err.message);
      throw err;
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh().catch(() => {});
    return invalidateRead;
  }, [refresh, invalidateRead]);
  const applyTask = useCallback((task) => {
    // A read started before this save must never overwrite the saved revision.
    version.current++;
    setLoading(false);
    setWorkspace((current) => ({
      ...current,
      tasks: task.archived_at
        ? current.tasks.filter((item) => item.id !== task.id)
        : current.tasks.some((item) => item.id === task.id)
          ? current.tasks.map((item) => (item.id === task.id ? task : item))
          : [...current.tasks, task],
    }));
  }, []);
  const removeDocument = useCallback((id) => {
    version.current++;
    setLoading(false);
    setWorkspace((current) => ({
      ...current,
      docs: current.docs.filter((doc) => doc.id !== id),
    }));
  }, []);
  const removeMember = useCallback((email) => {
    version.current++;
    setLoading(false);
    setWorkspace((current) => ({
      ...current,
      members: current.members.filter((member) => member.email !== email),
      tasks: current.tasks.map((task) =>
        task.assignee_email === email
          ? { ...task, assignee_email: null }
          : task,
      ),
    }));
  }, []);
  return {
    ...workspace,
    loading,
    ready,
    error,
    refresh,
    applyTask,
    removeDocument,
    removeMember,
  };
}
