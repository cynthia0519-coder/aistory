# 故事品質測試

```bash
ANTHROPIC_API_KEY=... npm run eval -w @aistory/api
```

| 環境變數 | 預設 | 用途 |
|---|---|---|
| `EVAL_MODELS` | `claude-opus-5-5,claude-sonnet-5-5` | 要比較的模型 |
| `EVAL_CASES` | 全部 | 只跑指定組合，例如 `2-4:zh,6-8:en` |
| `EVAL_SCENES` | 3 | 只跑前 N 個場景 |
| `EVAL_STYLE` / `EVAL_LENGTH` | `bedtime` / `3min` | 故事風格與長度 |
| `EVAL_JUDGE_MODEL` | `claude-opus-5-5` | 評審模型 |

完整跑一輪（2 模型 × 24 則，含評審）約 $1.2。逐則結果寫進 `eval/results/`（已 gitignore）。報告放在 `docs/eval/`。
