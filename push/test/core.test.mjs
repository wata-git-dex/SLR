import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';
import {validEndpoint,validSubscription,handle,emit,drain} from '../delivery.mjs';
import {badge,installationRequired,NotificationClient} from '../client.mjs';
import {notificationRoute,progressContext,reconcileProgress,markAchievementSave} from '../server.mjs';
import '../../achievements.js';
import appWorker from '../../worker.js';
import {arm,runAlarm,kickDelivery} from '../scheduler.mjs';
const b64=bytes=>Buffer.from(bytes).toString('base64url');
function db(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../migrations/0001.sql',import.meta.url),'utf8'));
 return {sqlite,prepare(sql){return {bind(...args){const stmt=sqlite.prepare(sql);return {async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};},async run(){return stmt.run(...args);}};}};},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
}
const request=(path,subject='alice',data)=>new Request('https://internal'+path,{method:data===undefined?'GET':'POST',headers:{'x-slr-app':'stoned-lab-rats','x-slr-subject':subject},body:data===undefined?undefined:JSON.stringify(data)});
async function keys(){const pair=await webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);const jwk=await webcrypto.subtle.exportKey('jwk',pair.privateKey);return {VAPID_PUBLIC_KEY:b64(await webcrypto.subtle.exportKey('raw',pair.publicKey)),VAPID_PRIVATE_KEY:jwk.d};}
async function subscription(){const pair=await webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);return {endpoint:'https://web.push.apple.com/example',keys:{p256dh:b64(await webcrypto.subtle.exportKey('raw',pair.publicKey)),auth:b64(new Uint8Array(16).fill(9))}};}
test('endpoint allowlist rejects private hosts, credentials, fragments and deceptive suffixes',()=>{
 for(const value of ['http://fcm.googleapis.com/x','https://localhost/x','https://push.apple.com.evil.test/x','https://a@web.push.apple.com/x','https://web.push.apple.com:444/x','https://web.push.apple.com/x#y'])assert.equal(validEndpoint(value),false);
 assert.equal(validEndpoint('https://web.push.apple.com/x'),true);
 assert.equal(validSubscription({endpoint:'https://fcm.googleapis.com/x',keys:{p256dh:'bad',auth:'bad'}}),false);
});
test('self events, subscription ownership, read scope, preferences and removal',async()=>{
 const DB=db(),env={DB,...await keys()},s=await subscription();
 const first=await (await handle(request('/subscribe','alice',{subscription:s}),env)).json();
 await handle(request('/subscribe','alice',{subscription:s}),env);
 assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM events').get().n,1);
 await assert.rejects(handle(request('/subscribe','bob',{subscription:s}),env),/previous account/);
 const state=await (await handle(request('/state','bob'),env)).json();assert.equal(state.events.length,0);assert.equal(state.devices.length,0);
 await handle(request('/read','bob',{ids:['device:'+first.id]}),env);
 assert.equal((await (await handle(request('/state','alice'),env)).json()).unread,1);
 await handle(request('/preferences','bob',{id:first.id,account:false,achievements:true,achievements:true}),env);
 assert.equal(DB.sqlite.prepare('SELECT account_enabled FROM subscriptions').get().account_enabled,1);
 await handle(request('/read','alice',{ids:['device:'+first.id]}),env);
 assert.equal((await (await handle(request('/state','alice'),env)).json()).unread,0);
 await handle(request('/unsubscribe','bob',{endpoint:s.endpoint}),env);assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM subscriptions').get().n,1);
 await handle(request('/unsubscribe','alice',{endpoint:s.endpoint}),env);assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM deliveries').get().n,0);
});
test('test requests deduplicate and never accept browser recipient/content',async()=>{
 const DB=db(),env={DB,...await keys()},s=await subscription();await handle(request('/subscribe','alice',{subscription:s}),env);
 for(let n=0;n<2;n++)await handle(request('/test','alice',{subject:'bob',body:'private',url:'https://evil.test'}),env);
 assert.equal(DB.sqlite.prepare("SELECT count(*) AS n FROM events WHERE category='test'").get().n,1);
 assert.equal(DB.sqlite.prepare("SELECT count(*) AS n FROM events WHERE subject='bob'").get().n,0);
});
test('dispatcher encrypts, retries 429, bounds attempts, and removes 410 subscriptions',async()=>{
 const DB=db(),env={DB,...await keys()},s=await subscription();await handle(request('/subscribe','alice',{subscription:s}),env);
 const start=Date.now()+1000;let sent=0;
 const sender=async(_url,options)=>{sent++;assert.equal(options.redirect,'manual');assert.ok(options.body);return new Response('',{status:429,headers:{'retry-after':'300'}});};
 await drain(env,sender,start,async()=>true);assert.equal(sent,1);const job=DB.sqlite.prepare('SELECT * FROM deliveries').get();assert.equal(job.attempts,1);assert.ok(job.due>=start+300000);
 await drain(env,sender,start,async()=>true);assert.equal(sent,1);
 await drain(env,async()=>new Response('',{status:410}),job.due+1,async()=>true);assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM subscriptions').get().n,0);
});
test('multi-device fanout and no retroactive fanout during subscription reconciliation',async()=>{
 const DB=db(),env={DB,...await keys()},a=await subscription(),b={...await subscription(),endpoint:'https://web.push.apple.com/second'};
 const first=await (await handle(request('/subscribe','alice',{subscription:a}),env)).json();
 // Deterministic ordering even on a fast test runner.
 DB.sqlite.prepare('UPDATE subscriptions SET created=created-1000').run();DB.sqlite.prepare('UPDATE events SET created=created-1000').run();
 await handle(request('/subscribe','alice',{subscription:b}),env);await handle(request('/subscribe','alice',{subscription:a}),env);
 assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM deliveries WHERE event_id=?').get('device:'+first.id).n,1);
 await emit(DB,'alice','real-test','test');assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM deliveries WHERE event_id=?').get('real-test').n,2);
});
test('SLR gateway requires canonical origin, valid invite and rejects producer paths',async()=>{
 const DB=db(),env={SLR_PUSH_DB:DB,...await keys()};
 const make=(path,code='good',origin='https://labrats.saltyviewfinder.com')=>new Request('https://api.example/notifications/'+path,{method:'POST',headers:{origin,'x-slr-subject':'bob'},body:JSON.stringify({code,data:{subject:'bob',app:'wrong',url:'https://evil.test'}})});
 const authorize=async code=>code==='good'?{name:'Alice',subject:'alice'}:null;
 assert.equal((await notificationRoute(make('state','bad'),env,authorize)).status,401);
 assert.equal((await notificationRoute(make('state','good','https://evil.test'),env,authorize)).status,403);
 assert.equal((await notificationRoute(make('emit'),env,authorize)).status,404);
 const state=await (await notificationRoute(make('state'),env,authorize)).json();assert.equal(state.devices.length,0);
});
test('badge fallback and iPad installation detection',async()=>{
 const calls=[];await badge(3,{setAppBadge:n=>calls.push(n)});await badge(0,{clearAppBadge:()=>calls.push(0)});await badge(3,{});assert.deepEqual(calls,[3,0]);
 assert.equal(installationRequired({userAgent:'Mac',platform:'MacIntel',maxTouchPoints:5},false),true);
 assert.equal(installationRequired({userAgent:'iPhone'},true),false);
});
test('late old-account state cannot update badge/inbox',async()=>{
 let owner='alice',finish;const client=new NotificationClient({identity:()=>owner,request:()=>new Promise(resolve=>finish=resolve)});
 const pending=client.refresh();owner='bob';client.reset();finish({unread:7});assert.equal(await pending,null);assert.equal(client.state,null);
});
test('SW uses generic previews, constrains tap URLs, and denies update with another tab',async()=>{
 const handlers={},shown=[],opened=[],messages=[];let skipped=0;
 const self={location:{origin:'https://labrats.saltyviewfinder.com'},navigator:{},registration:{showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>[{id:'one',url:'https://labrats.saltyviewfinder.com/#profile',postMessage(){}}],openWindow:async url=>opened.push(url)},skipWaiting:async()=>skipped++,addEventListener:(type,fn)=>handlers[type]=fn};
 vm.runInNewContext(readFileSync(new URL('../sw-runtime.js',import.meta.url),'utf8'),{self,URL});self.installSLRNotifications({version:'1',icon:'/icon.png'});
 let work;handlers.push({data:{json:()=>({body:'secret beneficiary',url:'https://evil.test',unread:2})},waitUntil:p=>work=p});await work;
 assert.ok(!JSON.stringify(shown).includes('secret'));assert.equal(shown[0][1].data.url,'https://labrats.saltyviewfinder.com/#notifications');
 assert.equal(shown[0][0],'Notification');
 for(const [category,title,body] of [
  ['test','Test notification','Your test notification has arrived.'],
  ['account','Notifications enabled','Device notifications are enabled for your account.'],
  ['achievement','New achievement','New achievement unlocked. Open the Lab to view your progress.'],
  ['__proto__','Notification','Device notifications are enabled for your account.']
 ]){
  handlers.push({data:{json:()=>({category,title:'secret title',body:'secret rating',id:'event-1',url:'/#notifications',unread:2})},waitUntil:p=>work=p});await work;
  const [actual,options]=shown.at(-1);assert.equal(actual,title);assert.equal(options.body,body);assert.equal(options.tag,'event-1');assert.equal(options.icon,'/icon.png');assert.equal(options.data.url,'https://labrats.saltyviewfinder.com/#notifications');
 }
 assert.ok(!JSON.stringify(shown).includes('secret'));

 handlers.notificationclick({notification:{close(){},data:{url:'https://evil.test'}},waitUntil:p=>work=p});await work;assert.deepEqual(opened,['https://labrats.saltyviewfinder.com/#notifications']);
 self.clients.matchAll=async()=>[{id:'one'},{id:'two'}];handlers.message({data:{type:'SLR_APPLY_UPDATE'},source:{id:'one'},ports:[{postMessage:m=>messages.push(m)}],waitUntil:p=>work=p});await work;assert.equal(skipped,0);assert.equal(messages[0].ok,false);
 self.clients.matchAll=async()=>[{id:'one'}];handlers.message({data:{type:'SLR_APPLY_UPDATE'},source:{id:'one'},ports:[{postMessage:m=>messages.push(m)}],waitUntil:p=>work=p});await work;assert.equal(skipped,1);
});
test('five failed attempts terminate; read events and disabled categories do not send',async()=>{
 const DB=db(),env={DB,...await keys()};await handle(request('/subscribe','alice',{subscription:await subscription()}),env);
 let calls=0;const sender=async()=>{calls++;return new Response('',{status:503});};
 let time=Date.now()+1000;
 for(let i=0;i<6;i++){await drain(env,sender,time,async()=>true);time+=2000000;}
 assert.equal(calls,5);assert.equal(DB.sqlite.prepare('SELECT status FROM deliveries').get().status,'failed');
 await emit(DB,'alice','read-event','test');await handle(request('/read','alice',{ids:['read-event']}),env);
 await drain(env,sender,time,async()=>true);assert.equal(calls,5);
 const id=DB.sqlite.prepare('SELECT id FROM subscriptions').get().id;
 await handle(request('/preferences','alice',{id,account:false,achievements:true}),env);await emit(DB,'alice','account-event','account');
 await drain(env,sender,time,async()=>true);assert.equal(calls,5);
});
test('oversized bodies are rejected before subscription parsing',async()=>{
 await assert.rejects(handle(request('/subscribe','alice',{padding:'x'.repeat(5000)}),{DB:db(),...await keys()}),e=>e.status===413);
});
test('active worker advertises push capability before client may subscribe',async()=>{
 const handlers={},messages=[];
 const self={location:{origin:'https://labrats.saltyviewfinder.com'},navigator:{},addEventListener:(type,fn)=>handlers[type]=fn};
 vm.runInNewContext(readFileSync(new URL('../sw-runtime.js',import.meta.url),'utf8'),{self,URL});
 self.installSLRNotifications({version:'pilot.2',icon:'/icon.png'});
 handlers.message({data:{type:'SLR_VERSION'},ports:[{postMessage:data=>messages.push(data)}]});
 assert.equal(messages[0].push,true);assert.equal(messages[0].version,'pilot.2');

});

