"use client";

import { useEffect, useMemo, useState } from "react";
import { AGE_RULES, LANGUAGE_LABELS, LENGTH_RULES } from "@aistory/shared";
import { deleteStory, listStories, type SavedStory } from "@/lib/storage";
import { HeroAvatar } from "./HeroAvatar";
import { StarIcon, TrashIcon } from "./icons";
import { PrimaryButton } from "./ui";

interface Props {
  onOpen: (story: SavedStory) => void;
  onCreate: () => void;
  onShop: () => void;
}

export function Library({ onOpen, onCreate, onShop }: Props) {
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
        <button
          type="button"
          onClick={onShop}
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex h-11 items-center gap-1.5 rounded-full bg-card/90 px-4 text-sm font-bold text-rust-dark shadow-sm"
        >
          <StarIcon className="h-4 w-4" />
          取得更多故事
        </button>
        <div className="absolute bottom-2 left-4">
          <h1 className="font-display text-3xl font-bold tracking-widest text-teal">我的書櫃</h1>
          {stories && stories.length > 0 && (
            <p className="text-sm text-ink-soft">{stories.length} 個故事，沒有網路也能聽</p>
          )}
        </div>
      </header>

      {stories && stories.length === 0 && (
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

      {stories && stories.length > 0 && (
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
    <div className="relative aspect-[4/3] overflow-hidden rounded-l-sm rounded-r-2xl border-l-8 border-ink/25 shadow-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      <span className="absolute bottom-2 left-2 rounded-lg bg-card px-2 py-0.5 text-[11px] font-bold">{meta}</span>
      {!url && story.heroLook && (
        <HeroAvatar look={story.heroLook} size={42} variant="bust" className="absolute left-2 top-2 rounded-full ring-2 ring-card drop-shadow-sm" />
      )}
    </div>
  );
}
