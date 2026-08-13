import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { StateBlock } from "../components/dashboard/StateBlock";
import { EmailJobsTable } from "../components/email/EmailJobsTable";
import { EmailJobDetailsModal } from "../components/email/EmailJobDetailsModal";
import { useEmailJobs } from "../hooks/useEmailJobs";
import type { EmailJob } from "../types/email";

type EmailListPageProps = {
  type: "scheduled" | "sent";
};

export function EmailListPage({ type }: EmailListPageProps) {
  const { jobs, isLoading, state, error, refresh } = useEmailJobs(type);
  const [selectedJob, setSelectedJob] = useState<EmailJob | null>(null);

  if (isLoading) {
    return <StateBlock type="loading" title={`Loading ${type} emails`} />;
  }

  if (state === "error") {
    return (
      <StateBlock
        type="error"
        title="Could not load emails"
        message={error ?? "The backend request failed."}
        action={
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        }
      />
    );
  }

  if (jobs.length === 0) {
    return (
      <StateBlock
        type="empty"
        title={`No ${type} emails`}
        message={
          type === "scheduled"
            ? "Newly scheduled emails will appear here as soon as the backend stores them."
            : "Sent and failed email records will appear here after workers process jobs."
        }
        action={
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            {type === "scheduled" ? "Scheduled Emails" : "Sent Emails"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Showing {jobs.length} record{jobs.length === 1 ? "" : "s"} from the backend.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>
      <EmailJobsTable jobs={jobs} type={type} onSelectJob={setSelectedJob} />
      {selectedJob ? (
        <EmailJobDetailsModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      ) : null}
    </div>
  );
}
