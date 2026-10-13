"use client";

import { useEffect, useState } from "react";
import { CreateStory } from "@/components/CreateStory";
import { Library } from "@/components/Library";
import { StoryReader } from "@/components/StoryReader";
import { requestPersistence, type SavedStory } from "@/lib/storage";

// 單頁、用狀態切畫面：不用動態路由，才能靜態輸出並打包成 App。
type View = { name: "create" } | { name: "library" } | { name: "read"; story: SavedStory };

export default function Home() {
  const [view, setView] = useState<View>({ name: "create" });

  useEffect(() => {
    requestPersistence();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const read = (story: SavedStory) => setView({ name: "read", story });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-amber-50/40">
      <main className="flex-1 px-4 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))]">
        {view.name === "create" && <CreateStory onCreated={read} />}
        {view.name === "library" && <Library onOpen={read} />}
        {view.name === "read" && <StoryReader key={view.story.id} story={view.story} onNewStory={read} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 mx-auto grid max-w-md grid-cols-2 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <Tab active={view.name === "create"} onClick={() => setView({ name: "create" })}>
          ✨ 編故事
        </Tab>
        <Tab active={view.name !== "create"} onClick={() => setView({ name: "library" })}>
          📚 我的書櫃
        </Tab>
      </nav>
    </div>
  );
}

function Tab({
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
      onClick={onClick}
      className={`py-4 font-semibold ${active ? "text-amber-600" : "text-stone-400"}`}
    >
      {children}
    </button>
  );
}
