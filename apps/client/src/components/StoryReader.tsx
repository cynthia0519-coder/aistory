"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AGE_RULES, LANGUAGE_LABELS, THEMES, type ParentGuide } from "@aistory/shared";
import { requestStory, StoryApiError } from "@/lib/api";
import { saveStory, type SavedStory } from "@/lib/storage";
import { bgm, loadMusicPref, saveMusicPref } from "@/lib/bgm";
import { narrator } from "@/lib/tts";
import { BackIcon, MusicIcon, MusicOffIcon, PauseIcon, PlayIcon, RepeatIcon } from "./icons";
import { HeroAvatar } from "./HeroAvatar";
import { StoryLoading } from "./StoryLoading";

/** 段落之間的小停頓：讓背景音樂浮上來一點，聽起來不趕 */
const PARAGRAPH_GAP_MS = 600;
/** 開場音效的長度，念標題前先等它響一下 */
const START_DELAY_MS = 1200;

interface Props {
  story: SavedStory;
  onNewStory: (story: SavedStory) => void;
  onBack: () => void;
  /**
   * 故事庫的故事不呼叫 API：給函式就把「再講一個」換成「下一個故事」，
   * 給 null 就不顯示這個按鈕；不給（undefined）才是一般的「再講一個」
   */
  onNext?: (() => void) | null;
}

export function StoryReader({ story, onNewStory, onBack, onNext }: Props) {
  /** 正在念的段落；-1 代表標題，null 代表沒在念 */
  const [current, setCurrent] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 背景音樂開關（記在 localStorage）；閱讀頁只在瀏覽器裡渲染，可以直接讀 */
  const [musicOn, setMusicOn] = useState(loadMusicPref);
  const runId = useRef(0);

  const thumbUrl = useMemo(() => (story.thumbnail ? URL.createObjectURL(story.thumbnail) : null), [story.thumbnail]);
  useEffect(() => () => {
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
  }, [thumbUrl]);

  useEffect(
    () => () => {
      runId.current++;
      narrator.stop();
      bgm.stop();
    },
    [story.id],
  );

  // 一段一段念，才能知道念到哪裡、反白那一段
  function speakFrom(index: number, id: number) {
    if (id !== runId.current) return;
    if (index >= story.paragraphs.length) {
      setCurrent(null);
      bgm.end();
      return;
    }
    setCurrent(index);
    const text = index === -1 ? story.title : story.paragraphs[index];
    bgm.duck(true);
    narrator.speak(text, story.language, () => {
      if (id !== runId.current) return;
      bgm.duck(false);
      setTimeout(() => speakFrom(index + 1, id), PARAGRAPH_GAP_MS);
    });
    // 念這段的同時先準備下一段
    const next = story.paragraphs[index + 1];
    if (next) narrator.prefetch?.(next, story.language);
  }

  function toggle() {
    if (current !== null) {
      runId.current++;
      narrator.stop();
      bgm.stop();
      setCurrent(null);
      return;
    }
    // 以下都要在按鈕的手勢裡同步執行，iOS 才允許播放聲音
    narrator.prepare?.();
    bgm.setEnabled(musicOn);
    bgm.start(story.style ?? "bedtime", story.theme);
    const id = ++runId.current;
    // 開場音效響一下再開始念；音效關掉時不用等
    setCurrent(-1);
    setTimeout(() => speakFrom(-1, id), musicOn ? START_DELAY_MS : 0);
  }

  function toggleMusic() {
    const next = !musicOn;
    setMusicOn(next);
    saveMusicPref(next);
    bgm.setEnabled(next);
  }

  // 「再講一個」只送場景文字，不重傳照片
  async function another() {
    runId.current++;
    narrator.stop();
    bgm.stop();
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
        theme: story.theme,
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
        theme: story.theme,
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

        {/* 引導卡是給大人看的，不在朗讀範圍內（speakFrom 只念標題與段落） */}
        {story.guide && (
          <GuideCard guide={story.guide} showHotline={!!story.theme && THEMES[story.theme]?.category === "body"} />
        )}

        {error && <p className="rounded-2xl bg-rust/10 p-3 text-rust-dark">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md rounded-t-3xl bg-teal px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-paper min-[360px]:px-6">
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
        {/* 三欄：播放鍵永遠置中，左右兩邊寬度不同也不會偏 */}
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center">
          {onNext === null ? (
            <span aria-hidden="true" />
          ) : (
            <button
              type="button"
              onClick={onNext ?? another}
              disabled={loading}
              className="flex h-11 items-center gap-1.5 justify-self-start whitespace-nowrap px-1 text-sm font-bold disabled:opacity-40"
            >
              <RepeatIcon className="h-5 w-5" />
              {onNext ? "下一個故事" : "再講一個"}
            </button>
          )}
          {narrator.isSupported() ? (
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? "停止朗讀" : "念給我聽"}
              className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-rust text-card shadow-[0_5px_0_var(--color-rust-dark)] active:translate-y-1 active:shadow-none"
            >
              {playing ? <PauseIcon className="h-8 w-8" /> : <PlayIcon className="ml-1 h-8 w-8" />}
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
          <div className="flex items-center gap-1 justify-self-end">
            {bgm.isSupported() && (
              <button
                type="button"
                onClick={toggleMusic}
                aria-pressed={musicOn}
                aria-label="背景音樂"
                title={musicOn ? "關掉背景音樂" : "打開背景音樂"}
                className={`flex h-11 w-11 items-center justify-center rounded-full ${
                  musicOn ? "bg-paper/15 text-mustard" : "text-paper/60"
                }`}
              >
                {musicOn ? <MusicIcon className="h-5 w-5" /> : <MusicOffIcon className="h-5 w-5" />}
              </button>
            )}
            <button type="button" onClick={onBack} className="flex h-11 items-center whitespace-nowrap px-1 text-sm font-bold">
              回書櫃
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/** 「給爸媽」引導卡：故事最後一段之後，2–3 個可以問小朋友的問題 + 1 個今晚就能做的小建議 */
function GuideCard({ guide, showHotline }: { guide: ParentGuide; showHotline: boolean }) {
  return (
    <aside aria-label="給爸媽的引導卡" className="relative mt-6 rounded-2xl bg-card p-5 pt-6 shadow-md ring-2 ring-line">
      <span className="absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 -rotate-2 bg-mustard/80" aria-hidden="true" />
      <h2 className="font-display text-xl font-bold tracking-wider text-rust-dark">給爸媽</h2>
      <p className="mt-0.5 text-xs text-ink-soft">讀完故事，可以這樣聊聊（這張卡不會念出來）</p>
      <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 leading-relaxed marker:font-bold marker:text-teal">
        {guide.questions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ol>
      <div className="mt-4 rounded-xl bg-paper-deep/70 p-3 leading-relaxed">
        <span className="mb-1 block text-xs font-bold tracking-widest text-teal">今晚試試看</span>
        {guide.tip}
      </div>
      {/* 求助專線由 App 固定顯示，不交給模型寫（模型寫的中英文版本常不一致） */}
      {showHotline && (
        <p className="mt-3 text-xs leading-relaxed text-ink-soft">
          如果孩子說出讓你擔心的事，可以撥 <strong className="text-ink">113 保護專線</strong>（24 小時）尋求協助。
        </p>
      )}
    </aside>
  );
}
