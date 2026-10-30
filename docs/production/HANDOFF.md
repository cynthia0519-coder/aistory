# 第一波節目製作交接（2026-10-27）

這個資料夾是頻道第一波節目（2026-11-16 起日更到 2027-02-28，加上「三兄妹」原創週日集）的製作狀態。前一個對話的暫存區不會跟過來，製作要用的檔案都放在這裡。

## 檔案

| 檔案 | 用途 |
|---|---|
| `wave1-production.json` | 76 集，依播出日期排序：`date`、`id`、`hero`（`mumu` / `jerry` / `bo` / `both` / `bella`）、`kind`（`library` / `original`） |
| `wave1-art-done.txt` | 已畫好封面的 id（`apps/api/episode-art/<id>.jpg`），畫好一張就加一行 |
| `wave1-render-done.txt` | 中英文影片都做好的 id |
| `render-loop.sh` | 背景迴圈：每分鐘看 art-done，有新封面就算中英文影片（輸出在 `apps/api/out/episodes-w1`、`episodes-en-w1`、`episodes-mumu-jerry`、`episodes-en-mumu-jerry`，不進 git）。故事不是 review ok 會一直失敗並寫進 `wave1-render.log`，那是正常的提醒 |
| `cover-pipeline.md` | Canva 畫封面的流程（generate-image → 放進自己的 Canva 簡報頁 → 匯出 1920x1080 → curl → normalize） |
| `normalize-cover.py` | `python3 normalize-cover.py raw.jpg apps/api/episode-art/<id>.jpg`，輸出 1600x900 |

## 封面規則

- 依 `wave1-production.json` 的順序畫，跳過已有 jpg 的。畫好就 append 到 `wave1-art-done.txt`，每幾張 commit + push 一次（`apps/api/episode-art/*.jpg` 和這兩個 txt）。
- 風格前綴見 `cover-pipeline.md`。角色外觀以 `docs/characters.md` 為準：
  - `mumu` / `jerry`：imageReferences `[MAHZNTKJt9I]`（B2 兄妹設計），只描述那一個孩子，加「Do NOT include the older boy / the little girl」。
  - `bella`：imageReferences `[MAHZNhttiaU]`（三兄妹設計，媽媽已確認）。
  - `both`（原創集）：讀 `docs/characters.md` 和故事內容，只畫故事裡在場的人。則則不抱沐沐。
  - `bo`：不用 reference，主角是「a small child with a short black bob haircut in a mustard yellow top」，不能長得像則則（黃 T 恤）。
- `mumu-jerry-09-bella-balloon-market`（12/6，茜茜第一集）的畫面：市集小攤、一桶白粉紫的氣球花；茜茜（長直髮、齊瀏海、頭頂兩個小丸子、湖水藍無袖運動上衣、深藍縮口褲有芥末黃條紋）勇敢地把紫色氣球花遞給一個小弟弟客人；旁邊是同學小晴（9 歲女孩、黑色短馬尾、淺綠 T 恤）在笑著鼓勵；兩個大人坐在攤位後面、柔焦、只是看著。不要畫則則和沐沐。
- 三兄妹 EP11–14（2026-10-28 媽媽試聽通過）。外觀照 `docs/characters.md`，reference 用 `[MAHZNhttiaU]`，只畫在場的人：
  - `mumu-jerry-11-siblings-grab-tug`（1/31，hero both）：三兄妹圍著餐桌，桌上一個焦糖布丁切成三塊，則則拿著湯匙小心地切，茜茜在旁邊說規則，沐沐拍手。熱鬧、溫暖，不要畫成吵架。
  - `mumu-jerry-12-bella-almost-done`（2/7）：茜茜坐在書桌前寫功課、旁邊放著一個廚房計時器，平板蓋起來放在一邊；則則坐在旁邊畫一排小花。不要畫媽媽生氣。
  - `mumu-jerry-13-bella-mom-date`（2/14）：媽媽和茜茜手牽手走在公園，茜茜手上拿著三顆氣球（藍、粉紅、還有一顆她自己的），兩人都在笑。只畫媽媽和茜茜；媽媽從背後或側面，不畫清楚的臉。
  - `mumu-jerry-14-bella-test-secret`（2/21）：茜茜坐在書桌前，用鉛筆把題目上的字圈起來，表情專注又有自信；旁邊沐沐在畫冊上把小貓一隻一隻圈起來。畫面不出現分數數字。
