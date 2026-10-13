"use client";

import { useEffect, useState } from "react";
import { CreateStory } from "@/components/CreateStory";
import { BooksIcon, StarIcon } from "@/components/icons";
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
  const create = () => setView({ name: "create" });
  const library = () => setView({ name: "library" });

  // 讀故事頁有自己的播放列，不顯示底部導覽
  if (view.name === "read") {
    return (
      <div className="mx-auto w-full max-w-md bg-paper">
        <StoryReader key={view.story.id} story={view.story} onNewStory={read} onBack={library} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper">
      <main className="flex-1 pb-32">
        {view.name === "create" && <CreateStory onCreated={read} />}
        {view.name === "library" && <Library onOpen={read} onCreate={create} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto grid max-w-md grid-cols-2 bg-paper-deep pb-[env(safe-area-inset-bottom)]">
        <Tab active={view.name === "create"} onClick={create} icon={<StarIcon className="h-6 w-6" />}>
          編故事
        </Tab>
        <Tab active={view.name === "library"} onClick={library} icon={<BooksIcon className="h-6 w-6" />}>
          我的書櫃
        </Tab>
      </nav>
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center gap-0.5 pb-2 pt-3 text-xs font-bold ${active ? "text-rust" : "text-ink-soft"}`}
    >
      {icon}
      {children}
    </button>
  );
}
