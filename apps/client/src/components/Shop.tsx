"use client";

import { useCallback, useId, useState } from "react";
import { PRICING, type PricingPlan } from "@/lib/pricing";
import { LockIcon, MoonIcon } from "./icons";
import { BackButton, Dialog, PrimaryButton } from "./ui";

interface Props {
  onBack: () => void;
}

// 購買頁：目前只有畫面，還沒接真正的付款，也不限制編故事
export function Shop({ onBack }: Props) {
  const [plan, setPlan] = useState<PricingPlan["id"]>(PRICING.defaultPlan);
  const [gateOpen, setGateOpen] = useState(false);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);
  const closeGate = useCallback(() => setGateOpen(false), []);
  const closeNotice = useCallback(() => setNotice(null), []);

  function passed() {
    setGateOpen(false);
    setNotice({ title: "付款功能開發中", body: "謝謝支持！付款功能還在準備，目前編故事不用付費，可以繼續使用。" });
  }

  function soon(what: string) {
    setNotice({ title: "即將推出", body: `「${what}」還在準備中，敬請期待。` });
  }

  return (
    <div className="flex flex-col">
      <header className="relative h-52 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/scenes/night_sky.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-b from-paper/0 via-paper/10 to-paper" />
        <BackButton onClick={onBack} label="返回書櫃" />
        <div className="absolute bottom-2 left-4 right-4">
          <h1 className="font-display text-3xl font-bold tracking-widest text-teal">每天晚上都有新故事</h1>
          <p className="text-sm text-ink-soft">用孩子的照片，編只屬於他的睡前故事</p>
        </div>
      </header>

      <div className="flex flex-col gap-5 px-4 pt-4">
        <div role="group" aria-label="購買方案" className="flex flex-col gap-3">
          {PRICING.plans.map((p) => {
            const active = plan === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => setPlan(p.id)}
                className={`relative flex min-h-20 items-center gap-3 rounded-2xl px-4 py-3 text-left ${
                  active ? "bg-card ring-[3px] ring-rust" : "bg-card ring-2 ring-line"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    active ? "border-rust" : "border-line"
                  }`}
                >
                  {active && <span className="h-3 w-3 rounded-full bg-rust" />}
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="font-display text-lg font-bold">{p.title}</span>
                  <span className="text-xs text-ink-soft">{p.detail}</span>
                </span>
                <span className={`shrink-0 text-right font-bold ${p.price ? "text-ink" : "text-sm text-ink-soft"}`}>
                  {p.price ?? "即將推出"}
                </span>
                {p.badge && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-mustard px-2.5 py-0.5 text-xs font-bold text-ink shadow-sm">
                    {p.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <ul className="flex flex-col gap-2 rounded-2xl bg-paper-deep px-4 py-3 text-sm text-ink-soft">
          <li className="flex items-center gap-2">
            <MoonIcon className="h-4 w-4 shrink-0 text-teal" />
            故事存在手機裡，沒有網路也能聽
          </li>
          <li className="flex items-center gap-2">
            <LockIcon className="h-4 w-4 shrink-0 text-teal" />
            照片不會保存在伺服器
          </li>
        </ul>

        <PrimaryButton onClick={() => setGateOpen(true)}>請爸爸媽媽確認購買</PrimaryButton>

        <nav aria-label="購買相關" className="flex justify-center gap-2 text-sm text-ink-soft">
          {["回復購買", "條款", "隱私"].map((label) => (
            <button key={label} type="button" onClick={() => soon(label)} className="h-11 px-3 underline">
              {label}
            </button>
          ))}
        </nav>
      </div>

      {gateOpen && <ParentalGate onPass={passed} onClose={closeGate} />}
      {notice && (
        <Dialog title={notice.title} onClose={closeNotice}>
          <p className="leading-relaxed text-ink-soft">{notice.body}</p>
          <PrimaryButton onClick={closeNotice}>好</PrimaryButton>
        </Dialog>
      )}
    </div>
  );
}

function newQuestion() {
  const a = 10 + Math.floor(Math.random() * 40);
  const b = 10 + Math.floor(Math.random() * 40);
  return { a, b };
}

/** 家長確認：兩位數加法，答對才繼續（避免小朋友誤觸購買） */
function ParentalGate({ onPass, onClose }: { onPass: () => void; onClose: () => void }) {
  const [q, setQ] = useState(newQuestion);
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);
  const inputId = useId();

  function check(e: React.FormEvent) {
    e.preventDefault();
    if (Number(answer) === q.a + q.b) {
      onPass();
      return;
    }
    setWrong(true);
    setAnswer("");
    setQ(newQuestion());
  }

  return (
    <Dialog title="請爸爸媽媽確認" onClose={onClose}>
      <form onSubmit={check} className="flex flex-col gap-4">
        <label htmlFor={inputId} className="flex flex-col gap-1">
          <span className="text-sm text-ink-soft">請回答下面的問題再繼續</span>
          <span className="font-display text-4xl font-bold tracking-wider">
            {q.a} + {q.b} = ?
          </span>
        </label>
        <input
          id={inputId}
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value.replace(/\D/g, ""));
            setWrong(false);
          }}
          inputMode="numeric"
          autoComplete="off"
          maxLength={3}
          autoFocus
          aria-invalid={wrong}
          aria-describedby={wrong ? `${inputId}-err` : undefined}
          className={`h-14 rounded-2xl bg-card px-4 text-center font-display text-3xl outline-none ring-2 focus:ring-teal ${
            wrong ? "ring-rust" : "ring-line"
          }`}
        />
        {wrong && (
          <p id={`${inputId}-err`} role="alert" className="text-sm font-bold text-rust-dark">
            答案不對，換一題再試試
          </p>
        )}
        <PrimaryButton type="submit" disabled={!answer}>
          確認
        </PrimaryButton>
      </form>
    </Dialog>
  );
}
