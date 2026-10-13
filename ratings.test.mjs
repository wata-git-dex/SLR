import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('const EFFECTS='),html.indexOf('function verdictFor('));
function run(expression){const ctx=vm.createContext({localStorage:{getItem:()=>null},CARD_VIEW_KEY:'test',parseArr:v=>v||[]});vm.runInContext(source,ctx);return vm.runInContext(expression,ctx);}
test('missing and legacy effect-only sessions stay unrated; valid historical stars count',()=>{
 assert.equal(run("aggregateSessions([{OverallRating:4},{OverallRating:2},{OverallRating:null},{Relaxed:'🟢🟢'},{OverallRating:0},{OverallRating:6}]).score"),3);
 assert.equal(run("aggregateSessions([{Relaxed:'🟢🟢'}]).score"),null);
 assert.equal(run("sessionOverallRating({Date:'2025-01-01',OverallRating:5})"),5);
});
test('community gives members equal weight instead of weighting frequent loggers',()=>{
 assert.equal(run("communityAggregate([{Blazers:['A'],OverallRating:5},{Blazers:['A'],OverallRating:5},{Blazers:['B'],OverallRating:1}]).score"),3);
});
