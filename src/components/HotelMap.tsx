"use client";

import { useRef } from "react";

interface MapRoom {
  room_id: string;
  floor: number;
  type: string;
  quiet: boolean;
  nearElevator: boolean;
  note: string;
  suitability: "suitable" | "candidate_later" | "unsuitable" | "support";
}

const ROOMS: MapRoom[] = [
  { room_id: "504", floor: 5, type: "king", quiet: true, nearElevator: false, note: "Quiet, away from elevator. Cleaning until 12:30 — best candidate, but not ready at 11:00.", suitability: "candidate_later" },
  { room_id: "506", floor: 5, type: "king", quiet: false, nearElevator: true, note: "King, but not in the quiet zone and beside the elevator — unsuitable for the VP.", suitability: "unsuitable" },
  { room_id: "401", floor: 4, type: "king", quiet: true, nearElevator: false, note: "Quiet, away from elevator, but occupied until 12:00 — available later only.", suitability: "candidate_later" },
  { room_id: "402", floor: 4, type: "king", quiet: true, nearElevator: true, note: "In the quiet zone but right beside the elevator — not suitable for the VP.", suitability: "unsuitable" },
  { room_id: "301", floor: 3, type: "twin", quiet: false, nearElevator: false, note: "Twin — part of the group block.", suitability: "support" },
  { room_id: "302", floor: 3, type: "twin", quiet: false, nearElevator: true, note: "Twin beside elevator — part of the group block.", suitability: "support" },
];

const SUIT: Record<MapRoom["suitability"], { tile: string; dot: string; label: string }> = {
  suitable: { tile: "from-emerald-50 to-white border-emerald-300", dot: "bg-emerald-500", label: "Suitable" },
  candidate_later: { tile: "from-amber-50 to-white border-amber-300", dot: "bg-amber-500", label: "Ready later" },
  unsuitable: { tile: "from-rose-50 to-white border-rose-300", dot: "bg-rose-500", label: "Unsuitable" },
  support: { tile: "from-slate-50 to-white border-slate-200", dot: "bg-slate-400", label: "Group" },
};

export default function HotelMap({
  assignedRoom,
  highlight = false,
}: {
  assignedRoom?: string;
  highlight?: boolean;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const floors = [5, 4, 3];

  // Subtle pointer parallax on the whole scene.
  const onMove = (e: React.PointerEvent) => {
    const el = sceneRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    el.style.setProperty("--ry", `${px * 6}deg`);
  };
  const onLeave = () => sceneRef.current?.style.setProperty("--ry", "0deg");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        {(["suitable", "candidate_later", "unsuitable", "support"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${SUIT[k].dot}`} />
            {SUIT[k].label}
          </span>
        ))}
        <span className="ml-1 text-slate-400">🛗 elevator · 🔇 quiet zone</span>
      </div>

      {highlight && (
        <div className="card relative animate-fadeup overflow-hidden border-rose-200 p-0">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-rose-500 to-rose-300" />
          <div className="p-4 pl-5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-500">
              Complaint trace · room placement
            </div>
            <p className="mt-1 text-sm text-slate-700">
              The VP was actually placed in <strong>Room 402</strong> — in the quiet zone, but{" "}
              <strong>right beside the elevator</strong>. The promise was a quiet king{" "}
              <em>away</em> from elevators. The front desk never locked a suitable room
              (room-block task still open). The best quiet alternative is{" "}
              <strong>Room 504</strong>, available after cleaning.
            </p>
          </div>
        </div>
      )}

      <div
        ref={sceneRef}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="card overflow-hidden p-6"
        style={{ perspective: "1400px" }}
      >
        <div
          className="space-y-7 transition-transform duration-300"
          style={{ transform: "rotateX(30deg) rotateY(var(--ry,0deg)) rotateZ(-14deg)", transformStyle: "preserve-3d" }}
        >
          {floors.map((floor, fi) => (
            <div key={floor} className="relative" style={{ transformStyle: "preserve-3d" }}>
              <div className="mb-2 flex items-center gap-2" style={{ transform: "rotateZ(14deg) rotateX(-30deg)" }}>
                <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow">
                  Floor {floor}
                </span>
                <span className="text-[10px] text-slate-400">
                  {floor >= 4 ? "Quiet zone" : "Standard floor"}
                </span>
              </div>

              {/* tilted floor plate */}
              <div
                className="relative rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-4"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(148,163,184,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.10) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                  boxShadow: "0 30px 50px -30px rgba(15,23,42,0.5)",
                  animation: `fadeup .5s ${fi * 80}ms both`,
                }}
              >
                <div className="flex items-stretch gap-3">
                  {/* elevator shaft */}
                  <div className="grid w-14 shrink-0 place-items-center rounded-xl border border-dashed border-slate-300 bg-white/70 text-center text-[10px] text-slate-400">
                    <div>
                      <div className="text-lg leading-none">🛗</div>
                      lift
                    </div>
                  </div>

                  <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
                    {ROOMS.filter((r) => r.floor === floor).map((r) => {
                      const s = SUIT[r.suitability];
                      const isAssigned = assignedRoom === r.room_id;
                      return (
                        <div
                          key={r.room_id}
                          className={`group relative rounded-xl border bg-gradient-to-b ${s.tile} p-2.5 transition-all duration-300 hover:-translate-y-1`}
                          style={{
                            boxShadow: isAssigned
                              ? "0 18px 30px -12px rgba(244,63,94,0.55), 0 0 0 2px rgba(244,63,94,0.6)"
                              : "0 12px 20px -12px rgba(15,23,42,0.45)",
                            transform: isAssigned ? "translateY(-6px)" : undefined,
                            animation: isAssigned ? "pulseglow 2s ease-in-out infinite" : undefined,
                          }}
                        >
                          {/* billboard content (faces camera) */}
                          <div style={{ transform: "rotateZ(14deg) rotateX(-30deg)" }}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-slate-800">
                                {r.room_id}
                              </span>
                              <span className="flex items-center gap-0.5 text-[11px]">
                                {r.quiet && <span title="quiet zone">🔇</span>}
                                {r.nearElevator && <span title="near elevator">🛗</span>}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
                              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                              {r.type}
                            </div>
                            <p className="mt-1 hidden text-[10px] leading-snug text-slate-500 group-hover:block">
                              {r.note}
                            </p>
                            {isAssigned && (
                              <span className="mt-1 inline-block rounded-md bg-rose-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                VP assigned here
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-center text-[10px] text-slate-400">
        Hover a room for detail · move the cursor across the map to look around
      </p>
    </div>
  );
}
