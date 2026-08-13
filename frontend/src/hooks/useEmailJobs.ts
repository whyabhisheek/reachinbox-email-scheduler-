import { useCallback, useEffect, useState } from "react";
import { getScheduledEmails, getSentEmails } from "../services/email.service";
import type { EmailJob } from "../types/email";

type EmailJobListType = "scheduled" | "sent";
type LoadState = "idle" | "loading" | "success" | "error";

export function useEmailJobs(type: EmailJobListType) {
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const response = type === "scheduled" ? await getScheduledEmails() : await getSentEmails();
      setJobs(response.jobs);
      setState("success");
    } catch {
      setError(`Could not load ${type} emails.`);
      setState("error");
    }
  }, [type]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    jobs,
    state,
    error,
    refresh,
    isLoading: state === "idle" || state === "loading"
  };
}
