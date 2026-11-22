import {command,normalizeMix,memberKey} from './model.mjs';
import {APP} from '../push/delivery.mjs';
import {kickDelivery} from '../push/scheduler.mjs';
const ORIGIN='https://labrats.saltyviewfinder.com';
const headers={'access-control-allow-origin':ORIGIN,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'Content-Type','cache-control':'private, no-store','vary':'Origin','x-content-type-options':'nosniff'};
const reply=(data,status=200)=>Response.json(data,{status,headers});
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
async function input(request){
  const reader=request.body?.getReader(),chunks=[];let size=0;
  if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();fail('Request too large',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||typeof data!=='object'||Array.isArray(data))fail('Invalid JSON');return data;}catch{fail('Invalid JSON');}
}
export async function progressRows(db){
  if(!db)return [];
  return (await stmt(db,`SELECT r.subject,COUNT(*) AS completed,
    SUM(CASE WHEN EXISTS(SELECT 1 FROM slr_mix_results other WHERE other.experiment_id=r.experiment_id AND other.subject<>r.subject) THEN 1 ELSE 0 END) AS shared
    FROM slr_mix_results r GROUP BY r.subject`).all()).results;
}
export async function mixProfile(db,member,active){
  if(!db)return {mixProgress:{},rewardHistory:[],mixRevision:0};
  const [rows,history]=await Promise.all([progressRows(db),stmt(db,'SELECT badge_id AS badgeId,rank,xp,created FROM slr_reward_history WHERE subject=? ORDER BY created DESC,badge_id LIMIT 50',member.subject).all()]);
  const subjects=new Map([...active.values()].map(entry=>[entry.subject,memberKey(entry.name)]));
  const mixProgress={};for(const row of rows){const key=subjects.get(row.subject);if(key)mixProgress[key]={completed:Number(row.completed),shared:Number(row.shared)};}
  return {mixProgress,rewardHistory:history.results,mixRevision:rows.reduce((sum,row)=>sum+Number(row.completed),0)};
}
async function awardMixes(env,subjects,priority){
  const db=env.SLR_PUSH_DB,rows=await progressRows(db),now=Date.now(),owners=[...subjects];if(!owners.length)return;
  const history=(await stmt(db,`SELECT h.subject,h.badge_id,h.created,e.id AS event_id FROM slr_reward_history h LEFT JOIN events e ON e.id=('achievement:'||h.subject||':'||h.badge_id||':1') WHERE h.subject IN (${owners.map(()=>'?').join(',')})`,...owners).all()).results;
  const existing=new Map(history.map(row=>[row.subject+'|'+row.badge_id,row])),commands=[];let awards=0;
  for(const row of rows.filter(row=>subjects.has(row.subject)).sort((a,b)=>Number(b.subject===priority)-Number(a.subject===priority))){
    for(const [id,value,threshold,xp]of [['mix-first-blend',row.completed,1,25],['mix-notes',row.completed,5,35],['mix-shared-bench',row.shared,1,25]]){
      const prior=existing.get(row.subject+'|'+id);if(value<threshold||prior?.event_id||awards>=10)continue;
      const created=prior?.created||now,eventId=`achievement:${row.subject}:${id}:1`;awards++;
      commands.push(stmt(db,'INSERT OR IGNORE INTO slr_reward_history(subject,badge_id,rank,xp,created) VALUES(?,?,1,?,?)',row.subject,id,xp,created));
      commands.push(stmt(db,"INSERT OR IGNORE INTO events(id,app,subject,category,created) VALUES(?,?,?,'achievement',?)",eventId,APP,row.subject,created));
      commands.push(stmt(db,`INSERT OR IGNORE INTO deliveries(event_id,subscription_id,due) SELECT e.id,s.id,? FROM events e JOIN subscriptions s ON s.app=e.app AND s.subject=e.subject WHERE e.id=? AND s.created<=e.created AND s.achievement_enabled=1`,now,eventId));
    }
  }
  if(commands.length)await db.batch(commands);
  await kickDelivery(env);
}
async function hydrate(db,rows){
  if(!rows.length)return [];
  const ids=rows.map(row=>row.id),marks=ids.map(()=>'?').join(',');
  const [people,results]=await db.batch([
    stmt(db,`SELECT experiment_id,name FROM slr_mix_participants WHERE experiment_id IN (${marks}) ORDER BY rowid`,...ids),
    stmt(db,`SELECT experiment_id,name,overall,effects,notes,created FROM slr_mix_results WHERE experiment_id IN (${marks}) ORDER BY created`,...ids)
  ]);
  return rows.map(row=>({id:row.id,author:row.author_name,title:row.title,ingredients:JSON.parse(row.ingredients),created:new Date(row.created).toISOString(),participants:people.results.filter(p=>p.experiment_id===row.id).map(p=>p.name),observations:results.results.filter(r=>r.experiment_id===row.id).map(r=>({member:r.name,overall:r.overall,effects:JSON.parse(r.effects),notes:r.notes,created:new Date(r.created).toISOString()}))}));
}
async function record(db,id){return (await hydrate(db,[await stmt(db,'SELECT * FROM slr_mix_experiments WHERE id=?',id).first()].filter(Boolean)))[0];}
export async function experimentRoute(request,env,{activeMembers,loadCatalog}){
  const path=new URL(request.url).pathname;
  if(path!=='/experiments'&&!path.startsWith('/experiments/'))return null;
  if(request.headers.get('origin')!==ORIGIN)return reply({error:'Invalid app origin'},403);
  if(request.method==='OPTIONS')return new Response(null,{headers});
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  const action=path.slice('/experiments/'.length);
  if(!['list','get','create','result'].includes(action))return reply({error:'Not found'},404);
  try{
    const body=await input(request),active=await activeMembers(),member=typeof body.code==='string'?active.get(body.code.trim().toUpperCase()):null;
    if(!member?.subject)return reply({error:'Invalid or revoked invite code.',needsCode:true},401);
    const db=env.SLR_PUSH_DB;if(!db)fail('Mixes are temporarily unavailable. Your normal ratings are safe.',503);
    if(action==='get'){
      const id=body.data?.id;if(!/^mix_[a-f0-9]{64}$/.test(id||''))fail('Invalid mix.');
      const found=await record(db,id);if(!found)fail('This mix could not be found.',404);
      return reply({ok:true,viewer:member.name,record:found,...await mixProfile(db,member,active)});
    }
    if(action==='list'){
      const data=body.data||{};if(!['community','mine'].includes(data.scope||'community'))fail('Invalid journal view');
      const mine=data.scope==='mine';let cursor=null;
      if(data.cursor){try{cursor=JSON.parse(atob(data.cursor));}catch{fail('Invalid journal cursor');}if(!Array.isArray(cursor)||!Number.isSafeInteger(cursor[0])||!/^mix_[a-f0-9]{64}$/.test(cursor[1]||''))fail('Invalid journal cursor');}
      const conditions=[],args=[];
      if(mine){conditions.push('EXISTS(SELECT 1 FROM slr_mix_participants p WHERE p.experiment_id=e.id AND p.subject=?)');args.push(member.subject);}
      if(cursor){conditions.push('(e.created<? OR (e.created=? AND e.id<?))');args.push(cursor[0],cursor[0],cursor[1]);}
      const rows=(await stmt(db,`SELECT e.* FROM slr_mix_experiments e ${conditions.length?'WHERE '+conditions.join(' AND '):''} ORDER BY e.created DESC,e.id DESC LIMIT 26`,...args).all()).results;
      const page=rows.slice(0,25),last=page.at(-1);
      return reply({ok:true,viewer:member.name,records:await hydrate(db,page),nextCursor:rows.length>25?btoa(JSON.stringify([last.created,last.id])):null,...await mixProfile(db,member,active)});
    }
    let parsed;try{parsed=command(body.data,{recipe:action==='create'});}catch(error){fail(error.message);}
    const {operationId,data}=parsed,requestHash=await hash(JSON.stringify(data));
    let id;
    if(action==='create'){
      id='mix_'+await hash(member.subject+'|'+operationId);
      const prior=await stmt(db,'SELECT request_hash FROM slr_mix_experiments WHERE id=? AND author_subject=?',id,member.subject).first();
      if(prior){if(prior.request_hash!==requestHash)fail('This save ID was already used. Reopen your draft.',409);}
      else{
        const roster=new Map([...active.values()].map(entry=>[memberKey(entry.name),entry]));
        const selected=[member,...data.participants.filter(name=>name!==memberKey(member.name)).map(name=>roster.get(name))];
        if(selected.some(entry=>!entry))fail('A selected Lab Rat is no longer active.');
        const participants=[...new Map(selected.map(entry=>[entry.subject,entry])).values()];
        const catalog=await loadCatalog();let ingredients;try{ingredients=normalizeMix(data.ingredients,catalog);}catch(error){fail(error.message);}
        const now=Date.now(),title=data.title||ingredients.map(row=>row.name).join(' + ').slice(0,80);
        const commands=[stmt(db,'INSERT INTO slr_mix_experiments(id,author_subject,author_name,operation_id,request_hash,title,ingredients,created) VALUES(?,?,?,?,?,?,?,?)',id,member.subject,member.name,operationId,requestHash,title,JSON.stringify(ingredients),now),
          ...participants.map(entry=>stmt(db,'INSERT INTO slr_mix_participants(experiment_id,subject,name) VALUES(?,?,?)',id,entry.subject,entry.name)),
          stmt(db,'INSERT INTO slr_mix_results(experiment_id,subject,name,operation_id,request_hash,overall,effects,notes,created) VALUES(?,?,?,?,?,?,?,?,?)',id,member.subject,member.name,operationId,requestHash,data.overall,JSON.stringify(data.effects),data.notes,now)];
        try{await db.batch(commands);}catch(error){const raced=await stmt(db,'SELECT request_hash FROM slr_mix_experiments WHERE id=? AND author_subject=?',id,member.subject).first();if(!raced||raced.request_hash!==requestHash)throw error;}
      }
    }else{
      id=data.experimentId;
      if(!await stmt(db,'SELECT 1 FROM slr_mix_participants WHERE experiment_id=? AND subject=?',id,member.subject).first())fail('Only a participating Lab Rat can add a result.',403);
      const prior=await stmt(db,'SELECT request_hash,operation_id FROM slr_mix_results WHERE experiment_id=? AND subject=?',id,member.subject).first();
      if(prior){if(prior.operation_id!==operationId||prior.request_hash!==requestHash)fail('Your result is already saved for this mix.',409);}
      else{
        try{await stmt(db,'INSERT INTO slr_mix_results(experiment_id,subject,name,operation_id,request_hash,overall,effects,notes,created) VALUES(?,?,?,?,?,?,?,?,?)',id,member.subject,member.name,operationId,requestHash,data.overall,JSON.stringify(data.effects),data.notes,Date.now()).run();}
        catch(error){const raced=await stmt(db,'SELECT request_hash,operation_id FROM slr_mix_results WHERE experiment_id=? AND subject=?',id,member.subject).first();if(!raced||raced.operation_id!==operationId||raced.request_hash!==requestHash)throw error;}
      }
    }
    const people=(await stmt(db,'SELECT subject FROM slr_mix_results WHERE experiment_id=?',id).all()).results;
    // Optional delivery cannot turn a committed mix into an apparent failed save.
    await awardMixes(env,new Set(people.map(row=>row.subject)),member.subject).catch(()=>{});
    return reply({ok:true,viewer:member.name,record:await record(db,id),...await mixProfile(db,member,active)});
  }catch(error){return reply({error:error.status?error.message:'Mixes could not be loaded or saved. Keep your draft and try again.'},error.status||503);}
}
