import { StatusBadge } from "../ui/StatusBadge";
import type { EmailJob } from "../../types/email";
import { formatDateTime } from "../../utils/date";

type EmailJobsTableProps = {
  jobs: EmailJob[];
  type: "scheduled" | "sent";
  onSelectJob: (job: EmailJob) => void;
};

export function EmailJobsTable({ jobs, type, onSelectJob }: EmailJobsTableProps) {
  const dateLabel = type === "scheduled" ? "Scheduled time" : "Sent time";

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recipient
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Subject
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {dateLabel}
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {jobs.map((job) => (
              <tr
                key={job.id}
                onClick={() => onSelectJob(job)}
                className="cursor-pointer transition hover:bg-slate-50"
              >
                <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                  {job.recipient}
                </td>
                <td className="max-w-md truncate px-5 py-4 text-sm font-medium text-slate-950">
                  {job.subject}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                  {formatDateTime(type === "scheduled" ? job.scheduledAt : job.sentAt)}
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <StatusBadge status={job.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-slate-100 md:hidden">
        {jobs.map((job) => (
          <li
            key={job.id}
            onClick={() => onSelectJob(job)}
            className="cursor-pointer space-y-3 p-4 transition hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{job.subject}</p>
                <p className="mt-1 truncate text-sm text-slate-600">{job.recipient}</p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {dateLabel}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {formatDateTime(type === "scheduled" ? job.scheduledAt : job.sentAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
