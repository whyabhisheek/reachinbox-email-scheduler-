import { AlertCircle, CalendarClock, CheckCircle2, Clock3, MailWarning, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { EmailPreviewList } from "../components/dashboard/EmailPreviewList";
import { RecentActivity } from "../components/dashboard/RecentActivity";
import { StateBlock } from "../components/dashboard/StateBlock";
import { StatCard } from "../components/dashboard/StatCard";
import { useEmailDashboard } from "../hooks/useEmailDashboard";

export function DashboardPage() {
  const { scheduled, sent, stats, recentActivity, isLoading, state, error, refresh } = useEmailDashboard();
  const hasData = scheduled.length > 0 || sent.length > 0;

  if (isLoading) {
    return <StateBlock type="loading" title="Loading dashboard" message="Fetching scheduled and sent emails." />;
  }

  if (state === "error") {
    return (
      <StateBlock
        type="error"
        title="Dashboard unavailable"
        message={error ?? "Could not load dashboard data."}
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

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">Email operations</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Scheduling overview</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Monitor queued, processing, sent, and failed emails from the live backend.
          </p>
        </div>
        <Link
          to="/compose"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Compose New Email
        </Link>
      </section>

      {!hasData ? (
        <StateBlock
          type="empty"
          title="No email activity yet"
          message="Scheduled and sent email previews will appear here after you create your first campaign."
          action={
            <Link
              to="/compose"
              className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Compose New Email
            </Link>
          }
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Scheduled" value={stats.scheduled} helper="Queued or waiting to send" icon={CalendarClock} to="/scheduled" />
        <StatCard label="Processing" value={stats.processing} helper="Currently being handled" icon={Clock3} to="/scheduled" />
        <StatCard label="Sent" value={stats.sent} helper="Delivered through Ethereal" icon={CheckCircle2} to="/sent" />
        <StatCard label="Failed" value={stats.failed} helper="Needs attention or retry" icon={MailWarning} to="/sent" />
      </section>

      {stats.failed > 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{stats.failed} email job{stats.failed === 1 ? "" : "s"} failed. Check the sent emails view for error details.</p>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <EmailPreviewList title="Scheduled email preview" jobs={scheduled} viewAllTo="/scheduled" dateField="scheduledAt" />
          <EmailPreviewList title="Sent email preview" jobs={sent} viewAllTo="/sent" dateField="sentAt" />
        </div>
        <RecentActivity jobs={recentActivity} />
      </section>
    </div>
  );
}
