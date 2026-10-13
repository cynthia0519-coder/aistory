"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AGE_BANDS,
  AGE_RULES,
  ageBandFor,
  LANGUAGE_LABELS,
  LANGUAGES,
  LENGTH_RULES,
  STYLE_RULES,
  type LibraryStory,
} from "@aistory/shared";
import { deleteStory, listStories, type SavedStory } from "@/lib/storage";
import { lookOf, type HeroProfile } from "@/lib/heroes";
import { ageRangeLabel, filterLibrary, loadLibrary, renderForHero, type LibraryPrefs } from "@/lib/library";
import { HeroAvatar } from "./HeroAvatar";
import { StarIcon, TrashIcon } from "./icons";
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
}

const TABS = [
  { id: "mine", label: "我的書櫃" },
  { id: "library", label: "故事庫" },
] as const;

export function Library({ prefs, onPrefs, hero, onOpen, onOpenLibrary, onCreate, onShop }: Props) {
  const [stories, setStories] = useState<SavedStory[] | null>(null);

  useEffect(() => {
    listStories().then(setStories);
  }, []);

  async function remove(id: string) {
    if (!confirm("確定刪除這個故事？")) return;
    await deleteStory(id);
    setStories((s) => s?.filter((x) => x.id !== id) ?? null);
  }

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
          {stories.map((s) => (
            <li key={s.id} className="relative">
              <button type="button" onClick={() => onOpen(s)} className="flex w-full flex-col gap-2 text-left">
                <Cover story={s} />
                <span className="line-clamp-2 font-display text-base font-bold leading-snug">{s.title}</span>
              </button>
              <button
                type="button"
                onClick={() => remove(s.id)}
                aria-label={`刪除「${s.title}」`}
                className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-ink-soft"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
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
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadLibrary()
      .then((s) => {
        if (!alive) return;
        setAll(s);
        setFailed(false);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [attempt]);

  // 沒選過年齡就跟著主角的年齡層，沒有主角就全部
  const age = prefs.age ?? (hero ? ageBandFor(hero.age) : "all");
  const list = useMemo(() => (all ? filterLibrary(all, age) : []), [all, age]);
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
              {l === "zh" ? LANGUAGE_LABELS.zh : "EN"}
            </button>
          ))}
        </div>
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

      {all && list.length === 0 && <p className="pt-6 text-center font-display text-lg">這個年齡還沒有故事，看看「全部」吧</p>}

      {list.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5 pt-1">
          {list.map((s, i) => {
            const { title } = renderForHero(s, prefs.language, hero);
            return (
              <li key={s.id}>
                <button type="button" onClick={() => onOpen(list, i)} className="flex w-full flex-col gap-2 text-left">
                  <BookCover src={`/scenes/${s.setting}.jpg`} label={`${STYLE_RULES[s.style].label} · ${ageRangeLabel(s.ageBands)}`}>
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
      <span className="absolute bottom-2 left-2 rounded-lg bg-card px-2 py-0.5 text-[11px] font-bold">{label}</span>
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
  const src = url ?? `/scenes/${story.setting ?? "park"}.jpg`;
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