test('older active worker cannot register a subscription before upgrade',async()=>{
 const saved=Object.fromEntries(['navigator','Notification','PushManager','matchMedia'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 let subscriptions=0;
 try{
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'Desktop',platform:'test',maxTouchPoints:0}});
  globalThis.Notification={requestPermission:async()=> 'granted'};globalThis.PushManager={};globalThis.matchMedia=()=>({matches:true});
  const reg={active:{postMessage(_message,ports){ports[0].postMessage({version:'old'});ports[0].close();}},pushManager:{async subscribe(){subscriptions++;}}};
  const client=new NotificationClient({identity:()=> 'alice',request:async()=>{throw Error('Must not call API');},registration:async()=>reg});client.state={publicKey:'test'};
  await assert.rejects(client.enable(),/Apply the available app update/);assert.equal(subscriptions,0);
 }finally{for(const [key,descriptor] of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});

function canonical(count){
 const id=n=>String(n).padStart(32,'0');
 return {strains:Array.from({length:count},(_,i)=>({url:'strain-'+i,Name:'Synthetic'})),batches:Array.from({length:count},(_,i)=>({url:'batch-'+i,Strain:'strain-'+i,Type:'Sativa',Brand:'Fixture',Terps:['Limonene'],THC:.2,Date:'2026-10-18'})),sessions:Array.from({length:count},(_,i)=>({url:'https://app.notion.com/'+id(i+1),Batch:['batch-'+i],Blazers:['Alice'],OverallRating:4,Date:'2026-10-18',Relaxed:'🟢'})),terpenes:[{Name:'Limonene'}]};
}
test('achievement producer waits for canonical saved ID, skips history, deduplicates ranks',async()=>{
 const DB=db(),env={SLR_PUSH_DB:DB,...await keys()},member={subject:'alice',name:'Alice'};
 await handle(request('/subscribe','alice',{subscription:await subscription()}),{...env,DB});
 await reconcileProgress(env,member,canonical(4));
 assert.equal(DB.sqlite.prepare("SELECT count(*) AS n FROM events WHERE category='achievement'").get().n,0);
 await markAchievementSave(env,'alice',String(5).padStart(32,'0'));
 await reconcileProgress(env,member,canonical(4));
 assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM achievement_receipts').get().n,1);
 await reconcileProgress(env,member,canonical(5));
 const earned=DB.sqlite.prepare("SELECT id FROM events WHERE category='achievement'").all();
 assert.ok(earned.some(e=>e.id==='achievement:alice:high-voltage:1'));
 await reconcileProgress(env,member,canonical(5));
 assert.equal(DB.sqlite.prepare("SELECT count(*) AS n FROM events WHERE category='achievement'").get().n,earned.length);
 // A bulk historical/catalog change alone is not a push producer.
 await reconcileProgress(env,member,canonical(9));
 assert.equal(DB.sqlite.prepare("SELECT count(*) AS n FROM events WHERE category='achievement'").get().n,earned.length);
 await markAchievementSave(env,'alice',String(10).padStart(32,'0'));
 await reconcileProgress(env,member,canonical(10));
 assert.equal(DB.sqlite.prepare("SELECT count(*) AS n FROM events WHERE id='achievement:alice:high-voltage:2'").get().n,1);
 assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM achievement_receipts').get().n,0);
});
test('revoked identity is rechecked before network dispatch; achievement mute retains inbox',async()=>{
 const DB=db(),env={DB,...await keys()};const saved=await (await handle(request('/subscribe','alice',{subscription:await subscription()}),env)).json();
 await handle(request('/preferences','alice',{id:saved.id,account:true,achievements:false}),env);
 await emit(DB,'alice','muted-achievement','achievement');
 assert.equal(DB.sqlite.prepare("SELECT count(*) AS n FROM deliveries WHERE event_id='muted-achievement'").get().n,0);
 let sent=0;await drain(env,async()=>{sent++;return new Response('',{status:201});},Date.now()+1000,async()=>false);
 assert.equal(sent,0);assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM subscriptions').get().n,0);
});

test('real invite adapter replaces forged identities and isolates reassigned invite pages',async()=>{
 const original=globalThis.fetch;let name='Alice';
 globalThis.fetch=async()=>Response.json({results:[{id:'11111111-1111-1111-1111-111111111111',properties:{Status:{select:{name:'Active'}},Code:{title:[{plain_text:'fixture-code'}]},'Given To':{rich_text:[{plain_text:name}]}}}],has_more:false});
 try{
  const DB=db(),env={SLR_PUSH_DB:DB,NOTION_TOKEN:'synthetic',...await keys()};
  const req=(action,data)=>new Request('https://slr-notion.example/notifications/'+action,{method:'POST',headers:{origin:'https://labrats.saltyviewfinder.com','x-slr-subject':'bob'},body:JSON.stringify({code:'fixture-code',data})});
  const saved=await appWorker.fetch(req('subscribe',{subscription:await subscription()}),env);assert.equal(saved.status,200);
  assert.equal((await (await appWorker.fetch(req('state'),env)).json()).devices.length,1);
  name='Bob';const next=await (await appWorker.fetch(req('state'),env)).json();assert.equal(next.devices.length,0);assert.equal(next.events.length,0);
 }finally{globalThis.fetch=original;}
});

test('durable alarms retain earlier work, reschedule queue retries and stop when empty',async()=>{
 let alarm=null;const storage={async getAlarm(){return alarm;},async setAlarm(value){alarm=value;}};
 await arm(storage,200);await arm(storage,300);assert.equal(alarm,200);await arm(storage,100);assert.equal(alarm,100);
 const DB=db(),env={SLR_PUSH_DB:DB,SLR_PUSH_DELIVERY_ENABLED:'on',...await keys()};
 await handle(request('/subscribe','alice',{subscription:await subscription()}),{...env,DB});
 alarm=null;let calls=0;const retry=Date.now()+90000;
 await runAlarm(storage,env,async()=>{calls++;DB.sqlite.prepare('UPDATE deliveries SET due=?').run(retry);});
 assert.equal(calls,1);assert.equal(alarm,retry);
 alarm=null;await runAlarm(storage,{...env,SLR_PUSH_DELIVERY_ENABLED:'off'},async()=>calls++);assert.equal(alarm,null);assert.equal(calls,1);
 DB.sqlite.prepare("UPDATE deliveries SET status='sent'").run();await runAlarm(storage,env,async()=>calls++);assert.equal(alarm,null);
 await runAlarm(storage,{...env,SLR_PUSH_DB:{prepare(){throw Error('temporary outage');}}},async()=>{});assert.ok(alarm>=Date.now()+59000);
 let kicked=0;env.SLR_DELIVERY={idFromName:name=>name,get(){return {fetch:async()=>{kicked++;return new Response(null,{status:204});}};}};
 await kickDelivery(env);assert.equal(kicked,0);DB.sqlite.prepare("UPDATE deliveries SET status='pending'").run();await kickDelivery(env);assert.equal(kicked,1);
});
