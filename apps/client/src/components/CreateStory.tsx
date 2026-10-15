"use client";

import { useRef, useState } from "react";
import {
  AGE_BANDS,
  AGE_RULES,
  ageBandFor,
  aiThemesFor,
  LANGUAGES,
  LANGUAGE_LABELS,
  LENGTH_RULES,
  STORY_LENGTHS,
  STORY_STYLES,
  STYLE_RULES,
  THEMES,
  type AgeBand,
  type Language,
  type StoryLength,
  type StoryStyle,
  type ThemeId,
} from "@aistory/shared";
import { prepareImage } from "@/lib/image";
import { requestStory, StoryApiError } from "@/lib/api";
import { saveStory, type SavedStory } from "@/lib/storage";
import { heroSummary, lookOf, toHero, type HeroProfile } from "@/lib/heroes";
import { HeroAvatar } from "./HeroAvatar";
import { CameraIcon, PlusIcon } from "./icons";
import { StoryLoading } from "./StoryLoading";
import { Chip, Dialog, PrimaryButton, SectionTitle } from "./ui";
import { hasPhotoConsent, savePhotoConsent } from "@/lib/privacy";

interface Props {
  onCreated: (story: SavedStory) => void;
  /** 目前選的主角；null = 不設定主角，改用下面的年齡選項 */
  hero: HeroProfile | null;
  onEditHero: () => void;
  /** 不拍照，改從故事庫挑 */
  onBrowseLibrary: () => void;
  onPrivacy: () => void;
}

const STYLE_DOT: Record<StoryStyle, string> = {
  adventure: "bg-teal",
  inspiring: "bg-ochre",
  cute: "bg-[#e8a0a0]",
  bedtime: "bg-sage",
  fable: "bg-[#b9a6d9]",
};

