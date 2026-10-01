(function(){
  'use strict';
  const engine=globalThis.SLRAchievements;
  if(!engine)return;
  let badgeView='collection';

  const confirmedBadgeSlots={
    'first-sesh':[0,0],
    'five-deep':[1,0],
    'double-digits':[2,0],
    'lab-regular':[3,0],
    'five-star-find':[0,1],
    'variety-pack':[1,1],
    'terp-nerd':[2,1],
    'guinea-pig':[3,1],
    'shared-specimen':[0,2],
    'lab-contributor':[1,2],
    'couch-culture':[2,2],
    'unknown-specimen':[3,2]
  };
  const supplementalBadgeSlots={
    'specimen-shelf':[0,0],
    'long-term-study':[1,0],
    'fifty-experiments':[2,0],
    'full-spectrum':[3,0],
    'brand-hopper':[4,0],
    'complete-observation':[0,1],
    'high-voltage':[1,1],
    'dreamwalker':[2,1],
    'best-of-both':[3,1],
    'super-dosed':[4,1],
    'deep-archive':[0,2],
    'century-study':[1,2],
    'star-stash':[2,2],
    'brand-passport':[3,2],
    'peer-review':[4,2],
    'complete-dossier':[0,3],
    'sativa-specialist':[1,3],
    'indica-specialist':[2,3],
    'hybrid-specialist':[3,3],
    'rat-recruiter':[4,3]
  };
  const badgeAssetIds=new Set([...Object.keys(confirmedBadgeSlots),...Object.keys(supplementalBadgeSlots)]);

  const badgeArt={
    rat:'<path d="M9 12C6 6 2 7 3 12c.4 2 2 3 4 3m16-3c3-6 7-5 6 0-.4 2-2 3-4 3M8 14c1-5 4-8 8-8s7 3 8 8l1 6c-1 6-5 9-9 9s-8-3-9-9l1-6Z"/><path d="m11 18 2 1m8-1-2 1m-5 4 2 1 2-1m-2 1v3M7 22l6 1m12-1-6 1"/>',
    fiveLeaves:'<path d="M16 26V11m0 5c-5-1-8-5-8-9 5 0 8 3 8 7m0 6c5-1 8-5 8-9-5 0-8 3-8 7M11 25h10"/><path d="M6 20c-3-2-4-5-3-8 4 1 6 4 6 7m14 1c3-2 4-5 3-8-4 1-6 4-6 7"/>',
    tenJar:'<path d="M9 4h14M11 4v5l-4 6v11h18V15l-4-6V4M9 18h16"/><path d="M12 14h8m-4-4v8"/>',
    shelf:'<path d="M4 10h24M4 22h24M7 7h5v3H7zm8-2h5v5h-5zm8 3h4v2h-4zM6 15h7v7H6zm10 2h5v5h-5zm8-2h3v7h-3z"/>',
    flaskMarks:'<path d="M11 3h10m-8 0v9L6 25a3 3 0 0 0 3 4h14a3 3 0 0 0 3-4l-7-13V3M9 22h14"/><path d="M12 18h3m-4 4h4m7-4h-3m4 4h-4"/>',
    calendarFlask:'<rect x="4" y="6" width="24" height="22" rx="4"/><path d="M9 3v6m14-6v6M4 12h24M13 15h6m-5 0v4l-3 5h10l-3-5v-4"/>',
    fiftyFlask:'<path d="M10 3h12m-9 0v9L6 25a3 3 0 0 0 3 4h14a3 3 0 0 0 3-4l-7-13V3M9 22h14"/><path d="M11 17h5v4h-5m9-4h3v4h-3m0-4v4"/>',
    starFlask:'<path d="M11 3h10m-8 0v8L6 24a3 3 0 0 0 3 5h14a3 3 0 0 0 3-5l-7-13V3"/><path d="m16 14 1.6 3.2 3.5.5-2.5 2.5.6 3.5-3.2-1.6-3.2 1.6.6-3.5-2.5-2.5 3.5-.5Z"/>',
    threeLeaves:'<path d="M16 28V12m0 7c-5-2-8-6-8-11 5 0 8 3 8 8m0 3c5-2 8-6 8-11-5 0-8 3-8 8"/><path d="M12 25c-4-1-7-4-8-8 4 0 7 2 9 5m7 3c4-1 7-4 8-8-4 0-7 2-9 5"/>',
    molecule:'<path d="M11 3h10m-8 0v8L6 24a3 3 0 0 0 3 5h14a3 3 0 0 0 3-5l-7-13V3"/><circle cx="13" cy="20" r="2"/><circle cx="20" cy="17" r="2"/><circle cx="21" cy="24" r="2"/><path d="m15 19 3-1m-3 3 4 2"/>',
    spectrum:'<circle cx="16" cy="16" r="12"/><path d="M5 19c5-7 17-7 22 0M7 23c5-5 13-5 18 0M9 27c4-3 10-3 14 0"/><circle cx="16" cy="12" r="3"/>',
    guineaPig:'<path d="M6 19c0-7 5-12 12-12 6 0 10 4 10 10 0 7-5 11-13 11H9c-3 0-5-2-5-5 0-2 1-3 2-4Z"/><path d="M21 9c0-4 6-4 6 1m-16 8h1m7 0h1M7 27l-2 2m20-3 2 2"/><circle cx="24" cy="15" r="1"/>',
    sharedLeaf:'<path d="M16 28V11m0 8c-5-2-8-6-8-11 5 0 8 3 8 8m0 3c5-2 8-6 8-11-5 0-8 3-8 8"/><path d="M8 23c-4-3-7 3 0 7 7-4 4-10 0-7Zm16 0c-4-3-7 3 0 7 7-4 4-10 0-7Z"/>',
    labels:'<path d="M5 8h13l9 9-11 11L5 17Z"/><circle cx="10" cy="13" r="2"/><path d="m19 6 9 9M9 20l7 7"/>',
    clipboard:'<rect x="6" y="5" width="20" height="24" rx="3"/><path d="M12 5c0-3 8-3 8 0v3h-8Zm-2 9 2 2 4-5m-6 11 2 2 4-5m3-5h4m-4 8h4"/>',
    couchRat:'<path d="M5 18v-3c0-3 4-3 5 0h12c1-3 5-3 5 0v3c2 0 3 1 3 3v6H2v-6c0-2 1-3 3-3Z"/><path d="M7 27v3m18-3v3M10 15c0-5 4-8 8-6 2 1 3 3 3 6m-8-2h1m4 0h1"/>',
    boltLeaf:'<path d="M16 28V12m0 7c-5-2-8-6-8-11 5 0 8 3 8 8m0 3c5-2 8-6 8-11-5 0-8 3-8 8"/><path d="m13 16 5-7-1 6h4l-7 9 2-8Z"/>',
    moonLeaf:'<path d="M16 28V13m0 7c-5-2-8-6-8-11 5 0 8 3 8 8m0 3c5-2 8-6 8-11-5 0-8 3-8 8"/><path d="M23 4a7 7 0 1 0 5 12 8 8 0 0 1-5-12Z"/>',
    splitLeaf:'<path d="M16 28V10m0 8c-6-2-9-6-9-12 6 0 9 4 9 9m0 3c6-2 9-6 9-12-6 0-9 4-9 9"/><path d="M16 8v20"/>',
    highGauge:'<circle cx="16" cy="18" r="11"/><path d="M8 18a8 8 0 0 1 16 0m-8 0 6-5M13 5l3-3 3 3M8 27h16"/>',
    archive:'<path d="M4 8h24v20H4Z"/><path d="M7 5h18v3M8 13h5v5H8zm11 0h5v5h-5zM8 21h5v4H8zm11 0h5v4h-5z"/>',
    century:'<path d="M10 3h12m-9 0v9L6 25a3 3 0 0 0 3 4h14a3 3 0 0 0 3-4l-7-13V3M9 22h14"/><path d="M10 18h2v4h-2m5-4h3v4h-3m7-4h2v4h-2"/>',
    starStash:'<path d="m16 4 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8Z"/><path d="m7 20 1.4 2.8 3.1.5-2.2 2.2.5 3.1L7 27.2l-2.8 1.4.5-3.1-2.2-2.2 3.1-.5Zm18 0 1.4 2.8 3.1.5-2.2 2.2.5 3.1-2.8-1.4-2.8 1.4.5-3.1-2.2-2.2 3.1-.5Z"/>',
    passport:'<rect x="5" y="4" width="22" height="25" rx="3"/><path d="M16 4v25m4-19h3m-3 4h3M9 10c4-3 7 2 4 5s-8-1-4-5Zm0 9h4m-4 4h4"/>',
    peerReview:'<path d="M4 10h10v14H4Zm14-2h10v14H18Z"/><path d="m9 14 1.3 2.6 2.7.4-2 2 .5 2.8L9 20.5l-2.5 1.3L7 19l-2-2 2.7-.4Zm14-2 1.3 2.6 2.7.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.7-.4M14 27h4"/>',
    dossier:'<path d="M6 4h15l5 5v19H6Z"/><path d="M21 4v6h6M10 14h12M10 19h12M10 24h8"/><circle cx="10" cy="9" r="1"/>',
    sunLeaf:'<circle cx="24" cy="8" r="4"/><path d="M24 1v2m0 10v2m7-7h-2M19 8h-2M16 29V12m0 7c-5-2-8-6-8-11 5 0 8 3 8 8m0 3c5-2 8-6 8-11-5 0-8 3-8 8"/>',
    nightLeaf:'<path d="M24 3a7 7 0 1 0 5 12 8 8 0 0 1-5-12ZM16 29V12m0 7c-5-2-8-6-8-11 5 0 8 3 8 8m0 3c5-2 8-6 8-11-5 0-8 3-8 8"/>',
    dualLeaf:'<path d="M16 29V10m0 8c-6-2-9-6-9-12 6 0 9 4 9 9m0 3c6-2 9-6 9-12-6 0-9 4-9 9M16 5v24"/><path d="M6 26h20"/>',
    recruiter:'<path d="M4 25c.5-5 3-8 7-8s6.5 3 7 8M7 10a4 4 0 1 0 8 0 4 4 0 0 0-8 0Zm13 4h8m-4-4v8M18 26c1-3 3-5 6-5 2 0 4 1 5 3"/>',
    tray:'<path d="M4 11h24v16H4Z"/><path d="M8 7h5v12H8zm7-3h5v15h-5zm7 5h5v10h-5M4 21h24"/>'
  };

  function svgFor(item){
    if(item.secret&&!item.earned)return '<span class="badgeSecretMark">?</span>';
    return `<svg viewBox="0 0 32 32" aria-hidden="true">${badgeArt[item.art]||badgeArt.rat}</svg>`;
  }
  const confirmedBadgeColors={'five-deep':'#edb82d','lab-regular':'#ef6470','five-star-find':'#f06eda','variety-pack':'#a865ed','guinea-pig':'#e6d733','shared-specimen':'#2ed6b0','lab-contributor':'#ff9f37'};
  function badgeColor(item){return confirmedBadgeColors[item.id]||item.color;}
  function coin(item){
    const progress=item.earned?100:Math.round((Number(item.progress)||0)*100);
    // This source is the approved full sheet. Crop its original pixels in CSS.
    if(item.id==='shared-specimen')return `<div class="badgeCoin badgeCoinArt" style="--coin:${badgeColor(item)};--progress:${progress}"><span class="badgeSprite badgeSheetCrop" aria-hidden="true"></span></div>`;
    if(badgeAssetIds.has(item.id))return `<div class="badgeCoin badgeCoinArt" style="--coin:${badgeColor(item)};--progress:${progress}"><img class="badgeSprite" src="assets/badges/${item.id}.png" alt="" aria-hidden="true" loading="lazy" decoding="async"></div>`;
    return `<div class="badgeCoin" style="--coin:${badgeColor(item)};--progress:${progress}">${svgFor(item)}</div>`;
  }
  function normalizeContext(){
    const batches=new Map(RAW_BATCHES.map(batch=>[batch.url,batch]));
    const strains=new Map(RAW_STRAINS.map(strain=>[strain.url,strain]));
    const sessions=[];
    RAW_SESSIONS.forEach((session,index)=>{
      const effects={},sideEffects={};
      EFFECTS.forEach(name=>effects[name]=dotVal(session[name]));
      SIDE_EFFECTS.forEach(name=>sideEffects[name]=dotVal(session[name]));
      parseArr(session.Batch).forEach(batchUrl=>{
        const batch=batches.get(batchUrl),strain=batch&&strains.get(batch.Strain);
        if(!batch||!strain)return;
        sessions.push({
          id:session.url||`session-${index}`,
          date:session.Date||batch.Date||'',
          members:memberNames(session),
          strainId:strain.url,
          strainName:strain.Name,
          overall:sessionOverallRating(session),
          type:batch.Type,
          brand:batch.Brand,
          terpenes:parseArr(batch.Terps),
          thc:batch.THC,
          effects,sideEffects
        });
      });
    });
    const tracked=RAW_TERPENES.length?RAW_TERPENES.map(terp=>terp.Name||terp.name):[...new Set(RAW_BATCHES.flatMap(batch=>parseArr(batch.Terps)))];
    return {sessions,trackedTerpenes:tracked};
  }
  function currentProgress(){return engine.calculateMember(normalizeContext(),CURRENT_MEMBER);}
  function orderedAchievements(items){
    return items.map((item,index)=>({...item,_catalogIndex:index})).sort((a,b)=>{
      const group=item=>item.earned?2:(item.unavailable||item.secret)?1:0;
      const groupDiff=group(a)-group(b);if(groupDiff)return groupDiff;
      if(group(a)===0){const progressDiff=b.progress-a.progress;if(progressDiff)return progressDiff;const remainingDiff=(a.threshold-a.value)-(b.threshold-b.value);if(remainingDiff)return remainingDiff;}
      return a._catalogIndex-b._catalogIndex;
    });
  }
  function buildShell(){
    const tabs=document.querySelector('.labTabs');
    const mineTab=document.createElement('button');mineTab.className='labTab';mineTab.dataset.labTab='mine';mineTab.setAttribute('role','tab');mineTab.setAttribute('aria-selected','false');mineTab.textContent='My Lab';tabs.append(mineTab);
    const minePanel=document.createElement('div');minePanel.className='labPanel myLabPanel';minePanel.dataset.labPanel='mine';minePanel.innerHTML='<div class="labSectionHead"><h3>My Lab</h3><span>Private progress · only visible to you.</span></div><main class="myLabBody" id="myLabBody"></main>';document.querySelector('.labHubBody').append(minePanel);
    const detail=document.createElement('div');detail.className='badgeDetailOverlay';detail.id='badgeDetailOverlay';detail.innerHTML='<div class="badgeDetail" id="badgeDetail"></div>';document.body.append(detail);
    detail.addEventListener('click',event=>{if(event.target===detail||event.target.closest('[data-close-badge]'))closeBadgeDetail();});
    document.getElementById('menuLabHeading').textContent='The Lab';
    const button=document.createElement('button');button.className='menuItem myLabPreviewBtn';button.id='menuMyLabPreview';button.innerHTML='<span class="menuIcon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="7" r="3.5"/><path d="M3 21v-2a7 7 0 0 1 10-6m4-1v5m-2.5-2.5h5M15 21h6"/></svg></span><span class="menuCopy"><b>My Lab</b><span>Your private level, XP and Badge Case</span></span><span class="menuArrow">›</span>';
    document.getElementById('menuTheLab').insertAdjacentElement('afterend',button);button.addEventListener('click',openMyLab);
    const badgeLink=document.createElement('button');badgeLink.type='button';badgeLink.className='profileBadgeLink';badgeLink.id='profileBadgeLink';badgeLink.setAttribute('aria-label','View badges');badgeLink.title='View badges';badgeLink.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="m8 14-2 7 6-3 6 3-2-7m-4-8 1 2 2 .3-1.5 1.5.3 2.2-1.8-1-1.8 1 .3-2.2L9 8.3l2-.3Z"/></svg>';
    document.querySelector('.profileSectionHead').append(badgeLink);
    badgeLink.addEventListener('click',()=>{openMyLab();toggleBadgeCase();document.getElementById('badgeCase').scrollIntoView({block:'start',behavior:'instant'});document.getElementById('badgeCaseToggle').focus({preventScroll:true});});
    mineTab.addEventListener('click',()=>{renderMyLab();setLabTab('mine');});
    document.getElementById('menuTheLab').addEventListener('click',()=>requestAnimationFrame(addPersonalLabLink));
    document.getElementById('labDockBtn').addEventListener('click',()=>requestAnimationFrame(addPersonalLabLink));
  }
  function addPersonalLabLink(){
    const inner=document.querySelector('.ratCard.you .ratSignalsInner');if(!inner||inner.querySelector('.ratMyLabLink'))return;
    const button=document.createElement('button');button.className='ratMyLabLink';button.innerHTML='<span>My Lab</span><b>›</b>';button.addEventListener('click',()=>{renderMyLab();setLabTab('mine');});inner.append(button);
  }
  function renderMyLab(){
    const result=currentProgress(),earned=result.earned.length,total=result.achievements.filter(item=>!item.disabled).length,level=result.level;
    const avatar=memberIconFor(CURRENT_MEMBER);
    const ordered=orderedAchievements(result.achievements);
    const badgeButtons=ordered.map(item=>{
      const state=item.earned?'earned':item.secret?'secret':'locked';
      const accessible=item.secret&&!item.earned?'Hidden achievement':item.name;
      const progress=item.earned?'':item.unavailable?'<span class="badgeItemMeta">Not tracked</span>':item.secret?'<span class="badgeItemMeta">Secret</span>':`<span class="badgeItemMeta">${Math.min(item.value,item.threshold)} / ${item.threshold}</span>`;
      return `<button class="badgeItem ${state}" data-badge-id="${item.id}" aria-label="${safeHtml(accessible)}">${coin(item)}<span class="badgeName">${safeHtml(item.secret&&!item.earned?'Unknown':item.name)}</span>${progress}</button>`;
    }).join('');
    const badgeRows=ordered.map(item=>{
      const hidden=item.secret&&!item.earned;
      const state=item.earned?'earned':item.secret?'secret':'locked';
      const name=hidden?'Unknown Specimen':item.name;
      const description=hidden?'A hidden Lab discovery.':item.description;
      const status=item.earned?`Earned · +${item.xp} XP`:item.unavailable?'Not tracked yet':hidden?'Secret':`${Math.min(item.value,item.threshold)} / ${item.threshold}`;
      const meter=!item.earned&&!item.unavailable&&!hidden?`<span class="badgeRowMeter"><i style="width:${Math.round(item.progress*100)}%"></i></span>`:'';
      return `<button class="badgeRow ${state}" data-badge-id="${item.id}">${coin(item)}<span class="badgeRowCopy"><b>${safeHtml(name)}</b><small>${safeHtml(description)}</small>${meter}</span><span class="badgeRowStatus">${safeHtml(status)}</span><span class="badgeRowArrow">›</span></button>`;
    }).join('');
    document.getElementById('myLabBody').innerHTML=`<section class="myLabIdentity"><div class="myLabIdentityTop"><div class="myLabAvatar"><img src="${avatar}" alt=""></div><div class="myLabName"><small>Active Lab Rat</small><h3>${safeHtml(displayName(CURRENT_MEMBER))}</h3></div><div class="myLabLevel"><b>Level ${level.level}</b><span>${safeHtml(level.title)}</span></div></div><div class="myLabProgressMeta"><span><b>${result.totalXp.toLocaleString()} XP</b> · ${result.activityXp} activity + ${result.achievementXp} badges</span><span>${level.needed} to Level ${level.level+1}</span></div><div class="myLabProgress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(level.progress*100)}"><i style="width:${Math.round(level.progress*100)}%"></i></div><div class="myLabStats"><div class="myLabStat"><b>${result.metrics.strains}</b><span>Strains</span></div><div class="myLabStat"><b>${result.metrics.sessions}</b><span>Sessions</span></div><div class="myLabStat"><b>${earned}</b><span>Badges</span></div></div></section><div class="myLabHistory"><span class="myLabHistoryIcon">⌁</span><div><b>Lab history</b><p>Your recorded history qualifies for ${earned} badge${earned===1?'':'s'}. Progress updates from your saved Sessions.</p></div></div><section class="badgeCase" id="badgeCase"><button class="badgeCaseToggle" id="badgeCaseToggle" aria-expanded="false"><span class="badgeCaseIcon" aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="16" cy="14" r="10"/><path d="M10 23 8 30l8-4 8 4-2-7M16 8l1.8 3.7 4.1.6-3 2.9.7 4.1-3.6-2-3.6 2 .7-4.1-3-2.9 4.1-.6Z"/></svg></span><span class="badgeCaseCopy"><strong>Badge Case</strong><small>${earned} earned · tap to see progress</small></span><span class="badgeCaseArrow">⌄</span></button><div class="badgeCaseBody"><div class="badgeCaseInner"><div class="badgeViewSwitch" role="group" aria-label="Badge view"><button data-badge-view="collection" class="${badgeView==='collection'?'active':''}">Collection</button><button data-badge-view="checklist" class="${badgeView==='checklist'?'active':''}">Checklist</button></div><div class="badgeViewPanel ${badgeView==='collection'?'active':''}" data-badge-panel="collection"><div class="badgeGrid">${badgeButtons}</div></div><div class="badgeViewPanel ${badgeView==='checklist'?'active':''}" data-badge-panel="checklist"><div class="badgeList">${badgeRows}</div></div></div></div></section><p class="myLabFoot"><b>Based on your Lab history.</b> Ratings-based badges use real Overall ratings; missing historical ratings are not guessed. Contribution badges only unlock after a Rat is deliberately credited.</p>`;
    document.getElementById('badgeCaseToggle').addEventListener('click',toggleBadgeCase);
    document.querySelectorAll('[data-badge-view]').forEach(button=>button.addEventListener('click',()=>setBadgeView(button.dataset.badgeView)));
    document.querySelectorAll('[data-badge-id]').forEach(button=>button.addEventListener('click',()=>openBadgeDetail(result.achievements.find(item=>item.id===button.dataset.badgeId))));
  }
  function toggleBadgeCase(){const card=document.getElementById('badgeCase'),open=!card.classList.contains('open');card.classList.toggle('open',open);document.getElementById('badgeCaseToggle').setAttribute('aria-expanded',String(open));}
  function setBadgeView(view){badgeView=view==='checklist'?'checklist':'collection';document.querySelectorAll('[data-badge-view]').forEach(button=>button.classList.toggle('active',button.dataset.badgeView===badgeView));document.querySelectorAll('[data-badge-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.badgePanel===badgeView));}
  function openBadgeDetail(item){
    if(!item)return;
    const hidden=item.secret&&!item.earned;
    const state=item.earned?'Earned':item.unavailable?'Not available yet':hidden?'Secret specimen':'Still testing';
    const copy=hidden?'The Lab is keeping this one under wraps.':item.description;
    const progress=item.unavailable?(item.unavailableReason||'Not available yet.'):item.earned?'Unlocked':`${Math.min(item.value,item.threshold)} of ${item.threshold} complete`;
    const meter=!item.earned&&!item.unavailable&&!hidden?`<div class="badgeDetailMeter"><i style="width:${Math.round(item.progress*100)}%"></i></div>`:'';
    const name=hidden?'Unknown Specimen':item.name;
    document.getElementById('badgeDetail').innerHTML=`<button class="badgeDetailX" data-close-badge aria-label="Close badge detail">✕</button><div class="badgeFlipCard" id="badgeFlipCard" role="button" tabindex="0" aria-label="Flip ${safeHtml(name)} badge" style="--coin:${badgeColor(item)}"><div class="badgeFlipFace badgeFlipFront">${coin(item)}<h3>${safeHtml(name)}</h3><span>Specimen badge</span></div><div class="badgeFlipFace badgeFlipBack"><div class="badgeBackLabel">${safeHtml(state)}</div><h3>${safeHtml(name)}</h3><p>${safeHtml(copy)}</p>${meter}<div class="badgeDetailProgress">${safeHtml(progress)}</div><div class="badgeXp">+${item.xp} XP</div></div></div>`;
    const overlay=document.getElementById('badgeDetailOverlay'),card=document.getElementById('badgeFlipCard');overlay.classList.add('show');
    const flip=()=>card.classList.toggle('flipped');card.addEventListener('click',flip);card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();flip();}});
  }
  function closeBadgeDetail(){document.getElementById('badgeDetailOverlay').classList.remove('show');}
  function openMyLab(){if(!CURRENT_MEMBER)return;closeMenu();openTheLab('mine');renderMyLab();addPersonalLabLink();}

  buildShell();
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.getElementById('badgeDetailOverlay').classList.contains('show')){event.stopImmediatePropagation();closeBadgeDetail();}},true);
})();
