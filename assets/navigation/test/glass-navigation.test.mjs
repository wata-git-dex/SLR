import test from 'node:test';
import assert from 'node:assert/strict';
import {mountGlassNavigation,releaseIndex} from '../glass-navigation.mjs';
test('release targets must contain both coordinates; gaps and cancellation do not navigate',()=>{
 const rects=[{left:0,right:44,top:0,bottom:44},{left:50,right:94,top:0,bottom:44}];
 assert.equal(releaseIndex(rects,70,20),1);assert.equal(releaseIndex(rects,47,20),-1);
 assert.equal(releaseIndex(rects,70,50),-1);assert.equal(releaseIndex(rects,70,20,true),-1);
});
test('press and movement never activate; release activates once; outside/cancel never activate; keyboard stays available',()=>{
 const previous={document:globalThis.document,matchMedia:globalThis.matchMedia,ResizeObserver:globalThis.ResizeObserver,MutationObserver:globalThis.MutationObserver};
 const cls=()=>({add(){},remove(){},toggle(){}}),style=()=>({setProperty(){},removeProperty(){}});
 let clicks=0,selected=0;const handlers={};
 const list=[0,1].map(i=>({disabled:false,getAttribute:()=>null,matches:()=>selected===i,closest(){return this},removeAttribute(){},toggleAttribute(){},getBoundingClientRect:()=>({left:i*50,right:i*50+44,top:0,bottom:44,width:44,height:44}),click(){clicks++;selected=i}}));
 const lens={style:style(),setAttribute(){},remove(){}};
 globalThis.document={documentElement:{dataset:{}},createElement:()=>lens};globalThis.matchMedia=()=>({matches:false});
 globalThis.ResizeObserver=globalThis.MutationObserver=class{observe(){}disconnect(){}};
 const tray={classList:cls(),dataset:{},style:style(),clientLeft:0,clientTop:0,querySelectorAll:()=>list,contains:()=>true,prepend(){},getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){},addEventListener:(n,f)=>handlers[n]=f,removeEventListener:n=>delete handlers[n]};
 try{
 const api=mountGlassNavigation(tray);assert.equal(mountGlassNavigation(tray),api);
 const event=(x=20,y=20)=>({button:0,pointerId:1,clientX:x,clientY:y,target:list[0]});
 handlers.pointerdown(event());handlers.pointermove(event(70));assert.equal(clicks,0);assert.equal(selected,0);
 handlers.pointerup(event(70));assert.equal(clicks,1);assert.equal(selected,1);
 let prevented=false;handlers.click({isTrusted:true,detail:1,preventDefault(){prevented=true},stopImmediatePropagation(){}});assert.equal(prevented,true);
 handlers.pointerdown(event());handlers.pointerup(event(100,70));assert.equal(clicks,1);
 handlers.pointerdown(event());handlers.pointercancel(event());assert.equal(clicks,1);
 handlers.pointerdown(event());handlers.pointermove(event(70));
 let escapePrevented=false;handlers.keydown({key:'Escape',preventDefault(){escapePrevented=true}});
 handlers.pointerup(event(70));assert.equal(clicks,1);assert.equal(escapePrevented,true);
 let keyboardPrevented=false;handlers.click({isTrusted:true,detail:0,preventDefault(){keyboardPrevented=true},stopImmediatePropagation(){}});assert.equal(keyboardPrevented,false);
 api.destroy();assert.equal(Object.keys(handlers).length,0);
 }finally{Object.assign(globalThis,previous)}
});
