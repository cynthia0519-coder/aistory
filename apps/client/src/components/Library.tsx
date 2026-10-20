"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AGE_BANDS,
  AGE_RULES,
  ageBandFor,
  LANGUAGE_LABELS,
  LANGUAGES,
  LENGTH_RULES,
  STYLE_RULES,
  THEMES,
  type LibraryStory,
} from "@aistory/shared";
import { deleteStory, latestChapters, listSeries, listStories, seriesOf, type SavedStory } from "@/lib/storage";
import { SERIES_CHAPTERS } from "@aistory/shared";
import { lookOf, type HeroProfile } from "@/lib/heroes";
import { ageRangeLabel, CATEGORY_CHIPS, draftMode, filterLibrary, loadLibrary, renderForHero, visibleLibrary, type LibraryPrefs } from "@/lib/library";
import { sceneSrc } from "@/lib/scenes";
import { BackupError, exportBackup, hasRecordings, importBackup, shareBackup } from "@/lib/backup";
import { canUse } from "@/lib/membership";
import { HeroAvatar } from "./HeroAvatar";
import { LockIcon, StarIcon, TrashIcon } from "./icons";
import { PrimaryButton } from "./ui";

interface Props {
  prefs: LibraryPrefs;
  onPrefs: (prefs: LibraryPrefs) => void;
  hero: HeroProfile | null;
  onOpen: (story: SavedStory) => void;
  /** 開啟故事庫的故事；list 是目前篩選下的清單，給「下一個故事」用 */
  onOpenLibrary: (list: LibraryStory[], index: number) => void;
  onCreate: () => void;
  onShop: () => void;
  onCredits: () => void;
  onPrivacy: () => void;
}

const TABS = [
  { id: "mine", label: "我的書櫃" },
  { id: "library", label: "故事庫" },
] as const;

