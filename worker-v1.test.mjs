import assert from 'node:assert/strict';
import worker from './worker.js';

const DS={strains:'90289161-102c-4070-9fcf-1805edcd28c1',batches:'eab15a0d-95a3-4695-b106-62a1e52e312b',sessions:'1fa2f04b-41fe-4de5-bc28-9f3c432d1234',invites:'ea3be0a8-c8f9-4857-bc1f-3c0ae6399cfb',terpenes:'84f1093f-2e26-4aae-8aa1-315896716d2d',legacyRatings:'fe8f9aea-1a95-4aff-8579-cb1a4d53c89a'};
const pageId='11111111-1111-1111-1111-111111111111';
const batchId='22222222-2222-2222-2222-222222222222';
const terpId='33333333-3333-3333-3333-333333333333';
const calls=[];

function titleProp(value){return {title:[{plain_text:value}]};}
function richProp(value){return {rich_text:[{plain_text:value}]};}

globalThis.fetch=async (url,opts={})=>{
  calls.push({url:String(url),opts});
  const u=String(url);
  if(u.includes(`/data_sources/${DS.invites}/query`)) return Response.json({results:[{properties:{Status:{select:{name:'Active'}},Code:titleProp('TEST-CODE'),'Given To':richProp('Cyrus')}}]});
  if(u.includes(`/data_sources/${DS.strains}/query`)) return Response.json({results:[{id:pageId,properties:{Name:titleProp('Test Strain'),Photo:{files:[]},Batches:{relation:[{id:batchId}]}}}]});
  if(u.includes(`/data_sources/${DS.batches}/query`)) return Response.json({results:[{id:batchId,properties:{Batch:titleProp('Test Batch'),Brand:{select:{name:'Maven'}},Type:{select:{name:'Hybrid'}},'THC %':{number:.25},Terpenes:{relation:[{id:terpId}]},'Terpenes (ms)':{multi_select:[]},Strains:{relation:[{id:pageId}]},'Purchase Date':{date:{start:'2026-08-21'}}}}]});
  if(u.includes(`/data_sources/${DS.sessions}/query`)) return Response.json({results:[{properties:{'🌾 Batches':{relation:[{id:batchId}]},Blazers:{multi_select:[{name:'Cyrus'}]},'Overall Rating':{number:5},Euphoric:{select:{name:'🟢🟢'}},Focused:{select:{name:'-' }},Creative:{select:{name:'🟢'}},Social:{select:{name:'-'}},Giggly:{select:{name:'-'}},Energized:{select:{name:'🟢'}},Relaxed:{select:{name:'🟢🟢'}},'Couch-Locked':{select:{name:'🟢'}},Sleepy:{select:{name:'🟢🟢'}},Hungry:{select:{name:'-' }},Anxious:{select:{name:'-'}},Paranoid:{select:{name:'-'}},Washed:{select:{name:'-'}},"KO'd":{select:{name:'-'}},Dizzy:{select:{name:'-'}},Headache:{select:{name:'-'}}}}]});
  if(u.includes(`/data_sources/${DS.terpenes}/query`)) return Response.json({results:[{id:terpId,properties:{Name:titleProp('Limonene')}}]});
  if(u.includes(`/data_sources/${DS.legacyRatings}/query`)) return Response.json({results:[
    {properties:{Enabled:{checkbox:true},Strain:{relation:[{id:pageId}]},Blazer:{select:{name:'Cyrus'}},'Pre-v1.0 Score':{number:85},'Legacy Rating':{number:4},'Source Sessions':{number:1}}},
    {properties:{Enabled:{checkbox:false},Strain:{relation:[{id:pageId}]},Blazer:{select:{name:'Amber'}},'Pre-v1.0 Score':{number:90},'Legacy Rating':{number:5},'Source Sessions':{number:1}}}
  ]});
  if(u.endsWith('/v1/pages')) return Response.json({id:'44444444-4444-4444-4444-444444444444'});
  throw new Error(`Unexpected fetch ${u}`);
};

const env={NOTION_TOKEN:'test',ALLOWED_ORIGIN:'https://example.test'};
const getRes=await worker.fetch(new Request('https://worker.test/?code=TEST-CODE'),env);
assert.equal(getRes.status,200);
const getData=await getRes.json();
assert.equal(getData.viewer,'Cyrus');
assert.equal(getData.sessions[0].OverallRating,5);
assert.equal(getData.sessions[0].Sleepy,'🟢🟢');
assert.equal(getData.sessions[0].KnockedOut,'-');
assert.deepEqual(getData.legacyRatings,[{Strain:'https://app.notion.com/11111111111111111111111111111111',Blazer:'Cyrus',PreV1Score:85,LegacyRating:4,SourceSessions:1}]);
assert.deepEqual(getData.batches[0].Terps,['Limonene']);
assert.deepEqual(getData.terpenes,[{url:'https://app.notion.com/33333333333333333333333333333333',Name:'Limonene'}]);

calls.length=0;
const sessionRes=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'TEST-CODE',batchUrl:'https://app.notion.com/22222222222222222222222222222222',OverallRating:4.5,Relaxed:'🟢🟢',Sleepy:'🟢🟢',Anxious:'🔴🔴'})}),env);
assert.equal(sessionRes.status,200);
const sessionWrite=JSON.parse(calls.find(c=>c.url.endsWith('/v1/pages')).opts.body);
assert.equal(sessionWrite.properties['Overall Rating'].number,4.5);
assert.equal(sessionWrite.properties.Sleepy.select.name,'🟢🟢');
assert.equal(sessionWrite.properties.Anxious.select.name,'🔴🔴');

const invalidOverallRes=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'TEST-CODE',batchUrl:'https://app.notion.com/22222222222222222222222222222222',OverallRating:4.2})}),env);
assert.equal(invalidOverallRes.status,500);
assert.match((await invalidOverallRes.json()).error,/half-point steps/);

calls.length=0;
const strainRes=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'strain',code:'TEST-CODE',strainName:'Test Strain',brand:'Maven',type:'Hybrid',thc:'25',terpUrls:['https://app.notion.com/33333333333333333333333333333333']})}),env);
assert.equal(strainRes.status,200);
const batchWrite=JSON.parse(calls.find(c=>c.url.endsWith('/v1/pages')).opts.body);
assert.deepEqual(batchWrite.properties.Terpenes.relation,[{id:terpId}]);

console.log('worker v1 tests passed');
