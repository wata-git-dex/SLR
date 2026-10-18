import { buildPushPayload } from '@block65/webcrypto-web-push';
export const APP = 'stoned-lab-rats';
const headers = {'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const reply = (data,status=200) => Response.json(data,{status,headers});
const fail = (message,status=400) => {throw Object.assign(new Error(message),{status});};
export function validEndpoint(value) {
  try { const u=new URL(value); return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&
    (u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com')); } catch {return false;}
}
export function validSubscription(s) {
  const key=(v,n)=>typeof v==='string'&&/^[\w-]+$/.test(v)&&Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)).length===n;
  try {return typeof s?.endpoint==='string'&&s.endpoint.length<2048&&validEndpoint(s.endpoint)&&key(s.keys?.p256dh,65)&&key(s.keys?.auth,16);}catch{return false;}
}
const statement=(db,sql,...args)=>db.prepare(sql).bind(...args);
async function body(request) {
  // Streaming limit also covers chunked requests without Content-Length.
  const reader=request.body?.getReader(); if(!reader)return {};
  const chunks=[]; let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();fail('Request too large',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||typeof data!=='object'||Array.isArray(data))fail('Invalid JSON');return data;}catch{fail('Invalid JSON');}
}
export async function emit(db,subject,id,category,now=Date.now()) {
  // Call only after the owning producer has authorized its recipient. No browser emitter.
  await db.batch([
    statement(db,'INSERT OR IGNORE INTO events(id,app,subject,category,created) VALUES(?,?,?,?,?)',id,APP,subject,category,now),
    statement(db,`INSERT OR IGNORE INTO deliveries(event_id,subscription_id,due)
      SELECT e.id,s.id,? FROM events e JOIN subscriptions s ON s.app=e.app AND s.subject=e.subject
      WHERE s.created<=e.created AND e.id=? AND e.subject=? AND e.app=? AND (e.category='test' OR (e.category='account' AND s.account_enabled=1) OR (e.category='achievement' AND s.achievement_enabled=1))`,now,id,subject,APP)
  ]);
}
export async function handle(request,env) {
  // Internal handler: the SLR gateway must validate the invite and construct these headers.
  const subject=request.headers.get('x-slr-subject');
  if(request.headers.get('x-slr-app')!==APP||!subject||! /^[a-zA-Z0-9-]{1,128}$/.test(subject))return reply({error:'Unauthorized'},401);
  if(!env.DB||!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY)return reply({error:'Device notification service is not configured'},503);
  const db=env.DB,path=new URL(request.url).pathname,now=Date.now();
  if(request.method==='GET'&&path==='/state') {
    const [events,devices,count]=await Promise.all([
      statement(db,'SELECT id,category,created,read_at FROM events WHERE app=? AND subject=? ORDER BY (read_at IS NOT NULL),created DESC LIMIT 50',APP,subject).all(),
      statement(db,'SELECT id,account_enabled,achievement_enabled,created,updated FROM subscriptions WHERE app=? AND subject=? ORDER BY created DESC',APP,subject).all(),
      statement(db,'SELECT count(*) AS unread FROM events WHERE app=? AND subject=? AND read_at IS NULL',APP,subject).first()
    ]);
    return reply({publicKey:env.VAPID_PUBLIC_KEY,events:events.results,devices:devices.results,unread:count.unread});
  }
  if(request.method!=='POST')return reply({error:'Not found'},404);
  const data=await body(request);
  if(path==='/subscribe') {
    if(!validSubscription(data.subscription))fail('Invalid push subscription');
    const s=data.subscription;
    const owner=await statement(db,'SELECT id,subject FROM subscriptions WHERE endpoint=?',s.endpoint).first();
    if(owner&&owner.subject!==subject)fail('Disable the previous account’s device subscription first',409);
    const count=await statement(db,'SELECT count(*) AS total FROM subscriptions WHERE app=? AND subject=?',APP,subject).first();
    if(!owner&&count.total>=20)fail('Remove an old device before registering another',409);
    const id=owner?.id||crypto.randomUUID();
    await statement(db,`INSERT INTO subscriptions(id,app,subject,endpoint,p256dh,auth,created,updated) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,updated=excluded.updated WHERE subject=excluded.subject AND app=excluded.app`,id,APP,subject,s.endpoint,s.keys.p256dh,s.keys.auth,now,now).run();
    const saved=await statement(db,'SELECT id,created FROM subscriptions WHERE endpoint=? AND subject=? AND app=?',s.endpoint,subject,APP).first();
    if(!saved)fail('Subscription belongs to another account',409);
    await emit(db,subject,`device:${saved.id}`,'account',saved.created);
    return reply({id:saved.id});
  }
  if(path==='/unsubscribe') {
    if(typeof data.endpoint!=='string')fail('Endpoint required');
    await statement(db,'DELETE FROM subscriptions WHERE app=? AND subject=? AND endpoint=?',APP,subject,data.endpoint).run();return reply({ok:true});
  }
  if(path==='/preferences') {
    if(typeof data.id!=='string'||typeof data.account!=='boolean'||typeof data.achievements!=='boolean')fail('Invalid preference');
    await statement(db,'UPDATE subscriptions SET account_enabled=?,achievement_enabled=? WHERE app=? AND subject=? AND id=?',Number(data.account),Number(data.achievements),APP,subject,data.id).run();return reply({ok:true});
  }
  if(path==='/remove-device') {
    if(typeof data.id!=='string')fail('Device required');
    await statement(db,'DELETE FROM subscriptions WHERE app=? AND subject=? AND id=?',APP,subject,data.id).run();return reply({ok:true});
  }
  if(path==='/read') {
    if(!Array.isArray(data.ids)||data.ids.length>50||data.ids.some(id=>typeof id!=='string'||id.length>150))fail('Invalid event IDs');
    if(data.ids.length)await statement(db,`UPDATE events SET read_at=? WHERE app=? AND subject=? AND id IN (${data.ids.map(()=>'?').join(',')})`,now,APP,subject,...data.ids).run();
    return reply({ok:true});
  }
  if(path==='/test') {
    // A fixed per-minute key makes retries/races idempotent and limits self-test traffic.
    const id=`test:${subject}:${Math.floor(now/60000)}`;
    const count=await statement(db,'SELECT count(*) AS total FROM subscriptions WHERE app=? AND subject=?',APP,subject).first();
    if(!count.total)fail('Enable a device first',409);
    await emit(db,subject,id,'test',now);return reply({queued:true,id});
  }
  return reply({error:'Not found'},404);
}
export async function drain(env,send=fetch,now=Date.now(),authorized=async()=>false) {
  if(!env.DB||!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY)return;
  const db=env.DB;
  const rows=(await statement(db,`SELECT d.event_id,d.subscription_id FROM deliveries d WHERE d.status='pending' AND d.due<=? AND d.attempts<5 ORDER BY d.due LIMIT 25`,now).all()).results;
  for(const row of rows) {
    const lease=crypto.randomUUID();
    const claimed=await statement(db,`UPDATE deliveries SET lease=?,attempts=attempts+1,due=? WHERE event_id=? AND subscription_id=? AND status='pending' AND due<=? AND attempts<5 RETURNING attempts`,lease,now+120000,row.event_id,row.subscription_id,now).first();
    if(!claimed)continue;
    const item=await statement(db,`SELECT s.*,e.category,e.read_at FROM subscriptions s JOIN events e ON e.id=? AND e.app=s.app AND e.subject=s.subject WHERE s.id=?`,row.event_id,row.subscription_id).first();
    if(!item)continue;
    if(!await authorized(item.subject)){await statement(db,'DELETE FROM subscriptions WHERE app=? AND subject=?',APP,item.subject).run();continue;}
    if(item.read_at!==null||(item.category==='account'&&!item.account_enabled)||(item.category==='achievement'&&!item.achievement_enabled)){
      await statement(db,"UPDATE deliveries SET status='sent' WHERE event_id=? AND subscription_id=? AND lease=?",row.event_id,row.subscription_id,lease).run();continue;
    }
    const count=await statement(db,'SELECT count(*) AS unread FROM events WHERE app=? AND subject=? AND read_at IS NULL',APP,item.subject).first();
    let status=0,retryAfter=0;
    try {
      if(!validEndpoint(item.endpoint))status=410;
      else {
        const payload=await buildPushPayload({data:JSON.stringify({id:row.event_id,category:item.category,unread:count.unread,url:'/#notifications'}),options:{ttl:300,urgency:'normal'}},
          {endpoint:item.endpoint,keys:{p256dh:item.p256dh,auth:item.auth}},
          {publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY,subject:'https://labrats.saltyviewfinder.com'});
        const response=await send(item.endpoint,{...payload,redirect:'manual',signal:AbortSignal.timeout(10000)});status=response.status;
        const retry=response.headers.get('retry-after');retryAfter=Number(retry)*1000||Math.max(0,Date.parse(retry)-now)||0;
      }
    }catch{/* Retry without logging endpoint, keys or private content. */}
    if(status===404||status===410){await statement(db,'DELETE FROM subscriptions WHERE id=?',item.id).run();continue;}
    const success=status>=200&&status<300,retryable=status===0||status===408||status===429||status>=500;
    const state=success?'sent':(!retryable||claimed.attempts>=5)?'failed':'pending';
    const due=now+Math.max(retryAfter,60000*2**(claimed.attempts-1)+Math.floor(Math.random()*15000));
    await statement(db,'UPDATE deliveries SET status=?,due=?,lease=NULL WHERE event_id=? AND subscription_id=? AND lease=?',state,due,row.event_id,row.subscription_id,lease).run();
  }
  // Expired final leases must not stay pending forever after a worker crash.
  await statement(db,"UPDATE deliveries SET status='failed' WHERE status='pending' AND attempts>=5 AND due<=?",now).run();
}
