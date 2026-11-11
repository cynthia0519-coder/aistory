#!/usr/bin/env python3
"""PreToolUse[Bash]: library:publish 的硬性關卡（不靠提示詞）。

- 帶 --force（跳過 AI 預審）→ deny
- 要上架的故事屬於「身體自主」類（category body）或原創集（ORIGINAL_PREFIXES）→ ask（Cynthia 要先聽過）
- 其他一律放行；找不到的 id 交給 publish-library.ts 自己擋
- --list 放行；--file 會讀檔判斷；只有主題清單解析失敗才 ask（fail closed）
"""
import json, os, re, shlex, sys

# 原創集（媽媽要先聽過）；新增原創系列時把前綴加進來
ORIGINAL_PREFIXES = ("mumu-jerry-",)

def out(decision, reason):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
        "permissionDecision": decision, "permissionDecisionReason": reason}}, ensure_ascii=False))
    sys.exit(0)

try:
    data = json.load(sys.stdin)
except ValueError:
    sys.exit(0)
if data.get("tool_name") != "Bash":
    sys.exit(0)
cmd = (data.get("tool_input") or {}).get("command", "")
if "library:publish" not in cmd and "publish-library" not in cmd:
    sys.exit(0)

if "--force" in cmd:
    out("deny", "[publish-guard] 禁止用 --force 跳過 AI 預審。先跑 library:review 修到 ok；做不到就放進待辦清單，繼續其他工作。")
if "--list" in cmd and "--unpublish" not in cmd:
    sys.exit(0)

root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
try:
    seg = cmd.split("library:publish", 1)[1] if "library:publish" in cmd else cmd.split("publish-library", 1)[1]
    seg = re.split(r"&&|\|\||;|\|", seg)[0]
    toks, ids, skip = shlex.split(seg), [], False
    for t in toks:
        if skip: skip = False; continue
        if t == "--file":
            skip = True
            fp = toks[toks.index(t) + 1]
            with open(fp if os.path.isabs(fp) else os.path.join(data.get("cwd") or root, fp), encoding="utf-8") as fh:
                ids += [x.split("@")[0] for x in fh.read().split() if x.strip()]
            continue
        if t in ("--at", "-w", "--workspace"): skip = True; continue
        if t.startswith("-") or t.endswith(".ts"): continue
        ids += [x.split("@")[0] for x in t.split(",") if x.split("@")[0].strip()]
    if not ids:
        raise ValueError("no ids")
    with open(os.path.join(root, "apps/client/public/library/stories.json"), encoding="utf-8") as f:
        themes = {s["id"]: s.get("theme") for s in json.load(f)}
    src = open(os.path.join(root, "packages/shared/src/index.ts"), encoding="utf-8").read()
    blocks = re.split(r'\n\s+"?([a-z][a-z0-9-]*)"?: theme\(', src)
    sensitive = set()
    for key, body in zip(blocks[1::2], blocks[2::2]):
        cat = re.match(r'\s*"(\w+)"', body)
        if cat and cat.group(1) == "body":
            sensitive.add(key)
    if not sensitive:
        raise ValueError("theme parse")
except Exception as e:
    out("ask", f"[publish-guard] 無法自動判斷這批故事是否需要你先聽（{e}），請人工確認。")

need = [i for i in ids if themes.get(i) in sensitive or i.startswith(ORIGINAL_PREFIXES)]
if need:
    out("ask", "[publish-guard] 以下故事是身體自主或原創集，要你先聽過才上架：" + ", ".join(need))
sys.exit(0)
