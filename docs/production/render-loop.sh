#!/bin/bash
# 跟著 waveN-art-done.txt 一集一集算圖（中英文），做完的記在 waveN-render-done.txt；可重跑
# 用法：bash docs/production/render-loop.sh [wave1|wave2]（預設 wave1）
W=${1:-wave1}; N=${W#wave}
S="$(cd "$(dirname "$0")" && pwd)"  # docs/production
cd "$S/../../apps/api"; touch $S/$W-art-done.txt $S/$W-render-done.txt
TOTAL=$(python3 -c "import json;print(len(json.load(open('$S/$W-production.json'))))")
while true; do
  for id in $(cat $S/$W-art-done.txt); do
    grep -qx "$id" $S/$W-render-done.txt && continue
    [[ -f episode-art/$id.jpg ]] || continue
    if [[ $id == mumu-jerry-* ]]; then ZH=out/episodes-mumu-jerry; EN=out/episodes-en-mumu-jerry; else ZH=out/episodes-w$N; EN=out/episodes-en-w$N; fi
    ok=1
    EPISODE_CREDIT="解放媽媽頻道製作" NODE_USE_ENV_PROXY=1 npx tsx scripts/render-episodes.ts --only $id --lang zh --out $ZH 2>&1 | grep -q "^$id … ok" || ok=0
    EPISODE_CREDIT="AISTORY by Liberated Mom · Bedtime stories that get kids talking" NODE_USE_ENV_PROXY=1 npx tsx scripts/render-episodes.ts --only $id --lang en --out $EN 2>&1 | grep -q "^$id … ok" || ok=0
    if [[ $ok == 1 ]]; then echo $id >> $S/$W-render-done.txt; else echo "FAIL $id $(date +%T)" >> $S/$W-render.log; fi
  done
  [[ $(wc -l < $S/$W-render-done.txt) -ge $TOTAL ]] && { echo ALLDONE >> $S/$W-render.log; exit 0; }
  sleep 60
done
