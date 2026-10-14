// 頻道節目：把故事庫的故事做成 Podcast 音檔（mp3）與 YouTube 影片（mp4），附標題、說明與封面。
// 聲音、配樂、插圖都和 App 一樣：曉臻朗讀、同一組 Mureka 配樂（念的時候壓低）、同一張場景插畫。
//
//   npm run episodes:render -w @aistory/api -- [--only id1,id2] [--limit 20] [--lang zh] [--audio-only] [--dry-run]
//
// 需要：AZURE_SPEECH_KEY / AZURE_SPEECH_REGION（在雲端 session 裡另外要 NODE_USE_ENV_PROXY=1 才走得出代理）、ffmpeg（含 libass、libx264、libmp3lame）、
// 字型 LXGW WenKai TC（放在 scripts/assets/LXGWWenKaiTC-Regular.ttf，或用 --font 指定）。
// 只挑 AI 預審 ok、非敏感主題的故事（lib/episode.ts 的 publishableStories）；發布前人要聽過一次。
// 輸出在 apps/api/out/episodes/（不進 git），每集一個資料夾，另有 episodes.md 彙整上架用的文字。
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { LibraryStorySchema, renderLibraryStory, type Language, type LibraryStory } from "@aistory/shared";
import { MUSIC_GROUPS, musicGroup, sceneName } from "@aistory/shared/media";
import { reviewContentHash } from "../src/lib/library-review";
import { buildAss, captionCues, episodeText, publishableStories, type ReviewFlag, type Segment } from "../src/lib/episode";
import { isTtsConfigured, synthesize } from "../src/lib/tts";

const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_PUBLIC = resolve(here, "../../client/public");
const STORIES_PATH = join(CLIENT_PUBLIC, "library/stories.json");
const FLAGS_PATH = resolve(here, "../eval/review-flags.json");
const DEFAULT_OUT = resolve(here, "../out/episodes");
const DEFAULT_FONT = resolve(here, "assets/LXGWWenKaiTC-Regular.ttf");
const FONT_NAME = "LXGW WenKai TC";
const APP_URL = process.env.EPISODE_APP_URL ?? "https://aistory-web.vercel.app";

// 時間軸（秒）：開場音效 → 標題 → 段落 → 結尾音效，和 App 的節奏一樣
const LEAD = 2.0;
const AFTER_TITLE = 1.0;
const GAP = 0.8;
const TAIL = 5.0;
const CROSSFADE = 4;
const MUSIC_VOLUME = 0.5;
const RATE = 44100;

function parseArgs(argv: string[]) {
  const args = {
    only: null as string[] | null,
    limit: 20,
    lang: "zh" as Language,
    audioOnly: false,
    dryRun: false,
    out: DEFAULT_OUT,
    font: DEFAULT_FONT,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i] ?? "";
    if (a === "--only") args.only = val().split(",").filter(Boolean);
    else if (a === "--limit") args.limit = Number(val());
    else if (a === "--lang") args.lang = z.enum(["zh", "en"]).parse(val());
    else if (a === "--audio-only") args.audioOnly = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--out") args.out = resolve(val());
    else if (a === "--font") args.font = resolve(val());
    else throw new Error(`unknown option: ${a}`);
  }
  if (!Number.isInteger(args.limit) || args.limit < 1) throw new Error("--limit must be a positive integer");
  return args;
}

const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
const ffmpeg = (args: string[]) => run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", ...args]);
const duration = (file: string) =>
  Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

/** 同一個故事每次都從同一首開始，不同故事分散到不同首 */
function startSong(id: string, count: number) {
  return (createHash("sha256").update(id).digest()[0] % count) + 1;
}