export function CreateStory({ onCreated, hero, onEditHero, onBrowseLibrary, onPrivacy }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // 第一次拍照前請家長確認照片怎麼用；同意過就直接開相機／相簿
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("zh");
  const [pickedAgeBand, setAgeBand] = useState<AgeBand>("4-6");
  // 有主角就用主角年齡換算年齡層（API 也會檢查兩者一致）
  const ageBand = hero ? ageBandFor(hero.age) : pickedAgeBand;
  const [style, setStyle] = useState<StoryStyle>("adventure");
  const [length, setLength] = useState<StoryLength>("3min");
  // 只列出即時 AI 可以寫的主題（生活習慣、情緒、品格），而且要符合目前的年齡層；
  // 換了年齡層、原本選的主題不適用時就當作沒選
  const themeOptions = aiThemesFor(ageBand);
  const [pickedTheme, setTheme] = useState<ThemeId | null>(null);
  const theme = pickedTheme && themeOptions.includes(pickedTheme) ? pickedTheme : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  }

  async function submit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const { apiBase64, thumbnail } = await prepareImage(file);
      const heroData = hero ? toHero(hero) : undefined;
      const { story } = await requestStory({
        language,
        ageBand,
        style,
        length,
        hero: heroData,
        imageBase64: apiBase64,
        theme: theme ?? undefined,
      });
      const saved: SavedStory = {
        ...story,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        language,
        ageBand,
        style,
        length,
        hero: heroData,
        theme: theme ?? undefined,
        heroLook: hero ? lookOf(hero) : undefined,
        thumbnail,
      };
      await saveStory(saved);
      onCreated(saved);
    } catch (e) {
      setError(e instanceof StoryApiError ? e.message : "出了點問題，請再試一次。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col">
      {loading && <StoryLoading previewUrl={preview} />}

      <header className="relative h-52 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/scenes/park.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-b from-paper/0 via-paper/10 to-paper" />
        <div className="absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))] flex justify-end">
          <div role="group" aria-label="故事語言" className="flex rounded-full bg-card/90 p-1 shadow-sm">
            {LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={language === l}
                onClick={() => setLanguage(l)}
                className={`h-8 rounded-full px-3 text-sm font-bold ${
                  language === l ? "bg-teal text-paper" : "text-ink"
                }`}
              >
                {l === "zh" ? LANGUAGE_LABELS.zh : "EN"}
              </button>
            ))}
          </div>
        </div>
        <h1 className="absolute bottom-3 left-4 font-display text-3xl font-bold tracking-widest text-teal">
          今晚的故事
        </h1>
      </header>

      <div className="flex flex-col gap-6 px-4 pt-3">
        <label
          className="block cursor-pointer"
          onClick={(e) => {
            if (hasPhotoConsent()) return;
            e.preventDefault();
            setConsentOpen(true);
          }}
        >
          {preview ? (
            <div className="flex items-center gap-4 rounded-2xl bg-card p-3 ring-2 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="選好的照片" className="h-24 w-28 -rotate-2 rounded-sm bg-card object-cover p-1 shadow-md" />
              <div className="flex flex-col gap-1">
                <span className="font-display text-lg font-bold">照片選好了</span>
                <span className="text-sm text-ink-soft">點這裡換一張</span>
              </div>
            </div>
          ) : (
            <div className="flex h-28 items-center gap-4 rounded-2xl bg-teal px-6 text-paper shadow-[0_5px_0_var(--color-teal-dark)]">
              <CameraIcon className="h-10 w-10 text-mustard" />
              <div className="flex flex-col">
                <span className="font-display text-xl font-bold">拍照或選一張照片</span>
                <span className="text-xs text-paper/75">小狗、玩具、公園、晚餐都可以</span>
              </div>
            </div>
          )}
          <input ref={fileInput} type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>

        {consentOpen && (
          <Dialog title="拍照前，請爸媽確認" onClose={() => setConsentOpen(false)}>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-ink-soft">
              <li>照片會傳給 AI（Anthropic Claude）編故事，伺服器不保存。</li>
              <li>主角的名字和年齡會一起送出，讓故事主角變成孩子。</li>
              <li>建議拍玩具、寵物、晚餐或公園，不要拍到孩子的臉、門牌或學校名稱。</li>
            </ul>
            <button type="button" onClick={onPrivacy} className="self-start text-sm font-bold text-teal underline underline-offset-4">
              看完整的隱私權政策
            </button>
            <label className="flex items-start gap-3 rounded-2xl bg-card p-3 ring-2 ring-line">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-teal"
              />
              <span className="text-sm font-bold leading-relaxed">我是孩子的爸媽或監護人，同意照片和主角資料這樣使用。</span>
            </label>
            <PrimaryButton
              disabled={!consentChecked}
              onClick={() => {
                savePhotoConsent();
                setConsentOpen(false);
                // 還在同一次點擊裡，iOS 才肯打開相機／相簿
                fileInput.current?.click();
              }}
            >
              同意，選照片
            </PrimaryButton>
          </Dialog>
        )}

        <button
          type="button"
          onClick={onBrowseLibrary}
          className="-mt-3 self-center px-3 py-2 text-sm font-bold text-teal underline decoration-line decoration-2 underline-offset-4"
        >
          不想拍照？從故事庫挑一個
        </button>

        <div className="flex flex-col gap-2">
          <SectionTitle>故事主角</SectionTitle>
          {hero ? (
            <button
              type="button"
              onClick={onEditHero}
              aria-label={`故事主角：${hero.name}，${heroSummary(hero)}。點一下更換`}
              className="flex items-center gap-4 rounded-2xl bg-card p-3 text-left ring-2 ring-line"
            >
              <HeroAvatar look={lookOf(hero)} size={56} variant="bust" className="shrink-0" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-display text-xl font-bold">{hero.name}</span>
                <span className="text-sm text-ink-soft">{heroSummary(hero)} · 點一下更換</span>
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onEditHero}
              className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-line bg-card/60 p-3 text-left"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-paper-deep text-rust">
                <PlusIcon className="h-6 w-6" />
              </span>
              <span className="flex flex-col">
                <span className="font-display text-xl font-bold">設定主角（選填）</span>
                <span className="text-sm text-ink-soft">讓小朋友變成故事裡的主角</span>
              </span>
            </button>
          )}
        </div>

        {!hero && (
          <fieldset className="flex flex-col gap-2">
            <SectionTitle as="legend">小朋友幾歲</SectionTitle>
            <div className="grid grid-cols-4 gap-2">
              {AGE_BANDS.map((a) => (
                <Chip key={a} active={ageBand === a} onClick={() => setAgeBand(a)}>
                  {AGE_RULES[a].label}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-2">
          <SectionTitle as="legend">想聽哪一種故事</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {STORY_STYLES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={style === s}
                onClick={() => setStyle(s)}
                className={`flex h-16 items-center gap-3 rounded-2xl px-3 text-left last:odd:col-span-2 ${
                  style === s ? "bg-rust text-card" : "bg-card text-ink ring-2 ring-line"
                }`}
              >
                <span className={`h-8 w-8 shrink-0 rounded-full ${STYLE_DOT[s]}`} />
                <span className="flex flex-col">
                  <span className="font-bold">{STYLE_RULES[s].label}</span>
                  <span className="text-xs opacity-80">{STYLE_RULES[s].hint}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-2">
          <SectionTitle as="legend">想聊的主題（選填）</SectionTitle>
          <p className="-mt-2 text-xs text-ink-soft">故事會自然帶到這件事，最後附上給爸媽的聊天卡</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
            <ThemeChip active={theme === null} onClick={() => setTheme(null)}>
              不用
            </ThemeChip>
            {themeOptions.map((t) => (
              <ThemeChip key={t} active={theme === t} onClick={() => setTheme(t)}>
                {THEMES[t].label.zh}
              </ThemeChip>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <SectionTitle as="legend">故事要講多久</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {STORY_LENGTHS.map((l) => (
              <Chip key={l} active={length === l} onClick={() => setLength(l)}>
                {LENGTH_RULES[l].label}
              </Chip>
            ))}
          </div>
        </fieldset>

        {error && <p className="rounded-2xl bg-rust/10 p-3 text-rust-dark">{error}</p>}

        <PrimaryButton disabled={!file || loading} onClick={submit}>
          開始編故事
        </PrimaryButton>
      </div>
    </div>
  );
}

/** 主題 chip：橫向捲動的一排，比一般 Chip 小一點 */
function ThemeChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-bold ${
        active ? "bg-teal text-paper" : "bg-card text-ink ring-2 ring-line"
      }`}
    >
      {children}
    </button>
  );
}
