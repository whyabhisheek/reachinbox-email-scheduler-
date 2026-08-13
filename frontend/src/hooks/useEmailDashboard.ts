import { useCallback, useEffect, useMemo, useState } from "react";
import { getScheduledEmails, getSentEmails } from "../services/email.service";
import type { EmailJob } from "../types/email";

type LoadState = "idle" | "loading" | "success" | "error";

export function useEmailDashboard() {
  const [scheduled, setScheduled] = useState<EmailJob[]>([]);
  const [sent, setSent] = useState<EmailJob[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const [scheduledResponse, sentResponse] = await Promise.all([
        getScheduledEmails(),
        getSentEmails()
      ]);
      setScheduled(scheduledResponse.jobs);
      setSent(sentResponse.jobs);
      setState("success");
    } catch {
      setError("Could not load dashboard data.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const failed = sent.filter((job) => job.status === "failed").length;
    const delivered = sent.filter((job) => job.status === "sent").length;
    const processing = scheduled.filter((job) => job.status === "processing").length;

    return {
      scheduled: scheduled.length,
      sent: delivered,
      failed,
      processing,
      total: scheduled.length + sent.length
    };
  }, [scheduled, sent]);

  const recentActivity = useMemo(() => {
    return [...scheduled, ...sent]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [scheduled, sent]);

  return {
    scheduled,
    sent,
    stats,
    recentActivity,
    state,
    error,
    refresh,
    isLoading: state === "loading" || state === "idle"
  };
}
