# 做半個月一頁的上傳頁：python3 docs/production/build-upload-page.py wave2 2027-03-01 2027-03-15 "第二波節目 3/1–3/15" "lead 文字" out-dir
# 檔案放在 out-dir（影片、縮圖、封面、音檔 JSON 包），index.html 用相對路徑引用，之後用 publish_files 一起發布
import base64, datetime, json, os, shutil, sys

wave, start, end, title, lead, out = sys.argv[1:7]
n = wave.removeprefix('wave')
root = os.path.dirname(os.path.abspath(__file__))
api = os.path.join(root, '../../apps/api')
eps = [e for e in json.load(open(f'{root}/{wave}-production.json')) if start <= e['date'] <= end]
os.makedirs(f'{out}/m', exist_ok=True)
items = []
for e in eps:
    i = e['id']; mj = i.startswith('mumu-jerry')
    for lang in ('zh', 'en'):
        sub = ('episodes-mumu-jerry' if mj else f'episodes-w{n}') if lang == 'zh' else ('episodes-en-mumu-jerry' if mj else f'episodes-en-w{n}')
        d = f'{api}/out/{sub}/{i}'; info = json.load(open(f'{d}/info.json')); key = f'{lang}-{i}'
        for suf in ('.mp4', '-thumb.jpg', '-cover.jpg'):
            shutil.copy(f'{d}/{i}{suf}', f'{out}/m/{key}{suf}')
        dt = datetime.date.fromisoformat(e['date'])
        items.append(dict(id=key, date=f"{dt.month}/{dt.day}（{'一二三四五六日'[dt.weekday()]}）", series=mj,
                          title=info['title'], description=info['description'], seconds=info['seconds'],
                          video=f'm/{key}.mp4', thumb=f'm/{key}-thumb.jpg', cover=f'm/{key}-cover.jpg', mp3=f'{d}/{i}.mp3'))
for b in range(0, len(items), 4):
    grp = items[b:b + 4]; name = f'm/audio-{b // 4 + 1}.json'
    json.dump({x['id']: base64.b64encode(open(x['mp3'], 'rb').read()).decode() for x in grp}, open(f'{out}/{name}', 'w'))
    for x in grp: x['audio'] = name; del x['mp3']
zipname = f"AISTORY-{wave}-{start[5:].replace('-', '')}-{end[5:].replace('-', '')}-audio.zip"
t = open(f'{root}/upload-page-template.html').read()
t = t.replace('__TITLE__', title).replace('__LEAD__', lead).replace('__ZIPNAME__', zipname).replace('__EPISODES__', json.dumps(items, ensure_ascii=False))
open(f'{out}/index.html', 'w').write(t)
print(len(eps), 'episodes', len(items), 'items')
