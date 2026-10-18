import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
test('update guard retains in-flight strain/session/photo writes after the form closes',async()=>{
 const start=html.indexOf('let SLR_ACTIVE_WRITES=0;'),end=html.indexOf('const APP_VERSION',start);
 let finish;const ctx=vm.createContext({fetch:()=>new Promise(resolve=>finish=resolve)});vm.runInContext(html.slice(start,end),ctx);
 const pending=vm.runInContext("slrWrite('/photo')",ctx);assert.equal(vm.runInContext('SLR_ACTIVE_WRITES',ctx),1);
 finish({ok:true});await pending;assert.equal(vm.runInContext('SLR_ACTIVE_WRITES',ctx),0);
 ctx.fetch=async()=>{throw Error('offline');};await assert.rejects(vm.runInContext("slrWrite('/session')",ctx),/offline/);assert.equal(vm.runInContext('SLR_ACTIVE_WRITES',ctx),0);
 assert.match(html,/safeToUpdate:\(\)=>SLR_ACTIVE_WRITES===0&&!AS.busy/);
 assert.equal((html.match(/await slrWrite\(WORKER_URL/g)||[]).length,3);
});
