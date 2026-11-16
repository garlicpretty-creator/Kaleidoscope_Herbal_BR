"""Packs both packs into dist/Kaleidoscope_Herbal_v<version>.mcaddon. Usage: python3 tools/build.py"""
import json,os,sys,zipfile
root=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
packs=['Kaleidoscope Herbal [BP]','Kaleidoscope Herbal [RP]']
versions={tuple(json.load(open(os.path.join(root,p,'manifest.json'),encoding='utf-8'))['header']['version']) for p in packs}
if len(versions)!=1:sys.exit('manifest versions differ: %s'%versions)
name='Kaleidoscope_Herbal_v%s.mcaddon'%'.'.join(map(str,versions.pop()))
os.makedirs(os.path.join(root,'dist'),exist_ok=True)
out=os.path.join(root,'dist',name);count=0
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    for pack in packs:
        for folder,dirs,files in os.walk(os.path.join(root,pack)):
            dirs.sort()
            for f in sorted(files):
                path=os.path.join(folder,f);z.write(path,os.path.relpath(path,root).replace(os.sep,'/'));count+=1
print('%s: %d files, %d bytes'%(os.path.relpath(out,root),count,os.path.getsize(out)))
