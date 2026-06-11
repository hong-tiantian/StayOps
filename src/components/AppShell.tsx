"use client";

import { Search } from "lucide-react";
import { Lang, ui } from "@/lib/i18n";

export interface TabDef {
  key: string;
  label: string;
}

export interface BookingOption {
  booking_id: string;
  company_name: string;
  arrival_date?: string;
}

export type Role = "manager" | "judge";

function bookingLabel(b: BookingOption) {
  const date = b.arrival_date ? ` · ${b.arrival_date.slice(5)}` : "";
  return `${b.company_name}${date}`;
}

const LOCALES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
] as const;

type LocaleValue = (typeof LOCALES)[number]["value"];

function langToLocale(lang: Lang): LocaleValue {
  return lang === "zh" ? "en" : lang;
}

function localeToLang(locale: string): Lang {
  return locale === "zh" ? "zh" : "en";
}

export default function AppShell({
  tabs,
  activeTab,
  onTab,
  role,
  onRole,
  bookingId,
  company,
  hotelName,
  allFresh,
  onRunAudit,
  onTrace,
  auditing,
  tracing,
  lang,
  onLang,
  bookings,
  onBooking,
  children,
}: {
  tabs: TabDef[];
  activeTab: string;
  onTab: (k: string) => void;
  role: Role;
  onRole: (r: Role) => void;
  bookingId: string;
  company: string;
  hotelName?: string;
  allFresh: boolean;
  onRunAudit: () => void;
  onTrace: () => void;
  auditing: boolean;
  tracing: boolean;
  lang: Lang;
  onLang: (lang: Lang) => void;
  bookings: BookingOption[];
  onBooking: (id: string) => void;
  children: React.ReactNode;
}) {
  const t = ui[lang];
  const locale = langToLocale(lang);

  return (
    <div className="h-screen overflow-hidden p-3 sm:p-5">
      <div className="liquid-device flex h-full overflow-hidden rounded-[34px]">
      <aside className="hidden w-[252px] shrink-0 border-r border-white/[0.08] bg-black/25 text-white backdrop-blur-3xl lg:block">
        <div className="flex h-full flex-col overflow-y-auto p-4">
          <div className="mb-7">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/[0.08] text-sm font-semibold text-white">
                S
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-normal">StayOps</div>
                {/* Identity, not a switcher: the duty manager works at ONE hotel. */}
                <div className="t-caption mt-0.5 truncate">{hotelName ?? t.nav.tagline}</div>
              </div>
            </div>
            <div className="liquid-window mt-4 rounded-2xl p-3.5">
              <div className="t-label">Selected booking</div>
              <div className="mt-1.5 truncate text-[13px] font-semibold text-white">{company}</div>
              <div className="tnum mt-0.5 truncate font-mono text-[10px] text-white/38">{bookingId}</div>
            </div>
          </div>

          <nav className="space-y-0.5">
            {tabs.map((item) => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onTab(item.key)}
                  className={`flex h-9 w-full items-center justify-between rounded-full px-3.5 text-left text-[12.5px] font-medium transition ${
                    active
                      ? "bg-white/[0.12] text-white"
                      : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span>{item.label}</span>
                  {active && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: "rgb(var(--ambient))", boxShadow: "0 0 8px rgb(var(--ambient))" }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3">
            <div className="glass-inset rounded-xl px-3 py-2.5">
              <div className="t-label mb-1.5">{t.nav.sync}</div>
              <div className={`flex items-center gap-2 text-[12px] font-medium ${allFresh ? "text-emerald-200" : "text-amber-200"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${allFresh ? "bg-emerald-400" : "bg-amber-400"}`} />
                {allFresh ? t.nav.fresh : t.nav.stale}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-30 shrink-0 border-b border-white/[0.08] bg-white/[0.04] backdrop-blur-3xl">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/25 bg-white/15 text-sm font-semibold text-white">S</div>
              <div>
                <div className="text-sm font-semibold text-white">StayOps</div>
                <div className="text-[10px] text-white/55">{hotelName ?? t.nav.tagline}</div>
              </div>
            </div>

            {activeTab !== "dashboard" && (
              <select
                value={bookingId}
                onChange={(e) => onBooking(e.target.value)}
                title={lang === "zh" ? "切换预订" : "Switch booking"}
                className="select-glass"
              >
                {bookings.length === 0 ? (
                  <option value={bookingId}>{company}</option>
                ) : (
                  bookings.map((b) => (
                    <option key={b.booking_id} value={b.booking_id}>
                      {bookingLabel(b)}
                    </option>
                  ))
                )}
              </select>
            )}

            <div className="relative hidden min-w-[280px] flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/45" strokeWidth={1.75} />
              <input
                placeholder={t.nav.search}
                className="h-8 w-full rounded-full bg-white/[0.08] pl-8 pr-3 text-xs text-white outline-none backdrop-blur-2xl transition placeholder:text-white/38 focus:bg-white/[0.12]"
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="flex h-8 items-center rounded-xl border border-white/10 bg-white/[0.05] p-0.5 text-[11px] font-medium text-white/55 backdrop-blur-2xl">
                <button
                  onClick={() => onRole("manager")}
                  className={`rounded-lg px-2.5 py-1 transition ${role === "manager" ? "bg-white/90 text-slate-950" : "hover:text-white"}`}
                >
                  {t.nav.roleManager}
                </button>
                <button
                  onClick={() => onRole("judge")}
                  className={`rounded-lg px-2.5 py-1 transition ${role === "judge" ? "bg-white/90 text-slate-950" : "hover:text-white"}`}
                >
                  {t.nav.roleJudge}
                </button>
              </div>
              <select
                value={locale}
                onChange={(e) => onLang(localeToLang(e.target.value))}
                title="Locale"
                aria-label="Locale"
                className="select-glass"
              >
                {LOCALES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <button onClick={onRunAudit} disabled={auditing} className="btn btn-primary hidden disabled:opacity-50 sm:inline-flex">
                {auditing ? t.nav.auditing : t.nav.audit}
              </button>
              <button
                onClick={onTrace}
                disabled={tracing}
                className="btn hidden border border-rose-300/30 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15 disabled:opacity-50 sm:inline-flex"
              >
                {tracing ? t.nav.tracing : t.nav.trace}
              </button>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto border-t border-white/12 px-3 py-2 lg:hidden">
            {tabs.map((item) => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onTab(item.key)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                    active ? "bg-white/90 text-slate-950" : "text-white/55 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <div key={activeTab} className="animate-tabin">
            {children}
          </div>
        </main>
      </div>
      </div>
    </div>
  );
}
