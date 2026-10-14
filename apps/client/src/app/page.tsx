"use client";

import { useEffect, useState } from "react";
import { CreateStory } from "@/components/CreateStory";
import { Credits } from "@/components/Credits";
import { HeroEditor } from "@/components/HeroEditor";
import { Shop } from "@/components/Shop";
import { BooksIcon, StarIcon } from "@/components/icons";
import { Library } from "@/components/Library";
import { StoryReader } from "@/components/StoryReader";
import type { LibraryStory } from "@aistory/shared";
import { getSelectedHero, type HeroProfile } from "@/lib/heroes";
import { toReadableStory, type LibraryPrefs } from "@/lib/library";
import { requestPersistence, type SavedStory } from "@/lib/storage";

// 單頁、用狀態切畫面：不用動態路由，才能靜態輸出並打包成 App。
type View =
  | { name: "create" }
  | { name: "library" }
  // 故事庫的故事帶著目前篩選的清單，「下一個故事」照順序往下讀
  | { name: "read"; story: SavedStory; library?: { list: LibraryStory[]; index: number } }
  | { name: "hero" }
  | { name: "shop" }
  // 授權與致謝；from = 從哪一頁進來，返回時回去
  | { name: "credits"; from: "library" | "shop" };

export default function Home() {
  const [view, setView] = useState<View>({ name: "create" });
  const [hero, setHero] = useState<HeroProfile | null>(null);
  const [libraryPrefs, setLibraryPrefs] = useState<LibraryPrefs>({ tab: "mine", language: "zh", age: null, category: "all" });

  useEffect(() => {
    requestPersistence();
    getSelectedHero()
      .then(setHero)
      .catch(() => {});
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const read = (story: SavedStory) => setView({ name: "read", story });
  const create = () => setView({ name: "create" });
  const library = () => setView({ name: "library" });
  const browseLibrary = () => {
    setLibraryPrefs((p) => ({ ...p, tab: "library" }));
    library();
  };
  // 故事庫故事在裝置上換好名字，只在記憶體裡，不存進 IndexedDB
  const readLibrary = (list: LibraryStory[], index: number) =>
    setView({
      name: "read",
      story: toReadableStory(list[index], libraryPrefs.language, hero),
      library: { list, index },
    });

  // 換畫面時回到頂端（編故事頁在主角頁時只是隱藏，不會重置）
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view.name]);

  // 讀故事頁有自己的播放列，不顯示底部導覽
  if (view.name === "read") {
    const lib = view.library;
    return (
      <div className="mx-auto w-full max-w-md bg-paper">
        <StoryReader
          key={view.story.id}
          story={view.story}
          onNewStory={read}
          onBack={library}
          onNext={
            !lib ? undefined : lib.list.length > 1 ? () => readLibrary(lib.list, (lib.index + 1) % lib.list.length) : null
          }
        />
      </div>
    );
  }

  const showNav = view.name === "create" || view.name === "library";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper">
      <main className={`flex-1 ${showNav ? "pb-32" : "pb-12"}`}>
        {/* 設定主角時保留編故事頁的狀態（已選的照片、風格），所以只隱藏不卸載 */}
        {(view.name === "create" || view.name === "hero") && (
          <div hidden={view.name !== "create"}>
            <CreateStory
              onCreated={read}
              hero={hero}
              onEditHero={() => setView({ name: "hero" })}
              onBrowseLibrary={browseLibrary}
            />
          </div>
        )}
        {view.name === "hero" && (
          <HeroEditor
            onBack={create}
            onDone={(h) => {
              setHero(h);
              create();
            }}
          />
        )}
        {view.name === "library" && (
          <Library
            prefs={libraryPrefs}
            onPrefs={setLibraryPrefs}
            hero={hero}
            onOpen={read}
            onOpenLibrary={readLibrary}
            onCreate={create}
            onShop={() => setView({ name: "shop" })}
            onCredits={() => setView({ name: "credits", from: "library" })}
          />
        )}
        {view.name === "shop" && <Shop onBack={library} onCredits={() => setView({ name: "credits", from: "shop" })} />}
        {view.name === "credits" && (
          <Credits onBack={() => (view.from === "shop" ? setView({ name: "shop" }) : library())} />
        )}
      </main>

      {showNav && (
        <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto grid max-w-md grid-cols-2 bg-paper-deep pb-[env(safe-area-inset-bottom)]">
          <Tab active={view.name === "create"} onClick={create} icon={<StarIcon className="h-6 w-6" />}>
            編故事
          </Tab>
          <Tab active={view.name === "library"} onClick={library} icon={<BooksIcon className="h-6 w-6" />}>
            我的書櫃
          </Tab>
        </nav>
      )}
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
