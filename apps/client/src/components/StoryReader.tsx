"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { AGE_RULES, LANGUAGE_LABELS, SERIES_CHAPTERS, THEMES, type ParentGuide } from "@aistory/shared";
import { requestStory, StoryApiError } from "@/lib/api";
import { listSeries, saveStory, seriesOf, type SavedStory } from "@/lib/storage";
import { canUse } from "@/lib/membership";
import { track } from "@/lib/stats";
import { bgm, loadMusicPref, saveMusicPref } from "@/lib/bgm";
import { narrator, type Narrator } from "@/lib/tts";
import {
  createRecordedNarrator,
  deleteRecordings,
  loadRecordings,
  openMic,
  recordingSupported,
  saveRecording,
  type Mic,
  type RecordingEntry,
} from "@/lib/recordings";
import { sceneSrc } from "@/lib/scenes";
import { ReportDialog } from "./ReportDialog";
import {
  BackIcon,
  CheckIcon,
  MicIcon,
  MoonIcon,
  MusicIcon,
  MusicOffIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  StopIcon,
} from "./icons";
import { HeroAvatar } from "./HeroAvatar";
import { StoryLoading } from "./StoryLoading";
import { PrimaryButton } from "./ui";

/** 段落之間的小停頓：讓背景音樂浮上來一點，聽起來不趕 */
const PARAGRAPH_GAP_MS = 600;
/** 開場音效的長度，念標題前先等它響一下 */
const START_DELAY_MS = 1200;

/**
 * listen：App 念（有爸媽錄音的段落用錄音，其他用 AI 聲音）
 * self：爸媽自己唸，字放大、一段一段翻，只放背景音樂
 * record：爸媽一段一段錄音，存在這支手機
 */
