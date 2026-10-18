const fs=require('node:fs');
const crypto=require('node:crypto');
const entries=[
 ['features','https://www.canva.com/features/'],
 ['design-guidelines','https://www.canva.dev/docs/apps/design-guidelines/'],
 ['design-elements','https://www.canva.dev/docs/apps/design-elements/'],
 ['exporting-designs','https://www.canva.dev/docs/apps/exporting-designs/']
];
(async()=>{
fs.mkdirSync('research/public-artifacts',{recursive:true});
const records=[];
for (const [name,url] of entries){
 try {
 const response=await fetch(url);
 const bytes=Buffer.from(await response.arrayBuffer());
 const file=`research/public-artifacts/${name}.html`;
 fs.writeFileSync(file,bytes);
 records.push({name,url,finalUrl:response.url,status:response.status,contentType:response.headers.get('content-type'),retrievedAt:new Date().toISOString(),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),file});
 } catch(error){records.push({name,url,error:String(error)});}
}
fs.writeFileSync('research/public-artifacts/provenance.json',JSON.stringify(records,null,2));
console.log(JSON.stringify(records,null,2));
})();
