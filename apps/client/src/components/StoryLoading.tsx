"use client";

import { useState } from "react";

// 等待畫面：AI 寫故事要 10–60 秒，給家長跟小孩一件事做
const QUESTIONS = [
  "你覺得照片裡最可愛的是什麼？",
  "如果你在照片裡，你想做什麼？",
  "猜猜看，故事主角會遇到誰？",
  "你最喜歡的顏色是什麼？",
];

export function StoryLoading({ previewUrl }: { previewUrl?: string | null }) {
  const [question] = useState(() => QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center gap-6 overflow-hidden bg-teal px-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(5rem,env(safe-area-inset-top))] text-paper"
    >
      <svg aria-hidden="true" viewBox="0 0 390 844" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <g fill="#f2c14e">
          <path d="M50 80l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
          <path d="M330 130l2 5 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1z" />
          <path d="M318 470l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" />
          <path d="M48 440l2 5 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1z" />
        </g>
        <path d="M0 720c60-26 130-30 200-10s140 18 190-6v140H0z" fill="#17303e" />
      </svg>

      <div className="relative h-56 w-56">
        <svg aria-hidden="true" viewBox="0 0 220 220" className="absolute inset-0">
          <path d="M140 16a96 96 0 1 0 64 142A80 80 0 1 1 140 16z" fill="#f2c14e" />
        </svg>
        <div className="absolute left-8 top-12 h-32 w-32 overflow-hidden rounded-full border-[5px] border-paper bg-sage">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
      </div>

      <div className="relative flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-3xl font-bold tracking-widest">故事精靈正在想</h1>
        <p className="text-sm text-paper/80">大約 10 到 60 秒，故事越長等越久</p>
      </div>

      <div className="relative flex gap-3" aria-hidden="true">
        <span className="h-3 w-3 animate-bounce rounded-full bg-mustard" />
        <span className="h-3 w-3 animate-bounce rounded-full bg-rust [animation-delay:150ms]" />
        <span className="h-3 w-3 animate-bounce rounded-full bg-paper/60 [animation-delay:300ms]" />
      </div>

      <div className="relative mt-auto w-full max-w-sm rounded-2xl bg-paper px-5 py-4 text-ink">
        <p className="text-xs font-bold tracking-widest text-rust-dark">等待的時候，問問小朋友</p>
        <p className="mt-1 font-display text-xl leading-relaxed">{question}</p>
      </div>
    </div>
  );
}