type Mode = "listen" | "self" | "record";
const MODES: { id: Mode; label: string }[] = [
  { id: "listen", label: "聽故事" },
  { id: "self", label: "我自己唸" },
  { id: "record", label: "錄我的聲音" },
];

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
  /** 正在念（或翻到、選到）的段落；-1 代表標題，null 代表沒在念 */
  const [current, setCurrent] = useState<number | null>(null);
  const [reporting, setReporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 背景音樂開關（記在 localStorage）；閱讀頁只在瀏覽器裡渲染，可以直接讀 */
  const [musicOn, setMusicOn] = useState(loadMusicPref);
  const [mode, setMode] = useState<Mode>("listen");
  /** 這個故事的錄音；記著屬於哪個故事，換故事時舊的不會閃一下 */
  const [recs, setRecs] = useState<{ storyId: string; map: Map<number, RecordingEntry> } | null>(null);
  /** 有錄音時，聽故事要不要用爸媽的聲音 */
  const [parentVoice, setParentVoice] = useState(true);
  const [recState, setRecState] = useState<"idle" | "recording" | "saving">("idle");
  const runId = useRef(0);
  const mic = useRef<Mic | null>(null);
  const preview = useRef<HTMLAudioElement | null>(null);
  /** 正在念的朗讀（AI 或錄音）；離開頁面時要停的是它 */
  const activeVoice = useRef<Narrator>(narrator);

  const total = story.paragraphs.length;
  const textOf = (i: number) => (i === -1 ? story.title : story.paragraphs[i]);

  const thumbUrl = useMemo(() => (story.thumbnail ? URL.createObjectURL(story.thumbnail) : null), [story.thumbnail]);
  useEffect(() => () => {
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
  }, [thumbUrl]);

  /** 換故事或離開閱讀頁：聲音、麥克風全部停掉 */
  const leave = useEffectEvent(() => {
    runId.current++;
    activeVoice.current.stop();
    bgm.stop();
    closeMic();
    stopPreview();
  });

  useEffect(() => {
    let alive = true;
    loadRecordings(story.id)
      .then((map) => alive && setRecs({ storyId: story.id, map }))
      .catch(() => {});
    return () => {
      alive = false;
      leave();
    };
  }, [story.id]);

  /** 文字跟現在一樣的錄音才算數（故事庫換了主角名字，舊錄音就不對了） */
  const recorded = useMemo(() => {
    const m = new Map<number, Blob>();
    if (recs?.storyId !== story.id) return m;
    for (const [i, r] of recs.map) {
      if (r.text === (i === -1 ? story.title : story.paragraphs[i])) m.set(i, r.blob);
    }
    return m;
  }, [recs, story]);

  const voice: Narrator = useMemo(() => {
    if (!parentVoice || recorded.size === 0) return narrator;
    const byText = new Map([...recorded].map(([i, blob]) => [i === -1 ? story.title : story.paragraphs[i], blob]));
    return createRecordedNarrator(byText, narrator);
  }, [parentVoice, recorded, story]);

  // 翻到、念到的段落捲到畫面中間
  useEffect(() => {
    if (current === null) return;
    document.querySelector(`[data-unit="${current}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [current]);

  function stopAll() {
    runId.current++;
    voice.stop();
    narrator.stop();
    bgm.stop();
    setCurrent(null);
  }

  function closeMic() {
    mic.current?.close();
    mic.current = null;
    setRecState("idle");
  }

  function stopPreview() {
    preview.current?.pause();
    preview.current = null;
  }

  function changeMode(next: Mode) {
    if (next === mode || recState === "saving") return;
    stopAll();
    closeMic();
    stopPreview();
    setError(null);
    setMode(next);
    // 錄音從第一個還沒錄的地方開始
    if (next === "record") {
      const units = [-1, ...story.paragraphs.keys()];
      setCurrent(units.find((i) => !recorded.has(i)) ?? -1);
    }
  }

  // ---- 聽故事：一段一段念，才能知道念到哪裡、反白那一段 ----
  function speakFrom(index: number, id: number) {
    if (id !== runId.current) return;
    if (index >= total) {
      setCurrent(null);
      bgm.end();
      return;
    }
    setCurrent(index);
    bgm.duck(true);
    voice.speak(textOf(index), story.language, () => {
      if (id !== runId.current) return;
      bgm.duck(false);
      setTimeout(() => speakFrom(index + 1, id), PARAGRAPH_GAP_MS);
    });
    // 念這段的同時先準備下一段
    const next = story.paragraphs[index + 1];
    if (next) voice.prefetch?.(next, story.language);
  }

  function toggle() {
    if (current !== null) return stopAll();
    // 以下都要在按鈕的手勢裡同步執行，iOS 才允許播放聲音
    activeVoice.current = voice;
    voice.prepare?.();
    bgm.setEnabled(musicOn);
    bgm.start(story.style ?? "bedtime", story.theme);
    const id = ++runId.current;
    // 開場音效響一下再開始念；音效關掉時不用等
    setCurrent(-1);
    setTimeout(() => speakFrom(-1, id), musicOn ? START_DELAY_MS : 0);
  }

  function toggleParentVoice() {
    stopAll();
    setParentVoice((v) => !v);
  }

  // ---- 我自己唸：只放音樂，爸媽自己翻頁 ----
  function goTo(i: number) {
    if (current === null) {
      // 第一次翻頁就是開始：在手勢裡開音樂
      bgm.setEnabled(musicOn);
      bgm.start(story.style ?? "bedtime", story.theme);
    }
    setCurrent(i);
  }

  function selfNext() {
    if (current === null) return goTo(-1);
    if (current < total - 1) return setCurrent(current + 1);
    // 最後一段翻完：結尾音效，音樂淡出
    bgm.end();
    setCurrent(null);
  }

  // ---- 錄我的聲音 ----
  async function record() {
    if (current === null || recState === "saving") return;
    if (recState === "recording") return finishRecording();
    stopPreview();
    setError(null);
    try {
      mic.current ??= await openMic(() => void finishRecording());
    } catch {
      setError("沒辦法使用麥克風。請到手機的「設定」允許這個 App 使用麥克風，再試一次。");
      return;
    }
    mic.current.start();
    setRecState("recording");
  }

  async function finishRecording() {
    const m = mic.current;
    const index = current;
    if (!m?.isRecording() || index === null) return;
    setRecState("saving");
    try {
      const blob = await m.stop();
      if (!blob) {
        setError("錄得太短了，再錄一次。");
        return;
      }
      const entry = await saveRecording(story.id, index, textOf(index), blob);
      setRecs((r) => {
        const map = new Map(r?.storyId === story.id ? r.map : []);
        map.set(index, entry);
        return { storyId: story.id, map };
      });
      track("recording");
      if (index < total - 1) setCurrent(index + 1);
    } catch {
      setError("錄音沒存起來，手機空間可能不夠，再試一次。");
    } finally {
      setRecState("idle");
    }
  }

  function playPreview() {
    if (current === null) return;
    const blob = recorded.get(current);
    if (!blob) return;
    stopPreview();
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    el.onended = el.onpause = () => URL.revokeObjectURL(url);
    preview.current = el;
    el.play().catch(() => {});
  }

  async function removeRecordings() {
    if (!confirm("刪掉這個故事的所有錄音？")) return;
    stopPreview();
    await deleteRecordings(story.id).catch(() => {});
    setRecs({ storyId: story.id, map: new Map() });
    setCurrent(-1);
  }

  function toggleMusic() {
    const next = !musicOn;
    setMusicOn(next);
    saveMusicPref(next);
    bgm.setEnabled(next);
  }

  // 「再講一個」只送場景文字，不重傳照片
  async function another() {
    stopAll();
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
      track("retell");
      onNewStory(saved);
    } catch (e) {
      setError(e instanceof StoryApiError ? e.message : "出了點問題，請再試一次。");
    } finally {
      setLoading(false);
    }
  }

  // 連載：照片故事才有（故事庫的故事 onNext 不是 undefined）；舊版故事沒存場景就接不下去
  const seriesable = onNext === undefined && !!story.scene;
  const [chapters, setChapters] = useState<SavedStory[] | null>(null);
  useEffect(() => {
    if (!seriesable) return;
    let alive = true;
    listSeries(seriesOf(story).id)
      .then((list) => alive && setChapters(list))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [seriesable, story]);

  // 下一集：送上一集全文和前情摘要，不重傳照片
  async function nextChapter() {
    const { id, chapter } = seriesOf(story);
    if (!canUse("series")) {
      setError("連載第 2 集以後是會員功能。");
      return;
    }
    stopAll();
    setLoading(true);
    setError(null);
    try {
      const { story: next } = await requestStory({
        language: story.language,
        ageBand: story.ageBand,
        style: story.style ?? "bedtime",
        length: story.length ?? "3min",
        hero: story.hero,
        scene: story.scene,
        series: {
          chapter: chapter + 1,
          memory: story.memory,
          // 伺服器只用最後幾段（PREVIOUS_TAIL），多送也沒用
          previous: { title: story.title, paragraphs: story.paragraphs.slice(-3) },
        },
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
        series: { id, chapter: chapter + 1 },
      };
      await saveStory(saved);
      track("chapter");
      onNewStory(saved);
    } catch (e) {
      setError(e instanceof StoryApiError ? e.message : "出了點問題，請再試一次。");
    } finally {
      setLoading(false);
    }
  }

  const playing = current !== null;
  const canRecord = recordingSupported();
  const modes = MODES.filter((m) => m.id !== "record" || canRecord);
  // 自己唸的時候字放大，爸媽拿遠一點也看得清楚
  const textClass = mode === "self" ? "text-2xl leading-loose" : AGE_RULES[story.ageBand].fontClass;
  const selectable = mode !== "listen";
  const unitClass = (i: number) =>
    current === i
      ? mode === "record"
        ? "bg-highlight ring-2 ring-rust"
        : "bg-highlight"
      : mode !== "record" && current !== null && i < current
        ? "text-ink-soft"
        : "";

  const recordMark = (i: number) =>
    mode === "record" && recorded.has(i) ? (
      <CheckIcon className="ml-1 inline h-4 w-4 align-baseline text-teal" aria-hidden="true" />
    ) : null;

  const musicButton = bgm.isSupported() && (
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
  );
  const backButton = (
    <button type="button" onClick={onBack} className="flex h-11 items-center whitespace-nowrap px-1 text-sm font-bold">
      回書櫃
    </button>
  );
  const bigButton =
    "flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full text-card active:translate-y-1 active:shadow-none disabled:opacity-40";
  const sideButton =
    "flex h-11 items-center gap-1 whitespace-nowrap px-1 text-sm font-bold disabled:opacity-30";

  return (
    <article className="flex min-h-dvh flex-col">
      {loading && <StoryLoading previewUrl={thumbUrl} />}

      <header className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-paper-deep">
        {/* 場景插畫隨 App 打包（public/scenes），離線也看得到 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sceneSrc(story.setting, story.theme, story.id)} alt="" className="h-full w-full object-cover" />
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

      <div className="flex flex-1 flex-col gap-4 px-6 pb-56">
        <p className="text-center text-xs font-bold tracking-widest text-rust-dark">
          {LANGUAGE_LABELS[story.language]} · {AGE_RULES[story.ageBand].label}
        </p>

        <div role="group" aria-label="怎麼念" className="mx-auto flex rounded-full bg-card p-1 shadow-sm ring-2 ring-line">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => changeMode(m.id)}
              className={`h-9 whitespace-nowrap rounded-full px-3 text-sm font-bold ${
                mode === m.id ? "bg-teal text-paper" : "text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "listen" && recorded.size > 0 && (
          <button
            type="button"
            onClick={toggleParentVoice}
            aria-pressed={parentVoice}
            className={`mx-auto flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold ${
              parentVoice ? "bg-rust/15 text-rust-dark" : "text-ink-soft ring-2 ring-line"
            }`}
          >
            <MicIcon className="h-4 w-4" />
            {parentVoice ? `用爸媽的聲音（已錄 ${recorded.size}/${total + 1} 段）` : "用 AI 的聲音"}
          </button>
        )}
        {mode === "self" && (
          <p className="text-center text-sm text-ink-soft">背景音樂會陪著你，按「下一段」翻頁，也可以直接點段落</p>
        )}
        {mode === "record" && (
          <p className="text-center text-sm text-ink-soft">
            點一段、按紅色按鈕開始錄，再按一下停止。錄音只存在這支手機，之後「聽故事」就是你的聲音。
          </p>
        )}

        <h1
          data-unit={-1}
          onClick={selectable ? () => (mode === "self" ? goTo(-1) : setCurrent(-1)) : undefined}
          className={`rounded-xl text-center font-display text-3xl font-bold tracking-wider text-teal ${unitClass(-1)} ${
            selectable ? "cursor-pointer" : ""
          }`}
        >
          {story.title}
          {recordMark(-1)}
        </h1>

        <div className={`flex flex-col gap-3 font-display ${textClass}`}>
          {story.paragraphs.map((p, i) => (
            <p
              key={i}
              data-unit={i}
              onClick={selectable && recState === "idle" ? () => (mode === "self" ? goTo(i) : setCurrent(i)) : undefined}
              className={`-mx-2 rounded-xl px-2 py-1 transition-colors ${unitClass(i)} ${selectable ? "cursor-pointer" : ""}`}
            >
              {p}
              {recordMark(i)}
            </p>
          ))}
        </div>

        {/* 引導卡是給大人看的，不在朗讀範圍內（speakFrom 只念標題與段落） */}
        {story.guide && (
          <GuideCard guide={story.guide} showHotline={!!story.theme && THEMES[story.theme]?.category === "body"} />
        )}

        {seriesable && chapters && (
          <SeriesCard story={story} chapters={chapters} loading={loading} onOpen={onNewStory} onNextChapter={nextChapter} />
        )}

        <button type="button" onClick={() => setReporting(true)} className="self-center px-3 py-2 text-sm text-ink-soft underline">
          這個故事怪怪的？告訴我們
        </button>

        {error && <p className="rounded-2xl bg-rust/10 p-3 text-rust-dark">{error}</p>}
      </div>
      {reporting && <ReportDialog story={story} onClose={() => setReporting(false)} />}

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md rounded-t-3xl bg-teal px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-paper min-[360px]:px-6">
        <div className="flex justify-center gap-1.5" aria-label={playing ? `第 ${Math.max(current, 0) + 1} 段，共 ${total} 段` : `共 ${total} 段`}>
          {story.paragraphs.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full ${
                current === i
                  ? "w-8 bg-rust"
                  : mode === "record"
                    ? recorded.has(i)
                      ? "w-4 bg-mustard"
                      : "w-4 bg-paper/25"
                    : current !== null && i < current
                      ? "w-4 bg-mustard"
                      : "w-4 bg-paper/25"
              }`}
            />
          ))}
        </div>

        {mode === "record" && (
          <div className="mt-2 flex items-center justify-center gap-3 text-sm">
            <span>
              {recState === "recording" ? "錄音中…" : `已錄 ${recorded.size} / ${total + 1} 段`}
            </span>
            {current !== null && recorded.has(current) && recState === "idle" && (
              <button type="button" onClick={playPreview} className="flex h-9 items-center gap-1 rounded-full bg-paper/15 px-3 font-bold">
                <PlayIcon className="h-3.5 w-3.5" />
                試聽這段
              </button>
            )}
            {recorded.size > 0 && recState === "idle" && (
              <button type="button" onClick={removeRecordings} className="h-9 px-1 text-paper/70 underline">
                全部刪除
              </button>
            )}
          </div>
        )}

        {/* 三欄：主按鈕永遠置中，左右兩邊寬度不同也不會偏 */}
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center">
          {mode === "listen" &&
            (onNext === null ? (
              <span aria-hidden="true" />
            ) : (
              <button type="button" onClick={onNext ?? another} disabled={loading} className={`${sideButton} justify-self-start`}>
                <RepeatIcon className="h-5 w-5" />
                {onNext ? "下一個故事" : "再講一個"}
              </button>
            ))}
          {mode !== "listen" && (
            <button
              type="button"
              onClick={() => current !== null && current > -1 && setCurrent(current - 1)}
              disabled={current === null || current <= -1 || recState !== "idle"}
              className={`${sideButton} justify-self-start`}
            >
              <PrevIcon className="h-5 w-5" />
              上一段
            </button>
          )}

          {mode === "listen" &&
            (voice.isSupported() ? (
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? "停止朗讀" : "念給我聽"}
                className={`${bigButton} bg-rust shadow-[0_5px_0_var(--color-rust-dark)]`}
              >
                {playing ? <PauseIcon className="h-8 w-8" /> : <PlayIcon className="ml-1 h-8 w-8" />}
              </button>
            ) : (
              <span aria-hidden="true" />
            ))}
          {mode === "self" && (
            <button
              type="button"
              onClick={selfNext}
              aria-label={current === null ? "開始" : current >= total - 1 ? "說晚安" : "下一段"}
              className={`${bigButton} flex-col bg-rust text-xs font-bold shadow-[0_5px_0_var(--color-rust-dark)]`}
            >
              {current === null ? (
                <PlayIcon className="ml-1 h-8 w-8" />
              ) : current >= total - 1 ? (
                <>
                  <MoonIcon className="h-7 w-7" />
                  晚安
                </>
              ) : (
                <NextIcon className="h-8 w-8" />
              )}
            </button>
          )}
          {mode === "record" && (
            <button
              type="button"
              onClick={() => void record()}
              disabled={current === null || recState === "saving"}
              aria-label={recState === "recording" ? "停止錄音" : "開始錄這段"}
              className={`${bigButton} shadow-[0_5px_0_var(--color-rust-dark)] ${
                recState === "recording" ? "animate-pulse bg-rust-dark" : "bg-rust"
              }`}
            >
              {recState === "recording" ? <StopIcon className="h-8 w-8" /> : <MicIcon className="h-8 w-8" />}
            </button>
          )}

          <div className="flex items-center gap-1 justify-self-end">
            {mode === "record" ? (
              <button
                type="button"
                onClick={() => current !== null && current < total - 1 && setCurrent(current + 1)}
                disabled={current === null || current >= total - 1 || recState !== "idle"}
                className={sideButton}
              >
                下一段
                <NextIcon className="h-5 w-5" />
              </button>
            ) : (
              <>
                {musicButton}
                {backButton}
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** 「給爸媽」引導卡：故事最後一段之後，2–3 個可以問小朋友的問題 + 1 個今晚就能做的小建議 */
/** 連載：集數切換和「下一集」。睡前一次一集，所以按鈕文字說「明天晚上」，但不鎖，想現在聽也可以 */
function SeriesCard({
  story,
  chapters,
  loading,
  onOpen,
  onNextChapter,
}: {
  story: SavedStory;
  chapters: SavedStory[];
  loading: boolean;
  onOpen: (story: SavedStory) => void;
  onNextChapter: () => void;
}) {
  const { chapter } = seriesOf(story);
  const next = chapters.find((c) => seriesOf(c).chapter === chapter + 1);
  const finished = chapter >= SERIES_CHAPTERS;
  return (
    <section aria-label="連載" className="flex flex-col gap-3 rounded-2xl bg-paper-deep p-4">
      <h2 className="font-display text-lg font-bold">
        {chapters.length > 1 ? `連載 第 ${chapter} 集／共 ${SERIES_CHAPTERS} 集` : `把這個故事變成連載（共 ${SERIES_CHAPTERS} 集）`}
      </h2>
      {chapters.length > 1 && (
        <div role="group" aria-label="選集數" className="flex flex-wrap gap-2">
          {chapters.map((c) => {
            const n = seriesOf(c).chapter;
            return (
              <button
                key={c.id}
                type="button"
                aria-current={c.id === story.id ? "true" : undefined}
                onClick={() => c.id !== story.id && onOpen(c)}
                className={`h-11 min-w-11 rounded-full px-3 font-bold ${c.id === story.id ? "bg-teal text-paper" : "bg-card ring-2 ring-line"}`}
              >
                {n}
              </button>
            );
          })}
        </div>
      )}
      {finished ? (
        <p className="text-sm text-ink-soft">這套連載完結了。想再聽新的冒險，就再拍一張照片吧。</p>
      ) : next ? (
        <PrimaryButton onClick={() => onOpen(next)}>聽第 {chapter + 1} 集</PrimaryButton>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            {chapters.length > 1
              ? `${story.hero?.name ?? "主角"}的故事還沒完，明天晚上接著聽第 ${chapter + 1} 集。`
              : `同一個主角和世界，每晚一集，${SERIES_CHAPTERS} 集講完一個完整的冒險。`}
          </p>
          <PrimaryButton onClick={onNextChapter} disabled={loading}>
            {loading ? "編故事中…" : `編第 ${chapter + 1} 集`}
          </PrimaryButton>
        </>
      )}
    </section>
  );
}

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
