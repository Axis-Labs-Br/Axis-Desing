const fs=require('fs');
for(const file of ['design-editing','selection','positioning-elements','grouping-elements','creating-text']){
const s=fs.readFileSync(`research/public-artifacts/${file}.txt`,'utf8');const start=s.indexOf(' Copy page');console.log('\n'+file+'\n'+s.slice(start,start+11500));
}
const x=JSON.parse(fs.readFileSync('research/canva-docs-static-analysis.json','utf8').replace(/^\uFEFF/,'')); console.log(JSON.stringify({summary:x.normalized_result.summary,statistics:x.normalized_result.statistics,semantic_summary:x.normalized_result.semantic_graph?.summary},null,2));
