"""Writes the 16x16 item icons into the resource pack, with their normal and MER maps.

Usage: python3 tools/icons.py            writes every icon
       python3 tools/icons.py --sheet F  also writes a contact sheet of them to F

Every icon is a sprite in tools/icon_src/rd/ (Retro Diffusion output, put together by tools/rd_assemble.py,
tools/tea_cups.py and tools/decoction_bowls.py). RD gives each icon its material, which sets the MER map
(metalness, emissive, roughness) and how much the pixels are raised in the normal map; RD_PARTS picks out
parts of an icon that are a different material.

Three drawings are still made here because rd_assemble.py puts them back into the redrawn sprites: the grass
and tilled soil under the plant icons (PLANTS), the label and sign of each powder packet (packet, POWDERS) and
the three shades of each herb powder (PILES). A drawing is 16 strings of 16 characters; '.' is transparent and
every other character is looked up in its palette as (r, g, b[, a], material).
"""
import json,os,sys
from PIL import Image,ImageDraw
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
OUT=os.path.join(ROOT,'Kaleidoscope Herbal [RP]','textures','kaleidoscope_herbal','items')
SRC=os.path.join(os.path.dirname(os.path.abspath(__file__)),'icon_src')

# material -> (metalness, emissive, roughness, height)
MAT={'cer':(0,0,120,2),'liq':(0,0,40,1),'glass':(0,0,30,2),'paper':(0,0,230,1),'wood':(0,0,215,2),'herb':(0,0,200,2),
     'meat':(0,0,150,2),'brass':(255,0,105,2),'iron':(255,0,135,2),'stone':(0,0,225,2),'soil':(0,0,245,1),'cloth':(0,0,240,1),
     'wax':(0,0,90,2),'glow':(0,210,200,2),'steam':(0,0,255,0),'line':(0,0,200,1)}
OUTLINE=(54,46,42,'line')

def layer(rows,pal,base=None,top=0):
    """Paints `rows` (any height, placed from row `top`) over `base` (a dict (x,y)->(rgba,mat))."""
    px=dict(base or {})
    for y,row in enumerate(rows):
        assert len(row)==16,('row',y+top,len(row),row)
        for x,ch in enumerate(row):
            if ch=='.':continue
            c=pal[ch];rgba=c[:3]+((c[3],) if len(c)==5 else (255,));px[(x,y+top)]=(rgba,c[-1])
    return px

def render(px):
    img=Image.new('RGBA',(16,16),(0,0,0,0))
    for (x,y),(rgba,_) in px.items():img.putpixel((x,y),rgba)
    return img

def pbr_maps(px):
    """Flat-shaded bevel: each opaque pixel is raised by its material height, plus a little relief from brightness."""
    h=[[0.0]*16 for _ in range(16)];mer=Image.new('RGBA',(16,16),(0,0,240,255))
    for (x,y),(rgba,mat) in px.items():
        if rgba[3]<60:continue
        m,e,r,hh=MAT[mat];lum=(rgba[0]*.3+rgba[1]*.59+rgba[2]*.11)/255
        h[y][x]=hh+lum*.6;mer.putpixel((x,y),(m,e,r,255))
    nrm=Image.new('RGBA',(16,16),(128,128,255,255))
    at=lambda x,y:h[min(15,max(0,y))][min(15,max(0,x))]
    for (x,y),(rgba,_) in px.items():
        dx=(at(x+1,y)-at(x-1,y))*.18;dy=(at(x,y+1)-at(x,y-1))*.18
        n=(-dx,dy,1.0);l=sum(v*v for v in n)**.5
        nrm.putpixel((x,y),tuple(round((v/l*.5+.5)*255) for v in n)+(255,))
    return nrm,mer

def save(name,px,written):
    img=render(px);nrm,mer=pbr_maps(px)
    img.save(os.path.join(OUT,name+'.png'));nrm.save(os.path.join(OUT,name+'_normal.png'));mer.save(os.path.join(OUT,name+'_mer.png'))
    with open(os.path.join(OUT,name+'.texture_set.json'),'w') as f:
        f.write(json.dumps({"format_version":"1.16.100","minecraft:texture_set":{"color":name,"normal":name+"_normal","metalness_emissive_roughness":name+"_mer"}},separators=(',',':')))
    written.append(name)

