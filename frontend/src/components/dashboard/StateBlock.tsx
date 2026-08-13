import { AlertCircle, Inbox, Loader2 } from "lucide-react";

type StateBlockProps = {
  type: "loading" | "empty" | "error" | "success";
  title: string;
  message?: string;
  action?: React.ReactNode;
};

export function StateBlock({ type, title, message, action }: StateBlockProps) {
  const Icon = type === "loading" ? Loader2 : type === "error" ? AlertCircle : Inbox;

  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-6 text-center">
      <Icon
        className={`h-6 w-6 ${
          type === "loading" ? "animate-spin text-slate-400" : type === "error" ? "text-red-500" : "text-slate-400"
        }`}
        aria-hidden="true"
      />
      <p className="mt-3 text-sm font-semibold text-slate-950">{title}</p>
      {message ? <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
