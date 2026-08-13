import type { EmailStatus } from "../../types/email";

const statusClasses: Record<EmailStatus, string> = {
  scheduled: "bg-sky-50 text-sky-700 ring-sky-200",
  queued: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  processing: "bg-amber-50 text-amber-700 ring-amber-200",
  sent: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-red-50 text-red-700 ring-red-200"
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${statusClasses[status]}`}
    >
      {status}
    </span>
  );
}
