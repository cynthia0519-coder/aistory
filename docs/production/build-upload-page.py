# 做半個月一頁的上傳頁：python3 docs/production/build-upload-page.py wave2 2027-03-01 2027-03-15 "第二波節目 3/1–3/15" "lead 文字" out-dir
# 第 8 個參數（選填）：逗號分隔的 id，只收這幾集，例如補件頁
# 檔案放在 out-dir（影片、縮圖、封面、音檔 JSON 包），index.html 用相對路徑引用，之後用 publish_files 一起發布
import base64, datetime, json, os, shutil, sys

wave, start, end, title, lead, out = sys.argv[1:7]
only = set(sys.argv[7].split(',')) if len(sys.argv) > 7 else None  # 選填：只收這些 id（補件頁用）
n = wave.removeprefix('wave')
root = os.path.dirname(os.path.abspath(__file__))
api = os.path.join(root, '../../apps/api')
eps = [e for e in json.load(open(f'{root}/{wave}-production.json')) if start <= e['date'] <= end and (only is None or e['id'] in only)]
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
for x in items:  # mp3 直接當成頁面檔案發布（頁面檔案收 mp3；舊的 assets 空間才不收）
    shutil.copy(x['mp3'], f"{out}/m/{x['id']}.mp3"); x['audio'] = f"m/{x['id']}.mp3"; del x['mp3']
zipname = f"AISTORY-{wave}-{start[5:].replace('-', '')}-{end[5:].replace('-', '')}-audio.zip"
t = open(f'{root}/upload-page-template.html').read()
t = t.replace('__TITLE__', title).replace('__LEAD__', lead).replace('__ZIPNAME__', zipname).replace('__EPISODES__', json.dumps(items, ensure_ascii=False))
open(f'{out}/index.html', 'w').write(t)
print(len(eps), 'episodes', len(items), 'items')
