import { Link } from "react-router-dom";
import { StatusBadge } from "../ui/StatusBadge";
import type { EmailJob } from "../../types/email";
import { formatDateTime } from "../../utils/date";

type EmailPreviewListProps = {
  title: string;
  jobs: EmailJob[];
  viewAllTo: string;
  dateField: "scheduledAt" | "sentAt";
};

export function EmailPreviewList({ title, jobs, viewAllTo, dateField }: EmailPreviewListProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <Link to={viewAllTo} className="text-sm font-medium text-cyan-700 hover:text-cyan-800">
          View all
        </Link>
      </div>
      {jobs.length === 0 ? (
        <div className="px-5 py-8 text-sm text-slate-500">No records yet.</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {jobs.slice(0, 5).map((job) => (
            <li key={job.id} className="px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-950">{job.subject}</p>
                  <p className="mt-1 truncate text-sm text-slate-500">{job.recipient}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-slate-500">{formatDateTime(job[dateField])}</span>
                  <StatusBadge status={job.status} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