def darken(c,t):return tuple(round(v*(1-t)) for v in c)

# ---------------------------------------------------------------- medicinal powders: one packet, a coloured label with a sign
PACKET=["................","................",
"...oooooooooo...",
"..oPPPPPPPPPPo..",
"..oPxxxxxxxPpo..",
"..oPxXXXXXxPpo..",
"..oPxXXXXXxPpo..",
"..oPxXXXXXxPpo..",
"..oPxXXXXXxPpo..",
"..oPxXXXXXxPpo..",
"..oPxxxxxxxPpo..",
"..oPPPPPPPPPpo..",
"..otttttttttto..",
"..oPPPPPPPPppo..",
"...oooooooooo...",
"................"]
SIGNS={
 'eye':  [".....",".YYY.","YYZYY",".YYY.","....."],
 'snow': ["..Y..","Y.Y.Y",".YYY.","Y.Y.Y","..Y.."],
 'moon': [".YYY.","YY...","Y....","YY...",".YYY."],
 'arrow':["..Y..","...Y.","YYYYY","...Y.","..Y.."],
 'flame':["..Y..",".YY..",".YYY.","YYZYY",".YYY."],
 'up':   ["..Y..",".YYY.","Y.Y.Y","..Y..","..Y.."],
 'dots': [".Y.Y.","Y...Y",".....","Y...Y",".Y.Y."],
 'heart':[".Y.Y.","YYYYY","YYYYY",".YYY.","..Y.."],
 'ask':  [".YYY.","....Y","..YY.",".....","..Y.."],
}
def packet(label,border,sign,mark,mark2=(30,30,40),paper=(238,226,198)):
    pal={'o':(96,74,52,'line'),'P':paper+('paper',),'p':darken(paper,.16)+('paper',),'t':(176,40,36,'cloth'),
         'x':border+('paper',),'X':label+('paper',),'Y':mark+('paper',),'Z':mark2+('paper',)}
    px=layer(PACKET,pal)
    return layer(['.....'+r+'......' for r in SIGNS[sign]],pal,px,top=5)
POWDERS={
 'ming_mu_powder':((58,96,190),(34,58,124),'eye',(244,244,255)),
 'qing_re_powder':((36,160,164),(20,98,104),'snow',(244,255,255)),
 'an_shen_powder':((100,70,176),(60,40,112),'moon',(252,236,150)),
 'xing_qi_powder':((70,164,60),(38,100,34),'arrow',(244,255,240)),
 'shen_chong_powder':((194,46,40),(122,24,22),'flame',(252,204,80),(255,244,190)),
 'qing_shen_powder':((232,182,40),(150,108,18),'up',(255,255,250)),
 'yin_xi_powder':((58,60,70),(26,26,32),'dots',(196,198,210)),
 'hui_chun_powder':((228,104,146),(150,50,92),'heart',(255,250,252)),
}

# The three shades of each single-herb powder (highlight, body, shade); rd_assemble.py recolours one heap with them.
PILES={'angelica':((220,180,124),(185,138,82),(138,96,52)),'chrysanthemum':((255,240,138),(240,204,48),(189,148,22)),
 'cordyceps':((207,143,64),(160,98,31),(110,64,18)),'ginseng':((248,236,198),(226,204,148),(181,156,100)),
 'goji':((244,118,94),(210,62,46),(149,35,24)),'honeysuckle':((242,246,184),(211,220,126),(160,169,78)),
 'jujube':((184,74,60),(138,42,34),(90,24,20)),'licorice':((242,210,114),(214,168,60),(162,118,34)),
 'poria':((255,255,255),(235,232,222),(185,180,164)),'reishi':((208,108,64),(156,62,34),(104,36,20))}
