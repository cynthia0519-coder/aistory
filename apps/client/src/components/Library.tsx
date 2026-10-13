"use client";

import { useEffect, useMemo, useState } from "react";
import { AGE_RULES, LANGUAGE_LABELS } from "@aistory/shared";
import { deleteStory, listStories, type SavedStory } from "@/lib/storage";

interface Props {
  onOpen: (story: SavedStory) => void;
}

export function Library({ onOpen }: Props) {
  const [stories, setStories] = useState<SavedStory[] | null>(null);

  useEffect(() => {
    listStories().then(setStories);
  }, []);

  async function remove(id: string) {
    if (!confirm("確定刪除這個故事？")) return;
    await deleteStory(id);
    setStories((s) => s?.filter((x) => x.id !== id) ?? null);
  }

  if (!stories) return null;
  if (stories.length === 0) {
    return <p className="py-16 text-center text-stone-500">還沒有故事，先去編一個吧！</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {stories.map((s) => (
        <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-stone-200">
          <button onClick={() => onOpen(s)} className="flex flex-1 items-center gap-3 text-left">
            <Thumb blob={s.thumbnail} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{s.title}</p>
              <p className="text-sm text-stone-500">
                {LANGUAGE_LABELS[s.language]} · {AGE_RULES[s.ageBand].label} ·{" "}
                {new Date(s.createdAt).toLocaleDateString()}
              </p>
            </div>
          </button>
          <button onClick={() => remove(s.id)} aria-label="刪除" className="p-2 text-stone-400">
            🗑
          </button>
        </li>
      ))}
    </ul>
  );
}

function Thumb({ blob }: { blob?: Blob }) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
  ) : (
    <div className="h-16 w-16 shrink-0 rounded-xl bg-amber-100" />
  );
}
