"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AGE_RULES, LANGUAGE_LABELS } from "@aistory/shared";
import { requestStory, StoryApiError } from "@/lib/api";
import { saveStory, type SavedStory } from "@/lib/storage";
import { webSpeechNarrator as narrator } from "@/lib/tts";
import { BackIcon, PauseIcon, PlayIcon, RepeatIcon } from "./icons";
import { HeroAvatar } from "./HeroAvatar";
import { StoryLoading } from "./StoryLoading";

interface Props {
  story: SavedStory;
  onNewStory: (story: SavedStory) => void;
  onBack: () => void;
}

export function StoryReader({ story, onNewStory, onBack }: Props) {
  /** 正在念的段落；-1 代表標題，null 代表沒在念 */
  const [current, setCurrent] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  const thumbUrl = useMemo(() => (story.thumbnail ? URL.createObjectURL(story.thumbnail) : null), [story.thumbnail]);
  useEffect(() => () => {
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
  }, [thumbUrl]);

  useEffect(
    () => () => {
      runId.current++;
      narrator.stop();
    },
    [story.id],
  );

  // 一段一段念，才能知道念到哪裡、反白那一段
  function speakFrom(index: number, id: number) {
    if (id !== runId.current) return;
    if (index >= story.paragraphs.length) {
      setCurrent(null);
      return;
    }
    setCurrent(index);
    const text = index === -1 ? story.title : story.paragraphs[index];
    narrator.speak(text, story.language, () => speakFrom(index + 1, id));
  }

  function toggle() {
    if (current !== null) {
      runId.current++;
      narrator.stop();
      setCurrent(null);
      return;
    }
    speakFrom(-1, ++runId.current);
  }

  // 「再講一個」只送場景文字，不重傳照片
  async function another() {
    runId.current++;
    narrator.stop();
    setCurrent(null);
    setLoading(true);
    setError(null);
    try {
      const { story: next } = await requestStory({
        language: story.language,
        ageBand: story.ageBand,
        style: story.style ?? "cute",
        length: story.length ?? "3min",
        hero: story.hero,
        scene: story.scene,
        avoidTitle: story.title,
      });
      const saved: SavedStory = {
        ...next,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        language: story.language,
        ageBand: story.ageBand,
        style: story.style,
        length: story.length,
        hero: story.hero,
        heroLook: story.heroLook,
        thumbnail: story.thumbnail,
      };
      await saveStory(saved);
      onNewStory(saved);
    } catch (e) {
      setError(e instanceof StoryApiError ? e.message : "出了點問題，請再試一次。");
    } finally {
      setLoading(false);
    }
  }

  const playing = current !== null;
  const total = story.paragraphs.length;

  return (
    <article className="flex min-h-dvh flex-col">
      {loading && <StoryLoading previewUrl={thumbUrl} />}

      <header className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-paper-deep">
        {/* 場景插畫隨 App 打包（public/scenes），離線也看得到 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/scenes/${story.setting ?? "park"}.jpg`} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-paper/0 to-paper" />
        <button
          type="button"
          onClick={onBack}
          aria-label="返回書櫃"
          className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-card/90 text-ink shadow-sm"
        >
          <BackIcon className="h-5 w-5" />
        </button>
        {story.heroLook && (
          // 主角站在插畫右下角；標題在插畫下方、返回鍵在左上，都不會被擋到
          <HeroAvatar
            look={story.heroLook}
            size={150}
            variant="figure"
            className="pointer-events-none absolute bottom-2 right-5 drop-shadow-[0_2px_0_rgba(58,42,32,0.12)]"
          />
        )}
        {thumbUrl && (
          <div
            className={`absolute bottom-5 w-28 bg-card p-1.5 pb-4 shadow-lg ${
              story.heroLook ? "left-5 -rotate-3" : "right-5 rotate-3"
            }`}
          >
            <span className="absolute -top-2 left-8 h-4 w-12 -rotate-3 bg-mustard/80" aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbUrl} alt="這個故事的照片" className="aspect-[4/3] w-full object-cover" />
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-4 px-6 pb-48">
        <p className="text-center text-xs font-bold tracking-widest text-rust-dark">
          {LANGUAGE_LABELS[story.language]} · {AGE_RULES[story.ageBand].label}
        </p>
        <h1
          className={`text-center font-display text-3xl font-bold tracking-wider text-teal ${
            current === -1 ? "rounded-xl bg-highlight" : ""
          }`}
        >
          {story.title}
        </h1>

        <div className={`flex flex-col gap-3 font-display ${AGE_RULES[story.ageBand].fontClass}`}>
          {story.paragraphs.map((p, i) => (
            <p
              key={i}
              className={`-mx-2 rounded-xl px-2 py-1 transition-colors ${
                current === i ? "bg-highlight" : current !== null && i < current ? "text-ink-soft" : ""
              }`}
            >
              {p}
            </p>
          ))}
        </div>

        {error && <p className="rounded-2xl bg-rust/10 p-3 text-rust-dark">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md rounded-t-3xl bg-teal px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-paper">
        <div className="flex justify-center gap-1.5" aria-label={playing ? `第 ${Math.max(current, 0) + 1} 段，共 ${total} 段` : `共 ${total} 段`}>
          {story.paragraphs.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full ${
                current === i ? "w-8 bg-rust" : current !== null && i < current ? "w-4 bg-mustard" : "w-4 bg-paper/25"
              }`}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={another} disabled={loading} className="flex h-11 items-center gap-1.5 px-1 text-sm font-bold disabled:opacity-40">
            <RepeatIcon className="h-5 w-5" />
            再講一個
          </button>
          {narrator.isSupported() && (
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? "停止朗讀" : "念給我聽"}
              className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-rust text-card shadow-[0_5px_0_var(--color-rust-dark)] active:translate-y-1 active:shadow-none"
            >
              {playing ? <PauseIcon className="h-8 w-8" /> : <PlayIcon className="ml-1 h-8 w-8" />}
            </button>
          )}
          <button type="button" onClick={onBack} className="flex h-11 items-center gap-1.5 px-1 text-sm font-bold">
            回書櫃
          </button>
        </div>
      </div>
    </article>
  );
}
