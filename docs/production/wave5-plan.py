# 排第五波節目表：python3 docs/production/wave5-plan.py（在 repo 根目錄跑），輸出 docs/production/wave5-production.json
# 2027-09-01～10-31 的週一、三、四、六、日（週二、五是故事庫對話的集數），43 集 2026-11-23 新寫＋第四波備用的剉冰雪人
# 日期手動排：開學放 9 月上旬、中秋 9/15（燈籠、走失、月餅、刷牙圍繞中秋）、防災日地震演練 9/22、教師節卡片 9/26、運動會與音樂會放 10 月；安全類不連排
import json,re,datetime,collections
s={x['id']:x for x in json.load(open('apps/client/public/library/stories.json'))}
ORDER='''09-01 starting-kindergarten-treasure-shelf
09-02 summer-shaved-ice-snowman
09-04 crossing-road-first-walk-to-school
09-05 empathy-crying-friend-first-day
09-06 bullying-new-term-nickname
09-08 starting-kindergarten-nap-time-blanket
09-09 tidying-toys-school-bag-pockets
09-11 typhoon-building-neighbors
09-12 keeping-promises-moon-festival-visit
09-13 getting-lost-moon-festival-picnic
09-15 mid-autumn-rabbit-mooncakes
09-16 brushing-teeth-after-mooncake
09-18 courage-raising-hand-in-class
09-19 sharing-turns-class-block-corner
09-20 potty-music-time-signal
09-22 earthquake-school-drill-day
09-23 anger-recess-domino-line
09-25 handwashing-flu-season-class-helper
09-26 gratitude-teachers-day-card
09-27 responsibility-class-duty-day
09-29 sockets-night-light-lantern
09-30 new-sibling-peekaboo-smile
10-02 hot-things-roasted-sweet-potato
10-03 autumn-leaf-crunch-walk
10-04 honesty-torn-library-book
10-06 medicine-not-sharing-cousins-syrup
10-07 moving-house-new-court-friends
10-09 caring-for-nature-hawk-migration
10-10 fear-of-dark-starry-hallway
10-11 trying-food-persimmon-autumn
10-13 online-safety-castle-griefer
10-14 dentist-tool-tour
10-16 teamwork-sports-day-giant-ball
10-17 autumn-hsinchu-persimmon-wind
10-18 strangers-sports-center-pickup
10-20 losing-failing-three-legged-race
10-21 doctor-shots-grandpa-joke-helper
10-23 windows-balcony-ribbon-breeze
10-24 respecting-differences-new-classmate-from-vietnam
10-25 perseverance-recorder-grandma-audience
10-27 water-safety-pond-ball
10-28 forgiveness-cardboard-castle-tower
10-30 bedtime-routine-school-night
10-31 autumn-osmanthus-tea-night'''
plan=[(('2027-'+l.split()[0]),l.split()[1]) for l in ORDER.splitlines()]
days=[d.isoformat() for d in (datetime.date(2027,9,1)+datetime.timedelta(i) for i in range(61)) if d.weekday() not in (1,4)]
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
NOMUMU_IDS={'empathy-crying-friend-first-day','sharing-turns-class-block-corner','new-sibling-peekaboo-smile','medicine-not-sharing-cousins-syrup'}  # 別的孩子是劇情重點，或沐沐家沒有這個角色
FORCE_MUMU={'fear-of-dark-starry-hallway'}  # 「名字」「數字」被 BAD 誤判，其實不用讀寫
out=[]
for d,i in plan:
  x=s[i]; txt=''.join(x['paragraphs']['zh'])
  h='mumu' if i in FORCE_MUMU or any(b in('2-4','4-6') for b in x['ageBands']) and not BAD.search(txt) and x.get('theme') not in NOMUMU and i not in NOMUMU_IDS else 'bo'
  out.append({'date':d,'id':i,'hero':h,'kind':'library'})
json.dump(out,open('docs/production/wave5-production.json','w'),ensure_ascii=False,indent=1)
print(collections.Counter(o['hero'] for o in out))
for o in out: print(o['date'],o['hero'],o['id'],s[o['id']]['ageBands'])
