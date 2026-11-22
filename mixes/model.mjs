export function normalizeMix(ingredients,catalog){
  if(!Array.isArray(ingredients)||ingredients.length<2||ingredients.length>4)throw Error('Choose 2–4 strains for your experiment.');
  const seen=new Set(),rows=ingredients.map(item=>{
    const batch=catalog.find(batch=>batch.id===item.batchId);
    if(!batch)throw Error('Choose a strain for every component.');
    if(seen.has(batch.id))throw Error('That batch is already in the mix. Choose a different batch.');
    seen.add(batch.id);
    return {batchId:batch.id,strainId:batch.strainId,name:batch.name,brand:batch.brand,family:batch.family||'Hybrid'};
  });
  return rows.map(row=>({...row,share:1/rows.length}));
}
function observation(input,member){
  const overall=input.overall==null?null:Number(input.overall);
  if(overall!==null&&(!Number.isInteger(overall)||overall<1||overall>5))throw Error('Choose 1–5 stars, or leave the overall rating blank.');
  const effects=Object.fromEntries(Object.entries(input.effects||{}).map(([name,value])=>{
    if(!Number.isInteger(value)||value<0||value>2)throw Error('Effect strength must be blank, noticeable or strong.');
    return [name,value];
  }));
  return {member,overall,effects,notes:String(input.notes||'').trim().slice(0,500)};
}
export function makeExperiment(input,catalog,members=[input.author]){
  const ingredients=normalizeMix(input.ingredients,catalog);
  const participants=[...new Set([input.author,...(input.participants||[])])];
  if(!input.author||participants.some(member=>!members.includes(member)))throw Error('Choose active Lab Rats for this experiment.');
  return {id:input.id,author:input.author,participants,title:String(input.title||'').trim().slice(0,80)||ingredients.map(row=>row.name).join(' + '),ingredients,observations:[observation(input,input.author)],created:input.created};
}
export function addObservation(record,member,input){
  if(!record.participants.includes(member))throw Error('Only a participating Lab Rat can add their result.');
  return {...record,observations:[...record.observations.filter(result=>result.member!==member),observation(input,member)]};
}
export function experimentProgress(records,member){
  const completed=records.filter(record=>record.observations.some(result=>result.member===member));
  const shared=completed.filter(record=>record.observations.length>=2).length;
  const badges=[{id:'first-blend',name:'First blend',threshold:1,value:completed.length,xp:25},{id:'mix-notes',name:'Mix notes',threshold:5,value:completed.length,xp:35},{id:'shared-bench',name:'Shared bench',threshold:1,value:shared,xp:25}].map(badge=>({...badge,earned:badge.value>=badge.threshold}));
  return {completed:completed.length,activityXp:completed.length*10,badges,totalXp:completed.length*10+badges.filter(badge=>badge.earned).reduce((sum,badge)=>sum+badge.xp,0)};
}

export const EFFECT_KEYS=['Euphoric','Focused','Creative','Social','Giggly','Energized','Relaxed','CouchLocked','Hungry','Sleepy','Anxious','Paranoid','Washed','KnockedOut','Dizzy','Headache'];
export const memberKey=value=>String(value||'').trim().toLowerCase();
export function command(input,{recipe=true}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid experiment.');
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.operationId||''))throw Error('A save ID is required. Reopen your draft.');
  const overall=input.overall==null?null:input.overall;
  if(overall!==null&&(!Number.isInteger(overall)||overall<1||overall>5))throw Error('Choose 1–5 stars or leave the rating blank.');
  if(input.effects&&(!Object.keys(input.effects).every(key=>EFFECT_KEYS.includes(key))))throw Error('Unknown effect.');
  const effects=Object.fromEntries(EFFECT_KEYS.map(key=>{const value=input.effects?.[key]??0;if(!Number.isInteger(value)||value<0||value>2)throw Error('Invalid effect strength.');return [key,value];}));
  if(typeof (input.notes??'')!=='string'||String(input.notes||'').length>500)throw Error('Keep notes under 500 characters.');
  const data={overall,effects,notes:(input.notes||'').trim()};
  if(recipe){
    if(!Array.isArray(input.ingredients)||input.ingredients.length<2||input.ingredients.length>4)throw Error('Choose 2–4 strains.');
    const ingredients=input.ingredients.map(row=>({batchId:String(row?.batchId||'')}));
    if(ingredients.some(row=>!/^https:\/\/app\.notion\.com\/[a-f0-9]{32}$/i.test(row.batchId))||new Set(ingredients.map(row=>row.batchId)).size!==ingredients.length)throw Error('Choose different valid batches.');
    if(typeof(input.title??'')!=='string'||(input.title||'').length>80)throw Error('Keep the name under 80 characters.');
    if(!Array.isArray(input.participants||[])||(input.participants||[]).length>11||(input.participants||[]).some(name=>typeof name!=='string'||!name.trim()||name.length>80))throw Error('Choose active Lab Rats.');
    Object.assign(data,{title:(input.title||'').trim(),ingredients,participants:[...new Set((input.participants||[]).map(memberKey))].sort()});
  }else if(!/^mix_[a-f0-9]{64}$/.test(input.experimentId||''))throw Error('Choose an existing mix.');
  else data.experimentId=input.experimentId;
  return {operationId:input.operationId.toLowerCase(),data};
}
