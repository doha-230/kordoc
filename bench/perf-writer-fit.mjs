import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [baselineDir,candidateDir,inputDir,reportPath]=process.argv.slice(2);
if(!baselineDir||!candidateDir||!inputDir||!reportPath){console.error('Usage: node bench/perf-writer-fit.mjs BASELINE_DIR CANDIDATE_DIR INPUT_MD_DIR REPORT_JSON');process.exit(1);}
const baselineRoot=resolve(baselineDir),candidateRoot=resolve(candidateDir);
const {markdownToHwpx:before}=await import(pathToFileURL(baselineRoot+'/dist/index.js'));
const {markdownToHwpx:after}=await import(pathToFileURL(candidateRoot+'/dist/index.js'));
const JSZip=createRequire(candidateRoot+'/package.json')('jszip');
const dir=resolve(inputDir);
const out=resolve(reportPath);
const docs=[{id:'small',md:'# 업무계획\n\n## 추진 개요\n\n- 정확한 기준에 따라 업무를 추진합니다.\n  - 처리 결과를 검토하고 관계 기관에 통보합니다.\n\n| 구분 | 내용 |\n| --- | --- |\n| 목표 | 업무 효율 향상 |'},...await Promise.all((await fs.readdir(dir)).filter(x=>x.endsWith('.md')&&!x.endsWith('.orig.md')).sort().map(async id=>({id,md:await fs.readFile(dir+'/'+id,'utf8')})))];
const presets=['official','report','plan','notice','minutes','ministry','bangchim'];
const samples=11,warmups=2,rows=[];
const median=a=>[...a].sort((x,y)=>x-y)[a.length>>1];
for(const d of docs)for(const preset of presets){
 const opt={gongmun:{preset,cover:false}};
 for(let k=0;k<warmups;k++){await before(d.md,opt);await after(d.md,opt);}
 const a=[],b=[];let lastA,lastB,wa,wb;
 for(let k=0;k<samples;k++){
  for(const v of k%2?['candidate','baseline']:['baseline','candidate']){
   const warnings=[];const cpu=process.cpuUsage(),start=performance.now();
   const result=await(v==='baseline'?before:after)(d.md,{...opt,warnings});
   const ms=performance.now()-start,used=process.cpuUsage(cpu);
   (v==='baseline'?a:b).push({ms,cpuMs:(used.user+used.system)/1000,observedRSSBytes:process.memoryUsage().rss});
   if(v==='baseline'){lastA=result;wa=warnings;}else{lastB=result;wb=warnings;}
  }
 }
 assert.deepEqual(wa,wb,d.id+'/'+preset+' warnings');
 const za=await JSZip.loadAsync(lastA),zb=await JSZip.loadAsync(lastB);
 const names=Object.keys(za.files).sort();assert.deepEqual(names,Object.keys(zb.files).sort());
 const parts={};for(const n of names){if(za.files[n].dir)continue;const av=await za.files[n].async('uint8array'),bv=await zb.files[n].async('uint8array');assert.deepEqual(av,bv,d.id+'/'+preset+'/'+n);parts[n]=crypto.createHash('sha256').update(av).digest('hex');}
 const beforeMedian=median(a.map(x=>x.ms)),afterMedian=median(b.map(x=>x.ms));
 rows.push({id:d.id,preset,chars:d.md.length,inputSHA256:crypto.createHash('sha256').update(d.md).digest('hex'),baselineMedianMs:beforeMedian,candidateMedianMs:afterMedian,changePct:(afterMedian/beforeMedian-1)*100,speedup:beforeMedian/afterMedian,baselineCpuMedianMs:median(a.map(x=>x.cpuMs)),candidateCpuMedianMs:median(b.map(x=>x.cpuMs)),zipPartsExact:true,warningsExact:true,warnings:wa,parts,baseline:a,candidate:b});
 console.log(JSON.stringify({id:d.id,preset,beforeMedian,afterMedian,changePct:rows.at(-1).changePct}));
}
const hash=async p=>crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex');
const report={date:new Date().toISOString(),api:'public markdownToHwpx from frozen dist',baselineVersion:JSON.parse(await fs.readFile(baselineRoot+'/package.json','utf8')).version,candidateVersion:JSON.parse(await fs.readFile(candidateRoot+'/package.json','utf8')).version,baselineIndexSHA256:await hash(baselineRoot+'/dist/index.js'),candidateIndexSHA256:await hash(candidateRoot+'/dist/index.js'),node:process.version,platform:process.platform,architecture:process.arch,warmups,samples,sequence:'AB/BA alternating; baseline/candidate in one process; no other local CPU benchmark active',memoryScope:'RSS samples belong to the combined process and cannot establish per-version peak memory improvement',rows};
await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({report:out,cases:rows.length,allPartsExact:rows.every(r=>r.zipPartsExact)}));
