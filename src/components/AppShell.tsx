"use client";

export interface TabDef {
  key: string;
  label: string;
}

export default function AppShell({
  tabs,
  activeTab,
  onTab,
  bookingId,
  company,
  allFresh,
  onRunAudit,
  onTrace,
  auditing,
  tracing,
  children,
}: {
  tabs: TabDef[];
  activeTab: string;
  onTab: (k: string) => void;
  bookingId: string;
  company: string;
  allFresh: boolean;
  onRunAudit: () => void;
  onTrace: () => void;
  auditing: boolean;
  tracing: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/60 glass">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-5 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/30">
              S
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-slate-900">StayOps</div>
              <div className="text-[10px] text-slate-400">Promise Ledger</div>
            </div>
          </div>

          <div className="relative hidden flex-1 md:block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              ⌕
            </span>
            <input
              placeholder="Search booking / company / room / task / complaint"
              className="w-full rounded-xl border border-slate-200/80 bg-white/70 py-2 pl-8 pr-3 text-xs text-slate-600 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="rounded-lg bg-slate-100/80 px-2.5 py-1.5 font-medium text-slate-600">
              {bookingId} · {company}
            </span>
            <span
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium ${
                allFresh ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  allFresh ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ animation: "pulseglow 2.4s ease-in-out infinite" }}
              />
              Fivetran Sync: {allFresh ? "Fresh" : "Stale"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onRunAudit} disabled={auditing} className="btn btn-primary disabled:opacity-50">
              {auditing ? "Auditing…" : "Run Promise Audit"}
            </button>
            <button
              onClick={onTrace}
              disabled={tracing}
              className="btn border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              {tracing ? "Tracing…" : "Trace Complaint"}
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4">
          {tabs.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onTab(t.key)}
                className={`relative whitespace-nowrap px-3.5 py-2.5 text-xs font-medium transition-colors ${
                  active ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {t.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                )}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-6">
        <div key={activeTab} className="animate-tabin">
          {children}
        </div>
      </main>
    </div>
  );
}
