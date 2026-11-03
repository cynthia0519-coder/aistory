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

- 上傳頁面：11/16–11/30 https://claude.ai/artifact/5AuTZtzTU3N4AaDrTNssTb、12/1–12/15 https://claude.ai/artifact/Tgj8URgyKJ6E5aYgNJZGQC、12/16–12/31 https://claude.ai/artifact/HrvUVvrR1nHKL6x9b8Eqb3、1/1–1/15 https://claude.ai/artifact/JpJCX52zMhUXgPFWhT7uwd、1/16–1/31 https://claude.ai/artifact/CH3XaVrdqbuuDa9QuLosgH、2/1–2/15 https://claude.ai/artifact/KSQsWYTBDStvMJr5JSwEJE、2/16–2/28 https://claude.ai/artifact/TrGVoavxAxbYR68KhtaMXh。第一波 81 集封面、算圖、上傳頁全部完成。第一波封面 81/81 已完成。empathy-elephant-and-mouse-fable 的 publishAt 已改成 2/3，跟節目同天。
- 剩下封面的畫面描述在 `wave1-cover-prompts.json`（`ref` 是 imageReferences，`scene` 接在風格前綴後面）。匯出用 Canva 簡報 `DAHY2Vv2sws`，第 85、86 頁輪流放新圖再匯出那一頁。
- Canva 每生成一張就會回 `quota_cooldown` 一段時間（約 30 分鐘以上），只能一張一張畫。
- edit-design 每次呼叫都會跳權限確認（連接器的政策，repo 設定管不到）。所以封面要批次：先連續 generate-image 累積 10–15 張（等冷卻），每張看過預覽後把「id media-id」記在 `wave1-cover-pending.txt`；再開一個 transaction：一次 keep_open 用 add_page 補頁 → read-design（帶 transaction_id、fields design_content）拿新頁 id → 一次 keep_open 把整批 update_fill / insert_fill（insert_fill 帶 page_id，可以跨頁）放進去 → 一次 commit → 一次 export 全部頁面，每批約 4 次確認，然後一次 export 全部頁面。
- 確認迴圈有沒有在跑：`ps -eo args | grep -x 'bash docs/production/render-loop.sh'`。不要用 `pgrep -f render-loop.sh`，它會比對到自己的指令列，迴圈停了也會回「有在跑」。
- 新容器要先 `npm install`，並把字型 LXGW WenKai TC 放到 `apps/api/scripts/assets/LXGWWenKaiTC-Regular.ttf`（不進 git，可從 github.com/lxgw/LxgwWenkaiTC releases 下載）。`out/` 不進 git，換容器後要重算才能做上傳頁面。
- 主 repo 若 push 一直回「missing necessary objects」，從新 clone 推送即可。

## 第二波（2026-10-31 開始）

