(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  if(!params.has('achievements-preview'))return;
  const engine=globalThis.SLRAchievements;
  if(!engine)return;

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
    tray:'<path d="M4 11h24v16H4Z"/><path d="M8 7h5v12H8zm7-3h5v15h-5zm7 5h5v10h-5M4 21h24"/>'
  };

  function svgFor(item){
    if(item.secret&&!item.earned)return '<span class="badgeSecretMark">?</span>';
    return `<svg viewBox="0 0 32 32" aria-hidden="true">${badgeArt[item.art]||badgeArt.rat}</svg>`;
  }
  function coin(item){return `<div class="badgeCoin" style="--coin:${item.color}">${svgFor(item)}</div>`;}
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
  function currentProgress(){return engine.calculateMember(normalizeContext(),CURRENT_MEMBER||'Cyrus');}
  function buildShell(){
    const overlay=document.createElement('div');
    overlay.className='myLabOverlay';overlay.id='myLabOverlay';
    overlay.innerHTML=`<section class="myLabPage" role="dialog" aria-modal="true" aria-labelledby="myLabHeading"><header class="myLabHead"><div class="myLabHeadMark"><img id="myLabHeadIcon" alt=""></div><div class="myLabHeadCopy"><h2 id="myLabHeading">My Lab</h2><p>Identity · progress · artifacts</p></div><button class="myLabClose" id="myLabClose" aria-label="Close My Lab">✕</button></header><main class="myLabBody" id="myLabBody"></main></section>`;
    document.body.append(overlay);
    const detail=document.createElement('div');detail.className='badgeDetailOverlay';detail.id='badgeDetailOverlay';detail.innerHTML='<div class="badgeDetail" id="badgeDetail"></div>';document.body.append(detail);
    overlay.querySelector('#myLabClose').addEventListener('click',closeMyLab);
    detail.addEventListener('click',event=>{if(event.target===detail||event.target.closest('[data-close-badge]'))closeBadgeDetail();});
    const profile=document.querySelector('.profileCard');
    const button=document.createElement('button');button.className='menuItem myLabPreviewBtn';button.id='menuMyLabPreview';button.innerHTML='<span class="menuIcon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21c.6-5 3-8 7-8s6.4 3 7 8M4 4h3M17 4h3"/></svg></span><span class="menuCopy"><b>Open My Lab</b><span>Your level, XP and Badge Case · preview</span></span><span class="menuArrow">›</span>';
    profile.insertAdjacentElement('afterend',button);button.addEventListener('click',openMyLab);
  }
  function renderMyLab(){
    const result=currentProgress(),earned=result.earned.length,total=result.achievements.filter(item=>!item.disabled).length,level=result.level;
    const avatar=memberIconFor(CURRENT_MEMBER||'Cyrus');
    document.getElementById('myLabHeadIcon').src=avatar;
    const earnedItems=result.achievements.filter(item=>item.earned).slice(-4);
    const badgeButtons=result.achievements.map(item=>{
      const state=item.earned?'earned':item.secret?'secret':'locked';
      const accessible=item.secret&&!item.earned?'Hidden achievement':item.name;
      return `<button class="badgeItem ${state}" data-badge-id="${item.id}" aria-label="${safeHtml(accessible)}">${coin(item)}<span class="badgeName">${safeHtml(item.secret&&!item.earned?'Unknown':item.name)}</span></button>`;
    }).join('');
    document.getElementById('myLabBody').innerHTML=`<section class="myLabIdentity"><div class="myLabIdentityTop"><div class="myLabAvatar"><img src="${avatar}" alt=""></div><div class="myLabName"><small>Active Lab Rat</small><h3>${safeHtml(displayName(CURRENT_MEMBER||'Cyrus'))}</h3></div><div class="myLabLevel"><b>Level ${level.level}</b><span>${safeHtml(level.title)}</span></div></div><div class="myLabProgressMeta"><span><b>${result.totalXp.toLocaleString()} XP</b> · ${result.activityXp} activity + ${result.achievementXp} badges</span><span>${level.needed} to Level ${level.level+1}</span></div><div class="myLabProgress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(level.progress*100)}"><i style="width:${Math.round(level.progress*100)}%"></i></div><div class="myLabStats"><div class="myLabStat"><b>${result.metrics.strains}</b><span>Strains</span></div><div class="myLabStat"><b>${result.metrics.sessions}</b><span>Sessions</span></div><div class="myLabStat"><b>${earned}</b><span>Badges</span></div></div></section><div class="myLabHistory"><span class="myLabHistoryIcon">⌁</span><div><b>Lab history preview</b><p>Your existing legitimate history currently earns ${earned} badge${earned===1?'':'s'}. This is a read-only estimate—nothing has been backfilled or awarded yet.</p></div></div><section class="badgeCase" id="badgeCase"><button class="badgeCaseToggle" id="badgeCaseToggle" aria-expanded="false"><span><strong>Badge Case</strong><small>${earned} earned · more artifacts waiting</small></span><span class="badgeCasePeek">${earnedItems.map(item=>`<i class="badgeMini" style="--badge-color:${item.color}"></i>`).join('')}</span><span class="badgeCaseArrow">⌄</span></button><div class="badgeCaseBody"><div class="badgeCaseInner"><div class="badgeGrid">${badgeButtons}</div></div></div></section><p class="myLabFoot"><b>Preview only.</b> Ratings-based badges use real Overall ratings; missing historical ratings are not guessed. Lab Contributor stays unavailable until attribution exists.</p>`;
    document.getElementById('badgeCaseToggle').addEventListener('click',toggleBadgeCase);
    document.querySelectorAll('[data-badge-id]').forEach(button=>button.addEventListener('click',()=>openBadgeDetail(result.achievements.find(item=>item.id===button.dataset.badgeId))));
  }
  function toggleBadgeCase(){const card=document.getElementById('badgeCase'),open=!card.classList.contains('open');card.classList.toggle('open',open);document.getElementById('badgeCaseToggle').setAttribute('aria-expanded',String(open));}
  function openBadgeDetail(item){
    if(!item)return;
    const hidden=item.secret&&!item.earned;
    const state=item.earned?'Earned':item.unavailable?'Not available yet':hidden?'Secret specimen':'Still testing';
    const copy=hidden?'The Lab is keeping this one under wraps.':item.description;
    const progress=item.unavailable?(item.unavailableReason||'Not available yet.'):item.earned?`Unlocked · +${item.xp} XP`:`Progress ${Math.min(item.value,item.threshold)} / ${item.threshold} · +${item.xp} XP when earned`;
    document.getElementById('badgeDetail').innerHTML=`${coin(item)}<h3>${safeHtml(hidden?'Unknown Specimen':item.name)}</h3><div class="badgeDetailState">${safeHtml(state)}</div><p>${safeHtml(copy)}</p><div class="badgeDetailProgress">${safeHtml(progress)}</div><button class="badgeDetailClose" data-close-badge>Close specimen</button>`;
    document.getElementById('badgeDetailOverlay').classList.add('show');
  }
  function closeBadgeDetail(){document.getElementById('badgeDetailOverlay').classList.remove('show');}
  function openMyLab(){closeMenu();renderMyLab();document.getElementById('myLabOverlay').classList.add('show');document.body.style.overflow='hidden';}
  function closeMyLab(){closeBadgeDetail();document.getElementById('myLabOverlay').classList.remove('show');document.body.style.overflow='';}

  buildShell();
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.getElementById('myLabOverlay').classList.contains('show'))closeMyLab();});
})();