export function Library({ prefs, onPrefs, hero, onOpen, onOpenLibrary, onCreate, onShop, onCredits, onPrivacy }: Props) {
  const [stories, setStories] = useState<SavedStory[] | null>(null);

  useEffect(() => {
    listStories().then(setStories);
  }, []);

  // 書櫃上一套連載只放最新一集，刪除就整套一起刪
  async function remove(story: SavedStory) {
    const chapters = await listSeries(seriesOf(story).id);
    if (!confirm(chapters.length > 1 ? `確定刪除這套連載（${chapters.length} 集）？` : "確定刪除這個故事？")) return;
    for (const c of chapters) await deleteStory(c.id);
    const gone = new Set(chapters.map((c) => c.id));
    setStories((s) => s?.filter((x) => !gone.has(x.id)) ?? null);
  }
  const shelf = useMemo(() => (stories ? latestChapters(stories) : null), [stories]);

  return (
    <div className="flex flex-col">
      <header className="relative h-40 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/scenes/home.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_35%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-paper/0 via-paper/20 to-paper" />
        <div
          role="group"
          aria-label="書櫃分頁"
          className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex rounded-full bg-card/90 p-1 shadow-sm"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={prefs.tab === t.id}
              onClick={() => onPrefs({ ...prefs, tab: t.id })}
              className={`h-9 rounded-full px-3 text-sm font-bold ${prefs.tab === t.id ? "bg-teal text-paper" : "text-ink"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onShop}
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex h-11 items-center gap-1.5 rounded-full bg-card/90 px-4 text-sm font-bold text-rust-dark shadow-sm"
        >
          <StarIcon className="h-4 w-4" />
          取得更多故事
        </button>
        <div className="absolute bottom-2 left-4">
          <h1 className="font-display text-3xl font-bold tracking-widest text-teal">
            {prefs.tab === "mine" ? "我的書櫃" : "故事庫"}
          </h1>
          {prefs.tab === "mine" && stories && stories.length > 0 && (
            <p className="text-sm text-ink-soft">{stories.length} 個故事，沒有網路也能聽</p>
          )}
          {prefs.tab === "library" && (
            <p className="text-sm text-ink-soft">
              {hero ? `主角是${hero.name}，不用拍照就能聽` : "不用拍照就能聽，設定主角會換成小朋友的名字"}
            </p>
          )}
        </div>
      </header>

      {prefs.tab === "library" && <LibraryShelf prefs={prefs} onPrefs={onPrefs} hero={hero} onOpen={onOpenLibrary} />}

      {prefs.tab === "mine" && stories && stories.length === 0 && (
        <div className="flex flex-col items-center gap-5 px-8 pt-8 text-center">
          <p className="font-display text-xl leading-relaxed">
            書櫃還是空的
            <br />
            拍一張照片，編第一個故事吧
          </p>
          <div className="w-full">
            <PrimaryButton onClick={onCreate}>去編故事</PrimaryButton>
          </div>
        </div>
      )}

      {prefs.tab === "mine" && stories && stories.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5 px-4 pt-4">
          {shelf?.map((s) => (
            <li key={s.id} className="relative">
              <button type="button" onClick={() => onOpen(s)} className="flex w-full flex-col gap-2 text-left">
                <Cover story={s} />
                {s.series && (
                  <span className="self-start rounded-full bg-mustard px-2 py-0.5 text-xs font-bold text-ink">
                    連載 {s.series.chapter}/{SERIES_CHAPTERS}
                  </span>
                )}
                <span className="line-clamp-2 font-display text-base font-bold leading-snug">{s.title}</span>
              </button>
              <button
                type="button"
                onClick={() => remove(s)}
                aria-label={`刪除「${s.title}」`}
                className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-ink-soft"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {prefs.tab === "mine" && stories && (
        <BackupCard onShop={onShop} onImported={() => listStories().then(setStories)} />
      )}

      <div className="mt-8 flex justify-center">
        <button type="button" onClick={onPrivacy} className="h-11 px-4 text-sm text-ink-soft underline">
          隱私權政策
        </button>
        <button type="button" onClick={onCredits} className="h-11 px-4 text-sm text-ink-soft underline">
          授權與致謝
        </button>
      </div>
    </div>
  );
}

// 故事庫分頁：語言、年齡篩選與書封
function LibraryShelf({
  prefs,
  onPrefs,
  hero,
  onOpen,
}: {
  prefs: LibraryPrefs;
  onPrefs: (prefs: LibraryPrefs) => void;
  hero: HeroProfile | null;
  onOpen: (list: LibraryStory[], index: number) => void;
}) {
  const [all, setAll] = useState<LibraryStory[] | null>(null);
  const [drafts, setDrafts] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadLibrary()
      .then((s) => {
        if (!alive) return;
        const showDrafts = draftMode();
        setDrafts(showDrafts);
        setAll(visibleLibrary(s, showDrafts));
        setFailed(false);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [attempt]);

  // 沒選過年齡就跟著主角的年齡層，沒有主角就全部
  const age = prefs.age ?? (hero ? ageBandFor(hero.age) : "all");
  const category = prefs.category;
  const list = useMemo(() => (all ? filterLibrary(all, age, category) : []), [all, age, category]);
  const look = hero ? lookOf(hero) : null;

  return (
    <div className="flex flex-col gap-3 px-4 pt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-lg font-bold">故事語言</span>
        <div role="group" aria-label="故事語言" className="flex rounded-full bg-card p-1 shadow-sm ring-2 ring-line">
          {LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={prefs.language === l}
              onClick={() => onPrefs({ ...prefs, language: l })}
              className={`h-8 rounded-full px-3 text-sm font-bold ${prefs.language === l ? "bg-teal text-paper" : "text-ink"}`}
            >
              {l === "zh" ? LANGUAGE_LABELS.zh : "英文"}
            </button>
          ))}
        </div>
      </div>

      {/* 主題分類：爸媽依生活中的需要挑故事；沒有主題的故事只在「全部」 */}
      <div role="group" aria-label="主題" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
        {CATEGORY_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={category === c.id}
            onClick={() => onPrefs({ ...prefs, category: c.id })}
            className={`h-10 flex-1 shrink-0 whitespace-nowrap rounded-full px-3 text-sm font-bold ${
              category === c.id ? "bg-rust text-card" : "bg-card text-ink ring-2 ring-line"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="年齡" className="grid grid-cols-5 gap-1.5">
        {(["all", ...AGE_BANDS] as const).map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={age === a}
            onClick={() => onPrefs({ ...prefs, age: a })}
            className={`h-10 whitespace-nowrap rounded-full px-1 text-sm font-bold ${
              age === a ? "bg-teal text-paper" : "bg-card text-ink ring-2 ring-line"
            }`}
          >
            {a === "all" ? "全部" : AGE_RULES[a].label}
          </button>
        ))}
      </div>

      {failed && (
        <div className="flex flex-col items-center gap-3 pt-6 text-center">
          <p className="font-display text-lg">故事庫打不開，連上網路後再試一次</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="h-11 rounded-full bg-card px-5 font-bold ring-2 ring-line">
            再試一次
          </button>
        </div>
      )}

      {drafts && all && (
        <p className="rounded-2xl bg-card px-4 py-2 text-sm font-bold ring-2 ring-rust">
          審稿模式：草稿也會顯示（{all.filter((s) => s.draft).length} 則）。網址加 ?drafts=0 關閉。
        </p>
      )}

      {all && all.length === 0 && <p className="pt-6 text-center font-display text-lg">故事庫正在整理，很快就有新故事</p>}

      {all && all.length > 0 && list.length === 0 && (
        <p className="pt-6 text-center font-display text-lg">
          {category === "all" ? "這個年齡還沒有故事，看看「全部」吧" : "這個主題還沒有適合的故事，換個年齡或主題看看"}
        </p>
      )}

      {list.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5 pt-1">
          {list.map((s, i) => {
            const { title } = renderForHero(s, prefs.language, hero);
            return (
              <li key={s.id}>
                <button type="button" onClick={() => onOpen(list, i)} className="flex w-full flex-col gap-2 text-left">
                  <BookCover
                    src={sceneSrc(s.setting, s.theme, s.id)}
                    label={`${drafts && s.draft ? "草稿 · " : ""}${s.theme ? THEMES[s.theme].label.zh : STYLE_RULES[s.style].label} · ${ageRangeLabel(s.ageBands)}`}
                  >
                    {look && (
                      <HeroAvatar look={look} size={42} variant="bust" className="absolute left-2 top-2 rounded-full ring-2 ring-card drop-shadow-sm" />
                    )}
                  </BookCover>
                  <span className="line-clamp-2 font-display text-base font-bold leading-snug">{title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** 書封外框：書背、圓角、左下角標籤；書櫃與故事庫共用 */
function BookCover({ src, label, children }: { src: string; label: string; children?: React.ReactNode }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-l-sm rounded-r-2xl border-l-8 border-ink/25 shadow-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-lg bg-card px-2 py-0.5 text-[11px] font-bold">
        {label}
      </span>
      {children}
    </div>
  );
}

// 封面：有照片縮圖用照片，舊故事沒有就用場景插畫
function Cover({ story }: { story: SavedStory }) {
  const url = useMemo(() => (story.thumbnail ? URL.createObjectURL(story.thumbnail) : null), [story.thumbnail]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  const src = url ?? sceneSrc(story.setting, story.theme, story.id);
  const meta = [
    LANGUAGE_LABELS[story.language] === "中文" ? "中" : "EN",
    AGE_RULES[story.ageBand].label,
    story.length ? LENGTH_RULES[story.length].label : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <BookCover src={src} label={meta}>
      {!url && story.heroLook && (
        <HeroAvatar look={story.heroLook} size={42} variant="bust" className="absolute left-2 top-2 rounded-full ring-2 ring-card drop-shadow-sm" />
      )}
    </BookCover>
  );
}

/** 錄音備份：換手機時把爸媽的錄音、書櫃和主角帶過去。匯出是會員權益，匯入不限 */
function BackupCard({ onShop, onImported }: { onShop: () => void; onImported: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function doExport() {
    if (!canUse("recordingBackup")) return onShop();
    setBusy(true);
    setMessage(null);
    try {
      if (!(await hasRecordings())) {
        setMessage("還沒有錄音。打開故事，選「錄我的聲音」就能錄。");
        return;
      }
      const { file, summary } = await exportBackup();
      await shareBackup(file);
      setMessage(`備份了 ${summary.recordings} 段錄音、${summary.stories} 個故事。把檔案存到「檔案」或雲端硬碟，換手機後再匯入。`);
    } catch {
      setMessage("備份失敗，再試一次。");
    } finally {
      setBusy(false);
    }
  }

  async function doImport(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const s = await importBackup(file);
      setMessage(`匯入了 ${s.recordings} 段錄音、${s.stories} 個故事、${s.heroes} 位主角。`);
      onImported();
    } catch (e) {
      setMessage(e instanceof BackupError ? e.message : "匯入失敗，手機空間可能不夠。");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="mx-4 mt-8 flex flex-col gap-2 rounded-2xl bg-card p-4 ring-2 ring-line">
      <h2 className="font-display text-lg font-bold">錄音備份</h2>
      <p className="text-sm leading-relaxed text-ink-soft">
        爸媽的錄音只存在這支手機。換手機前先備份，到新手機再匯入，錄音和書櫃都會回來。
      </p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void doExport()}
          disabled={busy}
          className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-teal px-3 text-sm font-bold text-paper disabled:opacity-40"
        >
          {!canUse("recordingBackup") && <LockIcon className="h-4 w-4" />}
          匯出備份
        </button>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="h-11 rounded-full bg-card px-3 text-sm font-bold ring-2 ring-line disabled:opacity-40"
        >
          匯入備份
        </button>
      </div>
      {/* 不設 accept：iOS 的檔案選擇器會把不認得的副檔名反灰 */}
      <input ref={input} type="file" hidden onChange={(e) => void doImport(e.target.files?.[0])} />
      {message && <p className="text-sm leading-relaxed text-rust-dark">{message}</p>}
    </section>
  );
}
