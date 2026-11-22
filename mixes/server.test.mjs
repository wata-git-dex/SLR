import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {experimentRoute,mixProfile} from './server.mjs';
import worker from '../worker.js';
import {reconcileProgress} from '../push/server.mjs';
import '../achievements.js';
const origin='https://labrats.saltyviewfinder.com';
const catalog=[{id:'https://app.notion.com/'+'a'.repeat(32),strainId:'s1',name:'Durban Poison',brand:'Luana',family:'Sativa'},{id:'https://app.notion.com/'+'b'.repeat(32),strainId:'s2',name:'Durban Poison',brand:'Claybourne',family:'Sativa'},{id:'https://app.notion.com/'+'c'.repeat(32),strainId:'s3',name:'Tangrini',brand:'ZOIKS',family:'Hybrid'}];
const active=new Map([['ALICE',{subject:'alice',name:'Alice'}],['AMBER',{subject:'amber',name:'Amber'}],['PIERO',{subject:'piero',name:'Piero'}]]);
function db(){
 const sqlite=new DatabaseSync(':memory:');for(const file of ['0001.sql','0002-mixes.sql'])sqlite.exec(readFileSync(new URL('../push/migrations/'+file,import.meta.url),'utf8'));
 const db={sqlite,failBatch:false,failAwards:false,prepare(sql){return {bind(...args){return {sql,async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return sqlite.prepare(sql).run(...args);}};}};},async batch(commands){sqlite.exec('BEGIN');try{const results=[];for(const [index,command]of commands.entries()){results.push(await command.all());if(db.failAwards&&command.sql?.includes('INSERT OR IGNORE INTO slr_reward_history')){db.failAwards=false;throw Error('Synthetic award failure');}if(db.failBatch&&index===0){db.failBatch=false;throw Error('Synthetic storage failure');}}sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};return db;
}
const input=(extra={})=>({operationId:crypto.randomUUID(),ingredients:catalog.slice(0,2).map(batch=>({batchId:batch.id})),participants:['Amber'],overall:4,effects:{Focused:2},notes:'A separate blend',...extra});
function setup(selectedCatalog=catalog){const DB=db();let reads=0;const env={SLR_PUSH_DB:DB},hooks={activeMembers:async()=>active,loadCatalog:async()=>{reads++;return structuredClone(selectedCatalog);}};const call=async(action,data,code='ALICE',requestOrigin=origin)=>{const result=await experimentRoute(new Request('https://worker.test/experiments/'+action,{method:'POST',headers:{origin:requestOrigin},body:JSON.stringify({code,data})}),env,hooks);return {status:result.status,body:await result.json()};};return {DB,env,hooks,call,reads:()=>reads};}
test('mix recipes and personal results are separate; retries do not duplicate XP or awards',async()=>{
 const {DB,call,reads}=setup(),data=input(),before=JSON.stringify(catalog);
 const first=await call('create',data);assert.equal(first.status,200);assert.equal(first.body.record.author,'Alice');assert.deepEqual(first.body.record.ingredients.map(row=>[row.brand,row.share]),[['Luana',.5],['Claybourne',.5]]);assert.equal(first.body.record.observations.length,1);assert.equal(first.body.mixProgress.alice.completed,1);assert.equal(first.body.mixProgress.amber,undefined);
 const retried=await call('create',data);assert.equal(retried.body.record.id,first.body.record.id);assert.equal(reads(),1);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM slr_mix_experiments').get().n,1);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM slr_mix_results').get().n,1);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM slr_reward_history').get().n,2);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM events').get().n,2);assert.equal(JSON.stringify(catalog),before);
 const baseline=SLRAchievements.calculateMember({sessions:[]},'Alice'),after=SLRAchievements.calculateMember({sessions:[],mixProgress:retried.body.mixProgress},'Alice');assert.equal(after.totalXp-baseline.totalXp,60);assert.equal(after.metrics.sessions,0);assert.equal(after.metrics.strains,0);assert.equal(after.metrics.fiveStars,0);assert.equal(after.metrics.mixes,1);
 assert.equal((await call('create',{...data,overall:5})).status,409);
});
test('each invited Rat records their own result; shared credit requires actual results',async()=>{
 const {call,DB}=setup(),first=await call('create',input());
 assert.equal((await call('result',input({experimentId:first.body.record.id}),'PIERO')).status,403);
 const amberInput={operationId:crypto.randomUUID(),experimentId:first.body.record.id,overall:2,effects:{Relaxed:1},notes:'My own result'};
 const amber=await call('result',amberInput,'AMBER');assert.equal(amber.status,200);assert.equal(amber.body.record.observations.length,2);assert.equal(amber.body.record.observations.find(row=>row.member==='Alice').overall,4);assert.equal(amber.body.record.observations.find(row=>row.member==='Amber').overall,2);
 for(const name of ['Alice','Amber']){const progress=SLRAchievements.calculateMember({sessions:[],mixProgress:amber.body.mixProgress},name);assert.equal(progress.totalXp,name==='Alice'?85:110);assert.equal(progress.metrics.sharedMixes,1);}
 assert.equal((await call('result',amberInput,'AMBER')).status,200);assert.equal((await call('result',{...amberInput,operationId:crypto.randomUUID()},'AMBER')).status,409);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM slr_mix_results').get().n,2);
 const mine=await call('list',{scope:'mine'},'AMBER');assert.equal(mine.body.records.length,1);assert.equal((await call('list',{scope:'mine'},'PIERO')).body.records.length,0);
});
test('failed multi-record writes roll back recipe and people; same save ID recovers',async()=>{
 const {DB,call}=setup(),data=input();DB.failBatch=true;assert.equal((await call('create',data)).status,503);for(const table of ['slr_mix_experiments','slr_mix_participants','slr_mix_results'])assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM '+table).get().n,0);
 assert.equal((await call('create',data)).status,200);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM slr_mix_experiments').get().n,1);
});
test('fresh invite, origin, active roster and rating validation protect mix writes',async()=>{
 const {call,DB,env,hooks}=setup();assert.equal((await call('create',input(),'ALICE','https://evil.example')).status,403);assert.equal((await call('create',input(),'REVOKED')).status,401);assert.equal((await call('create',input({participants:['Inactive Rat']}))).status,400);assert.equal((await call('create',input({overall:4.5}))).status,400);assert.equal((await call('create',input({effects:{Arbitrary:2}}))).status,400);assert.equal((await call('create',input({ingredients:[{batchId:catalog[0].id},{batchId:catalog[0].id}]}))).status,400);
 const huge=await experimentRoute(new Request('https://worker.test/experiments/create',{method:'POST',headers:{origin},body:'x'.repeat(9000)}),env,hooks);assert.equal(huge.status,413);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM slr_mix_experiments').get().n,0);
});
test('journal is paginated, includes authors, and does not leak invite subjects or other histories',async()=>{
 const {call,DB}=setup();for(let i=0;i<27;i++)assert.equal((await call('create',input({participants:[],title:'Mix '+i}))).status,200);
 const first=await call('list',{scope:'community'},'AMBER');assert.equal(first.body.records.length,25);assert.ok(first.body.nextCursor);assert.equal(first.body.rewardHistory.length,0);assert.ok(first.body.records.every(row=>row.author==='Alice'&&!('author_subject'in row)));
 const second=await call('list',{scope:'community',cursor:first.body.nextCursor},'AMBER');assert.equal(second.body.records.length,2);assert.equal(new Set([...first.body.records,...second.body.records].map(row=>row.id)).size,27);
 const own=await call('list',{scope:'mine'});assert.deepEqual(own.body.rewardHistory.map(row=>row.badgeId).sort(),['mix-first-blend','mix-notes','mix-twin-suns']);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM slr_reward_history').get().n,3);
});
test('Worker routes experiments before legacy Session POST; ordinary Notion records never receive mix scores',async()=>{
 const DB=db(),calls=[],originalFetch=globalThis.fetch;
 const title=value=>({title:[{plain_text:value}]}),text=value=>({rich_text:[{plain_text:value}]});
 globalThis.fetch=async(url,options={})=>{
  calls.push({url:String(url),method:options.method});assert.notEqual(options.method,'PATCH');assert.ok(!String(url).endsWith('/v1/pages'));
  if(String(url).includes('ea3be0a8-c8f9-4857-bc1f-3c0ae6399cfb'))return Response.json({results:[{id:'1'.repeat(32),properties:{Status:{select:{name:'Active'}},Code:title('ALICE'),'Given To':text('Alice')}}]});
  if(String(url).includes('90289161-102c-4070-9fcf-1805edcd28c1'))return Response.json({results:catalog.map((batch,index)=>({id:String(index+1).repeat(32),properties:{Name:title(batch.name),Batches:{relation:[{id:batch.id.slice(-32)}]}}}))});
  if(String(url).includes('eab15a0d-95a3-4695-b106-62a1e52e312b'))return Response.json({results:catalog.map((batch,index)=>({id:batch.id.slice(-32),properties:{Brand:{select:{name:batch.brand}},Type:{select:{name:batch.family}},Country:{select:{name:index?'🇺🇸':'🇩🇪'}},Strains:{relation:[{id:String(index+1).repeat(32)}]}}}))});
  return Response.json({results:[]});
 };
 const env={NOTION_TOKEN:'synthetic',SLR_PUSH_DB:DB};
 try{
  const make=(path,data)=>new Request('https://worker.test/'+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({code:'ALICE',...data})});
  const created=await worker.fetch(make('experiments/create',{data:input({participants:[]})}),env);assert.equal(created.status,200);const saved=await created.json();assert.equal(saved.record.observations[0].overall,4);assert.deepEqual(saved.record.ingredients.map(row=>row.country),['🇩🇪','🇺🇸']);assert.equal(saved.mixProgress.alice.international,1);
  const root=await worker.fetch(new Request('https://worker.test/?code=ALICE'),env);assert.equal(root.status,200);const canonical=await root.json();assert.equal(canonical.sessions.length,0);assert.equal(canonical.mixProgress.alice.completed,1);assert.equal(canonical.strains.length,3);
  assert.equal((await worker.fetch(make('',{kind:'experiment'}),env)).status,400);assert.equal((await worker.fetch(make('experiments/unknown',{}),env)).status,404);
 }finally{globalThis.fetch=originalFetch;}
});

