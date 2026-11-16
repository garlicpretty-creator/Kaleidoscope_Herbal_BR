"""PBR audit for the resource pack. Usage: python3 tools/pbr_audit.py "Kaleidoscope Herbal [RP]"
Checks every *.texture_set.json (maps exist, same size, colour name = file name, no normal+heightmap),
summarises the MER maps, and lists colour textures that have no texture set.
Exit code 1 on a broken set, or on a block/model/item texture without a set (flat icons, UI and particles are exempt)."""
import sys,os,json,struct,zlib,collections
rp=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','Kaleidoscope Herbal [RP]')
def png_info(p):
    with open(p,'rb') as f:
        d=f.read()
    w,h,bd,ct=struct.unpack('>IIBB',d[16:26])
    return w,h,bd,ct,d
def pixels(d):
    # decode 8-bit non-interlaced PNG to list of rows of channel tuples
    w,h,bd,ct,comp,flt,il=struct.unpack('>IIBBBBB',d[16:29])
    if bd!=8 or il!=0: return None
    ch={0:1,2:3,3:1,4:2,6:4}[ct]
    pos=8;idat=b'';plte=None
    while pos<len(d):
        ln=struct.unpack('>I',d[pos:pos+4])[0];t=d[pos+4:pos+8]
        if t==b'IDAT': idat+=d[pos+8:pos+8+ln]
        if t==b'PLTE': plte=d[pos+8:pos+8+ln]
        pos+=12+ln
    raw=zlib.decompress(idat);stride=w*ch;out=[];prev=bytearray(stride);i=0
    for y in range(h):
        f=raw[i];i+=1;line=bytearray(raw[i:i+stride]);i+=stride
        for x in range(stride):
            a=line[x-ch] if x>=ch else 0;b=prev[x];c=prev[x-ch] if x>=ch else 0
            if f==1: line[x]=(line[x]+a)&255
            elif f==2: line[x]=(line[x]+b)&255
            elif f==3: line[x]=(line[x]+((a+b)>>1))&255
            elif f==4:
                p=a+b-c;pa=abs(p-a);pb=abs(p-b);pc=abs(p-c)
                pr=a if pa<=pb and pa<=pc else (b if pb<=pc else c)
                line[x]=(line[x]+pr)&255
        out.append(bytes(line));prev=line
    return w,h,ch,ct,out,plte
sets=[];colors=collections.defaultdict(list)
for root,_,files in os.walk(os.path.join(rp,'textures')):
    for f in files:
        p=os.path.join(root,f);rel=os.path.relpath(p,rp)
        if f.endswith('.texture_set.json'): sets.append(p)
        elif f.endswith('.png') and not f.endswith(('_normal.png','_mer.png','_mers.png')):
            colors[os.path.relpath(root,rp)].append(f[:-4])
print('texture sets',len(sets))
issues=[];covered=set();stats=collections.Counter()
for s in sets:
    d=os.path.dirname(s);j=json.load(open(s))['minecraft:texture_set'];fv=json.load(open(s))['format_version']
    stats['fv '+str(fv)]+=1
    base=os.path.basename(s)[:-len('.texture_set.json')]
    if j.get('color')!=base: issues.append(('color!=filename',s))
    covered.add((os.path.relpath(d,rp),j.get('color')))
    dims={}
    for k,v in j.items():
        if not isinstance(v,str): stats['uniform '+k]+=1;continue
        p=os.path.join(d,v+'.png')
        if not os.path.exists(p): issues.append(('missing '+k,s));continue
        w,h,bd,ct,data=png_info(p);dims[k]=(w,h);stats[f'{k} ct{ct} bd{bd}']+=1
        if k=='metalness_emissive_roughness':
            r=pixels(data)
            if r:
                w,h,ch,ct2,rows,plte=r
                M=E=R=0;n=0;mx=[0,0,0];mn=[255,255,255]
                for row in rows:
                    for x in range(w):
                        px=row[x*ch:(x+1)*ch]
                        if ct2==3: px=plte[px[0]*3:px[0]*3+3]
                        elif ct2 in(0,4): px=bytes([px[0]]*3)
                        for c in range(3):
                            mx[c]=max(mx[c],px[c]);mn[c]=min(mn[c],px[c])
                if mx[0]>0: stats['mer has metal']+=1
                if mx[1]>0: stats['mer has emissive']+=1
                if mx[2]==mn[2]: stats['mer roughness flat']+=1
                if mx[2]<40: stats['mer very glossy everywhere']+=1
                stats[f'mer R range {mn[2]//32*32}-{mx[2]//32*32+31}']+=1
        if k=='normal':
            r=pixels(data)
            if r:
                w,h,ch,ct2,rows,plte=r
                flat=True
                for row in rows:
                    for x in range(w):
                        px=row[x*ch:(x+1)*ch]
                        if ct2==3: px=plte[px[0]*3:px[0]*3+3]
                        if len(px)>=3 and (abs(px[0]-128)>2 or abs(px[1]-128)>2): flat=False;break
                    if not flat: break
                if flat: stats['normal is flat']+=1
    if len(set(dims.values()))>1: issues.append(('dim mismatch '+str(dims),s))
    if 'normal' in j and 'heightmap' in j: issues.append(('normal+heightmap',s))
for k,v in sorted(stats.items()): print(' ',k,v)
print('issues',len(issues))
for i in issues[:30]: print(' ',i)
print('--- color textures without texture set, by dir')
unexpected=[]
for d,names in sorted(colors.items()):
    miss=[n for n in names if (d,n) not in covered]
    print(d,'total',len(names),'missing',len(miss))
    print('   ',sorted(miss)[:400])
    exempt=d.endswith(('ui','particle'))
    unexpected+=[d+'/'+n for n in miss if not exempt and not n.startswith('icon_')]
if issues or unexpected:
    print('FAIL',len(issues),'broken sets;',len(unexpected),'textures need a texture set:',unexpected);sys.exit(1)
print('OK')
