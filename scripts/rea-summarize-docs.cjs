const fs=require('fs');
const x=JSON.parse(fs.readFileSync('research/canva-docs-capture.json','utf8').replace(/^\uFEFF/,''));
const r=x.normalized_result;const step=r.steps.at(-1);fs.writeFileSync('research/canva-docs.png',Buffer.from(step.artifacts.screenshot.value.data_base64,'base64'));fs.writeFileSync('research/canva-docs-accessibility.txt',step.artifacts.accessibility.value.text);
console.log(JSON.stringify({evidence_id:x.evidence_id,browser:r.browser,completeness:r.completeness,accessibility:step.artifacts.accessibility.value.text.slice(0,700),limitations:x.limitations},null,2));
const p=JSON.parse(fs.readFileSync('research/rea-package-dist.json','utf8').replace(/^\uFEFF/,''));console.log(JSON.stringify(p));
