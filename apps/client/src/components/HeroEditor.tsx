"use client";

import { useEffect, useId, useState } from "react";
import { AGE_RULES, ageBandFor, GENDERS, HeroSchema, type Gender } from "@aistory/shared";
import {
  deleteHero,
  GENDER_LABELS,
  DEFAULT_LOOK,
  getSelectedHeroId,
  HAIR_COLOR_LABELS,
  HAIR_COLORS,
  HAIR_LABELS,
  HAIR_STYLES,
  HERO_COLORS,
  listHeroes,
  lookOf,
  OUTFIT_LABELS,
  OUTFITS,
  saveHero,
  setSelectedHeroId,
  SKIN_LABELS,
  SKIN_TONES,
  type HeroLook,
  type HeroProfile,
} from "@/lib/heroes";
import { HeroAvatar } from "./HeroAvatar";
import { MinusIcon, PlusIcon, TrashIcon } from "./icons";
import { BackButton, Chip, PrimaryButton, SectionTitle } from "./ui";

interface Props {
  onBack: () => void;
  /** 選好（或清除）主角後回到編故事 */
  onDone: (hero: HeroProfile | null) => void;
}

const MIN_AGE = 2;
const MAX_AGE = 10;

interface Draft {
  id: string | null;
  name: string;
  age: number;
  gender: Gender;
  likes: string;
  look: HeroLook;
}

const EMPTY: Draft = { id: null, name: "", age: 5, gender: "unspecified", likes: "", look: DEFAULT_LOOK };

function draftOf(h: HeroProfile): Draft {
  return { id: h.id, name: h.name, age: h.age, gender: h.gender, likes: h.likes ?? "", look: lookOf(h) };
}

const CHARSET_HINT = "只能用文字和數字，不能用符號或表情";