async function renderEpisode(story: LibraryStory, lang: Language, dir: string, font: string, audioOnly: boolean) {
  mkdirSync(dir, { recursive: true });
  const r = renderLibraryStory(story, lang);
  const texts = [r.title, ...r.paragraphs];

  // 1. 朗讀：一段一個檔，已經有的不重做（重跑只花沒做完的錢）
  const wavs: string[] = [];
  for (const [i, text] of texts.entries()) {
    const mp3 = join(dir, `tts-${String(i).padStart(2, "0")}.mp3`);
    if (!existsSync(mp3)) writeFileSync(mp3, Buffer.from(await synthesize({ text, language: lang })));
    const wav = mp3.replace(/\.mp3$/, ".wav");
    ffmpeg(["-i", mp3, "-ar", String(RATE), "-ac", "1", wav]);
    wavs.push(wav);
  }

  // 2. 人聲軌：段落之間留白，記下每段的起訖時間給字幕用
  const silence = (sec: number) => {
    const f = join(dir, `silence-${sec.toFixed(2)}.wav`);
    if (!existsSync(f)) ffmpeg(["-f", "lavfi", "-i", `anullsrc=r=${RATE}:cl=mono`, "-t", String(sec), f]);
    return f;
  };
  const list: string[] = [silence(LEAD)];
  const segments: Segment[] = [];
  let t = LEAD;
  wavs.forEach((wav, i) => {
    const d = duration(wav);
    segments.push({ text: texts[i], start: t, end: t + d });
    list.push(wav);
    t += d;
    if (i < wavs.length - 1) {
      const gap = i === 0 ? AFTER_TITLE : GAP;
      list.push(silence(gap));
      t += gap;
    }
  });
  const voiceEnd = t;
  const total = voiceEnd + TAIL;
  const concat = join(dir, "voice.txt");
  writeFileSync(concat, list.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  const voice = join(dir, "voice.wav");
  ffmpeg(["-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", voice]);

  // 3. 配樂：同一組歌依序接起來（交叉淡化），夠長就停
  const group = musicGroup(story.style, story.theme);
  const count = MUSIC_GROUPS[group];
  const songs: string[] = [];
  let length = 0;
  for (let n = startSong(story.id, count); length < total + 1; n = (n % count) + 1) {
    const song = join(CLIENT_PUBLIC, "music", `${group}-${n}.mp3`);
    length += duration(song) - (songs.length ? CROSSFADE : 0);
    songs.push(song);
  }
  const chain = songs.length === 1 ? "[0:a]anull[m0]" : songs.slice(1).map((_, i) => `${i === 0 ? "[0:a]" : `[x${i}]`}[${i + 1}:a]acrossfade=d=${CROSSFADE}${i === songs.length - 2 ? "[m0]" : `[x${i + 1}]`}`).join(";");
  const music = join(dir, "music.wav");
  ffmpeg([
    ...songs.flatMap((s) => ["-i", s]),
    "-filter_complex",
    `${chain};[m0]atrim=0:${total.toFixed(2)},afade=t=in:st=1.2:d=2,afade=t=out:st=${(total - 4).toFixed(2)}:d=4,volume=${MUSIC_VOLUME},aresample=${RATE},aformat=channel_layouts=stereo[m]`,
    "-map", "[m]", music,
  ]);

  // 4. 混音：念的時候音樂自動壓低（sidechain），加上開場、結尾音效，響度標準化到 Podcast 常用的 -16 LUFS
  const audio = join(dir, `${story.id}.mp3`);
  const endMs = Math.round(voiceEnd * 1000);
  ffmpeg([
    "-i", music, "-i", voice,
    "-i", join(CLIENT_PUBLIC, "music/sfx-start.mp3"),
    "-i", join(CLIENT_PUBLIC, "music/sfx-end.mp3"),
    "-filter_complex",
    [
      `[1:a]aformat=channel_layouts=stereo,asplit=2[v][key]`,
      `[0:a][key]sidechaincompress=threshold=0.02:ratio=6:attack=80:release=700[duck]`,
      `[2:a]aresample=${RATE},aformat=channel_layouts=stereo,volume=0.7[s1]`,
      `[3:a]aresample=${RATE},aformat=channel_layouts=stereo,volume=0.7,adelay=${endMs}|${endMs}[s2]`,
      `[duck][v][s1][s2]amix=inputs=4:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=${RATE}[out]`,
    ].join(";"),
    "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "128k", audio,
  ]);

  // 5. 封面：場景插畫裁成正方形（Podcast 平台要 1400×1400 以上）
  const scene = join(CLIENT_PUBLIC, "scenes", `${sceneName(story.setting, story.theme)}.jpg`);
  const cover = join(dir, `${story.id}-cover.jpg`);
  ffmpeg(["-i", scene, "-vf", "crop=ih:ih,scale=1400:1400:flags=lanczos", "-q:v", "3", cover]);

  // 6. 影片：插畫置中、兩側用模糊放大的同一張圖補滿 16:9，燒進字幕
  let video: string | null = null;
  if (!audioOnly) {
    const [title, ...rest] = segments;
    const ass = join(dir, "captions.ass");
    writeFileSync(ass, buildAss({ text: title.text, start: 0, end: title.end + AFTER_TITLE }, captionCues(rest), FONT_NAME));
    video = join(dir, `${story.id}.mp4`);
    const esc = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
    ffmpeg([
      "-loop", "1", "-framerate", "6", "-i", scene, "-i", audio,
      "-filter_complex",
      `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=30,eq=brightness=-0.06[bg];` +
        `[0:v]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0,ass='${esc(ass)}':fontsdir='${esc(dirname(font))}',format=yuv420p[v]`,
      "-map", "[v]", "-map", "1:a",
      // 靜態插圖 + 字幕：每秒 6 格就夠（字幕幾秒才換一次），檔案小一半
      "-c:v", "libx264", "-preset", "medium", "-tune", "stillimage", "-crf", "26", "-g", "300", "-r", "6",
      "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", video,
    ]);
  }

  // 中間檔很大（wav），刪掉；朗讀的 mp3 留著，重跑不用再花錢合成
  for (const f of readdirSync(dir)) if (f.endsWith(".wav") || f === "voice.txt") rmSync(join(dir, f));

  const text = episodeText(story, lang, APP_URL);
  const info = { id: story.id, ...text, seconds: Math.round(duration(audio)), music: group, scene: sceneName(story.setting, story.theme) };
  writeFileSync(join(dir, "info.json"), JSON.stringify(info, null, 2) + "\n");
  return { ...info, audio, video, cover };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stories = z.array(LibraryStorySchema).parse(JSON.parse(readFileSync(STORIES_PATH, "utf8")));
  const flags = (JSON.parse(readFileSync(FLAGS_PATH, "utf8")) as { stories: Record<string, ReviewFlag> }).stories;
  const ok = publishableStories(stories, flags, reviewContentHash);

  let todo: LibraryStory[];
  if (args.only) {
    const unknown = args.only.filter((id) => !ok.some((s) => s.id === id));
    if (unknown.length) throw new Error(`not publishable (missing, not reviewed ok, changed since review, or sensitive): ${unknown.join(", ")}`);
    todo = ok.filter((s) => args.only!.includes(s.id));
  } else {
    // 晚安、可愛的放前面（頻道主打睡前）；同風格裡沒有主題的純故事先，主題故事穿插在後；結果固定
    const order = ["bedtime", "cute", "adventure", "inspiring"];
    todo = [...ok]
      .sort(
        (a, b) =>
          order.indexOf(a.style) - order.indexOf(b.style) ||
          Number(!!a.theme) - Number(!!b.theme) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, args.limit);
  }

  console.log(`${ok.length} publishable stories; rendering ${todo.length}${args.audioOnly ? " (audio only)" : ""}`);
  const chars = todo.reduce((n, s) => {
    const r = renderLibraryStory(s, args.lang);
    return n + [r.title, ...r.paragraphs].join("").length;
  }, 0);
  console.log(`about ${chars} characters of speech (Azure neural TTS bills per character)`);
  if (args.dryRun) {
    for (const s of todo) console.log(`  ${s.id}  ${episodeText(s, args.lang, APP_URL).title}`);
    return;
  }
  if (!isTtsConfigured()) throw new Error("AZURE_SPEECH_KEY / AZURE_SPEECH_REGION are required (use --dry-run to only list)");
  if (!args.audioOnly && !existsSync(args.font)) {
    throw new Error(`font not found: ${args.font} (download LXGW WenKai TC, or pass --font, or use --audio-only)`);
  }

  const done = [];
  for (const story of todo) {
    process.stdout.write(`${story.id} … `);
    try {
      const ep = await renderEpisode(story, args.lang, join(args.out, story.id), args.font, args.audioOnly);
      done.push(ep);
      console.log(`ok ${Math.floor(ep.seconds / 60)}:${String(ep.seconds % 60).padStart(2, "0")}`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
      process.exitCode = 1;
    }
  }

  // 彙整：上架時一集一集複製貼上
  const md = [
    "# 頻道節目",
    "",
    `產生時間：${new Date().toISOString()}。故事只經過 AI 預審，上架前每集請先聽過一次。`,
    "YouTube 上傳時「目標觀眾」選「是，這是為兒童打造的內容」。",
    "",
    "| 集 | 故事 | 長度 | 檔案 |",
    "| --- | --- | --- | --- |",
    ...done.map(
      (e, i) =>
        `| ${i + 1} | ${e.title} | ${Math.floor(e.seconds / 60)}:${String(e.seconds % 60).padStart(2, "0")} | \`${e.id}/\` |`,
    ),
    "",
    ...done.flatMap((e, i) => [`## ${i + 1}. ${e.title}`, "", "```", e.description, "```", "", `標籤：${e.tags.join("、")}`, ""]),
  ].join("\n");
  mkdirSync(args.out, { recursive: true });
  writeFileSync(join(args.out, "episodes.md"), md);
  console.log(`\n${done.length}/${todo.length} rendered → ${args.out}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
