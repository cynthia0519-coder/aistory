// 共用小元件：確保每一頁的按鈕、選項、標題長得一樣
import { useEffect, useId, type ReactNode } from "react";
import { BackIcon, CloseIcon } from "./icons";

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-12 rounded-2xl px-2 text-sm font-bold ${
        active ? "bg-teal text-paper" : "bg-card text-ink ring-2 ring-line"
      }`}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="h-14 w-full rounded-full bg-rust font-display text-xl font-bold tracking-widest text-card shadow-[0_5px_0_var(--color-rust-dark)] active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none"
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children, as: Tag = "h2" }: { children: ReactNode; as?: "h2" | "legend" | "span" }) {
  return <Tag className="mb-1 block font-display text-lg font-bold">{children}</Tag>;
}

/** 返回鍵：疊在插畫標頭左上角 */
export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-card/90 text-ink shadow-sm"
    >
      <BackIcon className="h-5 w-5" />
    </button>
  );
}

/** 置中對話框：遮罩 + 紙卡片。按 Esc 或遮罩可關閉 */
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-teal-dark/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-paper p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-ink-soft"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
        <h2 id={titleId} className="pr-10 font-display text-2xl font-bold tracking-wider text-teal">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
