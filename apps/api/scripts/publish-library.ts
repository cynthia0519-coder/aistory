// 故事庫上架／下架：把人工審過的故事 draft 改成 false，App 才會顯示。
//   npm run library:publish -w @aistory/api -- id1,id2 [--unpublish] [--force]
//   npm run library:publish -w @aistory/api -- --file reviewed.txt   （一行一個 id）
//   npm run library:publish -w @aistory/api -- id1@2026-11-17,id2@2026-11-20   （排程：那天台灣時間 19:30 才在 App 出現，跟節目同步）
//   npm run library:publish -w @aistory/api -- id1,id2 --at 2026-11-17         （整批同一個時間）
//   npm run library:publish -w @aistory/api -- --list                （列出已上架的故事）
// 上架前會檢查 AI 預審：沒審過、審完又改過、或 status 是 fix 的不讓上架（--force 可跳過）。
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { LibraryStorySchema } from "@aistory/shared";
import { parsePublishAt, setPublished, type PublishFlag } from "../src/lib/library-publish";
import { reviewContentHash } from "../src/lib/library-review";

const here = dirname(fileURLToPath(import.meta.url));
const STORIES_PATH = resolve(here, "../../client/public/library/stories.json");
const FLAGS_PATH = resolve(here, "../eval/review-flags.json");

const argv = process.argv.slice(2);
const stories = z.array(LibraryStorySchema).parse(JSON.parse(readFileSync(STORIES_PATH, "utf8")));

if (argv.includes("--list")) {
  const live = stories.filter((s) => !s.draft);
  console.log(`已上架 ${live.length} / ${stories.length} 則`);
  for (const s of live) console.log(`  ${s.id}  ${s.title.zh}${s.publishAt ? `  （排程 ${s.publishAt}）` : ""}`);
  process.exit(0);
}

const fileAt = argv.indexOf("--file");
const atAt = argv.indexOf("--at");
const valueAt = new Set([fileAt, atAt].filter((i) => i >= 0).map((i) => i + 1));
const tokens = [
  ...(fileAt >= 0 ? readFileSync(argv[fileAt + 1], "utf8").split(/\s+/) : []),
  ...argv.filter((a, i) => !a.startsWith("--") && !valueAt.has(i)).flatMap((a) => a.split(",")),
].filter(Boolean);
const schedule: Record<string, string> = {};
const ids = tokens.map((t) => {
  const [id, at = atAt >= 0 ? argv[atAt + 1] : undefined] = t.split("@");
  if (at) schedule[id] = parsePublishAt(at);
  return id;
});
if (!ids.length) {
  console.error("要給故事 id，例如：npm run library:publish -w @aistory/api -- first-day-paper-boat");
  process.exit(1);
}

const publish = !argv.includes("--unpublish");
const flags = (JSON.parse(readFileSync(FLAGS_PATH, "utf8")) as { stories: Record<string, PublishFlag> }).stories;
const { stories: next, changed, errors } = setPublished(stories, ids, publish, flags, reviewContentHash, argv.includes("--force"), schedule);
if (errors.length) {
  console.error(`沒有任何變動，先處理這些：\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
writeFileSync(STORIES_PATH, JSON.stringify(next, null, 2) + "\n");
console.log(`${publish ? "上架" : "下架"} ${changed.length} 則${changed.length < ids.length ? `（其他 ${ids.length - changed.length} 則本來就是這個狀態）` : ""}`);
console.log(`目前已上架 ${next.filter((s) => !s.draft).length} / ${next.length} 則`);
