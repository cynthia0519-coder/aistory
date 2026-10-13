"use client";

import { useState } from "react";
import {
  AGE_BANDS,
  AGE_RULES,
  LANGUAGES,
  LANGUAGE_LABELS,
  type AgeBand,
  type Language,
} from "@aistory/shared";
import { prepareImage } from "@/lib/image";
import { requestStory, StoryApiError } from "@/lib/api";
import { saveStory, type SavedStory } from "@/lib/storage";

interface Props {
  onCreated: (story: SavedStory) => void;
}

export function CreateStory({ onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("zh");
  const [ageBand, setAgeBand] = useState<AgeBand>("4-6");
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
      const { story } = await requestStory({ language, ageBand, imageBase64: apiBase64 });
      const saved: SavedStory = {
        ...story,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        language,
        ageBand,
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
    <div className="flex flex-col gap-6">
      <label className="flex aspect-[4/3] w-full cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg text-amber-700">📷 拍照或選一張照片</span>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">故事語言</legend>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((l) => (
            <Chip key={l} active={language === l} onClick={() => setLanguage(l)}>
              {LANGUAGE_LABELS[l]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">小孩年齡</legend>
        <div className="grid grid-cols-4 gap-2">
          {AGE_BANDS.map((a) => (
            <Chip key={a} active={ageBand === a} onClick={() => setAgeBand(a)}>
              {AGE_RULES[a].label}
            </Chip>
          ))}
        </div>
      </fieldset>

      {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}

      <button
        disabled={!file || loading}
        onClick={submit}
        className="rounded-full bg-amber-500 py-4 text-lg font-bold text-white disabled:opacity-40"
      >
        {loading ? "正在編故事…" : "✨ 編一個故事"}
      </button>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2 py-3 text-sm font-medium ${
        active ? "bg-amber-500 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"
      }`}
    >
      {children}
    </button>
  );
}