- `sharing-turns-swing-timer` 的封面已刪除，因為故事改過：孩子在黃線外等，只有大人推鞦韆。重畫時照新文字。
- 每張都要看過：外觀對、人數對、沒有文字；不對就重畫一次。
- 永遠不要上傳或引用使用者的真實照片，只用文字描述。

## 目前狀態

- 封面：10 / 76 張完成（見 `wave1-art-done.txt`）。
- 影片：見 `wave1-render-done.txt`。原創集改名「三兄妹」後要重算，所以 render-done 已移除 mumu-jerry-*。
- 第一波 9 個在重審後變成 check 的故事：5 個修到 ok；4 個撤下排程，換成 ok 的故事，同一天播出：
  - 11/30 `anger-paper-crown`
  - 12/26 `night-sky-shooting-star-wish`
  - 12/30 `gratitude-thank-you-postman`
  - 2/6 `perseverance-tying-shoelaces`
- 另外 12 個已經做成節目、只是「情節相似」的 check 故事，跟故事庫對話（session_014XLzSdvGLUgDTkF8fT4wSc）約好維持原排程，不改。

## 三兄妹原創（媽媽要先聽過才上架）

- 試聽頁：https://claude.ai/artifact/1q3MeLfK9y7AcePcSaUhgF（9 集中英文音檔與全文）。要更新請用 Artifact `read` 再 `publish` 加 `url`。
- 播出表在 `docs/characters.md`。媽媽回覆「都可以」之後，用 `npm run library:publish -w @aistory/api -- id@日期,...` 排程這 9 集，再交播放清單給上傳助手。
- 媽媽已於 2026-10-27 試聽通過，9 集已用 library:publish 排程（publishAt 見 stories.json）。之後新的原創集一樣要先給她聽。

## 其他

- 每次 push 前先 `git pull --no-rebase origin claude/exciting-gates-roztcf`，故事庫對話也在同一個分支 commit。
- 做好的影片要整理成頁面交給上傳助手，第一批從 11/16 開始，比較急。

## 2026-10-29 接手狀態

- 上傳頁面：11/16–11/30 https://claude.ai/artifact/5AuTZtzTU3N4AaDrTNssTb、12/1–12/15 https://claude.ai/artifact/Tgj8URgyKJ6E5aYgNJZGQC、12/16–12/31 https://claude.ai/artifact/HrvUVvrR1nHKL6x9b8Eqb3、1/1–1/15 https://claude.ai/artifact/JpJCX52zMhUXgPFWhT7uwd、1/16–1/31 https://claude.ai/artifact/CH3XaVrdqbuuDa9QuLosgH、2/1–2/15 https://claude.ai/artifact/KSQsWYTBDStvMJr5JSwEJE。下一頁 2/16–2/28（第一波最後一頁）。第一波封面 81/81 已完成。注意：empathy-elephant-and-mouse-fable 節目 2/3 播出，但 stories.json 的 publishAt 是 2/14，待確認。
- 剩下封面的畫面描述在 `wave1-cover-prompts.json`（`ref` 是 imageReferences，`scene` 接在風格前綴後面）。匯出用 Canva 簡報 `DAHY2Vv2sws`，第 85、86 頁輪流放新圖再匯出那一頁。
- Canva 每生成一張就會回 `quota_cooldown` 一段時間（約 30 分鐘以上），只能一張一張畫。
- edit-design 每次呼叫都會跳權限確認（連接器的政策，repo 設定管不到）。所以封面要批次：先連續 generate-image 累積 10–15 張（等冷卻），每張看過預覽後把「id media-id」記在 `wave1-cover-pending.txt`；再開一個 transaction：一次 keep_open 用 add_page 補頁 → read-design（帶 transaction_id、fields design_content）拿新頁 id → 一次 keep_open 把整批 update_fill / insert_fill（insert_fill 帶 page_id，可以跨頁）放進去 → 一次 commit → 一次 export 全部頁面，每批約 4 次確認，然後一次 export 全部頁面。
- 確認迴圈有沒有在跑：`ps -eo args | grep -x 'bash docs/production/render-loop.sh'`。不要用 `pgrep -f render-loop.sh`，它會比對到自己的指令列，迴圈停了也會回「有在跑」。
- 新容器要先 `npm install`，並把字型 LXGW WenKai TC 放到 `apps/api/scripts/assets/LXGWWenKaiTC-Regular.ttf`（不進 git，可從 github.com/lxgw/LxgwWenkaiTC releases 下載）。`out/` 不進 git，換容器後要重算才能做上傳頁面。
- 主 repo 若 push 一直回「missing necessary objects」，從新 clone 推送即可。
