import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultMixTitle,displayMixTitle,mixStripe} from './presentation.mjs';
test('automatic recipe names use every strain with crosses; custom and saved legacy names remain recoverable',()=>{
 const ingredients=[{name:'Tangrini'},{name:'Frozen Lemon Haze'}];
 assert.equal(defaultMixTitle(ingredients),'Tangrini × Frozen Lemon Haze');
 assert.equal(displayMixTitle({ingredients,title:'Tangrini + Frozen Lemon Haze'}),'Tangrini × Frozen Lemon Haze');
 assert.equal(displayMixTitle({ingredients,title:'The Ultimate Combo'}),'The Ultimate Combo');
 const long=Array.from({length:4},(_,i)=>({name:'A long specimen name number '+i}));
 assert.equal(defaultMixTitle(long).split(' × ').length,4);assert.ok(defaultMixTitle(long).length>80);
 assert.equal(displayMixTitle({ingredients:long,title:long.map(row=>row.name).join(' + ').slice(0,80)}),defaultMixTitle(long));
});
test('equal ingredients receive equal color territory, with transitions centered at their boundaries',()=>{
 assert.equal(mixStripe(['green','amber']),'linear-gradient(90deg,green 0%,green 44%,amber 56%,amber 100%)');
 const four=mixStripe(['green','green','green','purple']);assert.match(four,/green 55%,green 70%,purple 80%,purple 100%/);
 assert.equal(mixStripe([]),'none');
});
