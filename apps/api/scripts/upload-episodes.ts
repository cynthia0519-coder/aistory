// 頻道節目自動上傳 YouTube：私人影片 + 排程（節目日台灣 19:30 公開）、自訂縮圖、加入播放清單。
//   npm run episodes:upload -w @aistory/api -- --wave wave1 --from 2026-11-16 --to 2026-11-30          （預設只列計畫，不上傳）
//   npm run episodes:upload -w @aistory/api -- --wave wave1 --from 2026-11-16 --to 2026-11-30 --commit （真的上傳）
//   選填：--lang zh|en（預設兩個都傳）、--only id1,id2
// 關卡（lib/youtube-upload.ts）：故事要已 library:publish、App 上架時間不晚於節目、節目時間還沒到。
// 已傳過的記在 docs/production/<wave>-youtube.json，重跑不會重複上傳；每傳完一集就寫一次。
// 需要：YT_CLIENT_ID、YT_CLIENT_SECRET、YT_REFRESH_TOKEN_ZH、YT_REFRESH_TOKEN_EN
//   選填：YT_PLAYLIST_ZH、YT_PLAYLIST_EN、YT_CATEGORY_ID（預設 24 娛樂）
//   雲端 session 另外要 NODE_USE_ENV_PROXY=1
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { LibraryStorySchema } from "@aistory/shared";
import {
  blockReason, episodePublishAt, ledgerKey, videoResource,
  type Lang, type Ledger, type PlannedEpisode,
} from "../src/lib/youtube-upload";

const here = dirname(fileURLToPath(import.meta.url));
const PROD = resolve(here, "../../../docs/production");
const OUT = resolve(here, "../out");
const STORIES = resolve(here, "../../client/public/library/stories.json");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** 跟 build-upload-page.py 同一套輸出資料夾 */
function episodeDir(wave: string, lang: Lang, id: string): string {
  const n = wave.replace("wave", "");
  const mj = id.startsWith("mumu-jerry");
  const sub = lang === "zh" ? (mj ? "episodes-mumu-jerry" : `episodes-w${n}`) : (mj ? "episodes-en-mumu-jerry" : `episodes-en-w${n}`);
  return join(OUT, sub, id);
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`缺少環境變數 ${name}`);
  return v;
}

async function accessToken(lang: Lang): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("YT_CLIENT_ID"),
      client_secret: env("YT_CLIENT_SECRET"),
      refresh_token: env(lang === "zh" ? "YT_REFRESH_TOKEN_ZH" : "YT_REFRESH_TOKEN_EN"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`OAuth ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function uploadVideo(token: string, file: string, resource: object): Promise<string> {
  const size = statSync(file).size;
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(size),
    },
    body: JSON.stringify(resource),
  });
  const url = init.headers.get("location");
  if (!init.ok || !url) throw new Error(`videos.insert init ${init.status}: ${await init.text()}`);
  const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(size) }, body: readFileSync(file) });
  if (!put.ok) throw new Error(`videos.insert upload ${put.status}: ${await put.text()}`);
  const body = (await put.json()) as { id: string; status?: { privacyStatus?: string } };
  if (body.status?.privacyStatus && body.status.privacyStatus !== "private") {
    console.warn(`  ! ${body.id} 回傳的隱私狀態是 ${body.status.privacyStatus}，請到 Studio 確認`);
  }
  return body.id;
}

async function setThumbnail(token: string, videoId: string, file: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" },
    body: readFileSync(file),
  });
  // 頻道沒做電話驗證時會失敗：不中斷，記下來手動補
  if (!res.ok) console.warn(`  ! 縮圖失敗 ${res.status}（頻道可能還沒驗證）：${(await res.text()).slice(0, 200)}`);
}

async function addToPlaylist(token: string, playlistId: string, videoId: string): Promise<void> {
  const res = await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=snippet", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } } }),
  });
  if (!res.ok) console.warn(`  ! 加入播放清單失敗 ${res.status}`);
}

async function main() {
  const wave = arg("--wave");
  const from = arg("--from");
  const to = arg("--to");
  if (!wave || !from || !to) throw new Error("需要 --wave、--from、--to");
  const commit = process.argv.includes("--commit");
  const langs: Lang[] = arg("--lang") === "zh" ? ["zh"] : arg("--lang") === "en" ? ["en"] : ["zh", "en"];
  const only = arg("--only")?.split(",");

  const plan = (JSON.parse(readFileSync(join(PROD, `${wave}-production.json`), "utf8")) as PlannedEpisode[])
    .filter((e) => e.date >= from && e.date <= to && (!only || only.includes(e.id)));
  const stories = new Map(z.array(LibraryStorySchema).parse(JSON.parse(readFileSync(STORIES, "utf8"))).map((s) => [s.id, s]));
  const ledgerPath = join(PROD, `${wave}-youtube.json`);
  const ledger: Ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : {};

  type Job = { ep: PlannedEpisode; lang: Lang; dir: string; publishAt: string };
  const jobs: Job[] = [];
  const blocked: string[] = [];
  for (const ep of plan) {
    const why = blockReason(ep, stories, new Date());
    for (const lang of langs) {
      const key = ledgerKey(lang, ep.id);
      if (ledger[key]) continue;
      if (why) { blocked.push(`${ep.date} ${key}：${why}`); continue; }
      const dir = episodeDir(wave, lang, ep.id);
      if (!existsSync(join(dir, `${ep.id}.mp4`))) { blocked.push(`${ep.date} ${key}：還沒算圖`); continue; }
      jobs.push({ ep, lang, dir, publishAt: episodePublishAt(ep.date) });
    }
  }

  console.log(`${wave} ${from}～${to}：要上傳 ${jobs.length} 支，已傳過 ${plan.length * langs.length - jobs.length - blocked.length} 支，擋下 ${blocked.length} 支`);
  for (const j of jobs) console.log(`  ↑ ${j.ep.date} ${ledgerKey(j.lang, j.ep.id)}`);
  for (const b of blocked) console.log(`  ✗ ${b}`);
  if (!commit) { console.log("\n（預覽模式，加 --commit 才會上傳）"); return; }

  const category = process.env.YT_CATEGORY_ID || "24";
  const tokens: Partial<Record<Lang, string>> = {};
  for (const j of jobs) {
    const token = (tokens[j.lang] ??= await accessToken(j.lang));
    const info = JSON.parse(readFileSync(join(j.dir, "info.json"), "utf8")) as { title: string; description: string };
    const key = ledgerKey(j.lang, j.ep.id);
    process.stdout.write(`${key} … `);
    const videoId = await uploadVideo(token, join(j.dir, `${j.ep.id}.mp4`), videoResource(info, j.lang, j.publishAt, category));
    // 先記帳再做縮圖和播放清單：就算後面失敗，重跑也不會重複上傳影片
    ledger[key] = { videoId, publishAt: j.publishAt, uploadedAt: new Date().toISOString() };
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
    const thumb = join(j.dir, `${j.ep.id}-thumb.jpg`);
    if (existsSync(thumb)) await setThumbnail(token, videoId, thumb);
    const playlist = process.env[j.lang === "zh" ? "YT_PLAYLIST_ZH" : "YT_PLAYLIST_EN"];
    if (playlist) await addToPlaylist(token, playlist, videoId);
    console.log(`ok https://youtu.be/${videoId}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
