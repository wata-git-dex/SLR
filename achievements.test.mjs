import assert from 'node:assert/strict';
import './achievements.js';

const engine=globalThis.SLRAchievements;
assert.ok(engine,'achievement engine is exposed');

const sessions=[];
for(let index=0;index<10;index++)sessions.push({
  id:`s${index}`,
  date:`2026-09-${String(index+1).padStart(2,'0')}`,
  members:index===0?['Cyrus','Amber']:['Cyrus'],
  strainId:`strain-${index}`,
  overall:index<5?(index===0?5:4):null,
  type:['Sativa','Hybrid','Indica'][index%3],
  brand:`Brand ${index%5}`,
  terpenes:[`Terp ${index%5}`],
  thc:index===9?35:30,
  effects:index<3?{CouchLocked:2}:index<5?{Focused:1}:{},
  sideEffects:{}
});

const result=engine.calculateMember({sessions,trackedTerpenes:['Terp 0','Terp 1','Terp 2','Terp 3','Terp 4']},'Cyrus');
const byId=Object.fromEntries(result.achievements.map(item=>[item.id,item]));
assert.equal(result.metrics.sessions,10);
assert.equal(result.metrics.strains,10);
assert.equal(result.metrics.ratedStrains,5);
assert.equal(byId['first-sesh'].earned,true);
assert.equal(byId['five-deep'].earned,true);
assert.equal(byId['double-digits'].earned,false,'unrated strains do not count as rated');
assert.equal(byId['lab-regular'].earned,true);
assert.equal(byId['five-star-find'].earned,true);
assert.equal(byId['variety-pack'].earned,true);
assert.equal(byId['terp-nerd'].earned,true);
assert.equal(byId['full-spectrum'].earned,true);
assert.equal(byId['couch-culture'].earned,true);
assert.equal(byId['super-dosed'].earned,true);
assert.equal(byId['lab-contributor'].earned,false);
assert.equal(byId['lab-contributor'].unavailable,true);
assert.equal(byId['deep-archive'].earned,false);
assert.equal(byId['star-stash'].value,1,'five-star milestones count distinct strains, not duplicate Sessions');
assert.equal(byId['rat-recruiter'].earned,false,'referrals require deliberate attribution');
assert.equal(result.activityXp,150,'activity XP remains 10/session + 5/distinct strain');

const credited=engine.calculateMember({sessions,trackedTerpenes:[],referrals:{cyrus:1}},'Cyrus');
assert.equal(credited.achievements.find(item=>item.id==='rat-recruiter').earned,true,'manual referral attribution unlocks Rat Recruiter');

const amber=engine.calculateMember({sessions,trackedTerpenes:[]},'Amber');
assert.equal(amber.metrics.sessions,1,'joint historical Session credits both Rats');
assert.equal(amber.metrics.firstRatings,1,'joint first rating credits both Rats');
assert.equal(amber.metrics.sharedRatings,1,'joint rating counts as shared participation');

assert.deepEqual(engine.levelForXp(0),{level:1,title:'Lab Rat',xp:0,floor:0,ceiling:75,into:0,needed:75,progress:0});
assert.equal(engine.levelForXp(600).level,6);
assert.equal(engine.levelForXp(1200).level,10);
assert.equal(engine.levelForXp(2700).level,20);
assert.equal(engine.levelForXp(7200).level,50);

console.log('achievement engine tests passed');

// Historical records determine ranks, without incrementing a stored XP counter.
for(const [type,id] of [['Sativa','high-voltage'],['Indica','dreamwalker'],['Hybrid','best-of-both']]){
 for(const count of [0,4,5,7,10,15,30]){
  const history=Array.from({length:count},(_,i)=>({id:`rank-${i}`,strainId:`strain-${i}`,members:['Cyrus'],type,overall:4,effects:{Focused:1},terpenes:['A']}));
  const context={sessions:history,trackedTerpenes:['A']};
  const progress=engine.calculateMember(context,'Cyrus');
  const badge=progress.achievements.find(b=>b.id===id);
  assert.equal(badge.rank,Math.floor(count/5));
  assert.equal(badge.earnedXp,Math.floor(count/5)*25);
  assert.equal(badge.nextThreshold,(Math.floor(count/5)+1)*5);
  assert.equal(progress.achievements.filter(b=>b.id===id).length,1);
  assert.deepEqual(engine.calculateMember(context,'Cyrus'),progress,'refresh cannot award XP twice');
  if(count){
   const repeated=engine.calculateMember({...context,sessions:[...history,{...history[0],id:'repeat',overall:5}]},'Cyrus');
   assert.equal(repeated.achievements.find(b=>b.id===id).earnedXp,badge.earnedXp,'repeat strain does not raise type rank');
   const full=progress.achievements.find(b=>b.id==='full-spectrum');
   assert.equal(full.earnedXp,50,'Full Spectrum remains one-time');
  }
  assert.equal(engine.calculateMember(context,'Amber').achievementXp,0,'history remains member scoped');
  assert.equal(progress.achievements.find(b=>b.id==='complete-observation').earnedXp,Math.floor(count/10)*35);
 }
}