# ---------------------------------------------------------------- plants: grass under wild ones, tilled soil under farmed ones
GRASS=["..g......g...g..",
".gGg.g..gGg.gGg.",
"gGGGgGgdGGGgGGGg",
"GGdGGGGGGGdGGGGG"]
GRASS_PAL={'g':(120,182,70,'herb'),'G':(84,146,52,'herb'),'d':(58,108,40,'herb')}
SOIL=["rRrRrRrRrRrRrRrR",
"SSsSSSsSSSsSSSsS",
"ssssssssssssssss"]
SOIL_PAL={'R':(112,76,46,'soil'),'r':(86,56,34,'soil'),'S':(78,52,32,'soil'),'s':(58,38,24,'soil')}
PODZOL=["rRrRrRrRrRrRrRrR",
"SSsSSSsSSSsSSSsS",
"ssssssssssssssss"]
PODZOL_PAL={'R':(126,90,54,'soil'),'r':(96,66,40,'soil'),'S':(92,62,36,'soil'),'s':(64,44,26,'soil')}
BERRIES=["......oo........",".....oRRo.......","....oRrRRo......",".....oRro.......","......oo........"]
BERRY_PAL={'o':(80,20,20,'line'),'R':(220,44,40,'herb'),'r':(250,140,120,'herb')}
def from_src(name):
    img=Image.open(os.path.join(SRC,name+'.png')).convert('RGBA');px={}
    for y in range(16):
        for x in range(16):
            c=img.getpixel((x,y))
            if c[3]:px[(x,y)]=(c,'herb')
    return px
PLANTS={}
for herb in ('angelica','goji','honeysuckle','jujube','licorice'):
    PLANTS['carried_wild_'+herb]=lambda h=herb:layer(GRASS,GRASS_PAL,from_src('carried_wild_'+h),top=12)
    PLANTS['carried_%s_crop'%herb]=lambda h=herb:layer(SOIL,SOIL_PAL,from_src('carried_%s_crop'%h),top=13)
for herb in ('chrysanthemum','mugwort'):
    PLANTS['carried_wild_'+herb]=lambda h=herb:layer(GRASS,GRASS_PAL,from_src('carried_wild_'+h),top=12)
    PLANTS['carried_%s_crop'%herb]=lambda h=herb:layer(SOIL,SOIL_PAL,from_src('carried_wild_'+h),top=13)
PLANTS['carried_wild_ginseng']=lambda:layer(GRASS,GRASS_PAL,from_src('carried_wild_ginseng'),top=12)
PLANTS['carried_ginseng_crop']=lambda:layer(PODZOL,PODZOL_PAL,layer(BERRIES,BERRY_PAL,from_src('carried_wild_ginseng'),top=0),top=13)

# Every icon and its material (tools/icon_src/rd/<name>.png, 16x16, hard-edged alpha).
RD={**{n:'cer' for n in ('ginseng_decoction','four_herb_decoction','reishi_decoction','cordyceps_decoction','four_gentlemen_decoction',
 'mugwort_angelica_decoction','licorice_jujube_decoction','ginseng_chicken_soup','goji_chicken_soup','goji_jujube_soup','jujube_sweet_soup',
 'angelica_mutton_soup','four_herb_chicken','chrysanthemum_tea','goji_tea','honeysuckle_tea','honeysuckle_tea_dew','jujube_tea')},
 **{n:'cer' for n in ('ginseng_wine','goji_wine','angelica_wine','jujube_wine','reishi_wine')},'bitter_dregs':'herb'}
# The other 55 icons: redrawn by Retro Diffusion from the drawings this file used to make, put together by tools/rd_assemble.py.
RD.update({n:'herb' for n in ['burnt_dregs','dried_cordyceps','fresh_cordyceps','dried_jujube','jujube_seeds','mugwort_floss']+[h+'_powder' for h in
 ('angelica','chrysanthemum','cordyceps','ginseng','goji','honeysuckle','jujube','licorice','poria','reishi')]+['carried_%s_crop'%h for h in
 ('angelica','chrysanthemum','ginseng','goji','honeysuckle','jujube','licorice','mugwort')]+['carried_wild_'+h for h in
 ('angelica','chrysanthemum','ginseng','goji','honeysuckle','jujube','licorice','mugwort')]})
