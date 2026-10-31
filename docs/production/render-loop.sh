#!/bin/bash
# 跟著 wave1-art-done.txt 一集一集算圖（中英文），做完的記在 wave1-render-done.txt；可重跑
S="$(cd "$(dirname "$0")" && pwd)"  # docs/production
cd "$S/../../apps/api"; touch $S/wave1-art-done.txt $S/wave1-render-done.txt
TOTAL=$(python3 -c "import json;print(len(json.load(open('$S/wave1-production.json'))))")
while true; do
  for id in $(cat $S/wave1-art-done.txt); do
    grep -qx "$id" $S/wave1-render-done.txt && continue
    [[ -f episode-art/$id.jpg ]] || continue
    if [[ $id == mumu-jerry-* ]]; then ZH=out/episodes-mumu-jerry; EN=out/episodes-en-mumu-jerry; else ZH=out/episodes-w1; EN=out/episodes-en-w1; fi
    ok=1
    EPISODE_CREDIT="解放媽媽頻道製作" NODE_USE_ENV_PROXY=1 npx tsx scripts/render-episodes.ts --only $id --lang zh --out $ZH 2>&1 | grep -q "^$id … ok" || ok=0
    EPISODE_CREDIT="AISTORY by Liberated Mom · Bedtime stories that get kids talking" NODE_USE_ENV_PROXY=1 npx tsx scripts/render-episodes.ts --only $id --lang en --out $EN 2>&1 | grep -q "^$id … ok" || ok=0
    if [[ $ok == 1 ]]; then echo $id >> $S/wave1-render-done.txt; else echo "FAIL $id $(date +%T)" >> $S/wave1-render.log; fi
  done
  [[ $(wc -l < $S/wave1-render-done.txt) -ge $TOTAL ]] && { echo ALLDONE >> $S/wave1-render.log; exit 0; }
  sleep 60
done
