import test from 'node:test';
import assert from 'node:assert/strict';
import '../achievements.js';
import {normalizeMix,purchaseCountry} from './model.mjs';
const engine=globalThis.SLRAchievements;
test('new mix badge ranks use milestones without changing ordinary repeatable badge math',()=>{
 for(const definition of engine.definitions.filter(row=>row.milestones)){
  for(const [value,rank,next]of [[0,0,1],[1,1,5],[4,1,5],[5,2,10],[9,2,10],[10,3,25],[24,3,25],[25,4,50],[49,4,50],[50,5,75],[75,6,100]]){
   const field={internationalMixes:'international',replicatedMixes:'replicated',doubleSativaMixes:'doubleSativa',doubleIndicaMixes:'doubleIndica',opposingMixes:'opposites'}[definition.metric];
   const progress=engine.calculateMember({sessions:[],mixProgress:{cyrus:{[field]:value}}},'Cyrus'),badge=progress.achievements.find(row=>row.id===definition.id);
   assert.equal(badge.rank,rank);assert.equal(badge.nextThreshold,next);assert.equal(badge.earnedXp,rank*25);assert.ok(badge.progress>=0&&badge.progress<1);
  }
 }
 const before=engine.calculateMember({mixProgress:{cyrus:{replicated:4}}},'Cyrus'),after=engine.calculateMember({mixProgress:{cyrus:{replicated:5}}},'Cyrus');
 assert.equal(engine.newlyEarned(before,after).find(row=>row.id==='mix-replication').awardedXp,25);assert.equal(engine.newlyEarned(after,after).length,0);
 const normal=engine.definitions.find(row=>row.id==='high-voltage');assert.equal(engine.rankForValue(normal,10),2);assert.equal(engine.thresholdForRank(normal,3),15);
});
test('country snapshots accept only known purchase countries, and preserve absence on legacy information',()=>{
 assert.equal(purchaseCountry(' Germany '),'🇩🇪');assert.equal(purchaseCountry('United States'),'🇺🇸');assert.equal(purchaseCountry('Unknown'),null);assert.equal(purchaseCountry(null),null);
 const catalog=[{id:'a',strainId:'s1',name:'One',brand:'A',family:'Sativa',country:'🇩🇪'},{id:'b',strainId:'s2',name:'Two',brand:'B',family:'Indica'}];
 const mix=normalizeMix([{batchId:'a',country:'🇹🇭'},{batchId:'b',country:'🇺🇸'}],catalog);assert.deepEqual(mix.map(row=>row.country),['🇩🇪',null]);assert.deepEqual(mix.map(row=>row.share),[.5,.5]);
});
test('new mix achievements add to an existing profile without changing its normal Session or strain metrics',()=>{
 const sessions=[{id:'normal-1',strainId:'existing-strain',members:['Cyrus'],type:'Hybrid',overall:4,effects:{Focused:1}},{id:'normal-2',strainId:'existing-strain',members:['Cyrus'],type:'Hybrid',overall:5,effects:{Relaxed:2}}];
 const before=engine.calculateMember({sessions},'Cyrus'),after=engine.calculateMember({sessions,mixProgress:{cyrus:{completed:1,shared:1,international:1,replicated:1,doubleSativa:1}}},'Cyrus');
 assert.equal(after.totalXp,before.totalXp+135);assert.equal(after.activityXp,before.activityXp+10);
 for(const metric of ['sessions','strains','ratedStrains','fiveStars','hybridStrains','completeSessions'])assert.equal(after.metrics[metric],before.metrics[metric]);
 assert.deepEqual(after.achievements.filter(row=>row.category!=='mixes'),before.achievements.filter(row=>row.category!=='mixes'));
});
