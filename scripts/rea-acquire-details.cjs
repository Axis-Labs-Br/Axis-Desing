const fs=require('node:fs'); const crypto=require('node:crypto');
(async()=>{
const folder='research/public-artifacts';
const records=JSON.parse(fs.readFileSync(`${folder}/provenance.json`,'utf8'));
const paths=['/docs/apps/design-editing/','/docs/apps/selection/','/docs/apps/positioning-elements/','/docs/apps/grouping-elements/','/docs/apps/creating-text/','/docs/apps/design-guidelines/layout/','/docs/apps/design-guidelines/spacing/','/docs/apps/design-guidelines/colors/'];
for (const pathname of paths){
 const url=`https://www.canva.dev${pathname}`; const res=await fetch(url); const bytes=Buffer.from(await res.arrayBuffer()); const name=pathname.replace(/^\/docs\/apps\//,'').replace(/\/$/,'').replaceAll('/','-');
 const file=`${folder}/${name}.html`; fs.writeFileSync(file,bytes); records.push({name,url,finalUrl:res.url,status:res.status,contentType:res.headers.get('content-type'),retrievedAt:new Date().toISOString(),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),file});
 const text=bytes.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');fs.writeFileSync(`${folder}/${name}.txt`,text);
}
fs.mkdirSync('research/canva-docs-bundles',{recursive:true});
for(const name of ['design-guidelines','exporting-designs']){
 const html=fs.readFileSync(`${folder}/${name}.html`,'utf8');
 const paths=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m=>m[1]).filter(src=>src.includes(`/pages/docs/apps/${name}-`));
 for(const pathname of paths){const url=`https://www.canva.dev${pathname}`;const res=await fetch(url);const bytes=Buffer.from(await res.arrayBuffer());const file=`research/canva-docs-bundles/${name}.js`;fs.writeFileSync(file,bytes);records.push({name:`${name}-bundle`,url,finalUrl:res.url,status:res.status,retrievedAt:new Date().toISOString(),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),file});}
}
fs.writeFileSync(`${folder}/provenance.json`,JSON.stringify(records,null,2)); console.log(records.slice(4).map(({name,status,bytes,file})=>({name,status,bytes,file})));
})();
