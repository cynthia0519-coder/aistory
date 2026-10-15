"use client";

import { POLICY_UPDATED, PRIVACY_CONTACT } from "@/lib/privacy";
import { BackButton } from "./ui";

interface Props {
  onBack: () => void;
}

// 隱私權政策：內容要和程式實際行為一致。改了資料流向（例如照片多送去哪裡、多存什麼）要一起更新這裡，
// 並把 lib/privacy.ts 的 CONSENT_VERSION 加一。
const SECTIONS: { heading: string; items: string[] }[] = [
  {
    heading: "照片",
    items: [
      "照片只在你按下「編故事」時使用：手機先把照片縮小，傳到我們的伺服器，再轉給 AI（Anthropic Claude）看圖編故事。",
      "伺服器只在編故事的那幾秒處理照片，不寫進硬碟、資料庫或紀錄檔。",
      "手機裡只留一張很小的縮圖（最長邊 320 像素）當書封，原圖不會另外保存。",
      "請盡量不要拍孩子的臉、門牌、制服上的學校名稱等可以認出孩子的東西；拍玩具、寵物、晚餐、公園就很好。",
    ],
  },
  {
    heading: "孩子的資料",
    items: [
      "主角的名字、年齡、性別、喜歡的東西和卡通外觀，只存在這支手機裡。",
      "編故事時，名字、年齡、性別和喜歡的東西會連同照片一起傳給 AI，讓故事的主角變成你的孩子；這些資料同樣不會保存在伺服器。",
      "朗讀故事時，故事文字（包含主角的名字）會傳給 Microsoft Azure 合成語音，合成好的聲音存在手機裡，下次不用再傳。",
    ],
  },
  {
    heading: "故事與爸媽的錄音",
    items: [
      "編好的故事、爸媽錄的聲音都只存在這支手機的瀏覽器資料裡，不會上傳。",
      "錄音備份是你自己匯出的檔案，存到哪裡、分享給誰由你決定。",
      "刪除故事會一併刪除它的錄音；清除瀏覽器資料或刪除 App，所有資料就會從手機上消失，我們也無法替你找回。",
    ],
  },
  {
    heading: "伺服器記錄的東西",
    items: [
      "為了防止濫用，伺服器會計算每個連線位址（IP）的使用次數。位址先經過雜湊處理、不存原始位址，計數最長 24 小時後自動清除。",
      "主機服務商（Vercel）會依其政策保留一般的連線紀錄（時間、網址、位址），內容不包含照片與故事。",
    ],
  },
  {
    heading: "我們合作的服務",
    items: [
      "Anthropic（Claude）：看照片、編故事。",
      "Microsoft Azure：朗讀語音。",
      "Vercel：網站與伺服器主機。",
      "Upstash：使用次數計數。",
      "我們不賣資料、不放廣告追蹤，也不把孩子的資料用在編故事以外的地方。",
    ],
  },
  {
    heading: "家長同意",
    items: [
      "這個服務是給爸媽陪孩子用的。第一次拍照前，我們會請爸爸媽媽或監護人確認並同意以上說明。",
      "政策有重要變更時，會在下一次拍照前再請你確認一次。",
    ],
  },
];

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
        <p className="leading-relaxed">
          照片說故事是給爸媽和孩子一起用的。我們把能留在手機裡的都留在手機裡，必須送出去的只用來編故事和朗讀。
        </p>
        {SECTIONS.map((s) => (
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
        <p className="text-center text-sm text-ink-soft">最後更新：{POLICY_UPDATED}</p>
      </div>
    </div>
  );
}
