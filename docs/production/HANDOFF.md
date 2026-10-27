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
- 還沒等到媽媽的試聽回覆前，**不要** publish 任何 `mumu-jerry-*`。

## 其他

- 每次 push 前先 `git pull --no-rebase origin claude/exciting-gates-roztcf`，故事庫對話也在同一個分支 commit。
- 做好的影片要整理成頁面交給上傳助手，第一批從 11/16 開始，比較急。
