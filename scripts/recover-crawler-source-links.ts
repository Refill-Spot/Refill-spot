import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

// Offline provenance recovery only. Historical name matches are not current identity verification.
const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, "");
async function main() {
  const path = process.argv[2];
  if (!path) throw Error("Supply original crawler log path");
  const log = await readFile(path, "utf8");
  const stores = JSON.parse(await readFile("logs/store-data-audit-input.json", "utf8")) as {id:number;name:string}[];
  const records: {name:string;sourceId:string;line:number}[] = [];
  let active: string|null = null;
  let errors = 0;
  log.split(/\r?\n/).forEach((line,index) => {
    const url = line.match(/상세 페이지 접속: https:\/\/www\.diningcode\.com\/profile\.php\?rid=([A-Za-z0-9_-]+)/);
    if(url) active=url[1];
    if(line.includes("무한리필 정보 추출 실패:")) errors++;
    const complete = line.match(/상세 정보 수집 완료: (.+?) - 주소:/);
    if(complete && active) {records.push({name:complete[1],sourceId:active,line:index+1});active=null;}
  });
  const results=stores.map(store=>{
    const matches=records.filter(row=>normalize(row.name)===normalize(store.name));
    const ids=[...new Set(matches.map(row=>row.sourceId))];
    return {storeId:store.id,status:ids.length===1?"historical_candidate":ids.length>1?"ambiguous":"not_found",verifiedCurrentIdentity:false,candidates:ids.map(id=>({sourceId:id,sourceUrl:`https://www.diningcode.com/profile.php?rid=${id}`,evidenceLines:matches.filter(row=>row.sourceId===id).map(row=>row.line)}))};
  });
  assert.equal(results.length,stores.length);
  assert.ok(results.every(row=>row.status!=="historical_candidate"||row.candidates.length===1));
  assert.ok(results.every(row=>row.verifiedCurrentIdentity===false));
  const counts=results.reduce<Record<string,number>>((out,row)=>{out[row.status]=(out[row.status]||0)+1;return out;},{});
  await mkdir("logs",{recursive:true});
  await writeFile("logs/recovered-source-links.json",JSON.stringify({method:"exact whitespace-normalized name + sequential historical page/completion events",limitations:["Candidate only, not safe to apply or publish without current address/branch verification.","Dates in original log have no explicit timezone; no timezone was inferred."],counts,originalRefillExtractionFailures:errors,records:results},null,2)+"\n");
  console.log(JSON.stringify({stores:stores.length,historicalRecords:records.length,counts,originalRefillExtractionFailures:errors,databaseWrites:0}));
}
main().catch(()=>{console.error("Offline source recovery failed; no database writes.");process.exitCode=1;});
