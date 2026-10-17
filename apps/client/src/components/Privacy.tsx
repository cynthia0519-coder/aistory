"use client";

import { POLICY_UPDATED, PRIVACY_CONTACT, PRIVACY_OPERATOR } from "@/lib/privacy";
import { POLICY_INTRO, POLICY_SECTIONS } from "@/lib/privacy-policy";
import { BackButton } from "./ui";

interface Props {
  onBack: () => void;
}

export function Privacy({ onBack }: Props) {
  return (
    <div className="flex flex-col">
      <header className="relative h-40 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/scenes/night_sky.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_40%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-paper/0 via-paper/20 to-paper" />
        <BackButton onClick={onBack} label="返回" />
        <h1 className="absolute bottom-2 left-4 font-display text-3xl font-bold tracking-widest text-teal">隱私權政策</h1>
      </header>

      <div className="flex flex-col gap-6 px-4 pt-4">
        <p className="leading-relaxed">{POLICY_INTRO}</p>
        {POLICY_SECTIONS.map((s) => (
          <section key={s.heading} className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-bold">{s.heading}</h2>
            <ul className="flex flex-col divide-y divide-line rounded-2xl bg-card px-4 ring-2 ring-line">
              {s.items.map((t) => (
                <li key={t} className="py-3 text-sm leading-relaxed text-ink-soft">
                  {t}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {PRIVACY_CONTACT && (
          <p className="text-sm leading-relaxed text-ink-soft">
            有任何隱私問題，請寫信到{" "}
            <a href={`mailto:${PRIVACY_CONTACT}`} className="text-teal underline">
              {PRIVACY_CONTACT}
            </a>
            。
          </p>
        )}
        <p className="text-sm leading-relaxed text-ink-soft">本服務由{PRIVACY_OPERATOR}提供。</p>
        <p className="text-center text-sm text-ink-soft">最後更新：{POLICY_UPDATED}</p>
      </div>
    </div>
  );
}
