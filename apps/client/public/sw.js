// 網頁版離線支援：快取 App 外殼與故事庫，離線時仍可開啟並閱讀本地書櫃與故事庫。
// 打包成 App（Capacitor）時檔案已在裝置上，不依賴這支。
const CACHE = "aistory-v6";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll([
        "/",
        "/manifest.webmanifest",
        "/library/stories.json",
        // 場景插畫也預存，沒看過的場景離線時才不會破圖
        // 插圖清單要和 @aistory/shared/media 的規則一致（apps/api/test/scenes.test.ts 會檢查）
        ...[
          "home", "park", "school", "zoo", "forest", "sea", "mountain", "city", "snow", "night_sky",
          "bathroom", "kitchen", "bedroom", "living_room", "clinic", "crosswalk", "classroom",
          "balcony", "storm", "riverside", "playground", "nursery", "garden", "moving",
          // 同場景的其他張（SCENE_VARIANTS）
          "classroom-2", "classroom-3", "city-2", "city-3", "home-2", "living_room-2", "sea-2", "playground-2",
          "clinic-2", "crosswalk-2", "mountain-2", "night_sky-2", "forest-2", "zoo-2", "bedroom-2",
          // 其他季節與銀河色調
          "classroom-4", "city-4", "playground-3", "forest-3", "garden-2", "home-3", "sea-3", "mountain-3",
          "riverside-2", "crosswalk-3", "living_room-3", "snow-2", "clinic-3", "night_sky-3", "night_sky-4", "bedroom-3",
        ].map(
          (s) => `/scenes/${s}.jpg`,
        ),
      ]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  // 音樂與音效不經過這裡：<audio> 會用 Range 分段請求，iOS Safari 經過 service worker 時常常播不出來；
  // 30MB 的歌也不該塞進快取
  if (url.pathname.startsWith("/music/") || req.headers.has("range")) return;
  // 先走網路拿最新版，失敗再用快取
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
  );
});
