import { StatusBadge } from "../ui/StatusBadge";
import type { EmailJob } from "../../types/email";
import { formatRelativeActivity } from "../../utils/date";

export function RecentActivity({ jobs }: { jobs: EmailJob[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-950">Recent activity</h2>
      </div>
      {jobs.length === 0 ? (
        <div className="px-5 py-8 text-sm text-slate-500">Activity will appear after emails are scheduled.</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {jobs.map((job) => (
            <li key={job.id} className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-950">{job.subject}</p>
                <p className="mt-1 truncate text-sm text-slate-500">{job.recipient}</p>
              </div>
              <div className="shrink-0 text-right">
                <StatusBadge status={job.status} />
                <p className="mt-2 text-xs text-slate-500">{formatRelativeActivity(job.updatedAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
