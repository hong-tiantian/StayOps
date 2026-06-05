import { FreshnessResult } from "@/lib/types";
import { Lang, ui } from "@/lib/i18n";

export default function DataFreshnessPanel({
  sources,
  demoNow,
  lang,
}: {
  sources: FreshnessResult[];
  demoNow?: string;
  lang: Lang;
}) {
  const t = ui[lang];
  return (
    <div className="card lift p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            {t.freshness.title}
          </h2>
          <p className="text-[11px] text-slate-400">
            {t.freshness.demoNow} = {demoNow ?? "2026-07-18T10:00:00Z"}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            sources.every((s) => s.freshness_status === "fresh")
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {sources.every((s) => s.freshness_status === "fresh") ? t.freshness.allFresh : t.freshness.staleSources}
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/70">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t.freshness.source}</th>
              <th className="px-3 py-2 text-left font-medium">{t.freshness.lastSynced}</th>
              <th className="px-3 py-2 text-right font-medium">{t.freshness.age}</th>
              <th className="px-3 py-2 text-right font-medium">{t.freshness.max}</th>
              <th className="px-3 py-2 text-center font-medium">{t.freshness.status}</th>
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
