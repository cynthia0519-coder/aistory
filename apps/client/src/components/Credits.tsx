"use client";

import { BackButton } from "./ui";

interface Props {
  onBack: () => void;
}

interface Credit {
  title: string;
  body: string;
  link?: { label: string; href: string };
}

// 授權與致謝：App 裡用到的素材來源與授權。換素材或加套件時一起更新這裡。
const SECTIONS: { heading: string; items: Credit[] }[] = [
  {
    heading: "聲音",
    items: [
      {
        title: "背景音樂與音效",
        body: "由 Mureka AI 生成，已取得商用授權。",
        link: { label: "mureka.ai", href: "https://www.mureka.ai" },
      },
      {
        title: "朗讀語音",
        body: "連上網路時使用 Microsoft Azure 神經語音；離線時使用裝置內建的語音。",
      },
    ],
  },
  {
    heading: "圖像",
    items: [
      { title: "場景插畫", body: "以 Canva AI 生成。" },
      { title: "卡通主角", body: "本 App 以程式繪製。" },
      {
        title: "字型：霞鶩文楷 TC（LXGW WenKai TC）",
        body: "© The LXGW WenKai TC Project Authors，以 SIL Open Font License 1.1 授權。",
        link: { label: "授權條款", href: "https://openfontlicense.org" },
      },
    ],
  },
  {
    heading: "故事",
    items: [
      {
        title: "故事內容",
        body: "由 AI（Anthropic Claude）協助撰寫，故事庫經人工審稿。照片只用來編故事，不會保存在伺服器（詳見隱私權政策）。",
      },
    ],
  },
  {
    heading: "開放原始碼",
    items: [
      { title: "Next.js、React", body: "MIT License" },
      { title: "idb", body: "ISC License" },
    ],
  },
];

export function Credits({ onBack }: Props) {
  return (
    <div className="flex flex-col">
      <header className="relative h-40 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/scenes/forest.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_40%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-paper/0 via-paper/20 to-paper" />
        <BackButton onClick={onBack} label="返回" />
        <h1 className="absolute bottom-2 left-4 font-display text-3xl font-bold tracking-widest text-teal">授權與致謝</h1>
      </header>

      <div className="flex flex-col gap-6 px-4 pt-4">
        {SECTIONS.map((s) => (
          <section key={s.heading} className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-bold">{s.heading}</h2>
            <ul className="flex flex-col divide-y divide-line rounded-2xl bg-card px-4 ring-2 ring-line">
              {s.items.map((c) => (
                <li key={c.title} className="flex flex-col gap-0.5 py-3">
                  <span className="font-bold">{c.title}</span>
                  <span className="text-sm leading-relaxed text-ink-soft">{c.body}</span>
                  {c.link && (
                    <a href={c.link.href} target="_blank" rel="noreferrer" className="text-sm text-teal underline">
                      {c.link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-center text-sm text-ink-soft">謝謝陪孩子一起聽故事的你。</p>
      </div>
    </div>
  );
}
