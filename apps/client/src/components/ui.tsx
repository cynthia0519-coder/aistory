// 共用小元件：確保每一頁的按鈕、選項、標題長得一樣
import type { ReactNode } from "react";

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
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-14 rounded-full bg-rust font-display text-xl font-bold tracking-widest text-card shadow-[0_5px_0_var(--color-rust-dark)] active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none"
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children, as: Tag = "h2" }: { children: ReactNode; as?: "h2" | "legend" }) {
  return <Tag className="mb-1 font-display text-lg font-bold">{children}</Tag>;
}
