"use client";

import { useEffect, useState } from "react";
import { AGE_RULES } from "@aistory/shared";
import { requestStory, StoryApiError } from "@/lib/api";
import { saveStory, type SavedStory } from "@/lib/storage";
import { webSpeechNarrator as narrator } from "@/lib/tts";

interface Props {
  story: SavedStory;
  onNewStory: (story: SavedStory) => void;
}

export function StoryReader({ story, onNewStory }: Props) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => narrator.stop(), [story.id]);

  function toggle() {
    if (playing) {
      narrator.stop();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    narrator.speak([story.title, ...story.paragraphs].join("\n"), story.language, () =>
      setPlaying(false),
    );
  }

  // 「再講一個」只送場景文字，不重傳照片
  async function another() {
    narrator.stop();
    setPlaying(false);
    setLoading(true);
    setError(null);
    try {
      const { story: next } = await requestStory({
        language: story.language,
        ageBand: story.ageBand,
        scene: story.scene,
        avoidTitle: story.title,
      });
      const saved: SavedStory = {
        ...next,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        language: story.language,
        ageBand: story.ageBand,
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

  return (
    <article className="flex flex-col gap-5">
      <h1 className="text-center text-2xl font-bold text-amber-800">{story.title}</h1>

      {narrator.isSupported() && (
        <button
          onClick={toggle}
          className="self-center rounded-full bg-amber-500 px-6 py-3 font-bold text-white"
        >
          {playing ? "⏸ 停止" : "🔊 念給我聽"}
        </button>
      )}

      <div className={`flex flex-col gap-4 ${AGE_RULES[story.ageBand].fontClass}`}>
        {story.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}

      <button
        onClick={another}
        disabled={loading}
        className="rounded-full bg-white py-3 font-semibold text-amber-700 ring-1 ring-amber-300 disabled:opacity-40"
      >
        {loading ? "正在編故事…" : "🔁 用同一張照片再講一個"}
      </button>
    </article>
  );
}
