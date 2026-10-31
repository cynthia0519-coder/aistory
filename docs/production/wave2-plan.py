# 排第二波節目表：python3 docs/production/wave2-plan.py（在 repo 根目錄跑），輸出 docs/production/wave2-production.json
# library-episodes.txt 是故事庫對話已做成週二、五節目的故事（不能再用）
import json,collections,datetime,re,random
s=json.load(open('apps/client/public/library/stories.json'))
used={x['id'] for x in json.load(open('docs/production/wave1-production.json'))}
f=json.load(open('apps/api/eval/review-flags.json'))['stories']
heroes=json.load(open('apps/api/episode-heroes.json'))
KEEP={'firefly-valley-lanterns','responsibility-ants-and-the-grasshopper','perseverance-the-character-yong'}
SEAS=re.compile('christmas|new-year|halloween|lunar|thanksgiving|winter|snow|mooncake|lantern|lion-dance|fireworks|dragon-boat|rabbit-in-the-moon|mountain-lodge')
def seasonal(x):
  if x['id'] in KEEP: return False
  t=x['title']['zh']+''.join(x['paragraphs']['zh'])
  return bool(SEAS.search(x['id']) or re.search('聖誕|過年|除夕|中秋|月餅|萬聖|跨年|春節|端午|粽子|元宵|下雪|雪花|寒流|感恩節',t))
E=set(open('docs/production/library-episodes.txt').read().split())  # 故事庫對話已做成節目的故事
NOPE={'good-bad-secrets','saying-no','trusted-adults','swimsuit-rule','not-your-fault','pet-loss'}
c=[x for x in s if x['id'] not in used|E and not x.get('cast') and x.get('theme') not in NOPE and (f.get(x['id']) or {}).get('status')=='ok']
start=datetime.date(2027,3,1); days=[d for d in (start+datetime.timedelta(i) for i in range(61)) if d.weekday() not in (1,4)]  # 週二、五是故事庫對話的集數
fixed={};pool=[]
for x in c:
  p=(x.get('publishAt') or '')[:10]
  if not p and not seasonal(x): pool.append(x)
SAFETY={'crossing-road','earthquake','getting-lost','online-safety','hot-things','water-safety','strangers','sockets','windows-balcony','typhoon'}
plan={k.isoformat():fixed[k.isoformat()] for k in days if k.isoformat() in fixed}
theme=lambda x: x.get('theme') or ('_'+x['style'])
order=sorted(pool,key=lambda x:x['id']); random.seed(2027); random.shuffle(order)
for d in days:
  k=d.isoformat()
  if k in plan: continue
  near=[plan.get((d+datetime.timedelta(j)).isoformat()) for j in (-3,-2,-1,1,2)]
  recent={theme(p) for p in near if p}
  rs=any(p and p.get('theme') in SAFETY for p in near[1:4])
  cnt=collections.Counter(theme(v) for v in plan.values())
  ok=lambda x: cnt[theme(x)]<(3 if x.get('theme') else 99)
  pick=next((x for x in order if ok(x) and theme(x) not in recent and not (x.get('theme') in SAFETY and rs)),None) or next(x for x in order if ok(x))
  order.remove(pick); plan[k]=pick
BAD=re.compile('唸|念|繪本|看書|字|讀|寫|學校|小學|考試|作業|功課|課本|教室|書包|班上|班長')
NOMUMU={'new-sibling','starting-kindergarten','moving-house'}
out=[]
for k in sorted(plan):
  x=plan[k]; txt=''.join(x['paragraphs']['zh'])
  h=heroes.get(x['id']) or ('mumu' if any(b in('2-4','4-6') for b in x['ageBands']) and not BAD.search(txt) and '{name}' in txt and x.get('theme') not in NOMUMU else 'bo')
  out.append({'date':k,'id':x['id'],'hero':h,'kind':'library'})
json.dump(out,open('docs/production/wave2-production.json','w'),ensure_ascii=False,indent=1)
print(collections.Counter(o['hero'] for o in out), sum(plan[k].get('theme') in SAFETY for k in plan))
for o in out:
  x=plan[o['date']]; print(o['date'],o['hero'],o['id'],x['title']['zh'],x.get('theme'),(x.get('publishAt') or '')[:10])
