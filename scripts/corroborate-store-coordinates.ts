import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {registryCoordinates} from '../lib/registry-coordinates';
const norm=(s:string)=>s.normalize('NFKC').replace(/[^가-힣a-zA-Z0-9]/g,'').toLowerCase();
async function main(){
 const observations=JSON.parse(await readFile('logs/store-live-verification.json','utf8'));
 const todo=observations.records.filter((r:any)=>r.status==='success');
 const results:any[]=[];
 try {
  const saved=JSON.parse(await readFile('logs/store-registry-corroboration.json','utf8'));
  const enriched=JSON.parse(await readFile('logs/store-live-verification-enriched.json','utf8'));
  if(enriched.records.some((r:any)=>observations.records.find((x:any)=>x.sourceId===r.sourceId)?.observedAt!==r.observedAt))throw Error('Observation mismatch');
  results.push(...saved.records);
  for(const row of todo){const previous=enriched.records.find((r:any)=>r.sourceId===row.sourceId);if(previous?.coordinateRegistryId)Object.assign(row,{lat:previous.lat,lng:previous.lng,coordinateSource:previous.coordinateSource,coordinateRegistryId:previous.coordinateRegistryId});}
 } catch(error:any){if(error.code!=='ENOENT')throw error;}
 for(let start=results.length;start<todo.length;start+=1){
  const queries=todo.slice(start,start+1).map((r:any)=>({sourceId:r.sourceId,name:r.name,phone:r.phone,address:r.address}));
  const code=`await listBrowserTabs();const p=await openTab("https://www.data.go.kr/iim/api/selectAcountList.do");console.log(p.url().split("?")[0],await p.title());await snapshot(p,{interactive:true});const a=p.locator("a").filter({hasText:"행정안전부_식품_일반음식점 조회서비스"});if(await a.count()!==1)throw Error("approved_account_unavailable");await a.first().click();let ready=false;for(let i=0;i<20;i++){ready=await p.evaluate(()=>!!document.querySelector("#ServiceKey")?.value);if(ready)break;await new Promise(r=>setTimeout(r,500));}if(!ready)throw Error("credential_unavailable");console.log("REGISTRY_BATCH:"+JSON.stringify(await p.evaluate(async(input)=>{const raw=document.querySelector("#ServiceKey").value;const key=raw.includes("%")?decodeURIComponent(raw):raw;const out=[];for(const entry of input){const m=entry.address.match(/(?:서울특별시|서울)\\s+([가-힣]+구)\\s+([^\\s]+(?:로|길))\\s+(\\d+(?:-\\d+)?)(?:\\s|$)/);if(!m){out.push({sourceId:entry.sourceId,status:"unsupported_address",candidates:[]});continue;}const u=new URL("https://apis.data.go.kr/1741000/general_restaurants/info");for(const [k,v]of Object.entries({serviceKey:key,pageNo:"1",numOfRows:"100",returnType:"JSON","cond[ROAD_NM_ADDR::LIKE]":m[1]+" "+m[2]+" "+m[3]}))u.searchParams.set(k,v);try{const response=await fetch(u);const b=await response.json();const body=b.response?.body;const rows=body?.items?.item||[];out.push({sourceId:entry.sourceId,status:response.ok&&b.response?.header?.resultCode==="0"?"queried":"api_error",total:body?.totalCount,candidates:(Array.isArray(rows)?rows:[rows]).map(x=>({id:x.MNG_NO,name:x.BPLC_NM,address:x.ROAD_NM_ADDR,phone:x.TELNO,x:x.CRD_INFO_X,y:x.CRD_INFO_Y,state:x.SALS_STTS_NM,updatedAt:x.DAT_UPDT_PNT}))});}catch{out.push({sourceId:entry.sourceId,status:"api_error",candidates:[]});}await new Promise(r=>setTimeout(r,200));}return out;},${JSON.stringify(queries)})));await p.close();`;
  const navigationCode=code.replace('await a.first().click();','await p.evaluate(()=>Array.from(document.querySelectorAll("a")).find(a=>a.textContent.includes("행정안전부_식품_일반음식점 조회서비스")).click());await new Promise(r=>setTimeout(r,1200));');
  let text='';
  for(let attempt=0;attempt<3;attempt++){
   text=execFileSync('aside',['repl',navigationCode],{encoding:'utf8',timeout:180000,maxBuffer:8000000});
   if(text.includes('REGISTRY_BATCH:'))break;
   if(!/CDP command timeout|Cannot find context|Execution context was destroyed/.test(text))break;
   await new Promise(resolve=>setTimeout(resolve,2000));
  }
  const line=text.split('\n').find(l=>l.startsWith('REGISTRY_BATCH:'));if(!line){console.error(JSON.stringify({browserErrors:text.match(/(?:TypeError|ReferenceError|Error):[^\n]*/g)}));throw Error('Missing registry batch');}
  const batch=JSON.parse(line.slice('REGISTRY_BATCH:'.length));
  for(const item of batch){
   const source=todo.find((r:any)=>r.sourceId===item.sourceId);
   const addressKey=(s:string)=>s.match(/(?:서울특별시|서울)\s+([가-힣]+구)\s+([^\s]+(?:로|길))\s+(\d+(?:-\d+)?)(?:\s|,|$)/)?.slice(1).join(' ');
   const matches=item.status==='queried'&&Number(item.total)<=100?item.candidates.filter((r:any)=>r.state==='영업/정상'&&addressKey(r.address)===addressKey(source.address)&&((norm(r.phone||'').length>=9&&norm(r.phone)===norm(source.phone||''))||norm(r.name)===norm(source.name))):[];
   const result:any={sourceId:source.sourceId,status:item.status==='queried'?(matches.length===1?'matched':matches.length>1?'ambiguous':'unmatched'):item.status};
   if(matches.length===1){try{const r=matches[0];const coordinate=registryCoordinates(String(r.x||''),String(r.y||''));Object.assign(source,{lat:coordinate.lat,lng:coordinate.lng,coordinateSource:'public_registry_epsg5174',coordinateRegistryId:r.id});result.registryId=r.id;result.coordinates=coordinate;result.registryUpdatedAt=r.updatedAt;}catch{result.status='invalid_coordinates';}}
   results.push(result);
  }
  await writeFile('logs/store-registry-corroboration.json',JSON.stringify({observedAt:new Date().toISOString(),records:results},null,2));
  await writeFile('logs/store-live-verification-enriched.json',JSON.stringify(observations,null,2));
  console.log(JSON.stringify({processed:results.length,total:todo.length,matched:results.filter(r=>r.status==='matched').length}));
  if(batch.filter((x:any)=>x.status==='api_error').length>=3)throw Error('Registry failures stop');
 }
}
main().catch((error)=>{console.error(JSON.stringify({errorType:error?.name,code:error?.code,exitStatus:error?.status,outputBytes:typeof error?.stdout==='string'?error.stdout.length:null}));console.error('Registry corroboration stopped; completed checkpoint files preserved, no DB writes.');process.exitCode=1;});
