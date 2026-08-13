import { useState } from "react";
import { AlertCircle, CheckCircle2, Send, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LeadUpload } from "../components/leads/LeadUpload";
import { scheduleEmails } from "../services/email.service";
import type { ParsedLeads } from "../types/leads";

function defaultStartTime() {
  const date = new Date(Date.now() + 5 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function ComposePage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<ParsedLeads | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }

    if (!body.trim()) {
      setError("Body is required.");
      return;
    }

    if (!leads || leads.validEmails.length === 0) {
      setError("Upload a CSV or TXT file with at least one valid email address.");
      return;
    }

    const startDate = new Date(startTime);
    if (Number.isNaN(startDate.getTime()) || startDate.getTime() <= Date.now()) {
      setError("Start time must be in the future.");
      return;
    }

    if (delayBetweenEmails < 0) {
      setError("Delay between emails cannot be negative.");
      return;
    }

    if (hourlyLimit <= 0) {
      setError("Hourly limit must be greater than zero.");
      return;
    }

    setIsSubmitting(true);
    try {
      let response;
      if (attachments.length > 0) {
        const form = new FormData();
        form.append("subject", subject.trim());
        form.append("body", body.trim());
        form.append("startTime", startDate.toISOString());
        form.append("delayBetweenEmails", String(delayBetweenEmails));
        form.append("hourlyLimit", String(hourlyLimit));
        // recipients as repeated fields
        for (const r of leads.validEmails) form.append("recipients[]", r);
        for (const file of attachments) form.append("attachments", file, file.name);

        response = await scheduleEmails(form);
      } else {
        response = await scheduleEmails({
          subject: subject.trim(),
          body: body.trim(),
          recipients: leads.validEmails,
          startTime: startDate.toISOString(),
          delayBetweenEmails,
          hourlyLimit
        });
      }

      setSuccess(`${response.count} email${response.count === 1 ? "" : "s"} scheduled successfully.`);
      navigate("/scheduled", { replace: true });
    } catch (err) {
      console.error(err);
      setError("Could not schedule emails. Check your inputs and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => window.history.back()} className="-ml-2 inline-flex items-center gap-2 text-sm text-slate-700">
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Compose New Email</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-1 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Send
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-5 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : null}

        {success ? (
          <div className="mt-5 flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>{success}</p>
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          <div className="grid gap-4">
            <div className="grid gap-2 md:grid-cols-3 md:items-center">
              <div className="md:col-span-1">
                <label className="text-sm font-medium text-slate-700">From</label>
                <div className="mt-1 text-sm text-slate-700">you@yourdomain.com</div>
              </div>

              <div className="md:col-span-2 relative">
                <label className="text-sm font-medium text-slate-700">To</label>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {(leads?.validEmails ?? []).slice(0, 4).map((e, idx) => (
                      <div key={e + idx} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-700">{e}</div>
                    ))}
                    {((leads?.validEmails?.length ?? 0) > 4) && (
                      <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-700">+{(leads?.validEmails.length ?? 0) - 4}</div>
                    )}
                    {(!leads || (leads.validEmails.length === 0)) && (
                      <input placeholder="recipient@example.com" className="text-sm text-slate-400" />
                    )}
                  </div>

                  <button type="button" className="text-sm text-emerald-600">Upload List</button>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="subject" className="text-sm font-medium text-slate-700">Subject</label>
              <input
                id="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="mt-2 w-full border-0 border-b border-slate-200 bg-transparent px-0 py-2 text-sm text-slate-700 outline-none"
                placeholder="Subject"
                maxLength={300}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3 items-center">
              <div>
                <label htmlFor="delay" className="text-sm font-medium text-slate-700">Delay between {leads?.validEmails.length ?? 0} emails</label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id="delay"
                    type="number"
                    min={0}
                    value={delayBetweenEmails}
                    onChange={(event) => setDelayBetweenEmails(Number(event.target.value))}
                    className="w-20 rounded-md border border-slate-100 px-3 py-2 text-sm text-slate-950 outline-none"
                  />
                  <span className="text-sm text-slate-500">sec</span>
                </div>
              </div>

              <div>
                <label htmlFor="hourlyLimit" className="text-sm font-medium text-slate-700">Hourly Limit</label>
                <input
                  id="hourlyLimit"
                  type="number"
                  min={1}
                  value={hourlyLimit}
                  onChange={(event) => setHourlyLimit(Number(event.target.value))}
                  className="w-24 mt-2 rounded-md border border-slate-100 px-3 py-2 text-sm text-slate-950 outline-none"
                />
              </div>

              <div>
                <label htmlFor="startTime" className="text-sm font-medium text-slate-700">Start time</label>
                <input
                  id="startTime"
                  type="datetime-local"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-100 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none"
                />
              </div>
            </div>

            <LeadUpload value={leads} onChange={setLeads} />

            <div>
              <label className="text-sm font-medium text-slate-700">Attachments</label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  id="attachments"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setAttachments((s) => [...s, ...files]);
                  }}
                />
                <div className="flex gap-2">
                  {attachments.map((f, i) => (
                    <div key={f.name + i} className="flex items-center gap-2 rounded-md border px-2 py-1">
                      <img src={URL.createObjectURL(f)} alt={f.name} className="h-8 w-8 rounded" />
                      <button
                        type="button"
                        onClick={() => setAttachments((s) => s.filter((_, idx) => idx !== i))}
                        className="text-sm text-slate-500"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm text-slate-500">Type Your Reply...</div>
                <div className="flex items-center gap-2 text-sm text-slate-400">B I U • •</div>
              </div>

              <textarea
                id="body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="mt-2 min-h-72 w-full resize-y rounded-md border border-slate-100 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-950 shadow-sm outline-none"
                placeholder="Hi, I wanted to reach out..."
                maxLength={10000}
              />
            </div>
          </div>
        </div>
      </form>

      <aside className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-950">Lead summary</h2>
        <p className="mt-4 text-3xl font-semibold text-slate-950">{leads?.validEmails.length ?? 0}</p>
        <p className="mt-1 text-sm text-slate-500">valid emails detected</p>
        <div className="mt-6 space-y-4 border-t border-slate-200 pt-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Delay</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{delayBetweenEmails} seconds</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Hourly limit</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{hourlyLimit} emails</p>
          </div>
        </div>
      </aside>
    </section>
  );
}