export function HeroEditor({ onBack, onDone }: Props) {
  const [heroes, setHeroes] = useState<HeroProfile[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<{ name?: string; likes?: string }>({});
  const [saving, setSaving] = useState(false);
  const nameId = useId();
  const likesId = useId();
  const lookId = useId();

  useEffect(() => {
    listHeroes().then((list) => {
      setHeroes(list);
      const selected = list.find((h) => h.id === getSelectedHeroId());
      if (selected) setDraft(draftOf(selected));
    });
  }, []);

  function edit(next: Draft) {
    setDraft(next);
    setErrors({});
  }

  function update(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => ({
      ...e,
      ...("name" in patch ? { name: undefined } : {}),
      ...("likes" in patch ? { likes: undefined } : {}),
    }));
  }

  function setLook(patch: Partial<HeroLook>) {
    setDraft((d) => ({ ...d, look: { ...d.look, ...patch } }));
  }

  function validate() {
    const name = draft.name.trim();
    const likes = draft.likes.trim();
    const parsed = HeroSchema.safeParse({
      name,
      age: draft.age,
      gender: draft.gender,
      likes: likes || undefined,
    });
    if (parsed.success) return parsed.data;

    const next: { name?: string; likes?: string } = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "name" && !next.name) {
        next.name = !name ? "請輸入名字或小名" : name.length > 12 ? "名字最多 12 個字" : `名字${CHARSET_HINT}`;
      }
      if (issue.path[0] === "likes" && !next.likes) {
        next.likes = likes.length > 30 ? "最多 30 個字" : CHARSET_HINT;
      }
    }
    setErrors(next);
    return null;
  }

  async function submit() {
    const hero = validate();
    if (!hero || !heroes) return;
    setSaving(true);
    const existing = heroes.find((h) => h.id === draft.id);
    const profile: HeroProfile = {
      ...hero,
      id: existing?.id ?? crypto.randomUUID(),
      color: existing?.color ?? HERO_COLORS[heroes.length % HERO_COLORS.length],
      createdAt: existing?.createdAt ?? Date.now(),
      look: draft.look,
    };
    try {
      await saveHero(profile);
      setSelectedHeroId(profile.id);
      onDone(profile);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const target = heroes?.find((h) => h.id === draft.id);
    if (!target || !confirm(`確定刪除主角「${target.name}」？`)) return;
    const wasSelected = getSelectedHeroId() === target.id;
    await deleteHero(target.id);
    setHeroes((list) => list?.filter((h) => h.id !== target.id) ?? null);
    edit(EMPTY);
    if (wasSelected) onDone(null);
  }

  function skip() {
    setSelectedHeroId(null);
    onDone(null);
  }

  const band = ageBandFor(draft.age);
  const hasSelected = heroes?.some((h) => h.id === getSelectedHeroId()) ?? false;

  return (
    <div className="flex flex-col">
      <header className="relative h-40 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/scenes/forest.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_40%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-paper/0 via-paper/20 to-paper" />
        <BackButton onClick={onBack} label="返回編故事" />
        <div className="absolute bottom-2 left-4">
          <h1 className="font-display text-3xl font-bold tracking-widest text-teal">故事主角</h1>
          <p className="text-sm text-ink-soft">讓小朋友走進自己的故事裡</p>
        </div>
      </header>

      <div className="flex flex-col gap-6 px-4 pt-3">
        <div role="group" aria-label="已存的主角" className="-mx-4 -my-2 flex gap-3 overflow-x-auto px-4 py-2">
          {heroes?.map((h) => (
            <button
              key={h.id}
              type="button"
              aria-pressed={draft.id === h.id}
              onClick={() => edit(draftOf(h))}
              className="flex w-16 shrink-0 flex-col items-center gap-1"
            >
              <HeroAvatar
                look={lookOf(h)}
                size={56}
                variant="bust"
                className={`shrink-0 rounded-full ${
                  draft.id === h.id ? "ring-4 ring-rust ring-offset-2 ring-offset-paper" : ""
                }`}
              />
              <span className="w-full truncate text-center text-xs font-bold">{h.name}</span>
            </button>
          ))}
          <button
            type="button"
            aria-pressed={draft.id === null}
            onClick={() => edit(EMPTY)}
            className="flex w-16 shrink-0 flex-col items-center gap-1"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed text-ink-soft ${
                draft.id === null ? "border-rust bg-card text-rust" : "border-line"
              }`}
            >
              <PlusIcon className="h-6 w-6" />
            </span>
            <span className="text-xs font-bold">新增</span>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={nameId}>
            <SectionTitle as="span">名字或小名</SectionTitle>
          </label>
          <input
            id={nameId}
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            maxLength={12}
            autoComplete="off"
            placeholder="例如：小寶、Mia"
            aria-invalid={!!errors.name}
            aria-describedby={`${nameId}-hint`}
            className={`h-12 rounded-2xl bg-card px-4 font-display text-xl outline-none ring-2 placeholder:text-ink-soft/60 focus:ring-teal ${
              errors.name ? "ring-rust" : "ring-line"
            }`}
          />
          <p id={`${nameId}-hint`} className={`text-xs ${errors.name ? "font-bold text-rust-dark" : "text-ink-soft"}`}>
            {errors.name ?? "建議用小名，不需要真實全名"}
          </p>
        </div>

        <section aria-labelledby={`${lookId}-title`} className="flex flex-col gap-3">
          <h2 id={`${lookId}-title`}>
            <SectionTitle as="span">外觀</SectionTitle>
          </h2>
          <div className="relative flex h-60 items-end justify-center overflow-hidden rounded-3xl bg-paper-deep ring-2 ring-line">
            {/* 預覽用的小舞台：後面一塊手刷的芥末色，地上一條草地 */}
            <svg aria-hidden="true" viewBox="0 0 320 240" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
              <path d="M76 58 C112 20 214 16 252 66 C286 110 270 180 204 196 C140 212 70 186 54 128 C47 100 58 76 76 58 Z" fill="var(--color-highlight)" opacity="0.75" />
              {[
                [44, 40, 7],
                [282, 58, 6],
                [258, 24, 4],
                [64, 170, 4.5],
              ].map(([x, y, r]) => (
                <polygon
                  key={`${x}-${y}`}
                  fill="var(--color-ochre)"
                  points={Array.from({ length: 10 }, (_, i) => {
                    const a = (Math.PI / 5) * i - Math.PI / 2;
                    const d = i % 2 ? r * 0.45 : r;
                    return `${(x + d * Math.cos(a)).toFixed(1)},${(y + d * Math.sin(a)).toFixed(1)}`;
                  }).join(" ")}
                />
              ))}
              <path d="M0 214 C70 204 140 210 200 206 C250 203 290 208 320 204 L320 240 L0 240 Z" fill="var(--color-sage)" opacity="0.55" />
            </svg>
            <HeroAvatar look={draft.look} size={216} variant="figure" className="relative -mb-1" />
          </div>
          <LookRow label="髮型">
            {HAIR_STYLES.map((h) => (
              <Swatch key={h} label={HAIR_LABELS[h]} active={draft.look.hair === h} onClick={() => setLook({ hair: h })}>
                <HeroAvatar look={{ ...draft.look, hair: h }} size={52} variant="bust" />
              </Swatch>
            ))}
          </LookRow>
          <LookRow label="髮色">
            {HAIR_COLORS.map((c) => (
              <Swatch key={c} label={HAIR_COLOR_LABELS[c]} active={draft.look.hairColor === c} onClick={() => setLook({ hairColor: c })}>
                <HeroAvatar look={{ ...draft.look, hairColor: c }} size={52} variant="bust" />
              </Swatch>
            ))}
          </LookRow>
          <LookRow label="膚色">
            {SKIN_TONES.map((t) => (
              <Swatch key={t} label={SKIN_LABELS[t]} active={draft.look.skin === t} onClick={() => setLook({ skin: t })}>
                <HeroAvatar look={{ ...draft.look, skin: t }} size={52} variant="bust" />
              </Swatch>
            ))}
          </LookRow>
          <LookRow label="衣服">
            {OUTFITS.map((o) => (
              <Swatch key={o} label={OUTFIT_LABELS[o]} active={draft.look.outfit === o} onClick={() => setLook({ outfit: o })}>
                <HeroAvatar look={{ ...draft.look, outfit: o }} size={52} variant="bust" />
              </Swatch>
            ))}
          </LookRow>
          <LookRow label="眼鏡">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <Chip active={!draft.look.glasses} onClick={() => setLook({ glasses: false })}>
                不戴
              </Chip>
              <Chip active={draft.look.glasses} onClick={() => setLook({ glasses: true })}>
                戴眼鏡
              </Chip>
            </div>
          </LookRow>
        </section>

        <div className="flex flex-col gap-2">
          <SectionTitle>幾歲</SectionTitle>
          <div className="flex items-center gap-4 rounded-2xl bg-card p-2 ring-2 ring-line">
            <StepButton label="小一歲" disabled={draft.age <= MIN_AGE} onClick={() => update({ age: draft.age - 1 })}>
              <MinusIcon className="h-6 w-6" />
            </StepButton>
            <output aria-live="polite" className="flex-1 text-center font-display text-3xl font-bold">
              {draft.age}
              <span className="ml-1 text-lg">歲</span>
            </output>
            <StepButton label="大一歲" disabled={draft.age >= MAX_AGE} onClick={() => update({ age: draft.age + 1 })}>
              <PlusIcon className="h-6 w-6" />
            </StepButton>
          </div>
          <p className="text-xs text-ink-soft">
            故事用字會配合 <span className="font-bold text-teal">{AGE_RULES[band].label}</span>
          </p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <SectionTitle as="legend">在故事裡是</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {GENDERS.map((g) => (
              <Chip key={g} active={draft.gender === g} onClick={() => update({ gender: g })}>
                {GENDER_LABELS[g]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor={likesId}>
            <SectionTitle as="span">
              喜歡的東西<span className="text-sm font-normal text-ink-soft">（選填）</span>
            </SectionTitle>
          </label>
          <input
            id={likesId}
            value={draft.likes}
            onChange={(e) => update({ likes: e.target.value })}
            maxLength={30}
            autoComplete="off"
            placeholder="例如：恐龍、草莓、溜滑梯"
            aria-invalid={!!errors.likes}
            aria-describedby={errors.likes ? `${likesId}-err` : undefined}
            className={`h-12 rounded-2xl bg-card px-4 text-base outline-none ring-2 placeholder:text-ink-soft/60 focus:ring-teal ${
              errors.likes ? "ring-rust" : "ring-line"
            }`}
          />
          {errors.likes && (
            <p id={`${likesId}-err`} className="text-xs font-bold text-rust-dark">
              {errors.likes}
            </p>
          )}
        </div>

        <PrimaryButton disabled={!heroes || saving} onClick={submit}>
          就是這個主角
        </PrimaryButton>

        {(draft.id || hasSelected) && (
          <div className="-mt-3 flex flex-wrap justify-center gap-x-6">
            {draft.id && (
              <button
                type="button"
                onClick={remove}
                className="flex h-11 items-center gap-1 text-sm font-bold text-rust-dark"
              >
                <TrashIcon className="h-4 w-4" />
                刪除這個主角
              </button>
            )}
            {hasSelected && (
              <button type="button" onClick={skip} className="h-11 text-sm font-bold text-ink-soft underline">
                這次不用主角
              </button>
            )}
          </div>
        )}

        <p className="rounded-2xl bg-paper-deep px-4 py-3 text-xs leading-relaxed text-ink-soft">
          主角資料只存在這支手機。編故事時只會送出小名、年齡、性別與喜歡的東西給 AI，不會保存。
        </p>
      </div>
    </div>
  );
}

/** 外觀的一列選項：左邊小標題，右邊一排可點的小預覽 */
function LookRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="font-display text-base font-bold text-ink-soft">{label}</span>
      <div className="flex flex-wrap gap-3 px-1">{children}</div>
    </div>
  );
}

function Swatch({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-14 w-14 items-center justify-center rounded-full ${
        active ? "ring-4 ring-rust ring-offset-2 ring-offset-paper" : "ring-2 ring-line"
      }`}
    >
      {children}
    </button>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-teal text-paper disabled:opacity-30"
    >
      {children}
    </button>
  );
}
