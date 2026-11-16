"""Redraws the item icons listed below as 16x16 pixel art, with matching normal and MER maps.

Usage: python3 tools/icons.py            writes the icons into the resource pack
       python3 tools/icons.py --sheet F  also writes a contact sheet of every redrawn icon to F

Each sprite is 16 strings of 16 characters. '.' is transparent; every other character is looked up in
the sprite's palette as (r, g, b[, a], material). The material sets the MER map (metalness, emissive,
roughness) and how much the pixel is raised in the normal map. Shared templates keep one drawing per
kind of object: one bowl for decoctions, one earthen bowl for soups, one cup for teas, one flask for
wines, one packet for medicinal powders.

Plant icons are built from the untouched originals in tools/icon_src/: wild plants get a grass tuft,
farmed crops a strip of tilled soil, so the two can be told apart.
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

def check(name,rows):
    assert len(rows)==16,(name,'has %d rows'%len(rows))
    for i,r in enumerate(rows):assert len(r)==16,(name,'row %d is %d wide: %r'%(i,len(r),r))

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

def lighten(c,t):return tuple(round(v+(255-v)*t) for v in c)
def darken(c,t):return tuple(round(v*(1-t)) for v in c)

# ---------------------------------------------------------------- decoctions: one celadon-white bowl
BOWL=["................","................","................","................",
"...oooooooooo...",
".ooWWWWWWWWWWoo.",
"oWWllllllllllWWo",
"oWLhhLLLLLLLLLWo",
"oWLLLLLLLLLLLLWo",
"ocWLLLLLLLLLLWco",
"occWWWWWWWWWWcco",
".ocbbbbbbbbbbwo.",
".occccccccccwwo.",
"..oocccccccwoo..",
"....oocccwoo....",
".....oooooo....."]
BOWL_PAL={'o':OUTLINE,'W':(242,238,228,'cer'),'c':(222,216,204,'cer'),'w':(186,180,168,'cer'),'b':(60,92,156,'cer')}
def bowl(liquid,garnish,gpal):
    pal=dict(BOWL_PAL,l=darken(liquid,.18)+('liq',),L=liquid+('liq',),h=lighten(liquid,.45)+('liq',))
    return layer(garnish,gpal,layer(BOWL,pal),top=6)
DECOCTIONS={
 'ginseng_decoction':((214,178,96),[ "................",".....gG...gg....","......G..y.Gg...","................"],
   {'g':(240,226,186,'herb'),'G':(196,168,116,'herb'),'y':(226,184,70,'herb')}),
 'four_herb_decoction':((164,50,58),["................",".....aa...f.....","......a..fFf....","................"],
   {'a':(222,198,156,'herb'),'f':(250,246,222,'herb'),'F':(240,200,80,'herb')}),
 'reishi_decoction':((104,64,46),["................","......RRRr......",".....rrrrr......","................"],
   {'R':(232,150,70,'herb'),'r':(196,82,40,'herb')}),
 'cordyceps_decoction':((222,168,62),[".........k......","........kK..k...",".......kK..kK...","..........kK...."],
   {'k':(196,104,44,'herb'),'K':(132,64,28,'herb')}),
 'four_gentlemen_decoction':((178,148,104),["................","....pP....pP....","....PP..gG.PP...","................"],
   {'p':(248,246,238,'herb'),'P':(206,202,190,'herb'),'g':(240,226,186,'herb'),'G':(196,168,116,'herb')}),
 'mugwort_angelica_decoction':((118,126,60),["................","....mM..mm......",".....Mm..Mm.aa..","................"],
   {'m':(118,184,76,'herb'),'M':(70,124,48,'herb'),'a':(222,198,156,'herb')}),
 'licorice_jujube_decoction':((198,114,46),["................",".....Jj...y.....",".....jj..yy..Jj.","............jj.."],
   {'J':(226,100,90,'herb'),'j':(160,32,34,'herb'),'y':(240,206,100,'herb')}),
}

# ---------------------------------------------------------------- soups: one earthen bowl, food above the rim
SOUP=["................","................","................","................","................",
"..oooooooooooo..",
".oRRRRRRRRRRRRo.",
"oRllllllllllllRo",
"oRLhhLLLLLLLLLRo",
"orRLLLLLLLLLLRro",
"obrRRRRRRRRRRrbo",
"obBByyyyyyyyBBbo",
".obBBBBBBBBBBbo.",
"..oobBBBBBBboo..",
"....oooooooo....",
"................"]
SOUP_PAL={'o':(50,34,26,'line'),'R':(190,124,78,'cer'),'r':(150,92,56,'cer'),'B':(158,98,60,'cer'),'b':(116,70,42,'cer'),'y':(212,168,108,'cer')}
def soup(liquid,food,fpal):
    pal=dict(SOUP_PAL,l=darken(liquid,.15)+('liq',),L=liquid+('liq',),h=lighten(liquid,.45)+('liq',))
    return layer(food,fpal,layer(SOUP,pal),top=1)
LEG={'X':(250,246,236,'meat'),'C':(232,190,130,'meat'),'c':(190,140,88,'meat')}
SOUPS={
 'ginseng_chicken_soup':((230,198,120),[
   ".........XX.....",".........X......","........CC......",".......CCCc.....",".......CCcc.....",
   "................","...gGG..cc..jj..","..gG.G..........","................"],dict(LEG,g=(240,222,172,'herb'),G=(198,166,110,'herb'),j=(170,34,34,'herb'))),
 'goji_chicken_soup':((236,204,128),[
   ".........XX.....",".........X......","........CC......",".......CCCc.....",".......CCcc.....",
   "................","..j..j..cc.j..j.","....j...j.....j.","................"],dict(LEG,j=(214,46,38,'herb'))),
 'four_herb_chicken':((196,134,66),[
   ".........XX.....",".........X......","........KK......",".......KkKK.....",".......KKKK.....",
   "................","...aa...KK......","....a...........","................"],{'X':(250,246,236,'meat'),'K':(44,40,52,'meat'),'k':(112,106,124,'meat'),'a':(232,210,168,'herb')}),
 'angelica_mutton_soup':((230,224,206),[
   "................","................","................","................","................",
   "................","...MmF....a.S...","..mMM..aa..MmS..","................"],{'M':(176,96,80,'meat'),'m':(128,62,56,'meat'),'F':(246,234,218,'meat'),'a':(206,174,120,'herb'),'S':(96,170,68,'herb')}),
 'goji_jujube_soup':((228,186,126),[
   "................","................","................","................","................",
   "................","...Jj..g...Jj...","...jj.g..g.jj.g.","................"],{'J':(214,84,72,'herb'),'j':(130,24,26,'herb'),'g':(226,64,40,'herb')}),
 'jujube_sweet_soup':((146,48,40),[
   "................","................","................","................","................",
   "................","...jJ.WW.W.jJ...","...JJ.Ww.WwJJ...","................"],{'J':(92,16,18,'herb'),'j':(214,96,84,'herb'),'W':(250,244,228,'herb'),'w':(214,204,180,'herb')}),
}

# ---------------------------------------------------------------- teas: one blue-and-white cup with steam
CUP=["................",
"......s..s......",
".....s..s.......",
"......s..s......",
"................",
"....oooooooo....",
"...oWllllllWo...",
"...oWLhLLLLWo...",
"...ocWWWWWWco...",
"...occccccwwo...",
"...obbbbbbbbo...",
"...occccccwwo...",
"...occccccwwo...",
"....occccwwo....",
".....oooooo.....",
"................"]
def cup(liquid,top,tpal):
    pal=dict(BOWL_PAL,s=(255,255,255,150,'steam'),l=darken(liquid,.15)+('liq',),L=liquid+('liq',),h=lighten(liquid,.45)+('liq',))
    return layer(top,tpal,layer(CUP,pal),top=6)
FLOWER={'f':(250,246,214,'herb'),'F':(236,196,80,'herb')}
TEAS={
 'honeysuckle_tea':((198,196,104),[".....fF.........","....fFf.F......."],FLOWER),
 'honeysuckle_tea_dew':((168,212,176),["........d.......","....fFf.dd......"],dict(FLOWER,d=(226,252,255,'glass'))),
 'chrysanthemum_tea':((234,192,72),["......FfF.......","....FfFfF......."],{'F':(255,220,70,'herb'),'f':(206,140,28,'herb')}),
 'goji_tea':((216,122,64),["......g.........","....g..g.g......"],{'g':(176,30,28,'herb')}),
 'jujube_tea':((158,56,44),[".....jJ.........",".....JJ..jJ....."],{'J':(100,20,22,'herb'),'j':(220,104,90,'herb')}),
}

# ---------------------------------------------------------------- wines: one glass flask, the herb shows inside
FLASK=["......oooo......",
"......okko......",
"......oKKo......",
"......oHgo......",
"......oHgo......",
"....ooHgggoo....",
"...oHlllllllo...",
"..oHLLLLLLLLgo..",
"..oHLLLLLLLLgo..",
"..oHLLLLLLLLgo..",
"..oHLLLLLLLLgo..",
"..ogLLLLLLLLgo..",
"...ogLLLLLLgo...",
"....oggggggo....",
".....oooooo.....",
"................"]
FLASK_PAL={'o':(44,52,58,'line'),'H':(234,248,246,'glass'),'g':(166,200,200,'glass'),'k':(180,134,86,'wood'),'K':(130,92,56,'wood')}
def flask(liquid,inside,ipal):
    pal=dict(FLASK_PAL,l=lighten(liquid,.25)+('glass',),L=liquid+('glass',))
    return layer(inside,ipal,layer(FLASK,pal),top=7)
WINES={
 'ginseng_wine':((222,176,80),[".......rR.......","......rRr.......","......rRR.r.....",".....r.rRr......",".....r..r.r....."],
   {'r':(244,230,190,'herb'),'R':(200,172,120,'herb')}),
 'angelica_wine':((204,132,40),["................",".....aA..aa.....","................",".......Aa...aA..","....aa.........."],
   {'a':(236,210,160,'herb'),'A':(184,144,92,'herb')}),
 'reishi_wine':((118,34,40),["................",".....cRRRc......","......rrr.......",".......r........","................"],
   {'c':(244,222,170,'herb'),'R':(220,108,52,'herb'),'r':(170,64,32,'herb')}),
 'goji_wine':((192,52,42),["................",".....g..g.g.....","......G...g.....","....g..gG..g....","......g.g......."],
   {'g':(252,150,64,'herb'),'G':(206,86,30,'herb')}),
 'jujube_wine':((156,82,38),["................",".....jJ...jJ....",".....JJ...JJ....","................","......jJ........"],
   {'J':(86,16,18,'herb'),'j':(206,84,70,'herb')}),
}

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

# ---------------------------------------------------------------- one-off drawings
WOOD={'F':(96,56,32,'wood'),'f':(70,40,24,'wood'),'T':(150,96,56,'wood'),'D':(182,118,64,'wood'),'d':(140,86,46,'wood'),
      'L':(234,220,184,'paper'),'K':(224,184,72,'brass')}
SINGLE={}
SINGLE['icon_herb_cabinet']=(["oooooooooooooooo",
"oTTTTTTTTTTTTTfo",
"oFFFFFFFFFFFFFfo",
"oFDLDFDLDFDLDFfo",
"oFDKDFDKDFDKDFfo",
"oFdddFdddFdddFfo",
"oFFFFFFFFFFFFFfo",
"oFDLDFDLDFDLDFfo",
"oFDKDFDKDFDKDFfo",
"oFdddFdddFdddFfo",
"oFFFFFFFFFFFFFfo",
"oFDLDFDLDFDLDFfo",
"oFDKDFDKDFDKDFfo",
"oFdddFdddFdddFfo",
"oFFFFFFFFFFFFFfo",
"oFo..........oFo"],dict(WOOD,o=OUTLINE))
SINGLE['icon_mortar']=(["................",
"...........oo...",
"..........oPPo..",
"..........oPpo..",
".........oPpo...",
"..oooooooPpooo..",
".oHHHHHoPpoHHSo.",
"oHIIIIIIPpIIIISo",
"oHSIIIIIIIIIISSo",
"oHSSSSSSSSSSSSso",
".oHSSSSSSSSSSso.",
"..oHSSSSSSSSso..",
"...oSSSSSSSSo...",
"..ooSSSSSSSSoo..",
"..osssssssssso..",
"...oooooooooo..."],{'o':OUTLINE,'P':(222,214,200,'stone'),'p':(176,166,152,'stone'),'H':(214,210,202,'stone'),
 'S':(170,166,158,'stone'),'s':(124,120,114,'stone'),'I':(92,88,84,'stone')})
SINGLE['icon_abacus']=(["................","................","................",
"oooooooooooooooo",
"oFFFFFFFFFFFFFFo",
"oFkbbkbbkbbkbbFo",
"oFkBBkBBkBBkBBFo",
"oFDDDDDDDDDDDDFo",
"oFkrkkrkkrkkrkFo",
"oFkbbkbbkbbkbbFo",
"oFkBBkBBkBBkBBFo",
"oFkrkkrkkrkkrkFo",
"oFFFFFFFFFFFFFFo",
"oooooooooooooooo",
"................","................"],{'o':OUTLINE,'F':(150,94,52,'wood'),'D':(110,66,36,'wood'),'k':(58,38,26,'wood'),
 'r':(200,180,140,'wood'),'B':(150,40,36,'wood'),'b':(214,96,74,'wood')})
SINGLE['icon_hanging_gourd']=(["......ttt.......",
".......t........",
".......s........",
"......oso.......",
".....oGGgo......",
".....oHGgo......",
".....oGGgo......",
"......ocot......",
"....ooGGgoot....",
"...oHHGGGGgo....",
"...oHGGGGGGgo...",
"...oGGGGGGGgo...",
"...ogGGGGGggo...",
"....oggggggo....",
".....oooooo.....",
"................"],{'o':OUTLINE,'G':(218,174,84,'wood'),'g':(170,124,52,'wood'),'H':(244,214,136,'wood'),'s':(110,88,50,'wood'),
 'c':(176,40,36,'cloth'),'t':(200,52,44,'cloth')})
SINGLE['icon_herb_counter']=(["................","................",
"...oo....ooooo..",
"..obbo...oPPPo..",
"..oWWo...oPtPo..",
"oooooooooooooooo",
"oTTTTTTTTTTTTTTo",
"oFFFFFFFFFFFFFFo",
"oFDDDDDFDDDDDDFo",
"oFDDKDDFDDDKDDFo",
"oFdddddFddddddFo",
"oFFFFFFFFFFFFFFo",
"oFDDDDDFDDDDDDFo",
"oFdddddFddddddFo",
"oFFFFFFFFFFFFFFo",
"oooooooooooooooo"],dict(WOOD,o=OUTLINE,W=(240,238,230,'cer'),b=(60,92,156,'cer'),P=(236,224,196,'paper'),t=(176,40,36,'cloth')))
SINGLE['icon_herb_packets']=(["................","................",
"....ooooooooo...",
"....oPPPtPPPo...",
"....otttttttto..",
"....oPPPtPPPpo..",
"....opppptpppo..",
"................",
"oooooooooooooooo",
"oPPtPPpooPPtPPpo",
"ottttttoottttttO",
"oPPtPPpooPPtPPpo",
"oPPtPPpooPPtPPpo",
"opptpppoopptpppo",
"oooooooooooooooo",
"................"],{'o':(96,74,52,'line'),'O':(96,74,52,'line'),'P':(238,226,198,'paper'),'p':(204,188,152,'paper'),'t':(176,40,36,'cloth')})
SINGLE['icon_medicine_jar']=(["................",
".......oo.......",
"......obbo......",
"....oooooooo....",
"...oWWWWWWwwo...",
"....oooooooo....",
"....oWWWWWwo....",
"..ooWWWWWWWwoo..",
".oWWbbWWWbbWwwo.",
".oWbWWbWbWWbwwo.",
".oWWbbWWWbbWwwo.",
".oWWWWWWWWWWwwo.",
"..oWBBBBBBBBwo..",
"...oWWWWWWwwo...",
"....oooooooo....",
"................"],{'o':OUTLINE,'W':(242,240,234,'cer'),'w':(200,198,192,'cer'),'b':(50,80,152,'cer'),'B':(110,140,204,'cer')})
SINGLE['icon_paper_lantern']=([".......oo.......",
".......oo.......",
".....oYYYYo.....",
"....oRRRRRRo....",
"...oHRRRRRRro...",
"..oHHRRRRRRrro..",
"..okkkkkkkkkko..",
".oHHRRRRRRRRrro.",
".oHHRRRRRRRRrro.",
"..okkkkkkkkkko..",
"..oHRRRRRRRRro..",
"...oRRRRRRrro...",
"....oRRRRRro....",
".....oYYYYo.....",
".......tt.......",
".......tt......."],{'o':OUTLINE,'Y':(222,172,62,'brass'),'R':(214,62,44,'glow'),'r':(160,34,30,'glow'),'H':(250,150,96,'glow'),
 'k':(70,30,24,'wood'),'t':(206,48,40,'cloth')})
SINGLE['icon_steelyard']=(["......o.........",
"......s.........",
".....oso........",
"oooooooooooooooo",
"oMMMMMMMMmMmMmMo",
"oooooooooooooooo",
"...ss......s....",
"..s..s....oWo...",
"..s..s...oWWWo..",
".s....s..oWWWo..",
".s....s...ooo...",
"oPPPPPPPo.......",
".oppppppo.......",
"..oooooo........",
"................","................"],{'o':OUTLINE,'s':(206,196,166,'cloth'),'M':(214,170,78,'brass'),'m':(120,84,30,'brass'),
 'W':(78,78,86,'iron'),'P':(206,164,74,'brass'),'p':(150,110,44,'brass')})
SINGLE['carried_reishi_spawn']=(["................","................",
"....oooooooo....",
"..ooEEEEEEEEoo..",
".oEEeeeeeeeeEEo.",
".oEeEEeeeeEEeEo.",
".obEEeeeeeeEEbo.",
".oBbbEEEEEEbbBo.",
".oBBMBBBBbBBBbo.",
".oBMMBbBBBRrBbo.",
".oBBBBBbBRRRrbo.",
".oBbBBMMBBBBBbo.",
".oBBbBMBBbBBBbo.",
".oBBBBBBBBBbBbo.",
"..ooBBBBBBBBoo..",
"....oooooooo...."],{'o':OUTLINE,'E':(208,168,114,'wood'),'e':(162,122,80,'wood'),'B':(112,76,46,'wood'),'b':(78,52,30,'wood'),
 'M':(242,238,228,'herb'),'R':(200,72,40,'herb'),'r':(244,166,66,'herb')})
SINGLE['bitter_dregs']=(["................","................","................","................","................",
"................",
"......aAa.......",
"....aAhAAaa.....",
"..aaAGAAhAAGa...",
".oaAAAaGAAAaAao.",
"oDDDDDDDDDDDDDDo",
"odDDDDDDDDDDDDdo",
".oddddddddddddo.",
"..oooooooooooo..",
"................","................"],{'o':OUTLINE,'D':(176,172,162,'cer'),'d':(130,126,118,'cer'),'A':(86,72,40,'herb'),
 'a':(58,48,28,'herb'),'h':(132,114,66,'herb'),'G':(100,108,54,'herb')})
SINGLE['fresh_cordyceps']=(["........oo......",
".......oTSo.....",
".......oSso.....",
"......oSso......",
"......oSso......",
".....oSso.......",
".....oSso.......",
".....oSo........",
"....ooYoo.......",
"..ooYHHYyoooo...",
".oYHYyYHYyYHYo..",
".oyYYyYYyYYyYYo.",
"..ooyyyyyyyyyoo.",
"...NNnNNNnNNn...",
"..nNNNnNNNNnNN..",
"................"],{'o':OUTLINE,'T':(170,104,54,'herb'),'S':(124,72,36,'herb'),'s':(84,46,22,'herb'),'Y':(218,174,94,'herb'),
 'y':(170,126,60,'herb'),'H':(244,214,146,'herb'),'N':(110,84,60,'soil'),'n':(80,60,42,'soil')})
SINGLE['burnt_dregs']=(["................",
".......s........",
"......s..s......",
".......s.s......",
"........s.......",
"................",
"......kKk.......",
"....kKeKKkk.....",
"..kkKKKKeKKKk...",
".okKKKkKKKKkKko.",
"oDDDDDDDDDDDDDDo",
"odDDDDDDDDDDDDdo",
".oddddddddddddo.",
"..oooooooooooo..",
"................","................"],{'o':OUTLINE,'D':(176,172,162,'cer'),'d':(130,126,118,'cer'),'K':(46,40,38,'herb'),
 'k':(24,20,20,'herb'),'e':(240,112,42,'glow'),'s':(150,144,140,'steam')})
SINGLE['icon_clay_pot']=(["................","................",
".......oo.......",
"......oLLo......",
"....oooLLooo....",
"...oLLLLLLLLo...",
"..oLlllllllllo..",
".oooooooooooooo.",
"ooPPPPPPPPPPPPoo",
"oHoPPpPPPPPPpoHo",
"oooPPPPPPPPPpooo",
"..oPPPPPPPPPpo..",
"..oPpPPPPPPppo..",
"...oppppppppo...",
"....oooooooo....",
"................"],{'o':OUTLINE,'L':(186,116,74,'cer'),'l':(144,84,52,'cer'),'P':(160,94,58,'cer'),'p':(112,62,36,'cer'),'H':(186,116,74,'cer')})
SINGLE['icon_incense_burner']=([".......s........",
"......s.........",
".......s........",
"......oKo.......",
".....oGGGo......",
"....oGgGgGo.....",
"..oooooooooooo..",
".oKKKKKKKKKKKKo.",
".oGGoGGoGGoGGgo.",
".oGGGGGGGGGGGgo.",
"..oGGGGGGGGGgo..",
"...oKKKKKKKKo...",
"...oogggggoo....",
"..oKo.oooo.oKo..",
"..oKo......oKo..",
"..ooo......ooo.."],{'o':OUTLINE,'G':(112,164,124,'cer'),'g':(74,118,88,'cer'),'K':(216,172,72,'brass'),'s':(170,164,160,'steam')})
# Single-herb powders: one pile on a paper square, told apart by the herb's own colour (highlight, body, shade).
PILE=["................","................","................","................",
".......oo.......",
"......ohho......",
".....ohbbbo.....",
"....ohbbbbso....",
"...ohbbbhbbso...",
"..oohbbbbbbsoo..",
".oPobbsbbbbsoPo.",
".oPPossssssoPPo.",
".oPPPooooooPPpo.",
"..opPPPPPPPPpo..",
"...oooooooooo...",
"................"]
PILES={'angelica':((220,180,124),(185,138,82),(138,96,52)),'chrysanthemum':((255,240,138),(240,204,48),(189,148,22)),
 'cordyceps':((207,143,64),(160,98,31),(110,64,18)),'ginseng':((248,236,198),(226,204,148),(181,156,100)),
 'goji':((244,118,94),(210,62,46),(149,35,24)),'honeysuckle':((242,246,184),(211,220,126),(160,169,78)),
 'jujube':((184,74,60),(138,42,34),(90,24,20)),'licorice':((242,210,114),(214,168,60),(162,118,34)),
 'poria':((255,255,255),(235,232,222),(185,180,164)),'reishi':((208,108,64),(156,62,34),(104,36,20))}
def pile(hi,body,shade):
    return layer(PILE,{'o':OUTLINE,'h':hi+('herb',),'b':body+('herb',),'s':shade+('herb',),'P':(238,226,198,'paper'),'p':(200,186,154,'paper')})
def dried_cordyceps():
    pal={'o':OUTLINE,'S':(96,54,28,'herb'),'s':(64,36,18,'herb'),'Y':(184,138,70,'herb'),'y':(140,100,48,'herb'),'t':(196,44,38,'cloth')}
    rows=[list('.'*16) for _ in range(16)]
    for x0,top in ((3,2),(6,1),(9,2),(12,3)):
        for y in range(top,15):
            stick='Ss' if y<8 else 'Yy'
            rows[y][x0]=stick[0];rows[y][x0+1]=stick[1]
        rows[top-1][x0]='o';rows[top-1][x0+1]='o'
    for x in range(2,15):rows[9][x]='t';rows[10][x]='t' if x in(2,14) else rows[10][x]
    return layer([''.join(r) for r in rows],pal)
def scatter(shape,pal,spots):
    px={}
    for (x0,y0) in spots:px=layer(['.'*x0+r+'.'*(16-x0-len(r)) for r in shape],pal,px,top=y0)
    return px
PIT=[".o.","oAo","oBo","oAo",".o."]
DATE=[".soo.","oRRRo","oHRro","oRrRo","oRRro","orRRo",".ooo."]
SINGLE_FN={
 'dried_cordyceps':dried_cordyceps,
 'jujube_seeds':lambda:scatter(PIT,{'o':(70,42,22,'line'),'A':(176,116,64,'herb'),'B':(118,72,38,'herb')},[(2,2),(7,1),(11,4),(4,8),(9,9)]),
 'dried_jujube':lambda:scatter(DATE,{'o':(52,14,16,'line'),'R':(150,36,34,'herb'),'r':(100,22,24,'herb'),'H':(206,86,74,'herb'),'s':(112,82,42,'herb')},[(1,1),(9,2),(5,8)]),
}
def herbal_trowel():
    """Drawn along the diagonal: a broad pointed blade (u > 0) on a short brass ferrule and a wooden grip."""
    pal={'o':OUTLINE,'H':(236,240,244,'iron'),'S':(176,184,192,'iron'),'s':(108,116,126,'iron'),'B':(214,170,72,'brass'),
         'b':(150,110,40,'brass'),'W':(176,116,64,'wood'),'w':(122,78,40,'wood'),'K':(150,40,36,'cloth')}
    rows=[['.']*16 for _ in range(16)];ox,oy=5.6,10.4;r2=2**.5
    for y in range(16):
        for x in range(16):
            px,py=x+.5-ox,y+.5-oy;u=(px-py)/r2;v=(px+py)/r2
            if 0<=u<=9.6:
                hw=3.3*min(1,.45+u/4.4)*(1-max(0,u-2.4)/7.2)+.3
                if abs(v)<=hw:rows[y][x]='s' if abs(v)<.45 else ('H' if v<0 else 'S')
            elif -1.6<=u<0 and abs(v)<=1.1:rows[y][x]='B' if v<0 else 'b'
            elif -6.4<=u<-1.6 and abs(v)<=1.0:rows[y][x]='K' if -6.4<=u<-5.2 else ('W' if v<0 else 'w')
    for y in range(16):
        for x in range(16):
            if rows[y][x]=='.' and any(0<=x+dx<16 and 0<=y+dy<16 and rows[y+dy][x+dx] not in '.o' for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))):rows[y][x]='o'
    return layer([''.join(r) for r in rows],pal)
SINGLE_FN_EXTRA={'herbal_trowel':herbal_trowel}
SINGLE['mugwort_floss']=(["................","................","................",
"......w..w......",
"....wwHHw.w.....",
"...wHHHHHFw.....",
"..wHHFHHFFFww...",
".wFHFFFFHFFFFw..",
".wFFFfFFFFfFFFw.",
"..wFfFFFfFFfFw..",
"..wffFdFffFdfw..",
"...wfddffdffw...",
"....wwdwwdww....",
"......w..w......",
"................","................"],{'H':(236,240,226,'cloth'),'F':(204,210,188,'cloth'),'f':(170,178,152,'cloth'),'d':(140,150,124,'cloth'),
 'w':(214,220,200,120,'cloth')})
SINGLE['sealed_prescription']=(["................","................","................",
"..oooooooooooo..",
".oePPPPPPtPPPPo.",
"oeEPPPPRRRPPPPpo",
"oeEPPPRRrRRPPPpo",
"oeEttRrRrRrtttpo",
"oeEPPPRRrRRPPPpo",
"oeEPPPPRRRPPPPpo",
"oeEppppppttppppo",
".oeeeeeeeeeeeeo.",
"..oooooooooooo..",
"................","................","................"],{'o':(96,74,52,'line'),'P':(238,226,198,'paper'),'p':(204,188,152,'paper'),
 'e':(186,168,128,'paper'),'E':(214,198,160,'paper'),'t':(176,40,36,'cloth'),'R':(188,34,32,'wax'),'r':(120,18,20,'wax')})

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

# Icons taken from Retro Diffusion output (tools/icon_src/rd/<name>.png, 16x16, hard-edged alpha). They replace the
# drawings above for the same names; the material given here sets their MER value and normal relief.
RD={**{n:'cer' for n in ('ginseng_decoction','four_herb_decoction','reishi_decoction','cordyceps_decoction','four_gentlemen_decoction',
 'mugwort_angelica_decoction','licorice_jujube_decoction','ginseng_chicken_soup','goji_chicken_soup','goji_jujube_soup','jujube_sweet_soup',
 'angelica_mutton_soup','four_herb_chicken','chrysanthemum_tea','goji_tea','honeysuckle_tea','honeysuckle_tea_dew','jujube_tea')},
 **{n:'glass' for n in ('ginseng_wine','goji_wine','angelica_wine','jujube_wine','reishi_wine')},'bitter_dregs':'herb'}
# The other 55 icons: each drawing above redrawn by Retro Diffusion and put together by tools/rd_assemble.py, which needs
# the drawings (soil strips, packet labels, powder shades), so they stay in this file.
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
def from_rd(name,mat):
    img=Image.open(os.path.join(SRC,'rd',name+'.png')).convert('RGBA');assert img.size==(16,16),(name,img.size)
    return {(x,y):(img.getpixel((x,y))[:3]+(255,),mat) for y in range(16) for x in range(16) if img.getpixel((x,y))[3]>=128}

def build():
    out={}
    for name,(liq,g,gp) in DECOCTIONS.items():out[name]=bowl(liq,g,gp)
    for name,(liq,f,fp) in SOUPS.items():out[name]=soup(liq,f,fp)
    for name,(liq,t,tp) in TEAS.items():out[name]=cup(liq,t,tp)
    for name,(liq,i,ip) in WINES.items():out[name]=flask(liq,i,ip)
    for name,args in POWDERS.items():out[name]=packet(*args)
    out['strange_powder']=packet((32,24,40),(110,40,130),'ask',(236,90,236),paper=(206,196,216))
    for name,(rows,pal) in SINGLE.items():check(name,rows);out[name]=layer(rows,pal)
    check('pile',PILE)
    for herb,shades in PILES.items():out[herb+'_powder']=pile(*shades)
    for name,fn in {**SINGLE_FN,**SINGLE_FN_EXTRA}.items():out[name]=fn()
    for name,fn in PLANTS.items():out[name]=fn()
    for name,mat in RD.items():out[name]=from_rd(name,mat)
    return out

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
