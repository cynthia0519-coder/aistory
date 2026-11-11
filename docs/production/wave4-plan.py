# 排第四波節目表：python3 docs/production/wave4-plan.py（在 repo 根目錄跑），輸出 docs/production/wave4-production.json
# 2027-07-01～08-31 的週一、三、四、六、日（週二、五是故事庫對話的集數），44 集全是 2026-11-11 新寫的暑假題材
# 日期手動排：開學相關（作息調整、參觀幼兒園、早上練習、健康檢查、燙制服）放 8 月下旬；
# 游泳課、夏令營結尾的故事放 8 月；颱風、玩水、安全類分散，不連續兩集安全類、同主題間隔 3 天以上（開學週例外）
import json,re,datetime,collections
s={x['id']:x for x in json.load(open('apps/client/public/library/stories.json'))}
ORDER='''07-01 screen-time-summer-vacation-plan
07-03 summer-paper-fan-wind-friend
07-04 empathy-delivery-worker-rain
07-05 sharing-turns-pool-noodle
07-07 manners-countryside-relatives
07-08 sockets-electric-fan-plug
07-10 caring-for-nature-stream-shrimp-release
07-11 summer-cicada-goodnight-concert
07-12 responsibility-neighbor-plant-watering
07-14 crossing-road-beach-town-scooters
07-15 brushing-teeth-shaved-ice-sugar
07-17 tidying-toys-summer-shell-collection
07-18 fear-of-dark-countryside-night-sounds
07-19 typhoon-day-blanket-fort
07-21 honesty-shared-popsicle
07-22 summer-grandpa-harbor-sunrise
07-24 medicine-motion-sickness-candy-tin
07-25 courage-first-summer-camp-night
07-26 anger-rainy-day-block-tower
07-28 handwashing-beach-before-snack
07-29 bullying-summer-camp-new-kid
07-31 windows-balcony-window-screen-cat
08-01 respecting-differences-cousin-wheelchair-beach
08-02 water-safety-swim-class-deep-end
08-04 potty-road-trip-rest-stop
08-05 strangers-summer-camp-pickup
08-07 summer-afternoon-thunder-nap
08-08 forgiveness-borrowed-kite
08-09 getting-lost-amusement-park-map
08-11 trying-food-summer-fruit-market
08-12 water-safety-stream-rising-water
08-14 gratitude-garbage-truck-summer-thanks
08-15 bedtime-routine-summer-to-school-clock
08-16 perseverance-learning-to-swim
08-18 typhoon-neighbor-check-call
08-19 losing-failing-summer-swim-test
08-21 teamwork-summer-camp-raft
08-22 starting-kindergarten-school-visit-day
08-23 online-safety-game-voice-chat
08-25 starting-kindergarten-morning-practice
08-26 doctor-shots-school-checkup
08-28 keeping-promises-summer-letter-friend
08-29 caring-for-nature-bring-your-own-cup
08-30 hot-things-ironing-new-uniform'''
plan=[(('2027-'+l.split()[0]),l.split()[1]) for l in ORDER.splitlines()]
days=[d.isoformat() for d in (datetime.date(2027,7,1)+datetime.timedelta(i) for i in range(62)) if d.weekday() not in (1,4)]
assert [d for d,_ in plan]==days, 'dates must be every Mon/Wed/Thu/Sat/Sun'
ids=[i for _,i in plan]; assert len(set(ids))==44 and all(i in s for i in ids)
SAFETY={'crossing-road','earthquake','getting-lost','online-safety','hot-things','water-safety','strangers','sockets','windows-balcony','typhoon','medicine'}
for a in range(len(plan)):
  for b in range(a+1,len(plan)):
    gap=(datetime.date.fromisoformat(plan[b][0])-datetime.date.fromisoformat(plan[a][0])).days
    ta,tb=s[plan[a][1]].get('theme'),s[plan[b][1]].get('theme')
    if ta and ta==tb and gap<3 and ta!='starting-kindergarten': print('WARN same theme',plan[a],plan[b])
    if ta in SAFETY and tb in SAFETY and gap<=1: print('WARN safety back-to-back',plan[a],plan[b])
BAD=re.compile('唸|念|繪本|看書|字|讀|寫|學校|小學|考試|作業|功課|課本|教室|書包|班上|班長|上學|制服|開學|校門')
NOMUMU={'new-sibling','starting-kindergarten','moving-house'}
NOMUMU_IDS={'honesty-shared-popsicle','sharing-turns-pool-noodle','anger-rainy-day-block-tower','forgiveness-borrowed-kite','respecting-differences-cousin-wheelchair-beach'}  # 姊姊／表妹／小朋友是劇情重點，封面要出現別的孩子
FORCE_MUMU={'fear-of-dark-countryside-night-sounds','summer-afternoon-thunder-nap'}  # 「名字」「數字」被 BAD 誤判，其實不用讀寫
out=[]
for d,i in plan:
  x=s[i]; txt=''.join(x['paragraphs']['zh'])
  h='mumu' if i in FORCE_MUMU or any(b in('2-4','4-6') for b in x['ageBands']) and not BAD.search(txt) and x.get('theme') not in NOMUMU and i not in NOMUMU_IDS else 'bo'
  out.append({'date':d,'id':i,'hero':h,'kind':'library'})
json.dump(out,open('docs/production/wave4-production.json','w'),ensure_ascii=False,indent=1)
print(collections.Counter(o['hero'] for o in out))
for o in out: print(o['date'],o['hero'],o['id'],s[o['id']]['ageBands'])
