"use client";

import { useState } from "react";
import { REPORT_REASON_LABELS, REPORT_REASONS, type ReportReason, type ReportRequest } from "@aistory/shared";
import { reportStory, StoryApiError } from "@/lib/api";
import type { SavedStory } from "@/lib/storage";
import { Dialog, PrimaryButton } from "./ui";

/**
 * 家長回報故事。照片故事送出故事文字，但主角名字先在手機上換成 {name}；故事庫的故事只送 id。
 * 隱私權政策（Privacy.tsx）有寫這件事，改送出內容時要一起改。
 */
export function toReport(story: SavedStory, reason: ReportReason, note: string): ReportRequest {
  const base = { reason, note: note.trim() || undefined, language: story.language, ageBand: story.ageBand };
  // 故事庫的故事 id 是 library:<故事 id>:<語言>
  const lib = /^library:(.+):[a-z]+$/.exec(story.id);
  if (lib) return { ...base, source: "library", storyId: lib[1] };
  const name = story.hero?.name;
  const scrub = (s: string) => (name ? s.split(name).join("{name}") : s);
  return { ...base, source: "photo", storyId: story.id, title: scrub(story.title), paragraphs: story.paragraphs.map(scrub) };
}

export function ReportDialog({ story, onClose }: { story: SavedStory; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!reason) return;
    setState("sending");
    setError(null);
    try {
      await reportStory(toReport(story, reason, note));
      setState("sent");
    } catch (e) {
      setError(e instanceof StoryApiError ? e.message : "回報沒有送出，請再試一次。");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <Dialog title="謝謝你告訴我們" onClose={onClose}>
        <p className="leading-relaxed text-ink-soft">我們會看這個故事，並用來改善之後的故事。</p>
        <PrimaryButton onClick={onClose}>好</PrimaryButton>
      </Dialog>
    );
  }

  return (
    <Dialog title="這個故事怪怪的？" onClose={onClose}>
      <div role="radiogroup" aria-label="哪裡不對" className="flex flex-col gap-2">
        {REPORT_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={reason === r}
            onClick={() => setReason(r)}
            className={`h-11 rounded-2xl px-4 text-left text-sm font-bold ${reason === r ? "bg-teal text-paper" : "bg-card ring-2 ring-line"}`}
          >
            {REPORT_REASON_LABELS[r]}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 300))}
        rows={2}
        aria-label="想補充的話（選填）"
        placeholder="想補充的話（選填）"
        className="rounded-2xl bg-card p-3 text-sm ring-2 ring-line focus:ring-teal"
      />
      <p className="text-xs leading-relaxed text-ink-soft">
        會送出故事的文字（主角名字會先換掉），不會送出照片。
      </p>
      {error && <p className="text-sm font-bold text-rust">{error}</p>}
      <PrimaryButton disabled={!reason || state === "sending"} onClick={send}>
        {state === "sending" ? "送出中…" : "送出回報"}
      </PrimaryButton>
    </Dialog>
  );
}
