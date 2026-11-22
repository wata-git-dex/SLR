import {command} from "./model.mjs?v=2.7.0";
import {MixClient} from "./client.mjs?v=2.7.0";
(()=>{
  const client=new MixClient({api:WORKER_URL,code:getStoredCode,member:()=>CURRENT_MEMBER,writer:slrWrite,verified:()=>getStoredCode()===SLR_VERIFIED_CODE});
  let catalog=[],roster=[],components=[{batchId:''},{batchId:''}],people=[],stars=null,signals={},view='community',records=[],nextCursor=null,operationId=crypto.randomUUID(),activeRecord=null,busy=false,readOnly=false,stateIdentity=client.identity(),draftTimer;
  function refreshCatalog(){
    catalog=RAW_BATCHES.map(batch=>{const strain=RAW_STRAINS.find(strain=>strain.url===batch.Strain);return strain?{id:batch.url,strainId:strain.url,name:strain.Name,brand:batch.Brand||'Unknown brand',family:SLRAchievements.typeFamily(batch.Type)||'Hybrid',thc:batch.THC}:null;}).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name)||a.brand.localeCompare(b.brand));
    roster=[...new Set([CURRENT_MEMBER,...RAW_MEMBERS].filter(Boolean))];
  }
  const mixIcon='<svg class="expMixGlyph" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 16h24c-1 8-5 12-12 12S5 24 4 16Zm6 13h12M14 16 24 3a2.5 2.5 0 0 1 4 3L20 16"/><path d="M7 21c5 3 13 3 18 0M5 7c5-1 8 2 8 6-5 0-8-2-8-6Zm2 2 4 3"/></svg>';
  const flask='<span class="expMixMark">'+mixIcon+'</span>' ;
  const panel=document.createElement('section');panel.className='labPanel expPanel';panel.dataset.labPanel='mixes';panel.innerHTML=`
  <div class="expIntro">${flask}<div><div class="expEyebrow">The Lab · Mixing bench</div><h3>Experiments</h3></div></div>
  <section class="expBench"><div class="expBenchTop" id="expStart"><div><h4>What’s in Your Mix?</h4><p>Choose your strains, add your crew, then use the familiar Blaze ratings.</p></div><button class="expButton primary" id="expNew">＋ New Experiment</button></div>
  <section class="expForm" id="expForm" aria-label="Build an experiment" hidden>
    <div class="expStep"><h4>01 · Choose Your Components</h4><small>Always split evenly.</small></div>
    <div id="expComponents"></div><div class="expComponentActions"><button class="expQuiet" id="expAdd">＋ Add a strain</button><span class="expHelp">2–4 strains · equal mix</span></div>
    <div class="expBlendBar" id="expBlendBar" aria-hidden="true"></div><div class="expBlendLabel" id="expBlendLabel">Choose at least two strains to see your mix.</div>
    <div class="expStep"><h4>02 · Who’s at the Bench?</h4><small>One recipe. Your own ratings.</small></div>
    <div class="expPeople" id="expPeople"></div><div class="expSelectWrap"><select class="expPeopleSelect" id="expPeopleSelect" aria-label="Add another Lab Rat"></select><span aria-hidden="true">⌄</span></div><p class="expHelp">Each Rat adds their own result. Adding someone doesn’t rate it for them.</p>
    <div class="expStep"><h4>03 · Your Result</h4><small>Only rates this blend.</small></div>
    <label class="expField">Experiment name · optional<input type="text" id="expName" maxlength="80" placeholder="e.g. Tangrini × Lemon Sorbet"></label>
    <div class="overall-box"><div class="eff-section-lbl" style="margin-top:0;color:var(--green)">Overall — optional</div><div class="log-hint">Tap 1–5 stars for how you rate the blend. Effects stay separate.</div><div class="overall-grid" id="expRating" role="group" aria-label="Your overall mix rating"></div><div class="overall-readout"><b id="expRatingReadout">No overall rating</b><button class="overall-clear" id="expClearRating">Clear rating</button></div></div>
    <div class="eff-group pos"><div class="eff-section-lbl">🟢 Effects — tap to rate</div><div class="log-hint">– = none · 🟢 = noticeable · 🟢🟢 = strong</div><div class="eff-grid" id="expEffects"></div></div>
    <div class="eff-group neg"><div class="eff-section-lbl">🔴 Side Effects — tap to rate</div><div class="log-hint">– = none · 🔴 = noticeable · 🔴🔴 = strong</div><div class="eff-grid" id="expSideEffects"></div></div>
    <label class="expField">Your notes · optional<textarea id="expNotes" maxlength="500" placeholder="What stood out about this mix?"></textarea></label>
    <div class="expFormFoot"><small>Mix results stay out of regular strain ratings and Blaze sessions.</small><div><button class="expQuiet" id="expDiscard">Discard Draft</button> <button class="expQuiet" id="expCancel">Cancel</button> <button class="expButton primary" id="expSave">Save Mix</button></div></div>
  </section><div class="expNotice" id="expNotice" role="status" aria-live="polite"></div></section>
  <section class="expProgress" aria-label="Your overall Lab progress"><div class="expProgressHead"><div class="expProgressIdentity"><img id="expProgressAvatar" alt=""><div><h4>Your Lab Progress</h4><small id="expLevelLabel"></small></div></div><b id="expXp">0 XP</b></div><div class="expLevelMeter" id="expLevelMeter" role="progressbar" aria-label="Progress to next Lab level" aria-valuemin="0" aria-valuemax="100"><i></i></div><div class="expLevelFoot"><span id="expXpBreakdown"></span><span id="expNextLevel"></span></div><button class="expProfileLink" id="expProfileLink">View Profile &amp; Achievements <span aria-hidden="true">↗</span></button></section>
  <div class="expListHead"><h4>Mix Journal</h4><div class="expViews" role="group" aria-label="Experiment history"><button data-exp-view="community" class="on" aria-pressed="true">Community</button><button data-exp-view="mine" aria-pressed="false">My Mixes</button></div></div><div class="expHistory" id="expHistory"></div>
  <button class="expQuiet" id="expMore" hidden>Load More</button><section class="expDetail" id="expDetail" hidden aria-label="Mix details"></section>`;
  document.querySelector('.labHubBody').append(panel);document.querySelector('.labHub').classList.add('expReview');
  const tab=document.createElement('button');tab.className='labTab';tab.dataset.labTab='mixes';tab.dataset.wataMenuNav='';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.setAttribute('aria-label','Experiments');tab.textContent='Mixes';document.querySelector('.labTabs').insertBefore(tab,document.querySelector('[data-lab-tab="mine"]'));
  const navArtwork={crew:'<svg class="expCrewMark" viewBox="0 0 40 30" aria-hidden="true"><svg x="0" y="6" width="23" height="23" viewBox="54 154 404 326" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" opacity="0.72"><path d="M190 237c-27-56-58-86-90-66-53 32-24 113 52 117M322 237c27-56 58-86 90-66 53 32 24 113-52 117M158 209c22 32 9 58-6 79-29 48-9 75 45 104 17 9 20 36 25 49 8 19 58 19 67 0 5-13 8-40 25-49 54-29 74-56 45-104-15-21-28-47-6-79M190 237q66-45 132 0M256 432v24M247 424h18"/><path d="m183 356-68-1 70 17-59 6 65 5m138-27 68-1-70 17 59 6-65 5"/><path d="M181 296q35 19 47 53-39-2-47-53Zm150 0q-35 19-47 53 39-2 47-53Z" fill="currentColor" stroke="none"/></svg><svg x="17" y="1" width="23" height="23" viewBox="54 154 404 326" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" opacity="1"><path d="M190 237c-27-56-58-86-90-66-53 32-24 113 52 117M322 237c27-56 58-86 90-66 53 32 24 113-52 117M158 209c22 32 9 58-6 79-29 48-9 75 45 104 17 9 20 36 25 49 8 19 58 19 67 0 5-13 8-40 25-49 54-29 74-56 45-104-15-21-28-47-6-79M190 237q66-45 132 0M256 432v24M247 424h18"/><path d="m183 356-68-1 70 17-59 6 65 5m138-27 68-1-70 17 59 6-65 5"/><path d="M181 296q35 19 47 53-39-2-47-53Zm150 0q-35 19-47 53 39-2 47-53Z" fill="currentColor" stroke="none"/></svg></svg>',taste:'<svg class="expResultsMark" viewBox="0 0 28 28" aria-hidden="true"><rect x="2.5" y="3.5" width="23" height="21" rx="3"/><path d="M6 20h16M6 16h3l2-5 3 7 4-11 2 9h2M6.5 7.5h2"/><circle cx="22" cy="7.5" r=".8" fill="currentColor" stroke="none"/></svg>',tests:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 10l2 2 4-4m-6 9h8"/></svg>',mixes:mixIcon};
  document.querySelectorAll('.labTabs button').forEach(button=>{const label=button.textContent;button.innerHTML=(button.dataset.labTab==='mine'?'<span class="expMyLabMark" aria-hidden="true"></span>':navArtwork[button.dataset.labTab])+`<span>${safeHtml(label)}</span>`;});
  tab.addEventListener('click',()=>{setLabTab('mixes');refreshCatalog();renderProgress();void loadHistory();});
  const entry=document.createElement('button');entry.className='expEntry';entry.innerHTML='<span>Experiments<small>Mix strains, invite Lab Rats and record a separate result.</small></span><span aria-hidden="true">↗</span>';document.querySelector('.labHero').after(entry);entry.addEventListener('click',()=>tab.click());
  new MutationObserver(()=>{entry.hidden=document.querySelector('.labHub').dataset.view!=='crew';}).observe(document.querySelector('.labHub'),{attributes:true,attributeFilter:['data-view']});
  const byId=id=>document.getElementById(id);
  refreshCatalog();
  const choiceText=batch=>batch.name+' · '+batch.brand+(batch.thc!=null?' · '+Math.round(batch.thc*1000)/10+'%':'');
  const typeColor=family=>({Sativa:'var(--sativa)',Hybrid:'var(--hybrid)',Indica:'var(--indica)'})[family]||'var(--green)';
  function ingredientColor(rows,index){
    const batch=catalog.find(batch=>batch.id===(rows[index].batchId||rows[index].id));
    const family=rows[index].family||batch?.family,base=typeColor(family);
    const repeated=rows.slice(0,index).filter(row=>(row.family||catalog.find(batch=>batch.id===row.batchId)?.family)===family).length;
    return repeated?`color-mix(in srgb,${base} ${Math.max(65,100-repeated*12)}%,white)`:base;
  }
  function renderComponents(){
    byId('expComponents').innerHTML=components.map((component,index)=>`<div class="expIngredient" style="--component-color:${ingredientColor(components,index)}"><div class="expIngredientLabel"><label for="expBatch${index}">Strain ${index+1}</label><span>${components.length===3?'⅓ each':Math.round(100/components.length)+'% share'}</span></div><div class="expSelectWrap"><select ${activeRecord?'disabled':''} id="expBatch${index}" data-exp-batch="${index}"><option value="">Choose a strain…</option>${catalog.map(batch=>`<option value="${safeHtml(batch.id)}" ${batch.id===component.batchId?'selected':''} ${components.some((row,i)=>i!==index&&row.batchId===batch.id)?'disabled':''}>${safeHtml(choiceText(batch))}</option>`).join('')}</select><span aria-hidden="true">⌄</span></div>${components.length>2&&!activeRecord?`<button class="expRemove" data-exp-remove="${index}">Remove</button>`:''}</div>`).join('');
    byId('expAdd').disabled=components.length===4;byId('expAdd').hidden=Boolean(activeRecord);renderBlend();
  }
  function renderBlend(){
    byId('expBlendBar').innerHTML=components.map((row,index)=>`<i style="width:${100/components.length}%;background:${ingredientColor(components,index)};--blend-opacity:1"></i>`).join('');
    byId('expBlendLabel').textContent=components.every(row=>row.batchId)?(components.length===2?'50 / 50':components.length===3?'One third each':'25% each')+' · equal mix':'Equal shares — no measuring needed.';
  }
  function renderPeople(){
    const member=CURRENT_MEMBER;
    byId('expPeople').innerHTML=`<span class="expPerson">${safeHtml(displayName(member))} · You</span>`+people.map(name=>`<span class="expPerson">${safeHtml(displayName(name))}${!activeRecord?`<button data-exp-person="${safeHtml(name)}" aria-label="Remove ${safeHtml(name)}">×</button>`:''}</span>`).join('');
    byId('expPeopleSelect').hidden=Boolean(activeRecord);
    byId('expPeopleSelect').innerHTML='<option value="">＋ Add another Lab Rat</option>'+roster.filter(name=>name!==member&&!people.includes(name)).map(name=>`<option>${safeHtml(name)}</option>`).join('');
  }
  function renderRating(){
    const group=byId('expRating');
    if(!group.querySelector('button'))group.innerHTML=[1,2,3,4,5].map(number=>`<button class="overall-btn" data-exp-star="${number}" aria-label="${number} star${number===1?'':'s'}">☆</button>`).join('');
    group.querySelectorAll('button').forEach(button=>{const on=Number(button.dataset.expStar)<=(stars||0);button.classList.toggle('on',on);button.textContent=on?'★':'☆';button.setAttribute('aria-pressed',String(on));});
    byId('expRatingReadout').textContent=stars?stars+' of 5':'No overall rating';
  }
  function renderEffects(){
    for(const [target,names] of [['expEffects',EFFS_POS],['expSideEffects',EFFS_NEG]]){
      const group=byId(target),positive=target==='expEffects';
      if(!group.children.length)group.innerHTML=names.map(effect=>`<button class="eff-btn" data-exp-effect="${effect.key}"><span class="efi">${effect.emoji}</span>${effect.label}<span class="eval">–</span></button>`).join('');
      group.querySelectorAll('button').forEach(button=>{const value=signals[button.dataset.expEffect]||0;button.className='eff-btn'+(value?' '+(positive?'pos-':'neg-')+value:'');button.setAttribute('aria-pressed',String(value>0));button.querySelector('.eval').textContent=value?(positive?'🟢':'🔴').repeat(value):'–';});
    }
  }
  function renderProgress(){
    const progress=window.SLRLabAchievements.snapshot();if(!progress)return;
    byId('expXp').textContent=SLR_MIXES_AVAILABLE?progress.totalXp.toLocaleString()+' XP':'— XP';
    byId('expProgressAvatar').src=memberIconFor(CURRENT_MEMBER);
    byId('expLevelLabel').textContent='Level '+progress.level.level+' · '+progress.level.title;
    byId('expXpBreakdown').textContent=SLR_MIXES_AVAILABLE?'Sessions and Mixes · one XP total':'Mix progress is temporarily unavailable';
    byId('expNextLevel').textContent=progress.level.needed+' to Level '+(progress.level.level+1);
    byId('expLevelMeter').setAttribute('aria-valuenow',String(Math.round(progress.level.progress*100)));byId('expLevelMeter').querySelector('i').style.width=Math.round(progress.level.progress*100)+'%';
    window.SLRLabAchievements.updateProfileXp();
  }
  function renderHistory(){

    byId('expHistory').innerHTML=records.length?records.map((record,index)=>{
      const own=record.observations.find(result=>result.member.toLowerCase()===CURRENT_MEMBER.toLowerCase());
      const totals={};record.observations.forEach(row=>Object.entries(row.effects).forEach(([key,value])=>{totals[key]=(totals[key]||0)+value;}));
      const result=view==='mine'?(own||{effects:{}}):{effects:Object.fromEntries(Object.entries(totals).map(([key,value])=>[key,value/Math.max(1,record.observations.length)]).sort((a,b)=>b[1]-a[1]))};
      const ratings=record.observations.map(row=>row.overall).filter(value=>value!=null),score=view==='mine'?own?.overall:ratings.length?Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length*10)/10:null;
      const others=record.participants.filter(member=>!record.observations.some(result=>result.member===member));
      const effects=Object.entries(result.effects).filter(([,strength])=>strength>0).slice(0,3);
      const colors=record.ingredients.map((row,index)=>ingredientColor(record.ingredients,index));
      const resultLabel='By '+displayName(record.author);
      return `<article class="expRecord expCompact" style="--mix-start:${colors[0]};--mix-end:${colors.at(-1)};--mix-gradient:linear-gradient(120deg,${colors.join(',')})"><div class="expCardStripe" aria-hidden="true"></div><div class="expCompactTop"><h4>${safeHtml(record.title)}</h4><span class="expScore">${score?'★ '+score:'—'}</span></div><div class="expMiniRecipe">${record.ingredients.map((row,index)=>`<div style="--ingredient-color:${colors[index]}"><i aria-hidden="true"></i><span>${safeHtml(row.name)}<small>${safeHtml(row.brand)}</small></span><b>${record.ingredients.length===3?'⅓':Math.round(row.share*100)+'%'}</b></div>`).join('')}</div><div class="expCompactFoot"><span>${safeHtml(resultLabel)} · ${record.observations.length}/${record.participants.length} results</span><div>${effects.map(([name,strength])=>`<span title="${safeHtml(effectLabel(name))}: ${strength===2?'strong':'noticeable'}" aria-label="${safeHtml(effectLabel(name))}: ${strength===2?'strong':'noticeable'}">${EFFECT_ICON[name]||'·'}</span>`).join('')}</div></div><button class="expRecordAction" data-exp-open="${safeHtml(record.id)}">View Mix <span aria-hidden="true">↗</span></button></article>`;
    }).join(''):'<div class="expRecord"><h4>Your Bench Is Ready.</h4><p>Your experiments will appear here. Start with two strains, split evenly.</p></div>';
  }
  function notice(message){byId('expNotice').textContent=message;}
  function draftData(){return {operationId,ingredients:components,participants:people,title:byId('expName').value,overall:stars,effects:signals,notes:byId('expNotes').value,...(activeRecord?{experimentId:activeRecord.id}:{})};}
  function persist(){if(byId('expForm').hidden)return;try{client.persistSync(draftData());}catch{notice('Your draft could not be stored on this device. Keep this page open.');}}
  function scheduleDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(persist,200);}
  function resetForm(){components=[{batchId:''},{batchId:''}];people=[];stars=null;signals={};activeRecord=null;readOnly=false;operationId=crypto.randomUUID();byId('expName').value='';byId('expNotes').value='';}
  async function openBuilder(record=null){
    try{
      if(!client.verified())throw Error('Wait for your Lab profile to finish loading.');
      await client.prepareScope();refreshCatalog();
      const existing=await client.draft();if(record&&existing&&existing.experimentId!==record.id)throw Error('Resume or discard your unfinished mix before adding another result.');
      resetForm();const draft=record?null:existing;
      if(record)activeRecord=record;
      if(draft){
        if(draft.experimentId)activeRecord=records.find(row=>row.id===draft.experimentId)||(await client.request('get',{id:draft.experimentId})).record;
        operationId=draft.operationId||crypto.randomUUID();components=draft.ingredients||components;people=draft.participants||[];stars=draft.overall??null;signals=draft.effects||{};byId('expName').value=draft.title||'';byId('expNotes').value=draft.notes||'';
      }
      if(activeRecord){components=activeRecord.ingredients.map(row=>({batchId:row.batchId}));people=activeRecord.participants.filter(name=>name.toLowerCase()!==CURRENT_MEMBER.toLowerCase());byId('expName').value=activeRecord.title;}
      byId('expName').disabled=Boolean(activeRecord);byId('expDetail').hidden=true;byId('expForm').hidden=false;byId('expStart').hidden=true;notice(draft?'Draft restored.':'');renderComponents();renderPeople();renderRating();renderEffects();
      client.persistSync(draftData());byId(activeRecord?'expRating':'expBatch0').scrollIntoView({block:'center'});
    }catch(error){notice(error.message);}
  }
  function closeBuilder(){persist();byId('expForm').hidden=true;byId('expStart').hidden=false;}
  function applyProfile(data){acceptMixProfile(data);renderProgress();window.SLRLabAchievements.updateProfileXp();}
  async function loadHistory(append=false,force=false){
    const identity=client.identity(),scope=view,cursor=append?nextCursor:null;
    byId('expMore').disabled=true;byId('expHistory').setAttribute('aria-busy','true');
    if(!append&&!records.length)byId('expHistory').innerHTML='<p class="expHelp" role="status">Loading Mixes…</p>';
    try{
      const data=await client.list(scope,cursor,force);if(identity!==client.identity()||scope!==view)return;
      records=append?[...new Map([...records,...data.records].map(row=>[row.id,row])).values()]:data.records;nextCursor=data.nextCursor;applyProfile(data);renderHistory();byId('expMore').hidden=!nextCursor;
    }catch(error){if(!error.stale){notice(error.message);if(!records.length)byId('expHistory').innerHTML='<div class="expRecord"><h4>Mix Journal Unavailable</h4><p>Your saved mixes are safe. Reconnect and try again.</p><button class="expQuiet" id="expRetry">Retry</button></div>';}}finally{if(identity===client.identity()){byId('expMore').disabled=false;byId('expHistory').setAttribute('aria-busy','false');}}
  }
  function openDetail(record){
    const own=record.observations.some(row=>row.member.toLowerCase()===CURRENT_MEMBER.toLowerCase()),joined=record.participants.some(name=>name.toLowerCase()===CURRENT_MEMBER.toLowerCase());
    const detail=byId('expDetail');detail.hidden=false;detail.innerHTML=`<div class="expDetailHead"><div><h4>${safeHtml(record.title)}</h4><p>By ${safeHtml(displayName(record.author))} · ${new Date(record.created).toLocaleDateString()}</p></div><button class="expQuiet" data-exp-detail-close aria-label="Close mix details">✕</button></div><div class="expDetailRecipe">${record.ingredients.map(row=>`<span>${safeHtml(row.name)} · ${safeHtml(row.brand)} · ${record.ingredients.length===3?'⅓':Math.round(row.share*100)+'%'}</span>`).join('')}</div><div class="expPersonalResults">${record.participants.map(name=>{const result=record.observations.find(row=>row.member.toLowerCase()===name.toLowerCase());return `<div><div class="expResultHeading"><b>${safeHtml(displayName(name))}</b><strong>${result?.overall?'★ '+result.overall:result?'Unrated':'Result pending'}</strong></div>${result?`<p>${Object.entries(result.effects).filter(([,value])=>value).map(([key,value])=>safeHtml((EFFECT_ICON[key]||'')+' '+effectLabel(key)+(value===2?' · strong':''))).join(' · ')||'No effects logged'}</p>${result.notes?`<p class="expDetailNotes">${safeHtml(result.notes)}</p>`:''}`:''}</div>`;}).join('')}</div>${joined&&!own?`<button class="expButton primary" data-exp-result="${safeHtml(record.id)}">Add Your Result</button>`:''}`;
    detail.scrollIntoView({block:'start',behavior:'smooth'});
  }
  async function save(){
    if(busy)return;busy=true;const identity=client.identity();byId('expSave').disabled=true;byId('expCancel').disabled=true;
    try{
      const data=draftData();command(data,{recipe:!activeRecord});client.persistSync(data);
      const before=window.SLRLabAchievements.snapshot(),response=await client.request(activeRecord?'result':'create',data,true);
      if(identity!==client.identity())return;
      applyProfile(response);records=[response.record,...records.filter(row=>row.id!==response.record.id)];renderHistory();
      clearTimeout(draftTimer);client.clearDraft(operationId);byId('expForm').hidden=true;byId('expStart').hidden=false;resetForm();notice('Mix saved. Your result adds to your overall Lab progress.');renderTheLab();
      const after=window.SLRLabAchievements.snapshot(),awards=SLRAchievements.newlyEarned(before,after).filter(item=>item.category==='mixes');if(awards.length)window.SLRLabAchievements.show(awards);
      void loadHistory(false,true);void window.SLRPush?.authenticated(CURRENT_MEMBER);
    }catch(error){if(identity===client.identity())notice(error.name==='TimeoutError'?'The connection timed out. Your draft is kept; try Save Mix again.':error.message);}
    finally{if(identity===client.identity()){busy=false;byId('expSave').disabled=false;byId('expCancel').disabled=false;}}
  }
  panel.addEventListener('input',scheduleDraft);
  panel.addEventListener('change',event=>{
    if(event.target.matches('[data-exp-batch]')){const index=Number(event.target.dataset.expBatch);components[index].batchId=event.target.value;renderComponents();byId('expBatch'+index).focus({preventScroll:true});}
    if(event.target.id==='expPeopleSelect'&&event.target.value){people.push(event.target.value);renderPeople();}scheduleDraft();
  });
  panel.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||busy)return;
    if(button.id==='expProfileLink')document.querySelector('[data-lab-tab="mine"]').click();
    if(button.id==='expNew')void openBuilder();if(button.id==='expCancel')closeBuilder();
    if(button.id==='expDiscard'){clearTimeout(draftTimer);try{client.clearDraft(operationId);byId('expForm').hidden=true;byId('expStart').hidden=false;resetForm();notice('Draft discarded.');}catch{notice('Could not discard the draft. Keep this page open.');}return;}
    if(button.dataset.expRemove!==undefined&&!activeRecord){components.splice(Number(button.dataset.expRemove),1);renderComponents();}
    if(button.id==='expAdd'&&components.length<4&&!activeRecord){components.push({batchId:''});renderComponents();}
    if(button.id==='expClearRating'){stars=null;renderRating();}
    if(button.dataset.expStar){const number=Number(button.dataset.expStar);stars=stars===number?null:number;renderRating();}
    if(button.dataset.expEffect){const name=button.dataset.expEffect;signals[name]=((signals[name]||0)+1)%3;renderEffects();}
    if(button.dataset.expPerson&&!activeRecord){people=people.filter(name=>name!==button.dataset.expPerson);renderPeople();}
    if(button.dataset.expView){view=button.dataset.expView;records=[];nextCursor=null;panel.querySelectorAll('[data-exp-view]').forEach(button=>{const on=button.dataset.expView===view;button.classList.toggle('on',on);button.setAttribute('aria-pressed',String(on));});byId('expDetail').hidden=true;renderHistory();void loadHistory();}
    if(button.id==='expMore')void loadHistory(true);if(button.id==='expRetry')void loadHistory(false,true);if(button.dataset.expOpen)openDetail(records.find(row=>row.id===button.dataset.expOpen));
    if(button.dataset.expDetailClose!==undefined)byId('expDetail').hidden=true;
    if(button.dataset.expResult)void openBuilder(records.find(row=>row.id===button.dataset.expResult));
    if(button.id==='expSave')void save();else scheduleDraft();
  });
  const dataReady=()=>{
    if(stateIdentity!==client.identity()){stateIdentity=client.identity();byId('expSave').disabled=false;byId('expCancel').disabled=false;clearTimeout(draftTimer);records=[];nextCursor=null;busy=false;byId('expForm').hidden=true;byId('expStart').hidden=false;byId('expDetail').hidden=true;resetForm();notice('');renderHistory();}
    refreshCatalog();renderProgress();
    if(document.querySelector('.labHub').dataset.view==='mixes'&&document.getElementById('labHubOverlay').classList.contains('show'))void loadHistory(false,true);
  };
  window.SLRMixes={dataReady,isBusy:()=>busy};window.addEventListener('slr:data-ready',dataReady);
  window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.hidden)persist();});
  renderHistory();renderProgress();entry.hidden=document.querySelector('.labHub').dataset.view!=='crew';
})();
