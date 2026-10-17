import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import './achievements.js';
const engine=globalThis.SLRAchievements;
const source=readFileSync(new URL('./my-lab-preview.js',import.meta.url),'utf8');
const controller=source.slice(source.indexOf('  const pendingAchievementSaves='),source.indexOf('  function closeAchievementNotice('));
function progress(member,count){return engine.calculateMember({sessions:Array.from({length:count},(_,i)=>({id:`s-${i}`,strainId:`strain-${i}`,members:[member],type:'Sativa'}))},member);}
function harness(failingStorage=false){
 const storage=new Map(),events=[];
 const ctx=vm.createContext({CURRENT_MEMBER:'Cyrus',engine,result:progress('Cyrus',9),localStorage:{getItem:key=>{if(failingStorage)throw Error('blocked');return storage.get(key)||null;},setItem:(key,value)=>{if(failingStorage)throw Error('full');storage.set(key,value);}},currentProgress:()=>ctx.result,showAchievementNotice:items=>events.push(items)});
 vm.runInContext(controller,ctx);return {ctx,events,storage,run:source=>vm.runInContext(source,ctx)};
}
test('only a confirmed save plus new readback announces; reload and repeated refresh stay quiet',()=>{
 const h=harness();h.run('achievementDataReady()');assert.equal(h.events.length,0);
 // A failed POST never calls expectSave. A plain refresh must not celebrate.
 h.ctx.result=progress('Cyrus',10);h.run('achievementDataReady()');assert.equal(h.events.length,0);
 h.ctx.result=progress('Cyrus',14);h.run('achievementDataReady();expectAchievementSave(achievementSnapshot());achievementDataReady()');assert.equal(h.events.length,0);
 h.ctx.result=progress('Cyrus',15);h.run('achievementDataReady()');assert.equal(h.events.length,1);
 assert.equal(h.events[0].find(item=>item.id==='high-voltage').awardedXp,25);
 h.run('achievementDataReady();achievementDataReady()');assert.equal(h.events.length,1);
});
test('pending saves and seen ranks stay with their member, including storage failure',()=>{
 for(const failedStorage of [false,true]){
  const h=harness(failedStorage);h.run('achievementDataReady();expectAchievementSave(achievementSnapshot())');
  h.ctx.CURRENT_MEMBER='Amber';h.ctx.result=progress('Amber',10);h.run('achievementDataReady()');assert.equal(h.events.length,0);
  h.ctx.CURRENT_MEMBER='Cyrus';h.ctx.result=progress('Cyrus',10);h.run('achievementDataReady()');assert.equal(h.events.length,1);
  h.run('achievementDataReady()');assert.equal(h.events.length,1);
 }
});
