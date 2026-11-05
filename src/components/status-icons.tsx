import type { LucideIcon } from "lucide-react";
// Simpan sebagai ~/components/status-icons.tsx
// Catatan lucide versi lama: CircleCheck=CheckCircle2, CircleAlert=AlertCircle,
// CircleX=XCircle, CircleHelp=HelpCircle.
import type { ButtonHTMLAttributes, ReactNode } from "react";

import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CircleX,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  Hourglass,
  Thermometer,
} from "lucide-react";

import type { SubmissionStatus } from "~/lib/types";

import { Tip } from "~/components/ui";

export type StatusMeta = {
  label: string;
  cls: string;
  Icon: LucideIcon;
};

/** Ikon status + tooltip. Tiap status punya bentuk ikon berbeda, jadi maknanya tidak hanya lewat warna. */
export function StatusIcon({
  meta,
  side = "right",
}: Readonly<{
  meta: StatusMeta;
  side?: "left" | "right" | "top" | "bottom";
}>) {
  const { label, cls, Icon } = meta;
  return (
    <Tip
      tip={label}
      side={side}
    >
      <span
        role="img"
        aria-label={label}
        tabIndex={0}
        className={`inline-flex ${cls}`}
      >
        <Icon className="size-5" />
      </span>
    </Tip>
  );
}

/* ---------- pengumpulan tugas (halaman Pengumpulan + Tugas Saya) ---------- */

const SUBMISSION: Record<SubmissionStatus, StatusMeta> = {
  belum: {
    label: "Belum dikerjakan",
    cls: "text-base-content/40",
    Icon: CircleDashed,
  },
  berlangsung: {
    label: "Sedang dikerjakan",
    cls: "text-info",
    Icon: Hourglass,
  },
  diserahkan: {
    label: "Menunggu penilaian",
    cls: "text-warning",
    Icon: ClipboardList,
  },
  dinilai: {
    label: "Sudah dinilai",
    cls: "text-success",
    Icon: CircleCheck,
  },
};

const LATE: StatusMeta = {
  label: "Lewat tenggat",
  cls: "text-error",
  Icon: CircleAlert,
};

export function SubmissionStatusIcon({
  status,
  late = false,
}: Readonly<{
  status: SubmissionStatus;
  late?: boolean;
}>) {
  return <StatusIcon meta={late ? LATE : SUBMISSION[status]} />;
}

/* ---------- absensi (laporan) ---------- */

const ATTENDANCE: Record<string, StatusMeta> = {
  Hadir: {
    label: "Hadir",
    cls: "text-success",
    Icon: CircleCheck,
  },
  Sakit: {
    label: "Sakit",
    cls: "text-warning",
    Icon: Thermometer,
  },
  Izin: {
    label: "Izin",
    cls: "text-info",
    Icon: FileText,
  },
  Alpa: {
    label: "Alpa",
    cls: "text-error",
    Icon: CircleX,
  },
};

/** Di layar: ikon + tooltip. Saat dicetak: teks status (ikon dan tooltip tidak terbaca di kertas). */
export function AttendanceStatusIcon({ status }: Readonly<{ status: string }>) {
  const meta = ATTENDANCE[status] ?? {
    label: status || "Belum diisi",
    cls: "text-base-content/40",
    Icon: CircleHelp,
  };
  return (
    <>
      <span className="print:hidden">
        <StatusIcon meta={meta} />
      </span>
      <span className="hidden print:inline">{meta.label}</span>
    </>
  );
}

/* ---------- publikasi tugas (daftar tugas guru/admin) ---------- */

const PUBLISHED: StatusMeta = {
  label: "Terbit (terlihat siswa)",
  cls: "text-success",
  Icon: Eye,
};
const DRAFT: StatusMeta = {
  label: "Draft (belum terlihat siswa)",
  cls: "text-base-content/40",
  Icon: EyeOff,
};

export function PublishStatusIcon({
  published,
}: Readonly<{ published: boolean }>) {
  return <StatusIcon meta={published ? PUBLISHED : DRAFT} />;
}

/* ---------- header halaman ---------- */

/** Judul halaman + aksi di kanan. Judul dipatahkan bila panjang agar halaman tidak melebar di ponsel. */
export function PageHeader({
  title,
  subtitle,
  className = "",
  children,
}: Readonly<{
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  children?: ReactNode;
}>) {
  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-xl font-bold sm:text-2xl wrap-anywhere">{title}</h2>
        {subtitle}
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

/** Tombol aksi header: di ponsel hanya ikon, mulai layar sm ikon + teks. */
export function HeaderButton({
  label,
  icon,
  className = "btn-primary",
  ...rest
}: Readonly<
  {
    label: string;
    icon: ReactNode;
    className?: string;
  } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">
>) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`btn btn-sm ${className}`}
      {...rest}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
