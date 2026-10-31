# raw/<id>.jpg (1920x1080, sometimes with painted plain margins) -> episode-art/<id>.jpg 1600x900
import sys, numpy as np
from PIL import Image, ImageFilter, ImageEnhance
W,H=1600,900
src, dst = sys.argv[1], sys.argv[2]
im=Image.open(src).convert('RGB')
a=np.asarray(im.convert('L'),dtype=float)
c=np.where(a.std(axis=0)>6)[0]; r=np.where(a.std(axis=1)>6)[0]
box=(int(c[0]),int(r[0]),int(c[-1])+1,int(r[-1])+1)
im=im.crop(box); w,h=im.size; ar=w/h
if ar>=1.55:
    s=max(W/w,H/h); im=im.resize((round(w*s),round(h*s)),Image.LANCZOS)
    x=(im.width-W)//2; y=(im.height-H)//2; out=im.crop((x,y,x+W,y+H))
else:
    s=max(W/w,H/h); bg=im.resize((round(w*s),round(h*s)),Image.LANCZOS)
    x=(bg.width-W)//2; y=(bg.height-H)//2; bg=bg.crop((x,y,x+W,y+H)).filter(ImageFilter.GaussianBlur(40))
    bg=ImageEnhance.Brightness(bg).enhance(0.94)
    fg=im.resize((round(w*H/h),H),Image.LANCZOS); bg.paste(fg,((W-fg.width)//2,0)); out=bg
out.save(dst,quality=84,optimize=True,progressive=True)
print(dst.split('/')[-1], 'fill' if ar>=1.55 else 'blur', round(ar,2))
