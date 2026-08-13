import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

type StatCardProps = {
  label: string;
  value: number;
  helper: string;
  icon: LucideIcon;
  to?: string;
};

export function StatCard({ label, value, helper, icon: Icon, to }: StatCardProps) {
  const content = (
    <div className="rounded-lg border border-slate-200 bg-white p-5 transition hover:border-cyan-200 hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className="rounded-md bg-cyan-50 p-2 text-cyan-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-500">{helper}</p>
    </div>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }

  return content;
}
