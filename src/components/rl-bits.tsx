"use client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FindingStatus } from "@/lib/types";
import { AlertTriangle, CheckCircle2, CircleDot } from "lucide-react";

export function ChipStatus({ s, className }: { s: "H" | "M" | "-"; className?: string }) {
  if (s === "-") return <span className={cn("inline-flex h-6 min-w-8 items-center justify-center rounded border border-dashed border-slate-300 text-[11px] text-slate-400", className)}>-</span>;
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-8 items-center justify-center rounded text-[12px] font-bold text-white shadow-sm",
        s === "H" ? "bg-green-600" : "bg-red-600",
        className,
      )}
      title={s === "H" ? "HIJAU — Layak" : "MERAH — Tidak Layak"}
    >
      {s}
    </span>
  );
}

export function LevelBadge({ level, className }: { level: 1 | 2 | 3 | 4; className?: string }) {
  const style =
    level === 1
      ? "bg-lime-600"
      : level === 2
        ? "bg-amber-500"
        : level === 3
          ? "bg-orange-600"
          : "bg-red-700";
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold text-white", style, className)}>
      Lv.{level}
    </span>
  );
}

const STATUS_LABEL: Record<FindingStatus, string> = {
  OPEN: "Baru / Belum Ditindak",
  IN_PROGRESS: "Sedang Dikerjakan",
  SUBMITTED: "Bukti Terkirim — Menunggu Verifikasi",
  VERIFIED: "Bukti Disetujui Auditor",
  CLOSED: "Selesai & Ditutup",
};

export function StatusTemuanBadge({ status }: { status: FindingStatus }) {
  const map: Record<FindingStatus, string> = {
    OPEN: "bg-red-100 text-red-800 border-red-200",
    IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-200",
    SUBMITTED: "bg-sky-100 text-sky-800 border-sky-200",
    VERIFIED: "bg-violet-100 text-violet-800 border-violet-200",
    CLOSED: "bg-green-100 text-green-800 border-green-200",
  };
  return <Badge variant="outline" className={cn("text-[11px]", map[status])}>{STATUS_LABEL[status]}</Badge>;
}

export function StatusLabelTemuan(status: FindingStatus) {
  return STATUS_LABEL[status];
}

export function StatCard({ title, value, sub, icon, accent = "forest", className }: { title: string; value: string | number; sub?: string; icon?: React.ReactNode; accent?: "forest" | "red" | "gold" | "sky"; className?: string }) {
  const ring = {
    forest: "text-forest bg-forest-soft",
    red: "text-red-600 bg-red-50",
    gold: "text-gold-deep bg-gold-soft",
    sky: "text-sky-700 bg-sky-50",
  }[accent];
  return (
    <div className={cn("rounded-xl border bg-white p-4 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-800">{value}</p>
          {sub ? <p className="mt-1 text-[11px] text-slate-500">{sub}</p> : null}
        </div>
        {icon ? <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", ring)}>{icon}</div> : null}
      </div>
    </div>
  );
}

export function KartuBadge({ id, singkat }: { id: string; singkat: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">
      {id.replace("KMS-0", "K")} <span className="font-normal opacity-80">{singkat}</span>
    </span>
  );
}

export function SlaInfo({ target, base = "2026-11-23" }: { target: string; base?: string }) {
  const t = new Date(`${target}T00:00:00+07:00`).getTime();
  const b = new Date(`${base}T00:00:00+07:00`).getTime();
  const diff = Math.round((t - b) / 86400000);
  if (diff < 0)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600">
        <AlertTriangle className="h-3 w-3" /> Lewat {Math.abs(diff)} hari SLA
      </span>
    );
  if (diff === 0)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
        <CircleDot className="h-3 w-3" /> Jatuh tempo hari ini
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
      <CheckCircle2 className="h-3 w-3 text-green-600" /> Sisa {diff} hari (target {target.slice(8)}/{target.slice(5, 7)})
    </span>
  );
}
