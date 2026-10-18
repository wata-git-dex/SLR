import {kickDelivery} from './scheduler.mjs';
import '../achievements.js';
import {handle,APP,drain} from './delivery.mjs';
const ORIGIN='https://labrats.saltyviewfinder.com';
const headers={'access-control-allow-origin':ORIGIN,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'Content-Type','cache-control':'private, no-store','vary':'Origin'};
const response=(data,status)=>Response.json(data,{status,headers});
const routes=new Set(['state','subscribe','unsubscribe','remove-device','preferences','test','read']);
export async function notificationRoute(request,env,authorize){
  const path=new URL(request.url).pathname;
  if(!path.startsWith('/notifications/'))return null;
  if(request.headers.get('origin')!==ORIGIN)return response({error:'Invalid app origin'},403);
  if(request.method==='OPTIONS')return new Response(null,{headers});
  if(request.method!=='POST')return response({error:'Method not allowed'},405);
  const action=path.slice('/notifications/'.length);
  if(!routes.has(action))return response({error:'Not found'},404);
  try{
    const reader=request.body?.getReader();let text='',size=0;const decoder=new TextDecoder();
    if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4608){await reader.cancel();return response({error:'Request too large'},413);}text+=decoder.decode(value,{stream:true});}
    text+=decoder.decode();const input=JSON.parse(text||'{}');
    const member=await authorize(input.code);
    if(!member?.subject)return response({error:'Invite code required',needsCode:true},401);
    // Never forward browser identity headers, app, content, event producer or destination.
    const internal=new Request('https://slr.internal/'+action,{method:action==='state'?'GET':'POST',headers:{'x-slr-app':APP,'x-slr-subject':member.subject},body:action==='state'?undefined:JSON.stringify(input.data||{})});
    const result=await handle(internal,{...env,DB:env.SLR_PUSH_DB});
    if(result.ok&&['subscribe','test','state'].includes(action))await kickDelivery(env);
    const outgoing=new Response(result.body,result);for(const [key,value]of Object.entries(headers))outgoing.headers.set(key,value);return outgoing;
  }catch(error){return response({error:error.status?error.message:'Notifications are temporarily unavailable'},error.status||503);}
}
const array=value=>{if(Array.isArray(value))return value;try{return JSON.parse(value||'[]');}catch{return [];}};
const effects=['Euphoric','Focused','Creative','Social','Giggly','Energized','Relaxed','CouchLocked','Hungry'];
const sides=['Sleepy','Anxious','Paranoid','Washed','KnockedOut','Dizzy','Headache'];
const dots=value=>String(value||'').split('🟢').length-1+String(value||'').split('🔴').length-1;
export function progressContext(data){
  const batches=new Map(data.batches.map(b=>[b.url,b])),strains=new Map(data.strains.map(s=>[s.url,s]));
  const sessions=[];
  data.sessions.forEach((session,index)=>{
    const names=array(session.Blazers).map(n=>String(n).trim()).filter(Boolean),when=Date.parse(session.Date||'');
    const legacy=Number.isFinite(when)?when<Date.parse('2026-08-21T17:34:17Z'):Object.hasOwn(session,'MotivatedLegacy');
    for(const batchUrl of array(session.Batch)){
      const batch=batches.get(batchUrl),strain=batch&&strains.get(batch.Strain);if(!strain)continue;
      const n=Number(session.OverallRating);
      sessions.push({id:session.url||`session-${index}`,date:session.Date||batch.Date||'',members:names.length?names:legacy?['Cyrus','Amber']:['Cyrus'],strainId:strain.url,strainName:strain.Name,overall:Number.isInteger(n)&&n>=1&&n<=5?n:null,type:batch.Type,brand:batch.Brand,terpenes:array(batch.Terps),thc:batch.THC,effects:Object.fromEntries(effects.map(k=>[k,dots(session[k])])),sideEffects:Object.fromEntries(sides.map(k=>[k,dots(session[k])]))});
    }
  });
  return {sessions,trackedTerpenes:data.terpenes?.length?data.terpenes.map(t=>t.Name||t.name):[...new Set(data.batches.flatMap(b=>array(b.Terps)))]};
}
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
export async function markAchievementSave(env,subject,sessionId){
  if(env.SLR_PUSH_DB&&subject&&/^[a-f0-9-]{32,36}$/i.test(sessionId||''))await stmt(env.SLR_PUSH_DB,'INSERT OR IGNORE INTO achievement_receipts(subject,session_id) VALUES(?,?)',subject,sessionId.replace(/-/g,'')).run();
}
export async function reconcileProgress(env,member,data){
  const db=env.SLR_PUSH_DB,subject=member.subject;if(!db||!subject)return;
  const result=globalThis.SLRAchievements.calculateMember(progressContext(data),member.name);
  const current=Object.fromEntries(result.achievements.map(a=>[a.id,a.rank]));
  const old=await stmt(db,'SELECT * FROM achievement_progress WHERE subject=?',subject).first();
  if(!old){await stmt(db,'INSERT OR IGNORE INTO achievement_progress(subject,ranks) VALUES(?,?)',subject,JSON.stringify(current)).run();return;}
  const receipts=(await stmt(db,'SELECT session_id FROM achievement_receipts WHERE subject=?',subject).all()).results;
  const visible=new Set(data.sessions.map(session=>String(session.url||'').split('/').pop().replace(/-/g,'')));
  if(receipts.some(row=>!visible.has(row.session_id)))return; // Notion query visibility may lag a committed save.
  const previous=JSON.parse(old.ranks),high={...previous};
  for(const [id,rank]of Object.entries(current))high[id]=Math.max(previous[id]||0,rank);
  const commands=[];const now=Date.now();
  // Data arrived from the authorized Notion read following a confirmed server save.
  // Historical catalog/ratings edits and first launch only establish a baseline.
  if(receipts.length)for(const [id,rank]of Object.entries(current))if(rank>(previous[id]||0)){
    const eventId=`achievement:${subject}:${id}:${rank}`;
    commands.push(stmt(db,`INSERT OR IGNORE INTO events(id,app,subject,category,created) SELECT ?,?,?,'achievement',? WHERE EXISTS(SELECT 1 FROM achievement_progress WHERE subject=? AND revision=?)`,eventId,APP,subject,now,subject,old.revision));
    commands.push(stmt(db,`INSERT OR IGNORE INTO deliveries(event_id,subscription_id,due) SELECT e.id,s.id,? FROM events e JOIN subscriptions s ON s.app=e.app AND s.subject=e.subject WHERE e.id=? AND e.app=? AND e.subject=? AND s.created<=e.created AND s.achievement_enabled=1`,now,eventId,APP,subject));
  }
  if(receipts.length)commands.push(stmt(db,`DELETE FROM achievement_receipts WHERE subject=? AND session_id IN (${receipts.map(()=>'?').join(',')}) AND EXISTS(SELECT 1 FROM achievement_progress WHERE subject=? AND revision=?)`,subject,...receipts.map(r=>r.session_id),subject,old.revision));
  commands.push(stmt(db,'UPDATE achievement_progress SET ranks=?,pending=0,revision=revision+1 WHERE subject=? AND revision=?',JSON.stringify(high),subject,old.revision));
  await db.batch(commands);
  if(receipts.length)await kickDelivery(env);
}
export async function drainAuthorized(env,activeMembers){
  if(!env.SLR_PUSH_DB)return;
  // Recheck revoked invites before dispatch, independently of the read cache.
  const active=new Set([...activeMembers.values()].map(member=>member.subject));
  await drain({...env,DB:env.SLR_PUSH_DB},fetch,Date.now(),async subject=>active.has(subject));
}
