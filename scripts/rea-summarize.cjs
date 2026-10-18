const fs = require('node:fs');
const path = require('node:path');
const capture=JSON.parse(fs.readFileSync('research/canva-public-capture.json','utf8').replace(/^\uFEFF/,''));
const result=capture.normalized_result;
const step=result.steps.at(-1);
const summaries={evidence_id:capture.evidence_id,browser:result.browser,completeness:result.completeness,step:{status:step.status,url:step.after_url,artifacts:Object.fromEntries(Object.entries(step.artifacts).map(([k,v])=>[k,{state:v.state,keys:v.value?Object.keys(v.value):[]}]))},dom:step.artifacts.dom.value,accessibility:step.artifacts.accessibility.value,network:result.events.items?.filter(e=>e.kind==='response').map(e=>({url:e.url?.url,status:e.status}))};
fs.writeFileSync('research/canva-public-summary.json',JSON.stringify(summaries,null,2));
const screenshot=step.artifacts.screenshot.value;
fs.writeFileSync('research/canva-public.png',Buffer.from(screenshot.data_base64,'base64'));
console.log(JSON.stringify({...summaries,dom:JSON.stringify(summaries.dom).slice(0,1800),accessibility:JSON.stringify(summaries.accessibility).slice(0,3500)},null,2));



