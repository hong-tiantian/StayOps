"use client";

import { Lang, ui } from "@/lib/i18n";

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
  lang,
  onLang,
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
  lang: Lang;
  onLang: (lang: Lang) => void;
  children: React.ReactNode;
}) {
  const t = ui[lang];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/60 glass">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-lg shadow-slate-950/15">
              S
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-slate-900">StayOps</div>
              <div className="text-[10px] text-slate-400">{t.nav.tagline}</div>
            </div>
          </div>

          <div className="relative hidden flex-1 md:block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              ⌕
            </span>
            <input
              placeholder={t.nav.search}
              className="w-full rounded-full border border-slate-200/80 bg-white/70 py-2 pl-8 pr-3 text-xs text-slate-600 outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-900/5"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="rounded-full bg-white/70 px-2.5 py-1.5 font-medium text-slate-600 ring-1 ring-slate-200/70">
              {bookingId} · {company}
            </span>
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-medium ${
                allFresh ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  allFresh ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ animation: "pulseglow 2.4s ease-in-out infinite" }}
              />
              {t.nav.sync}: {allFresh ? t.nav.fresh : t.nav.stale}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-slate-200 bg-white/70 p-0.5 text-[11px] font-medium text-slate-500">
              <button
                onClick={() => onLang("en")}
                className={`rounded-full px-2 py-1 ${
                  lang === "en" ? "bg-slate-950 text-white" : "hover:text-slate-900"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => onLang("zh")}
                className={`rounded-full px-2 py-1 ${
                  lang === "zh" ? "bg-slate-950 text-white" : "hover:text-slate-900"
                }`}
              >
                中文
              </button>
            </div>
            <button onClick={onRunAudit} disabled={auditing} className="btn btn-primary disabled:opacity-50">
              {auditing ? t.nav.auditing : t.nav.audit}
            </button>
            <button
              onClick={onTrace}
              disabled={tracing}
              className="btn border border-rose-200 bg-white/80 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              {tracing ? t.nav.tracing : t.nav.trace}
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
                  active ? "text-slate-950" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {t.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-slate-950" />
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
