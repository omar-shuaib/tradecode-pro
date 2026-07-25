const fs = require('fs');
function tokenize(t) { return t.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi,' ').split(/\s+/).filter(t=>t.length>=2); }
function scoreMatch(q,c) {
  const qt=tokenize(q), ct=tokenize(c);
  if(!qt.length||!ct.length) return 0;
  const cs=new Set(ct);
  const ov=qt.filter(t=>cs.has(t)).length;
  const ex=c.includes(q.toLowerCase().trim())?1:0;
  const ph=qt.filter(t=>ct.some(ct2=>ct2.includes(t)||t.includes(ct2))).length;
  return (ov*0.5+ph*0.3+ex)/qt.length;
}
const india = JSON.parse(fs.readFileSync('data/fixtures/local-india-seed.json','utf8'));
const china = JSON.parse(fs.readFileSync('data/fixtures/local-china-seed.json','utf8'));
const desc = 'lithium battery pack';
const allRows = [
  ...india.map(r=>({country:'IN',hsCode:r.hs_code,descriptionEn:r.description_en,descriptionLocal:''})),
  ...china.map(r=>({country:'CN',hsCode:r.hs_code_8,descriptionEn:r.description_en,descriptionLocal:r.description_zh||''}))
];
const scored = allRows.map(r=>({...r,score:scoreMatch(desc, `${r.hsCode} ${r.descriptionEn} ${r.descriptionLocal}`)})).filter(r=>r.score>=0.1).sort((a,b)=>b.score-a.score).slice(0,10);
console.log(scored.map(r=>({code:r.hsCode,country:r.country,desc:r.descriptionEn,score:r.score.toFixed(3)})));