RD.update({n+'_powder':'paper' for n in ('an_shen','hui_chun','ming_mu','qing_re','qing_shen','shen_chong','xing_qi','yin_xi','strange')})
RD.update({'sealed_prescription':'paper','icon_herb_packets':'paper','icon_paper_lantern':'paper','carried_reishi_spawn':'wood','herbal_trowel':'wood',
 'icon_abacus':'wood','icon_hanging_gourd':'wood','icon_herb_cabinet':'wood','icon_herb_counter':'wood','icon_steelyard':'wood',
 'icon_clay_pot':'cer','icon_incense_burner':'cer','icon_medicine_jar':'cer','icon_mortar':'stone'})
# The 38 icons that were hand-drawn originals (tools/icon_src/original/), redrawn the same way.
RD.update({n:'herb' for n in ['angelica_seeds','chrysanthemum_seeds','ginseng_seeds','goji_seeds','honeysuckle_seeds','licorice_seeds','mugwort_seeds',
 'angelica_slices','ginseng_slices','licorice_slices','poria_slices','broken_ginseng_root','dried_broken_ginseng','fresh_ginseng','dried_ginseng',
 'fresh_angelica','dried_angelica','fresh_licorice','dried_licorice','fresh_goji','dried_goji','fresh_jujube','fresh_mugwort','dried_mugwort',
 'fresh_poria','dried_poria','reishi','dried_reishi','chrysanthemum','dried_chrysanthemum','honeysuckle','dewy_honeysuckle','dried_honeysuckle',
 'carried_wild_cordyceps','carried_wild_poria']})
RD.update({'formula_notebook':'paper','prescription_slip':'paper','icon_herbal_curtain':'cloth'})
# Parts of a redrawn icon that are a different material from the rest, picked out by colour: (test on r,g,b) -> material.
gold=lambda r,g,b:r>165 and g>120 and b<120 and r-b>70
RD_PARTS={'icon_paper_lantern':[(lambda r,g,b:r>170 and g<130,'glow')],          # the lit paper
 'burnt_dregs':[(lambda r,g,b:r>190 and 60<g<180 and b<100,'glow')],             # embers
 'icon_steelyard':[(gold,'brass')],  # the incense burner is clay (decided 2026-11-18): no metal on it
 'herbal_trowel':[(lambda r,g,b:abs(r-g)<22 and abs(g-b)<30 and r>110,'iron')]}  # the blade
def from_rd(name,mat):
    img=Image.open(os.path.join(SRC,'rd',name+'.png')).convert('RGBA');assert img.size==(16,16),(name,img.size)
    def material(rgb):
        for test,part in RD_PARTS.get(name,()):
            if test(*rgb): return part
        return mat
    return {(x,y):(img.getpixel((x,y))[:3]+(255,),material(img.getpixel((x,y))[:3])) for y in range(16) for x in range(16) if img.getpixel((x,y))[3]>=128}

def build():
    return {name:from_rd(name,mat) for name,mat in RD.items()}

def sheet(names,path,before=None):
    cell=72;cols=10;rows=(len(names)+cols-1)//cols
    img=Image.new('RGB',(cols*cell,rows*(cell+12)),(58,58,58));d=ImageDraw.Draw(img)
    for i,n in enumerate(names):
        x=(i%cols)*cell;y=(i//cols)*(cell+12)
        bg=Image.new('RGBA',(64,64),(146,146,146,255))
        bg.alpha_composite(Image.open(os.path.join(OUT,n+'.png')).convert('RGBA').resize((64,64),Image.NEAREST))
        img.paste(bg,(x+4,y+2));d.text((x+3,y+67),n[:12],fill=(255,255,255))
    img.save(path)

if __name__=='__main__':
    written=[]
    for name,px in build().items():save(name,px,written)
    print('wrote %d icons'%len(written))
    if '--sheet' in sys.argv:sheet(sorted(written),sys.argv[sys.argv.index('--sheet')+1])
