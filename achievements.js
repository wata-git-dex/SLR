(function(root){
  'use strict';

  const DEFINITIONS=[
    {id:'first-sesh',name:'First Sesh',description:'Logged your first Session.',category:'sessions',xp:10,metric:'sessions',threshold:1,art:'rat',color:'#35d978'},
    {id:'five-deep',name:'Five Deep',description:'Rated 5 different strains.',category:'strains',xp:20,metric:'ratedStrains',threshold:5,art:'fiveLeaves',color:'#2ed6b0'},
    {id:'double-digits',name:'Double Digits',description:'Rated 10 different strains.',category:'strains',xp:30,metric:'ratedStrains',threshold:10,art:'tenJar',color:'#42a5ff'},
    {id:'specimen-shelf',name:'Specimen Shelf',description:'Tried 25 different strains.',category:'strains',xp:50,metric:'strains',threshold:25,art:'shelf',color:'#8d6cff'},
    {id:'lab-regular',name:'Lab Regular',description:'Logged 10 Sessions.',category:'sessions',xp:25,metric:'sessions',threshold:10,art:'flaskMarks',color:'#ff9f37'},
    {id:'long-term-study',name:'Long-Term Study',description:'Logged 25 Sessions.',category:'sessions',xp:50,metric:'sessions',threshold:25,art:'calendarFlask',color:'#ff6b45'},
    {id:'fifty-experiments',name:'Fifty Experiments',description:'Logged 50 Sessions.',category:'sessions',xp:75,metric:'sessions',threshold:50,art:'fiftyFlask',color:'#ec4f76'},
    {id:'five-star-find',name:'Five-Star Find',description:'Found your first five-star strain.',category:'ratings',xp:20,metric:'fiveStars',threshold:1,art:'starFlask',color:'#ffd24a'},
    {id:'variety-pack',name:'Variety Pack',description:'Rated a Sativa, Hybrid and Indica.',category:'discovery',xp:25,metric:'ratedTypes',threshold:3,art:'threeLeaves',color:'#9adf4b'},
    {id:'terp-nerd',name:'Terp Nerd',description:'Encountered 5 different terpenes.',category:'discovery',xp:25,metric:'terpenes',threshold:5,art:'molecule',color:'#34cde8'},
    {id:'full-spectrum',name:'Full Spectrum',description:'Encountered every terpene tracked by the Lab.',category:'discovery',xp:50,metric:'fullSpectrum',threshold:1,art:'spectrum',color:'#b86ef0'},
    {id:'guinea-pig',name:'Guinea Pig',description:'Became the first Rat to rate a strain.',category:'community',xp:25,metric:'firstRatings',threshold:1,art:'guineaPig',color:'#f16a78'},
    {id:'shared-specimen',name:'Shared Specimen',description:'Rated a strain another Rat has rated.',category:'community',xp:20,metric:'sharedRatings',threshold:1,art:'sharedLeaf',color:'#ff719d'},
    {id:'brand-hopper',name:'Brand Hopper',description:'Rated strains from 5 different brands.',category:'discovery',xp:25,metric:'ratedBrands',threshold:5,art:'labels',color:'#ffb13b'},
    {id:'complete-observation',repeatable:true,name:'Complete Observation',description:'Logged 10 Sessions with an Overall rating and an Effect or Side Effect.',category:'quality',xp:35,metric:'completeSessions',threshold:10,art:'clipboard',color:'#4cd19b'},
    {id:'couch-culture',name:'Couch Culture',description:'Strongly reported Couch-Locked in 3 Sessions.',category:'effects',xp:20,metric:'couchLockedStrong',threshold:3,art:'couchRat',color:'#9c7ae8'},
    {id:'high-voltage',repeatable:true,name:'High Voltage',description:'Tried 5 different Sativa strains.',category:'types',xp:25,metric:'sativaStrains',threshold:5,art:'boltLeaf',color:'#f4be32'},
    {id:'dreamwalker',repeatable:true,name:'Dreamwalker',description:'Tried 5 different Indica strains.',category:'types',xp:25,metric:'indicaStrains',threshold:5,art:'moonLeaf',color:'#9178ef'},
    {id:'best-of-both',repeatable:true,name:'Best of Both',description:'Tried 5 different Hybrid strains.',category:'types',xp:25,metric:'hybridStrains',threshold:5,art:'splitLeaf',color:'#4bd47d'},
    {id:'super-dosed',name:'Super Dosed',description:'Tried a batch with at least 35% THC.',category:'discovery',xp:20,metric:'superDosed',threshold:1,art:'highGauge',color:'#ff604d'},
    {id:'deep-archive',name:'Deep Archive',description:'Tried 50 different strains.',category:'strains',xp:75,metric:'strains',threshold:50,art:'archive',color:'#25c9a2'},
    {id:'century-study',name:'Century Study',description:'Logged 100 Sessions.',category:'sessions',xp:100,metric:'sessions',threshold:100,art:'century',color:'#ef5378'},
    {id:'star-stash',name:'Star Stash',description:'Found 5 different five-star strains.',category:'ratings',xp:50,metric:'fiveStarStrains',threshold:5,art:'starStash',color:'#ffd24a'},
    {id:'brand-passport',name:'Brand Passport',description:'Rated strains from 20 different brands.',category:'discovery',xp:40,metric:'ratedBrands',threshold:20,art:'passport',color:'#f29442'},
    {id:'peer-review',name:'Peer Review',description:'Rated 15 strains another Rat has rated.',category:'community',xp:40,metric:'sharedRatings',threshold:15,art:'peerReview',color:'#ff719d'},
    {id:'complete-dossier',name:'Complete Dossier',description:'Logged 25 Sessions with an Overall rating and an Effect or Side Effect.',category:'quality',xp:60,metric:'completeSessions',threshold:25,art:'dossier',color:'#36c890'},
    {id:'sativa-specialist',name:'Sativa Specialist',description:'Tried 30 different Sativa strains.',category:'types',xp:50,metric:'sativaStrains',threshold:30,art:'sunLeaf',color:'#f5bf35'},
    {id:'indica-specialist',name:'Indica Specialist',description:'Tried 15 different Indica strains.',category:'types',xp:50,metric:'indicaStrains',threshold:15,art:'nightLeaf',color:'#8978ee'},
    {id:'hybrid-specialist',name:'Hybrid Specialist',description:'Tried 15 different Hybrid strains.',category:'types',xp:50,metric:'hybridStrains',threshold:15,art:'dualLeaf',color:'#48cf79'},
    {id:'rat-recruiter',name:'Rat Recruiter',description:'Brought a new Rat into the Lab.',category:'contribution',xp:40,metric:'referrals',threshold:1,art:'recruiter',color:'#35bde6'},
    {id:'lab-contributor',name:'Lab Contributor',description:'Add 5 useful new strains to the shared library.',category:'contribution',xp:50,metric:'contributedStrains',threshold:5,art:'tray',color:'#2ebde7',unavailable:true,unavailableReason:'Starts after contribution tracking launches.'},
    {id:'unknown-specimen',name:'Unknown Specimen',description:'A hidden Lab discovery.',category:'secret',xp:0,metric:'secret',threshold:1,art:'unknown',color:'#8f98a0',secret:true,disabled:true}
  ];

  const LEVELS=[
    {level:1,xp:0},{level:2,xp:75},{level:3,xp:175},{level:4,xp:300},{level:5,xp:450},{level:6,xp:600}
  ];

  function levelThreshold(level){
    const fixed=LEVELS.find(item=>item.level===level);
    if(fixed)return fixed.xp;
    return 600+(Math.max(6,level)-6)*150;
  }
  function levelTitle(level){
    if(level>=50)return 'Stoned Overlord';
    if(level>=30)return 'Mad Scientist';
    if(level>=20)return 'Lab Menace';
    if(level>=15)return 'Rat Tech';
    if(level>=10)return 'Pack Rat';
    if(level>=5)return 'Tested Rat';
    return 'Lab Rat';
  }
  function levelForXp(rawXp){
    const xp=Math.max(0,Number(rawXp)||0);
    let level=1;
    while(levelThreshold(level+1)<=xp&&level<999)level++;
    const floor=levelThreshold(level),ceiling=levelThreshold(level+1);
    return {level,title:levelTitle(level),xp,floor,ceiling,into:xp-floor,needed:ceiling-xp,progress:Math.max(0,Math.min(1,(xp-floor)/(ceiling-floor)))};
  }
  function key(value){return String(value||'').trim().toLowerCase();}
  function validOverall(value){const number=Number(value);return Number.isFinite(number)&&number>=1&&number<=5?number:null;}
  function intensity(value){const number=Number(value);return Number.isFinite(number)?Math.max(0,Math.min(2,number)):0;}
  function thcPercent(value){const number=Number(value);return Number.isFinite(number)?(number<=1?number*100:number):0;}
  function hasExperienceRating(session){return validOverall(session.overall)!=null||Object.values({...session.effects,...session.sideEffects}).some(value=>intensity(value)>0);}
  function memberIn(session,member){return (session.members||[]).some(name=>key(name)===key(member));}
  function distinct(rows,field){return new Set(rows.map(row=>key(typeof field==='function'?field(row):row[field])).filter(Boolean));}
  function countByType(rows,type){return distinct(rows.filter(row=>key(row.type)===key(type)),'strainId').size;}
  function chronological(rows){return [...rows].sort((a,b)=>new Date(a.date||0)-new Date(b.date||0)||String(a.id||'').localeCompare(String(b.id||'')));}
  function firstRatingWins(allSessions,member){
    const firstByStrain=new Map();
    chronological(allSessions).forEach(session=>{
      if(!hasExperienceRating(session)||!session.strainId)return;
      const strain=key(session.strainId);
      if(!firstByStrain.has(strain))firstByStrain.set(strain,new Set((session.members||[]).map(key)));
    });
    return [...firstByStrain.values()].filter(names=>names.has(key(member))).length;
  }
  function sharedRatedCount(allSessions,member){
    const rat=key(member),byStrain=new Map();
    allSessions.forEach(session=>{
      if(!hasExperienceRating(session)||!session.strainId)return;
      const strain=key(session.strainId),set=byStrain.get(strain)||new Set();
      (session.members||[]).map(key).filter(Boolean).forEach(name=>set.add(name));
      byStrain.set(strain,set);
    });
    return [...byStrain.values()].filter(names=>names.has(rat)&&[...names].some(name=>name!==rat)).length;
  }
  function calculateMember(context,member){
    const all=Array.isArray(context?.sessions)?context.sessions:[];
    const sessions=all.filter(session=>memberIn(session,member));
    // Effect-only historical Sessions are legitimate ratings, even though they predate Overall stars.
    const rated=sessions.filter(hasExperienceRating);
    const strains=distinct(sessions,'strainId');
    const sessionCount=distinct(sessions,'id').size;
    const ratedTypes=distinct(rated,'type');
    const knownTypes=new Set(['sativa','hybrid','indica']);
    const trackedTerpenes=new Set((context?.trackedTerpenes||[]).map(key).filter(Boolean));
    const encountered=distinct(sessions,session=>session.terpenes||[]);
    // Flatten array-valued terpene fields without relying on string coercion.
    const terpeneSet=new Set();sessions.forEach(session=>(session.terpenes||[]).map(key).filter(Boolean).forEach(value=>terpeneSet.add(value)));
    const metrics={
      sessions:sessionCount,
      strains:strains.size,
      ratedStrains:distinct(rated,'strainId').size,
      fiveStars:distinct(rated.filter(session=>validOverall(session.overall)===5),'id').size,
      fiveStarStrains:distinct(rated.filter(session=>validOverall(session.overall)===5),'strainId').size,
      ratedTypes:[...ratedTypes].filter(value=>knownTypes.has(value)).length,
      terpenes:terpeneSet.size,
      fullSpectrum:trackedTerpenes.size>0&&[...trackedTerpenes].every(value=>terpeneSet.has(value))?1:0,
      firstRatings:firstRatingWins(all,member),
      sharedRatings:sharedRatedCount(all,member),
      ratedBrands:distinct(rated,'brand').size,
      completeSessions:distinct(sessions.filter(session=>validOverall(session.overall)!=null&&Object.values({...session.effects,...session.sideEffects}).some(value=>intensity(value)>0)),'id').size,
      couchLockedStrong:distinct(sessions.filter(session=>intensity(session.effects?.CouchLocked)>=2),'id').size,
      sativaStrains:countByType(sessions,'Sativa'),
      indicaStrains:countByType(sessions,'Indica'),
      hybridStrains:countByType(sessions,'Hybrid'),
      superDosed:sessions.some(session=>thcPercent(session.thc)>=35)?1:0,
      contributedStrains:Number(context?.contributions?.[key(member)]||0),
      referrals:Number(context?.referrals?.[key(member)]||0),
      secret:0
    };
    const achievements=DEFINITIONS.map(definition=>{
      const value=Number(metrics[definition.metric]||0);
      const unavailable=Boolean(definition.unavailable||definition.disabled);
      const earned=!unavailable&&value>=definition.threshold;
      const rank=unavailable?0:definition.repeatable?Math.floor(value/definition.threshold):Number(earned);
      const nextThreshold=definition.repeatable?(rank+1)*definition.threshold:definition.threshold;
      const earnedXp=rank*definition.xp;
      return {...definition,value,earned,unavailable,rank,nextThreshold,earnedXp,
        progress:unavailable?0:definition.repeatable?(value%definition.threshold)/definition.threshold:Math.min(1,value/definition.threshold)};
    });
    const activityXp=sessionCount*10+strains.size*5;
    const achievementXp=achievements.filter(item=>item.earned).reduce((sum,item)=>sum+item.earnedXp,0);
    const totalXp=activityXp+achievementXp;
    return {member,metrics,activityXp,achievementXp,totalXp,level:levelForXp(totalXp),achievements,earned:achievements.filter(item=>item.earned)};
  }

  root.SLRAchievements={version:'preview-2',definitions:DEFINITIONS,calculateMember,levelForXp,levelThreshold,levelTitle};
})(typeof globalThis!=='undefined'?globalThis:window);
