import { Mail, Send, User, X } from "lucide-react";
import type { EmailJob } from "../../types/email";
import { StatusBadge } from "../ui/StatusBadge";
import { formatDateTime } from "../../utils/date";

type EmailJobDetailsModalProps = {
  job: EmailJob;
  onClose: () => void;
};

export function EmailJobDetailsModal({ job, onClose }: EmailJobDetailsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Email details"
    >
      <section
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-cyan-300">
              Email details
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold text-white">{job.subject}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                Sender
              </dt>
              <dd className="mt-1 text-sm text-white">
                {job.sender.name}
                <span className="block text-xs text-slate-400">{job.sender.email}</span>
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Recipient
              </dt>
              <dd className="mt-1 text-sm text-white">{job.recipient}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <StatusBadge status={job.status} />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Sent time
              </p>
              <p className="mt-0.5 text-sm text-white">{formatDateTime(job.sentAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Scheduled time
              </p>
              <p className="mt-0.5 text-sm text-white">{formatDateTime(job.scheduledAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Attempts
              </p>
              <p className="mt-0.5 text-sm text-white">{job.attempts}</p>
            </div>
          </div>

          {job.error ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <p className="font-medium">Delivery error</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{job.error}</p>
            </div>
          ) : null}

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              Email body
            </p>
            <div className="max-h-80 overflow-y-auto rounded-md border border-slate-700 bg-slate-800 p-4 text-sm leading-6 text-slate-100">
              <p className="whitespace-pre-wrap break-words">{job.body}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
