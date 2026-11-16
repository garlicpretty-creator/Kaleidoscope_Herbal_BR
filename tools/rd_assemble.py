"""Turns the Retro Diffusion redraws in art/retro_diffusion/rest/ into the sprites tools/icons.py reads from
tools/icon_src/rd/. Usage: python3 tools/rd_assemble.py, then python3 tools/icons.py

Every file in rest/ is the code-drawn icon of that name redrawn image-to-image (<name>_s50.png at strength 0.5,
<name>_s35.png at 0.35 for the ones that drifted too far). Redrawing loses three things, which are put back here:
  farmed plants   the strip of tilled soil that tells them from the wild plant is taken from the drawn icon
  powder packets  nine redraws give nine slightly different packets and smudge the signs, so all use one redrawn
                  packet and keep their own drawn label and sign (the odd one, strange powder, keeps its own redraw)
  herb powders    ten redraws give ten different heaps, so all use one redrawn heap recoloured to the herb"""
import os,sys
from PIL import Image
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import icons
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
SRC=os.path.join(ROOT,'art','retro_diffusion','rest');OUT=os.path.join(ROOT,'tools','icon_src','rd')
CLOSER={'carried_honeysuckle_crop','carried_jujube_crop','carried_chrysanthemum_crop','carried_mugwort_crop','carried_wild_ginseng',
        'icon_incense_burner','burnt_dregs','dried_cordyceps','carried_reishi_spawn','icon_hanging_gourd'}
def redraw(name):
    return Image.open(os.path.join(SRC,name+('_s25' if name=='icon_abacus' else '_s35' if name in CLOSER else '_s50')+'.png')).convert('RGBA')
def clean(im):
    for y in range(16):
        for x in range(16):
            p=im.getpixel((x,y));im.putpixel((x,y),p[:3]+(255,) if p[3]>=128 else (0,0,0,0))
    return im
if __name__=='__main__':
    names=sorted({f.rsplit('_s',1)[0] for f in os.listdir(SRC) if f.endswith('.png')});out={n:clean(redraw(n)) for n in names}
    for n in names:                                   # farmed plants: the drawn soil strip
        if n.startswith('carried_') and n.endswith('_crop'):
            for (x,y),(rgba,mat) in icons.PLANTS[n]().items():
                if mat=='soil': out[n].putpixel((x,y),rgba[:3]+(255,))
    packets={n:icons.packet(*args) for n,args in icons.POWDERS.items()}
    label={xy for px in packets.values() for xy in px if any(q.get(xy)!=px[xy] for q in packets.values())}
    body=out['qing_re_powder'].copy()
    for n,px in packets.items():                      # powder packets: one redrawn packet, the drawn label and sign
        im=body.copy()
        for xy in label: im.putpixel(xy,px[xy][0][:3]+(255,))
        out[n]=im
    heap=out['goji_powder'];is_powder=lambda p:p[3] and p[0]-p[1]>40
    lum=lambda p:p[0]*.3+p[1]*.59+p[2]*.11;ls=[lum(heap.getpixel((x,y))) for y in range(16) for x in range(16) if is_powder(heap.getpixel((x,y)))]
    lo,hi=min(ls),max(ls)
    for herb,(light,mid,dark) in icons.PILES.items():  # herb powders: one redrawn heap in the herb's own three shades
        im=heap.copy()
        for y in range(16):
            for x in range(16):
                p=heap.getpixel((x,y))
                if not is_powder(p): continue
                t=(lum(p)-lo)/(hi-lo);a,b,k=(dark,mid,t*2) if t<.5 else (mid,light,t*2-1)
                im.putpixel((x,y),tuple(round(a[i]+(b[i]-a[i])*k) for i in range(3))+(255,))
        out[herb+'_powder']=im
    # The 38 icons that were hand-drawn originals (kept in tools/icon_src/original/), redrawn the same way into orig/.
    ORIG=os.path.join(ROOT,'art','retro_diffusion','orig');KEPT=os.path.join(ROOT,'tools','icon_src','original')
    for n in sorted({f.rsplit('_s',1)[0] for f in os.listdir(ORIG) if f.endswith('.png')}):
        best=next(p for p in (os.path.join(ORIG,n+s+'.png') for s in ('_s20','_s30','_s50')) if os.path.exists(p))   # the redraw closest to the original that exists
        out[n]=clean(Image.open(best).convert('RGBA'))
    seeds=out['angelica_seeds'].copy()                 # chrysanthemum seeds came out as noise both times: the angelica seeds in grey
    for y in range(16):
        for x in range(16):
            p=seeds.getpixel((x,y))
            if p[3]: g=round(70+lum(p)*.62);seeds.putpixel((x,y),(g,g,g-6,255))
    out['chrysanthemum_seeds']=seeds
    dew=Image.open(os.path.join(KEPT,'dewy_honeysuckle.png')).convert('RGBA')   # the dew drops were painted over: put them back
    for y in range(16):
        for x in range(16):
            p=dew.getpixel((x,y))
            if p[3] and p[2]>p[0]+30: out['dewy_honeysuckle'].putpixel((x,y),p[:3]+(255,))
    for n,im in out.items(): im.save(os.path.join(OUT,n+'.png'))
    print(len(out),'sprites')
