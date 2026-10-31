import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  PriorityDot,
  SelectField,
  Segmented,
  SkeletonTable,
  StatusChip,
  Toast,
} from "@/components/staff/ui";
import { NewTaskDialog } from "@/components/staff/dialogs";
import { useApi, useUrlState } from "@/hooks/useApi";
import {
  count,
  daysUntil,
  errorText,
  fmtDate,
  staffGet,
  staffPost,
  type Paged,
  type StaffProfile,
  type StaffTask,
} from "@/lib/practice";

const SIZE = 25;

export default function StaffTasks() {
  const { get, set, page, setPage } = useUrlState({ assignee: "me", status: "open" });
  const assignee = get("assignee") || "me";
  const status = get("status") || "open";
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState("");
  const [actionError, setActionError] = useState("");
  const [compose, setCompose] = useState(false);

  const staff = useApi(() => staffGet<{ staff: StaffProfile[] }>("/staff"), []);

  const list = useApi(
    () =>
      staffGet<Paged<StaffTask>>("/tasks", {
        assignee,
        status: status === "all" ? undefined : status,
        page,
        size: SIZE,
      }),
    [assignee, status, page],
  );

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;

  const setTaskStatus = async (task: StaffTask, next: string) => {
    setSaving(task.id);
    setActionError("");
    try {
      await staffPost("/task-status", { id: task.id, status: next });
      setToast(next === "done" ? "Task marked done." : `Task moved to ${next}.`);
      list.reload();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setSaving("");
    }
  };

  return (
    <StaffLayout title="Tasks">
      <div data-testid="staff-tasks">
        <PageHeader
          title="Tasks"
          subtitle={assignee === "me" ? "What's on your own list." : "The team's tasks."}
          actions={
            <button type="button" className="bw-btn bw-btn-primary bw-btn-sm" onClick={() => setCompose(true)}>
              <Plus size={14} aria-hidden="true" /> New task
            </button>
          }
        />

        <Toast message={toast} />
        {actionError ? <ErrorState message={actionError} compact /> : null}

        <div className="bw-list-toolbar">
          <Segmented
            label="Task status"
            value={status as "open" | "in progress" | "waiting" | "done" | "all"}
            onChange={(v) => set({ status: v === "open" ? "" : v })}
            options={[
              { value: "open", label: "Open" },
              { value: "in progress", label: "In progress" },
              { value: "waiting", label: "Waiting" },
              { value: "done", label: "Done" },
              { value: "all", label: "All" },
            ]}
          />
          <div className="bw-filter-row">
            <SelectField
              label="Assignee"
              value={assignee}
              onChange={(v) => set({ assignee: v })}
              options={[
                { value: "me", label: "My tasks" },
                ...(staff.data?.staff ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
        </div>

        <p className="bw-list-summary" data-copilot-summary>
          {list.data
            ? `${count(total)} ${total === 1 ? "task" : "tasks"}${status !== "all" ? ` ${status}` : ""}${
                assignee === "me" ? " on my list" : ""
              }`
            : "Loading tasks…"}
        </p>

        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.loading && !list.data ? (
          <SkeletonTable rows={8} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState>
            {status === "open" ? "Nothing open: your list is clear." : "No tasks with this status."}
          </EmptyState>
        ) : (
          <>
            <div className="bw-table-wrap">
              <table className="bw-table bw-table-hover">
                <thead>
                  <tr>
                    <th className="bw-col-check" aria-label="Done" />
                    <th className="bw-col-name">Task</th>
                    <th>Client</th>
                    <th>Assignee</th>
                    <th className="bw-col-date">Due</th>
                    <th>Status</th>
                    <th className="bw-col-pri">Pri</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((task) => {
                    const late = (daysUntil(task.due) ?? 0) < 0 && task.status !== "done";
                    return (
                      <tr key={task.id}>
                        <td className="bw-col-check">
                          <input
                            type="checkbox"
                            checked={task.status === "done"}
                            disabled={saving === task.id}
                            onChange={(e) => void setTaskStatus(task, e.target.checked ? "done" : "open")}
                            aria-label={`Mark “${task.title}” done`}
                          />
                        </td>
                        <td className="bw-col-name">
                          <span className={task.status === "done" ? "bw-cell-name bw-done" : "bw-cell-name"}>
                            {task.title}
                          </span>
                          {task.engagement_id ? (
                            <span className="bw-row-sub bw-mono">{task.engagement_id}</span>
                          ) : null}
                        </td>
                        <td data-label="Client">
                          {task.client_ref ? (
                            <Link to={`/staff/clients/${task.client_ref}`} className="bw-row-link">
                              {task.client_name}
                            </Link>
                          ) : (
                            <span className="bw-muted">—</span>
                          )}
                        </td>
                        <td data-label="Assignee">{task.assignee_name ?? task.assignee}</td>
                        <td className={late ? "bw-col-date bw-late" : "bw-col-date"} data-label="Due">
                          {fmtDate(task.due)}
                        </td>
                        <td data-label="Status">
                          <select
                            className="bw-inline-select"
                            value={task.status}
                            disabled={saving === task.id}
                            aria-label={`Status of “${task.title}”`}
                            onChange={(e) => void setTaskStatus(task, e.target.value)}
                          >
                            <option value="open">Open</option>
                            <option value="in progress">In progress</option>
                            <option value="waiting">Waiting</option>
                            <option value="done">Done</option>
                          </select>
                        </td>
                        <td className="bw-col-pri" data-label="Priority">
                          <PriorityDot priority={task.priority} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={list.data?.page ?? page}
              size={list.data?.size ?? SIZE}
              total={total}
              pages={list.data?.pages ?? 1}
              onPage={setPage}
            />
          </>
        )}

        {compose && (
          <NewTaskDialog
            onClose={() => setCompose(false)}
            onSaved={(m) => {
              setToast(m);
              list.reload();
            }}
          />
        )}
      </div>
    </StaffLayout>
  );
}
