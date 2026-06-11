"use client";

import { Building2, SlidersHorizontal } from "lucide-react";
import GmailIntakePanel from "@/components/GmailIntakePanel";
import { cx } from "@/components/ui/visuals";
import { FreshnessResult } from "@/lib/types";
import { Lang } from "@/lib/i18n";

export interface HotelOption {
  hotel_id: string;
  name: string;
}

/* Demo console — judge-side chaos & persona controls. These are demo PROPS,
   not product features: a real duty manager has one hotel and cannot will
   data sources stale. They live here so the manager view stays clean. */

export default function DemoConsole({
  lang,
  hotels,
  activeHotelId,
  onHotel,
  freshness,
  demoNow,
  onToggleFreshness,
}: {
  lang: Lang;
  hotels: HotelOption[];
  activeHotelId: string;
  onHotel: (id: string) => void;
  freshness: FreshnessResult[];
  demoNow: string;
  onToggleFreshness: (source: string) => void;
}) {
  const zh = lang === "zh";
  const staleCount = freshness.filter((f) => f.freshness_status === "stale").length;

  return (
    <div className="space-y-4">
      <div className="glass-lite px-5 py-3.5">
        <h1 className="t-title">{zh ? "演示控制台" : "Demo Console"}</h1>
        <p className="t-caption mt-0.5">
          {zh
            ? "评委侧的演示道具：切换酒店人格、注入过期数据、导入测试邮件 — 观察 agent 如何随之改变裁决。"
            : "Judge-side demo props: swap the hotel persona, inject stale data, import test emails — and watch the agent's verdicts change."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* -------- Hotel persona switcher -------- */}
        <div className="glass p-5">
          <div className="mb-1.5 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-white/60" strokeWidth={1.75} />
            <h3 className="t-label">{zh ? "酒店人格切换" : "Hotel persona"}</h3>
          </div>
          <p className="t-caption mb-3">
            {zh
              ? "切换 SOP 语料库 — 同一封客人邮件，在不同酒店政策下得到不同的承诺裁决。"
              : "Swaps the SOP corpus — the same guest email gets different promise verdicts under each hotel's policies."}
          </p>
          <div className="space-y-1.5">
            {hotels.map((h) => {
              const active = h.hotel_id === activeHotelId;
              return (
                <button
                  key={h.hotel_id}
                  onClick={() => onHotel(h.hotel_id)}
                  className={cx(
                    "flex h-11 w-full items-center justify-between gap-3 rounded-xl border px-3.5 text-left transition",
                    active
                      ? "border-white/25 bg-white/[0.1] text-white"
                      : "border-white/8 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  <span className="truncate text-[13px] font-medium">{h.name}</span>
                  {active && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "rgb(var(--ambient))", boxShadow: "0 0 8px rgb(var(--ambient))" }}
                    />
                  )}
                </button>
              );
            })}
            {hotels.length === 0 && (
              <div className="grid h-16 place-items-center text-xs text-white/38">
                {zh ? "未加载酒店人格" : "No hotel personas loaded"}
              </div>
            )}
          </div>
        </div>

        {/* -------- Freshness chaos injection -------- */}
        <div className="glass p-5">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-white/60" strokeWidth={1.75} />
              <h3 className="t-label">{zh ? "数据新鲜度注入" : "Freshness injection"}</h3>
            </div>
            <span className={cx("rounded-full px-2 py-0.5 text-[9px] font-semibold", staleCount ? "bg-rose-400/15 text-rose-200" : "bg-emerald-400/15 text-emerald-200")}>
              {staleCount ? `${staleCount} stale` : zh ? "全部新鲜" : "all fresh"}
            </span>
          </div>
          <p className="t-caption mb-3">
            {zh
              ? `点击数据源切换新鲜/过期 — 过期时安全门自动降级相关承诺（评估时间锚定 ${demoNow || "DEMO_NOW"}）。`
              : `Click a source to toggle fresh/stale — the safety gate downgrades affected promises automatically (evaluated at ${demoNow || "DEMO_NOW"}).`}
          </p>
          <div className="space-y-0.5">
            {freshness.map((f) => {
              const stale = f.freshness_status === "stale";
              return (
                <button
                  key={f.source_name}
                  onClick={() => onToggleFreshness(f.source_name)}
                  className="flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 transition hover:bg-white/[0.05]"
                >
                  <span className={cx("truncate font-mono text-[12px]", stale ? "text-rose-300" : "text-white/65")}>{f.source_name}</span>
                  <span className="flex shrink-0 items-center gap-2.5">
                    <span className="tnum font-mono text-[11px] text-white/38">{f.age_minutes}/{f.max_allowed_age_minutes}m</span>
                    <span className={cx("h-1.5 w-1.5 rounded-full", stale ? "bg-rose-400" : "bg-emerald-400")} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* -------- Test email injection (Gmail readonly) -------- */}
      <GmailIntakePanel lang={lang} variant="gmail" />
    </div>
  );
}
