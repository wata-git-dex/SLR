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

const {checkAppUpdate,applyAppUpdate,waitForInstall}=await import('../updates.mjs');
const page=version=>async()=>({ok:true,text:async()=>`const APP_VERSION = '${version}';`});
test('explicit update check detects page-only releases and reports current versions',async()=>{
 let calls=0;const registration={update:async()=>{calls++;},waiting:null};
 assert.deepEqual(await checkAppUpdate(registration,'v1',page('v2')),{version:'v2',available:true});
 assert.deepEqual(await checkAppUpdate(registration,'v1',page('v1')),{version:'v1',available:false});
 registration.waiting={};assert.equal((await checkAppUpdate(registration,'v1',page('v1'))).available,true);assert.equal(calls,3);
 await assert.rejects(checkAppUpdate(registration,'v1',async()=>({ok:false})),/Could not check/);
 await assert.rejects(checkAppUpdate(registration,'v1',page('unknown')), /Could not confirm/);
});
test('checks wait for installation and surface failed downloads',async()=>{
 const worker=new EventTarget();worker.state='installing';const pending=waitForInstall({installing:worker},50);
 worker.state='installed';worker.dispatchEvent(new Event('statechange'));await pending;
 worker.state='installing';await assert.rejects(waitForInstall({installing:worker},5),/still downloading/);
 worker.state='redundant';await assert.rejects(waitForInstall({installing:worker},50),/could not install/);
});
test('update apply preserves drafts and worker rejection, then recovers after stalled takeover',async()=>{
 const serviceWorker=new EventTarget();serviceWorker.controller={};let reloads=0,sends=0;
 const args={registration:{waiting:{}},safeToUpdate:()=>false,available:true,serviceWorker,reload:()=>reloads++,send:async()=>{sends++;return {ok:false,error:'Close other SLR tabs'};},timeout:20};
 await assert.rejects(applyAppUpdate(args),/Save or close/);assert.equal(sends,0);
 args.safeToUpdate=()=>true;await assert.rejects(applyAppUpdate(args),/other SLR tabs/);assert.equal(reloads,0);
 args.send=async()=>({ok:true});await assert.rejects(applyAppUpdate(args),/has not finished/);assert.equal(reloads,0);
 args.send=async()=>{serviceWorker.dispatchEvent(new Event('controllerchange'));return {ok:true};};await applyAppUpdate(args);assert.equal(reloads,1);
 args.registration.waiting=null;await applyAppUpdate(args);assert.equal(reloads,2);
});