test('Try This Mix lets an active Rat add only their own result to the existing recipe',async()=>{
 const {call,DB}=setup(),first=await call('create',input({participants:[]})),id=first.body.record.id;
 const data={operationId:crypto.randomUUID(),experimentId:id,overall:2,effects:{Energized:2,Creative:1},notes:'My take',member:'Alice',participants:['Amber']};
 const tried=await call('try',data,'PIERO');assert.equal(tried.status,200);
 assert.equal(tried.body.record.id,id);assert.equal(tried.body.record.author,'Alice');assert.deepEqual(tried.body.record.ingredients,first.body.record.ingredients);
 assert.deepEqual(tried.body.record.participants,['Alice','Piero']);assert.equal(tried.body.record.observations.find(row=>row.member==='Alice').overall,4);assert.equal(tried.body.record.observations.find(row=>row.member==='Piero').overall,2);
 assert.equal(tried.body.mixProgress.piero.completed,1);assert.equal(tried.body.mixProgress.piero.shared,1);assert.equal(tried.body.mixProgress.amber,undefined);
 assert.equal((await call('list',{scope:'mine'},'PIERO')).body.records.length,1);
 assert.equal((await call('try',data,'PIERO')).status,200);assert.equal((await call('try',{...data,operationId:crypto.randomUUID()},'PIERO')).status,409);
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM slr_mix_results').get().n,2);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM slr_mix_experiments').get().n,1);
 assert.equal((await call('try',data,'REVOKED')).status,401);assert.equal((await call('try',{...data,experimentId:'mix_'+'f'.repeat(64)},'AMBER')).status,404);
});
test('failed self-try rolls back enrollment and a stable retry creates one result',async()=>{
 const {call,DB}=setup(),first=await call('create',input({participants:[]}));
 const data={operationId:crypto.randomUUID(),experimentId:first.body.record.id,overall:5,effects:{Relaxed:1}};
 DB.failBatch=true;assert.equal((await call('try',data,'PIERO')).status,503);
 assert.equal(DB.sqlite.prepare("SELECT COUNT(*) n FROM slr_mix_participants WHERE subject='piero'").get().n,0);assert.equal(DB.sqlite.prepare("SELECT COUNT(*) n FROM slr_mix_results WHERE subject='piero'").get().n,0);
 assert.equal((await call('try',data,'PIERO')).status,200);assert.equal((await call('try',data,'PIERO')).status,200);
 assert.equal(DB.sqlite.prepare("SELECT COUNT(*) n FROM slr_mix_results WHERE subject='piero'").get().n,1);
});
test('server generates cross-separated names and preserves an explicit custom name',async()=>{
 const {call}=setup();
 const auto=await call('create',input({title:''}));assert.equal(auto.status,200);assert.equal(auto.body.record.title,'Durban Poison × Durban Poison');
 const custom=await call('create',input({title:'The Ultimate Combo'}));assert.equal(custom.body.record.title,'The Ultimate Combo');
});

