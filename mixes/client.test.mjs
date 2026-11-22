import test from 'node:test';
import assert from 'node:assert/strict';
import {MixClient} from './client.mjs';
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key),map};};
const ok=data=>Response.json({ok:true,...data});
test('same-identity reads coalesce, but late prior-account data cannot populate a new account',async()=>{
 let code='alice-code',member='Alice',resolve,calls=0;const store=storage();
 const client=new MixClient({api:'https://api.test',code:()=>code,member:()=>member,storage:store,fetcher:()=>{calls++;return new Promise(done=>{resolve=done;});}});
 const a=client.list('community'),b=client.list('community');assert.equal(calls,1);code='amber-code';member='Amber';resolve(ok({viewer:'Alice',records:[]}));await assert.rejects(a,/Account changed/);await assert.rejects(b,/Account changed/);assert.equal(client.cache.size,0);
});
test('drafts and save IDs survive a new client; another identity never receives that draft',async()=>{
 let code='alice-code',member='Alice';const store=storage(),options={api:'https://api.test',code:()=>code,member:()=>member,storage:store};
 const first=new MixClient(options);await first.prepareScope();const draft={operationId:crypto.randomUUID(),title:'Even mix',ingredients:[{batchId:'a'},{batchId:'b'}],notes:'Keep my work'};first.persistSync(draft);
 const reopened=new MixClient(options);assert.equal((await reopened.draft()).operationId,draft.operationId);assert.equal((await reopened.draft()).notes,'Keep my work');code='amber-code';member='Amber';assert.equal(await reopened.draft(),null);assert.ok([...store.map.values()].every(value=>!value.includes('alice-code')));
 code='alice-code';member='Alice';await reopened.prepareScope();reopened.clearDraft('different-operation');assert.ok(await reopened.draft());reopened.clearDraft(draft.operationId);assert.equal(await reopened.draft(),null);
});
test('a committed save with a lost response can retry the persisted operation; reads from before a save are stale',async()=>{
 let id,first=true,resolveRead;const seen=new Set(),store=storage();const client=new MixClient({api:'https://api.test',code:()=> 'alice-code',member:()=> 'Alice',storage:store,fetcher:()=>new Promise(done=>{resolveRead=done;}),writer:async(_url,options)=>{const {data}=JSON.parse(options.body);seen.add(data.operationId);id=data.operationId;if(first){first=false;throw Error('connection lost after commit');}return ok({record:{id},records:[]});}});
 await client.prepareScope();const draft={operationId:crypto.randomUUID(),overall:4};client.persistSync(draft);await assert.rejects(client.request('create',draft,true),/connection lost/);const pending=client.list('community');const retried=await client.request('create',await client.draft(),true);assert.equal(retried.record.id,draft.operationId);assert.equal(seen.size,1);resolveRead(ok({records:[]}));await assert.rejects(pending,error=>error.stale===true);
});
test('storage errors stay visible and never erase an existing unrelated draft',async()=>{
 const client=new MixClient({api:'https://api.test',code:()=> 'alice-code',member:()=> 'Alice',storage:{getItem:()=>null,setItem:()=>{throw Error('Quota exceeded');}}});await client.prepareScope();assert.throws(()=>client.persistSync({operationId:'keep'}),/Quota exceeded/);
});
test('unverified account writes are blocked and a mismatched canonical viewer is discarded',async()=>{
 let sent=0;const client=new MixClient({api:'https://api.test',code:()=> 'amber-code',member:()=> 'Cyrus',storage:storage(),verified:()=>false,writer:async()=>{sent++;return ok({viewer:'Amber'});},fetcher:async()=>ok({viewer:'Amber',records:[]})});
 await assert.rejects(client.request('create',{},true),/finish loading/);assert.equal(sent,0);await assert.rejects(client.list('community'),error=>error.stale===true);
});
test('a post-save refresh never reuses an older in-flight journal request',async()=>{
 const resolves=[];const client=new MixClient({api:'https://api.test',code:()=> 'alice-code',member:()=> 'Alice',storage:storage(),fetcher:()=>new Promise(resolve=>resolves.push(resolve)),writer:async()=>ok({viewer:'Alice',record:{id:'new'}})});
 const older=client.list('community');await client.request('create',{operationId:crypto.randomUUID()},true);const fresh=client.list('community',null,true);assert.equal(resolves.length,2);
 resolves[0](ok({viewer:'Alice',records:[]}));await assert.rejects(older,error=>error.stale===true);resolves[1](ok({viewer:'Alice',records:[{id:'new'}]}));assert.equal((await fresh).records[0].id,'new');
});
