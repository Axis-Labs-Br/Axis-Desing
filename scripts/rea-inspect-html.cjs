const fs=require('fs');
for(const file of ['design-guidelines','exporting-designs','design-elements']){
const html=fs.readFileSync(`research/public-artifacts/${file}.html`,'utf8');
const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(x=>x[1]);
const links=[...html.matchAll(/href=["']([^"']+)["']/g)].map(x=>x[1]).filter(x=>x.includes('/docs/apps/') && /(element|design|select|upload|page|export)/i.test(x));
const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
fs.writeFileSync(`research/public-artifacts/${file}.txt`,text);
console.log(JSON.stringify({file,title:html.match(/<title>([\s\S]*?)<\/title>/)?.[1],scripts,links:[...new Set(links)],text:text.slice(-17000)},null,2));
}
