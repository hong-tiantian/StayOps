import { FreshnessResult } from "@/lib/types";

export default function DataFreshnessPanel({
  sources,
  demoNow,
}: {
  sources: FreshnessResult[];
  demoNow?: string;
}) {
  return (
    <div className="card lift p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            Operational Data Freshness
          </h2>
          <p className="text-[11px] text-slate-400">
            Freshness gate evaluated at demo now = {demoNow ?? "2026-07-18T10:00:00Z"}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            sources.every((s) => s.freshness_status === "fresh")
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {sources.every((s) => s.freshness_status === "fresh") ? "All Fresh" : "Stale source(s)"}
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/70">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Source</th>
              <th className="px-3 py-2 text-left font-medium">Last synced</th>
              <th className="px-3 py-2 text-right font-medium">Age (min)</th>
              <th className="px-3 py-2 text-right font-medium">Max (min)</th>
              <th className="px-3 py-2 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sources.map((s) => (
              <tr key={s.source_name} className="bg-white">
                <td className="px-3 py-1.5 font-mono text-slate-700">{s.source_name}</td>
                <td className="px-3 py-1.5 text-slate-500">
                  {(s.last_synced_at ?? "—").replace("T", " ").replace("Z", "")}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {s.age_minutes}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">
                  {s.max_allowed_age_minutes}
                </td>
                <td className="px-3 py-1.5 text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      s.freshness_status === "fresh"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {s.freshness_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
