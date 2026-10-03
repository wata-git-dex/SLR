import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
function harness(){
  const storage=new Map(),classes=new Set();
  const context=vm.createContext({CURRENT_MEMBER:'Cyrus',memberPalette:()=>'',requestAnimationFrame:f=>f(),localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},document:{documentElement:{classList:{toggle:(k,on)=>on?classes.add(k):classes.delete(k)}},querySelectorAll:()=>[],querySelector:()=>null}});
  context.document.querySelectorAll=()=>[];context.document.querySelector=()=>null;
  vm.runInContext(html.slice(html.indexOf('function appearancePreference('),html.indexOf('\nfunction displayName(',html.indexOf('function appearancePreference('))),context);
  return {context,storage,classes,run:s=>vm.runInContext(s,context)};
}
test('appearance choices persist independently and remain scoped to each member',()=>{
 const h=harness();h.run("setAppearancePreference('mode','light');setAppearancePreference('material','solid');setAppearancePreference('selection','black')");
 assert(h.classes.has('slr-light'));assert(h.classes.has('slr-no-glass'));assert(!h.classes.has('slr-glass'));assert(!h.classes.has('slr-filled-selection'));
 h.run("CURRENT_MEMBER='Piero';applyAppearance()");assert(!h.classes.has('slr-light'));assert(h.classes.has('slr-glass'));assert(h.classes.has('slr-filled-selection'));
 h.run("CURRENT_MEMBER='Cyrus';applyAppearance()");assert(h.classes.has('slr-light'));assert(h.classes.has('slr-no-glass'));assert(!h.classes.has('slr-filled-selection'));
 h.run("setAppearancePreference('mode','dark')");assert(h.classes.has('slr-no-glass'));assert(!h.classes.has('slr-filled-selection'));
 const before=[...h.storage];h.run("setAppearancePreference('mode','invalid');setAppearancePreference('unknown','light')");assert.deepEqual([...h.storage],before);
});
test('legacy Pink & White remains light until explicitly changed',()=>{
 const h=harness();h.context.CURRENT_MEMBER='Amber';h.context.memberPalette=()=> 'pink-light';h.run('applyAppearance()');assert(h.classes.has('slr-light'));
 h.run("setAppearancePreference('mode','dark');applyAppearance()");assert(!h.classes.has('slr-light'));
});
