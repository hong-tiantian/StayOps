"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { Lang } from "@/lib/i18n";
import { cx } from "@/components/ui/visuals";

/* Hotel Brain — the per-hotel knowledge the agent reasons over.
   Left: hotel personas (active one highlighted) with operating constraints.
   Right: the SOP corpus for the active hotel + drag-drop / paste onboarding.
   Every uploaded document is chunked immediately and embedded on first
   retrieval, so a new policy changes the very next audit. */

interface HotelPersona {
  front_desk_hours: string;
  check_in_window: string;
  late_arrival_policy: string;
  pet_policy_summary: string;
  parking_summary: string;
  upgrade_authority: string;
  voice: string;
  signature: string;
}

interface Hotel {
  hotel_id: string;
  name: string;
  brand_style: string;
  timezone: string;
  persona: HotelPersona;
}

interface SopDocMeta {
  doc_id: number;
  title: string;
  source: string;
  created_at: string;
  chunk_count: number;
}

const ACCEPTED = [".txt", ".md", ".markdown"];

export default function HotelBrainPanel({ lang }: { lang: Lang }) {
  const zh = lang === "zh";
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [docs, setDocs] = useState<SopDocMeta[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const loadHotels = useCallback(async () => {
    const r = await fetch("/api/hotels");
    const j = await r.json();
    setHotels(j.hotels ?? []);
    setActiveId(j.active_hotel_id ?? "");
  }, []);

  const loadDocs = useCallback(async (hotelId: string) => {
    if (!hotelId) return;
    const r = await fetch(`/api/hotels/${encodeURIComponent(hotelId)}/sop`);
    const j = await r.json();
    setDocs(j.docs ?? []);
  }, []);

  useEffect(() => {
    loadHotels();
  }, [loadHotels]);

  useEffect(() => {
    loadDocs(activeId);
  }, [activeId, loadDocs]);

  const switchHotel = useCallback(async (hotelId: string) => {
    setActiveId(hotelId);
    await fetch("/api/hotels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotel_id: hotelId }),
    });
  }, []);

  const uploadDoc = useCallback(
    async (title: string, text: string) => {
      if (!activeId || !title.trim() || !text.trim()) return;
      setUploading(true);
      setNotice(null);
      try {
        const r = await fetch(`/api/hotels/${encodeURIComponent(activeId)}/sop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), text }),
        });
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setNotice({
          kind: "ok",
          text: zh
            ? `已收录「${j.title}」，切分为 ${j.chunks} 个检索片段 — 下一次审计立即生效`
            : `Onboarded "${j.title}" as ${j.chunks} retrieval chunk(s) — live on the very next audit`,
        });
        setPasteTitle("");
        setPasteText("");
        await loadDocs(activeId);
      } catch (e) {
        setNotice({ kind: "err", text: e instanceof Error ? e.message : "upload failed" });
      } finally {
        setUploading(false);
      }
    },
    [activeId, loadDocs, zh]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const ok = ACCEPTED.some((ext) => file.name.toLowerCase().endsWith(ext));
        if (!ok) {
          setNotice({
            kind: "err",
            text: zh ? `不支持 ${file.name} — 请用 .txt / .md 文本` : `Unsupported ${file.name} — use .txt / .md text`,
          });
          continue;
        }
        const text = await file.text();
        await uploadDoc(file.name.replace(/\.(txt|md|markdown)$/i, ""), text);
      }
    },
    [uploadDoc, zh]
  );

  const active = hotels.find((h) => h.hotel_id === activeId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="t-title">{zh ? "酒店大脑" : "Hotel Brain"}</h1>
        <p className="t-caption mt-0.5">
          {zh
            ? "每家酒店的 persona 与 SOP 语料 — agent 的决策依据全部来自这里，没有任何酒店政策写死在代码里"
            : "Per-hotel persona + SOP corpus — every policy the agent reasons over lives here, none of it is hardcoded"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* -------- Left: personas -------- */}
        <div className="space-y-3 lg:col-span-2">
          {hotels.map((h) => {
            const isActive = h.hotel_id === activeId;
            return (
              <button
                key={h.hotel_id}
                onClick={() => switchHotel(h.hotel_id)}
                className={cx(
                  "glass w-full p-4 text-left transition",
                  isActive ? "ring-1 ring-white/35" : "opacity-75 hover:opacity-100"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-white">{h.name}</div>
                    <div className="t-caption mt-0.5 truncate">{h.brand_style}</div>
                  </div>
                  {isActive && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: "rgb(var(--ambient))", boxShadow: "0 0 8px rgb(var(--ambient))" }}
                    />
                  )}
                </div>
                {isActive && (
                  <dl className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-[11.5px] leading-relaxed">
                    {[
                      [zh ? "前台" : "Front desk", h.persona.front_desk_hours],
                      [zh ? "入住" : "Check-in", h.persona.check_in_window],
                      [zh ? "晚到" : "Late arrival", h.persona.late_arrival_policy],
                      [zh ? "宠物" : "Pets", h.persona.pet_policy_summary],
                      [zh ? "停车" : "Parking", h.persona.parking_summary],
                      [zh ? "升级权限" : "Upgrades", h.persona.upgrade_authority],
                    ].map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <dt className="w-[72px] shrink-0 text-white/40">{k}</dt>
                        <dd className="text-white/75">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </button>
            );
          })}
        </div>

        {/* -------- Right: SOP corpus + onboarding -------- */}
        <div className="space-y-4 lg:col-span-3">
          <div className="glass p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="t-label">
                {zh ? "SOP 语料" : "SOP corpus"}
                {active ? ` · ${active.name}` : ""}
              </h3>
              <span className="t-caption">
                {docs.reduce((a, d) => a + d.chunk_count, 0)} {zh ? "个检索片段" : "retrieval chunks"}
              </span>
            </div>
            <div className="space-y-1.5">
              {docs.map((d) => (
                <div key={d.doc_id} className="glass-inset flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/8 text-white/70">
                    <FileText className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-white/90">{d.title}</div>
                    <div className="t-caption">
                      {d.chunk_count} {zh ? "片段" : "chunks"} · {d.source === "seed" ? (zh ? "内置" : "seeded") : zh ? "上传" : "uploaded"}
                    </div>
                  </div>
                </div>
              ))}
              {docs.length === 0 && (
                <div className="grid h-16 place-items-center text-xs text-white/38">
                  {zh ? "暂无 SOP 文档" : "No SOP documents yet"}
                </div>
              )}
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={cx(
              "glass grid min-h-[120px] cursor-pointer place-items-center p-5 text-center transition",
              dragOver && "ring-2 ring-white/45"
            )}
            onClick={() => fileInput.current?.click()}
          >
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED.join(",")}
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <div>
              <div className="grid place-items-center text-white/70">
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.75} aria-hidden />
                ) : (
                  <Upload className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                )}
              </div>
              <p className="mt-1 text-[13px] font-medium text-white/85">
                {uploading
                  ? zh
                    ? "切分并收录中…"
                    : "Chunking & onboarding…"
                  : zh
                    ? "拖入 SOP 文档（.txt / .md），或点击选择"
                    : "Drop SOP documents (.txt / .md), or click to browse"}
              </p>
              <p className="t-caption mt-1">
                {zh
                  ? "上传即切分入库，首次检索时向量化 — 不需要重启或重新部署"
                  : "Chunked on upload, embedded on first retrieval — no restart, no redeploy"}
              </p>
            </div>
          </div>

          <div className="glass p-5">
            <h3 className="t-label mb-2.5">{zh ? "或直接粘贴政策文本" : "Or paste a policy directly"}</h3>
            <input
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              placeholder={zh ? "文档标题，如「春节期间退改政策」" : 'Document title, e.g. "Holiday cancellation policy"'}
              className="mb-2 h-8 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/85 placeholder-white/30 outline-none focus:border-white/25"
            />
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={5}
              placeholder={zh ? "粘贴 SOP 正文…" : "Paste the SOP body…"}
              className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12.5px] leading-relaxed text-white/85 placeholder-white/30 focus:border-white/25 focus:outline-none"
            />
            <button
              onClick={() => uploadDoc(pasteTitle, pasteText)}
              disabled={uploading || !pasteTitle.trim() || !pasteText.trim()}
              className="btn btn-primary mt-2 disabled:opacity-50"
            >
              {zh ? "收录到酒店大脑" : "Onboard to Hotel Brain"}
            </button>
          </div>

          {notice && (
            <p className={cx("text-[12px]", notice.kind === "ok" ? "text-emerald-200" : "text-rose-300")}>
              {notice.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