- 播出：2027-03-01～04-30，只排週一、三、四、六、日（週二、五是故事庫對話跟 App 同步的集數）。共 43 集，`wave2-production.json`。
- 選故事：`python3 docs/production/wave2-plan.py` 重排。條件：預審 ok、第一波沒用過、不在 `library-episodes.txt`（故事庫對話已做成節目的故事）、沒有 publishAt、不是季節題材、不是身體自主或寵物離世。
- 43 則已讀過中英文（安全類核對做法）並修正 14 則、重跑 AI 預審全部 ok；41 則草稿已用 `library:publish` 排在播出日 19:30 上架（2026-10-31），另 2 則本來就已上架。
- 沐沐當主角的已寫進 `apps/api/episode-heroes.json`；搬家、新手足、上幼兒園、需要讀寫或上學的故事維持小寶。
- 封面全部要新畫（沒有現成的），流程同第一波；記錄用 `wave2-art-done.txt`、`wave2-render-done.txt`。
- 算圖：`bash docs/production/render-loop.sh wave2`，輸出在 `apps/api/out/episodes-w2`、`episodes-en-w2`。確認迴圈：`ps -eo args | grep -x 'bash docs/production/render-loop.sh wave2'`。
- 三兄妹 EP15 `mumu-jerry-15-bella-splits`（茜茜的一字馬）3/7 播出、已排程上架；在 wave2-production.json 是 kind original、hero bella，封面 ref 用 MAHZNhttiaU。其他週日是一般故事，EP16 之後要等媽媽給素材、試聽通過才排。
- 封面 prompt 在 `wave2-cover-prompts.json`（依播出順序），畫好先記 `wave2-cover-pending.txt`，每 13 張一批放進 DAHY2Vv2sws（放圖前先通知主控 session）。下一張：`python3 -c "import json,os;p=json.load(open('docs/production/wave2-cover-prompts.json'));pend=open('docs/production/wave2-cover-pending.txt').read();print([k for k in p if not os.path.exists('apps/api/episode-art/'+k+'.jpg') and k not in pend][:1])"`
- DAHY2Vv2sws 已到 Canva 100 頁上限，不能再 add_page。之後每批改成 update_fill 覆蓋第一波已匯出的舊頁（每頁最上層元素；先 read-design 帶 transaction 拿 locator），第二波第一批用了 88–100 頁；下一批用 75–87 頁，再來 62–74、49–61。
- 第二波上傳頁：用 `python3 docs/production/build-upload-page.py wave2 <起> <訖> "標題" "lead" apps/api/out/w2pN` 產生，再用 Artifact 發布 index.html，`files` 分批（每批 ≤60MB、每檔 ≤16MB）把 `m/` 下的 mp4/mp3/jpg 傳上去（mp3 直接當頁面檔，整頁上限 256 MiB）。3/1–3/15：https://claude.ai/artifact/DaoyjApaMQpvWieBc9DT35；EP16 補件（3/14）：https://claude.ai/artifact/81JjhGTCyMTSK1JaL427hh；3/16–3/31：https://claude.ai/artifact/JfEbc9oXnNB71RKssrhwaE；4/1–4/15：https://claude.ai/artifact/CRsLF2RsE9LDMkZTSRga5P；4/16–4/30：https://claude.ai/artifact/YNySmtBEMZam19YLcSgW4K（第二波封面 45/45、算圖 45/45、上傳頁全部完成）（build-upload-page.py 第 8 參數只收指定 id）
- 3/1–3/15 上傳頁（DaoyjApaMQpvWieBc9DT35）已交給上架助理，不再改動。EP16 mumu-jerry-16-bella-swim-race（3/14）另做小頁「第二波 EP16 補件（3/14）」：封面跟下一批一起放 Canva，算完後用 build-upload-page.py 只放這一集（可暫時用只含 EP16 的 production 子集），標三兄妹，連結給主控。

## 第三波（2026-11-03 開始）

- 使用者選「排滿 5–6 月」：播出 2027-05-01～06-30，照第二波只排週一、三、四、六、日，約 43 集。
- 盤點（條件同 wave2-plan.py，排除第一二波）：可直接用 28 則（24 則仍是 draft），預審 check 的非敏感故事 17 則可修後重審，缺口約 15 集要靠修稿或新寫。
- 分工照第二波：主控 session（有 ANTHROPIC_API_KEY）負責選故事、修稿／新稿、AI 預審＋讀中英文、library:publish 排程、產出 `wave3-production.json` 與 `wave3-cover-prompts.json`；封面／算圖／上傳頁的 session 接手後續。
- 封面：Canva DAHY2Vv2sws 已滿 100 頁，第三波每批 update_fill 覆蓋舊頁，依序用 36–48、23–35、10–22 頁（第 1–9 頁留著）。
- 算圖：`bash docs/production/render-loop.sh wave3`，輸出 `apps/api/out/episodes-w3`、`episodes-en-w3`（三兄妹集照舊在 episodes-mumu-jerry）。迴圈在容器重啟時會停，每次醒來確認並重開；長時間等算圖時留在同一輪用 timeout 等待，比排提醒快。
- 上傳頁：`python3 docs/production/build-upload-page.py wave3 <起> <訖> "第三波節目 …" "lead" apps/api/out/w3pN`，同第二波發布方式。
- 2026-11-03 主控完成選稿與排程：44 集（5/1–6/30 週一三四六日），`wave3-production.json`、`wave3-cover-prompts.json`（播出順序）、`wave3-plan.py`（颱風 6 月颱風季放寬到 4 集，手動把颱風集都移到 6 月、兩集地震拆開）。17 則 check 稿改前提重生、新增 caring-for-nature-firefly-red-light，44 則都 AI 預審 ok、中英文讀過（安全類做法核對過），已 library:publish 排程在播出日 19:30。typhoon-after-storm-helpers、strangers-ice-cream-truck 原本已上架、重生後內容換新，改成播出日才出現。第三波沒有新的三兄妹原創集。主角：bo 31、mumu 12、jerry 1（lighthouse-keepers-cat，ref 照第一波 jerry 用 MAHZNTKJt9I）。
