# 故事品質測試報告（2026-10-13）

測試設定：3 個場景 × 4 個年齡層 × 中英文 = 每個模型 24 則。用場景文字當輸入（`scene` 路徑，不傳照片）。
評審：`claude-opus-5-5` 依 6 個維度打 1–5 分，另外估計適讀年齡。規則檢查不花 token。
腳本：`apps/api/eval/story-quality.ts`，執行方式見 `apps/api/eval/README.md`。

## ⚠️ 本次沒跑完
- **Opus 5.5**：第 1 輪 24/24 完成（舊版指標）；第 2 輪完成 18/24（新版指標），8–10 歲那 6 則因為帳戶額度用完而中斷。
- **Sonnet 5.5**：0/24，全部失敗，錯誤是 `credit balance is too low`。**目前還不能比較兩個模型的品質。**
- 下面 Sonnet 的成本是**推估**，不是實測。

## 1. 字數是否符合 AGE_RULES
| 年齡 | 中文規則 | Opus 實際（平均） | 英文規則 | Opus 實際（平均） |
|---|---|---|---|---|
| 2–4 | 150–250 字 | 186 | 80–150 words | 121 |
| 4–6 | 350–550 | 427 | 200–350 | 295 |
| 6–8 | 600–900 | 844（最高 914，超出 1.5%） | 400–600 | 555 |
| 8–10 | 900–1300 | 1183（第 1 輪） | 600–900 | 831（第 1 輪） |

**結論：達標。** 42 則裡只有 1 則超出上限，而且只超 1.5%。

## 2. 用字難度有沒有隨年齡拉開
| 年齡 | 中文平均句長（字） | 英文平均句長（words） | 英文 FK 年級 | 評審估計適讀年齡（中／英） |
|---|---|---|---|---|
| 2–4 | 9.3 | 3.6 | 0.5 | 3.0 / 3.0 |
| 4–6 | 13.5 | 5.7 | 0.8 | 5.0 / 4.7 |
| 6–8 | 21.2 | 10.0 | 3.0 | 6.7 / 6.5 |

**結論：有拉開，而且是單調遞增。** 每個年齡層的適讀年齡都落在目標區間內。
有一個小問題：4–6 歲英文的 FK 年級（0.8）幾乎跟 2–4 歲（0.5）一樣。差異主要來自句子變長，用詞並沒有變難。這不算錯，但 4–6 歲其實可以再多一點新詞。

## 3. 中文是不是繁體、台灣用語
- 簡體字：0 次。
- 大陸用語：只抓到「一會兒」（2 次）。台灣課本也會用這個詞，算誤判，已經從清單移除。
- 評審 `taiwanUsage` 平均 **5.00**。

**結論：沒有問題。**

## 4. 有沒有不適合小孩的內容
沒有暴力、恐怖、品牌，也沒有可以識別身分的內容。安全分數被扣的原因全部是**「小孩可能模仿的情節」**：
- 6–8 歲英文（安全 3 分）：在「離人行道很遠」的水坑跳，等於在車道上，還出現「看左看右」，容易跟過馬路搞混
- 4–6 歲英文：小孩獨自跑去海邊取水，沒有大人陪
- 6–8 歲中文：小孩獨自上街，還陪陌生的老奶奶走回家
- 8–10 歲中文（第 1 輪）：主角答應媽媽「別踩水」後馬上違反，沒有反思
- 4–6 歲英文：書被檯燈「烤熱」

**結論：這是提示詞的缺口，不是模型的問題。** 安全規則只寫了「不能有什麼」，沒寫「大人要在場」「不示範危險行為」。

## 5. 其他重複出現的品質問題（連貫性平均 4.33，是最低的一項）
1. **標題跟內容對不上**（3 次）：例如標題叫「小雨點」，主角卻叫「小芽」
2. **6–8 歲會說教**：直接定義生詞（「耐心就是…」）、直接說出寓意。這跟 AGE_RULES 的 "shown, not lectured" 衝突
3. **白天的場景突然接「晚安」**，中間沒有過渡（2–4 歲出現 3 次）
4. 道具歸屬前後不一致（例如爸爸拿著鏟子，下一段變成孩子在用）
5. 擬聲詞用錯（海鷗寫成 caw／啾啾）

## 6. 成本（實測 Opus 5.5，effort low）
| 年齡 | 中文 | 英文 | 平均延遲 |
|---|---|---|---|
| 2–4 | $0.0096 | $0.0086 | 9 秒 |
| 4–6 | $0.0163 | $0.0147 | 10 秒 |
| 6–8 | $0.0282 | $0.0243 | 19 秒 |
| 8–10 | 約 $0.04（推估） | 約 $0.035（推估） | 25 秒 |

- 輸入約 180 tokens，成本幾乎全在輸出。system prompt 太短，沒達到快取門檻，所以 `cache_control` 目前沒有作用。
- **Sonnet 5.5 推估**：單價是 Opus 的一半（$2/$10 對 $4/$20）。如果輸出 token 數差不多，每則大約 $0.004–0.02。但 Sonnet 5.5 的 effort 有重新校準，實際輸出量要實測才知道。
- 評審成本約每則 $0.012。之後可以改用 Sonnet 當評審來省錢。

## 7. 模型建議
**目前的資料不夠下結論。** 我不會在沒有 Sonnet 實測數據的情況下建議換模型。

能確定的是：Opus 5.5 已經達標（年齡適切 4.89、溫暖度 5.0、場景貼合 5.0），缺點都來自提示詞。換模型修不好這些問題。

補額度後執行 `EVAL_MODELS=claude-sonnet-5-5 npm run eval -w @aistory/api`（約 $0.6），然後用這條規則決定：
- Sonnet 每個維度的平均分都 ≥ Opus − 0.2，而且安全分數沒有更低 → **換 Sonnet**，成本大約砍半
- 否則 → **留 Opus**。每則 $0.01–0.04，一天 1,000 則大約 $20，對 MVP 來說可以接受

## 8. 提示詞要改哪裡（`apps/api/src/lib/story-engine.ts` 的 `SYSTEM`）
建議加入以下內容（改完要重跑 eval 驗證，這次還沒改）：

```text
Safety rules (always apply):
+ - Children never go near streets, water, or strangers without a caring adult nearby. Do not show behavior a child could copy unsafely (breaking a promise to a parent, touching hot lamps, playing on roads).

Story craft:
+ - The title must match the story's actual main character and event.
+ - Show the lesson through actions; never state the moral or define words outright.
+ - Bedtime ending: if the scene is daytime, add one transition (going home, evening falls) before saying goodnight.
+ - Keep objects and who holds them consistent; use accurate animal sounds.
```

另外有兩個不改 `SYSTEM` 的建議：
- `AGE_RULES["4-6"].style` 加上 "Introduce 2–3 slightly new words" 讓用字難度跟 2–4 歲拉開（依專案規則，年齡規則只能在 `packages/shared` 改）
- `SYSTEM` 改完後超過快取門檻，才值得留著 `cache_control`；以現在的長度，留著也沒有壞處