test('countries are canonical server snapshots; missing or same-country information never invents International Incident',async()=>{
 const choices=catalog.map((row,index)=>({...row,country:index?'USA':'🇩🇪'})),{call,reads}=setup(choices);
 const first=await call('create',input({participants:[],country:'🇹🇭',ingredients:catalog.slice(0,2).map(row=>({batchId:row.id,country:'🇹🇭'}))}));
 assert.equal(first.status,200);assert.deepEqual(first.body.record.ingredients.map(row=>row.country),['🇩🇪','🇺🇸']);assert.equal(first.body.mixProgress.alice.international,1);assert.ok(first.body.rewardHistory.some(row=>row.badgeId==='mix-international'));
 await call('list',{});assert.equal(reads(),1,'journal does not query Notion per country or per keystroke');
 for(const countries of [['🇩🇪','Germany'],['🇩🇪',null],['Unknown','🇺🇸']]){
  const {call}=setup(catalog.map((row,index)=>({...row,country:countries[index]})));
  const result=await call('create',input({participants:[]}));assert.equal(result.body.mixProgress.alice.international,0);
 }
});
test('specialty badges require two distinct strains and pure types; Hybrid leanings stay hybrids',async()=>{
 for(const [families,field]of [[['Sativa','Sativa'],'doubleSativa'],[['Indica','Indica'],'doubleIndica'],[['Sativa','Indica'],'opposites'],[['Hybrid-S','Indica'],null],[['Hybrid-I','Sativa'],null],[['Hybrid','Hybrid'],null]]){
  const {call}=setup(catalog.map((row,index)=>({...row,family:families[index]||'Hybrid'}))),saved=await call('create',input({participants:[]}));
  assert.equal(saved.status,200);for(const name of ['doubleSativa','doubleIndica','opposites'])assert.equal(saved.body.mixProgress.alice[name],name===field?1:0);
 }
 const same=setup(catalog.map(row=>({...row,strainId:'one-strain',country:row.brand==='Luana'?'🇩🇪':'🇺🇸'})));
 const result=await same.call('create',input({participants:[]}));assert.equal(result.body.mixProgress.alice.doubleSativa,0);assert.equal(result.body.mixProgress.alice.international,0);
});
test('specialty combinations deduplicate across copies and component order; Replication needs another author and a saved personal result',async()=>{
 const {call}=setup(),first=await call('create',input());assert.equal(first.body.mixProgress.alice.replicated,0);assert.equal(first.body.mixProgress.amber,undefined);
 const answer=id=>({operationId:crypto.randomUUID(),experimentId:id,overall:3,effects:{Energized:1}});
 const tried=await call('try',answer(first.body.record.id),'AMBER');assert.equal(tried.body.mixProgress.amber.replicated,1);
 const copy=await call('create',input({ingredients:catalog.slice(0,2).reverse().map(row=>({batchId:row.id})),participants:[]}));
 const again=await call('try',answer(copy.body.record.id),'AMBER');assert.equal(again.body.mixProgress.amber.replicated,1);assert.equal(again.body.mixProgress.amber.doubleSativa,1);assert.equal(again.body.mixProgress.alice.doubleSativa,1);
 const ownCopy=await call('create',input({participants:[]}),'AMBER');assert.equal(ownCopy.body.mixProgress.amber.replicated,1);
 assert.equal(ownCopy.body.rewardHistory.filter(row=>row.badgeId==='mix-replication').length,1);
});
test('distinct qualifying combinations award per-rank history and notifications once, at 1, 5 and 10',async()=>{
 const rows=Array.from({length:11},(_,index)=>({id:'https://app.notion.com/'+(index+20).toString(16).padStart(32,'0'),strainId:'pure-'+index,name:'Pure Sativa '+index,brand:'Test',family:'Sativa'}));
 const {call,DB}=setup(rows);let saved,data;
 for(let index=1;index<=10;index++){data=input({participants:[],ingredients:[{batchId:rows[0].id},{batchId:rows[index].id}]});saved=await call('create',data);assert.equal(saved.status,200);}
 const badge=SLRAchievements.calculateMember({sessions:[],mixProgress:saved.body.mixProgress},'Alice').achievements.find(row=>row.id==='mix-twin-suns');assert.equal(badge.rank,3);assert.equal(badge.nextThreshold,25);assert.equal(badge.earnedXp,75);
 const history=DB.sqlite.prepare("SELECT rank,xp FROM slr_reward_history WHERE badge_id='mix-twin-suns' ORDER BY rank").all();assert.deepEqual(history.map(row=>[row.rank,row.xp]),[[1,25],[2,25],[3,25]]);
 assert.equal((await call('create',data)).status,200);assert.equal(DB.sqlite.prepare("SELECT COUNT(*) n FROM events WHERE id LIKE '%mix-twin-suns:%'").get().n,3);
 const progress=SLRAchievements.calculateMember({sessions:[],mixProgress:saved.body.mixProgress},'Alice');assert.equal(progress.metrics.strains,0);assert.equal(progress.metrics.sessions,0);assert.equal(progress.totalXp,235);
});
test('optional award failure keeps the saved result; retry materializes each reward exactly once',async()=>{
 const {call,DB}=setup(),data=input({participants:[]});DB.failAwards=true;
 const saved=await call('create',data);assert.equal(saved.status,200);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM slr_mix_results').get().n,1);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM slr_reward_history').get().n,0);
 const retry=await call('create',data);assert.equal(retry.status,200);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM slr_mix_results').get().n,1);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM slr_reward_history').get().n,2);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM events').get().n,2);
});
test('normal Session reconciliation leaves mix ranks and per-rank notifications to the mix producer',async()=>{
 const {call,DB,env}=setup(),saved=await call('create',input({participants:[]}));
 const payload={batches:[],strains:[],sessions:[],terpenes:[],mixProgress:saved.body.mixProgress};
 await reconcileProgress(env,active.get('ALICE'),payload);
 const cached=JSON.parse(DB.sqlite.prepare("SELECT ranks FROM achievement_progress WHERE subject='alice'").get().ranks);assert.ok(Object.keys(cached).every(id=>!id.startsWith('mix-')));
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM slr_reward_history').get().n,2);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM events').get().n,2);
});
