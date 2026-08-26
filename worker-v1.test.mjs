import assert from 'node:assert/strict';
import worker from './worker.js';

const DS={strains:'90289161-102c-4070-9fcf-1805edcd28c1',batches:'eab15a0d-95a3-4695-b106-62a1e52e312b',sessions:'1fa2f04b-41fe-4de5-bc28-9f3c432d1234',invites:'ea3be0a8-c8f9-4857-bc1f-3c0ae6399cfb',terpenes:'84f1093f-2e26-4aae-8aa1-315896716d2d'};
const pageId='11111111-1111-1111-1111-111111111111';
const batchId='22222222-2222-2222-2222-222222222222';
const terpId='33333333-3333-3333-3333-333333333333';
const calls=[];
let existingPhoto=false;

function titleProp(value){return {title:[{plain_text:value}]};}
function richProp(value){return {rich_text:[{plain_text:value}]};}

globalThis.fetch=async (url,opts={})=>{
  calls.push({url:String(url),opts});
  const u=String(url);
  if(u.includes(`/data_sources/${DS.invites}/query`)) return Response.json({results:[
    {properties:{Status:{select:{name:'Active'}},Code:titleProp('TEST-CODE'),'Given To':richProp('Cyrus')}},
    {properties:{Status:{select:{name:'Active'}},Code:titleProp('AMBER-CODE'),'Given To':richProp('Amber')}},
  ]});
  if(u.includes(`/data_sources/${DS.strains}/query`)) return Response.json({results:[{id:pageId,properties:{Name:titleProp('Test Strain'),Photo:{files:existingPhoto?[{type:'file',name:'strain.jpg',file:{url:'https://files.example/strain.jpg'}}]:[]},Batches:{relation:[{id:batchId}]}}}]});
  if(u.includes(`/data_sources/${DS.batches}/query`)) return Response.json({results:[{id:batchId,properties:{Batch:titleProp('Test Batch'),Brand:{select:{name:'Maven'}},Type:{select:{name:'Hybrid'}},'THC %':{number:.25},Terpenes:{relation:[{id:terpId}]},'Terpenes (ms)':{multi_select:[]},Strains:{relation:[{id:pageId}]},'Purchase Date':{date:{start:'2026-08-21'}}}}]});
  if(u.includes(`/data_sources/${DS.sessions}/query`)) return Response.json({results:[{properties:{'🌾 Batches':{relation:[{id:batchId}]},Blazers:{multi_select:[{name:'Cyrus'}]},'Overall Rating':{number:5},Euphoric:{select:{name:'🟢🟢'}},Focused:{select:{name:'-' }},Creative:{select:{name:'🟢'}},Social:{select:{name:'-'}},Giggly:{select:{name:'-'}},Energized:{select:{name:'🟢'}},Relaxed:{select:{name:'🟢🟢'}},'Couch-Locked':{select:{name:'🟢'}},Sleepy:{select:{name:'🟢🟢'}},Hungry:{select:{name:'-' }},Anxious:{select:{name:'-'}},Paranoid:{select:{name:'-'}},Washed:{select:{name:'-'}},"KO'd":{select:{name:'-'}},Dizzy:{select:{name:'-'}},Headache:{select:{name:'-'}}}}]});
  if(u.includes(`/data_sources/${DS.terpenes}/query`)) return Response.json({results:[{id:terpId,properties:{Name:titleProp('Limonene')}}]});
  if(u.endsWith('/v1/file_uploads')) return Response.json({id:'upload-1'});
  if(u.endsWith('/v1/file_uploads/upload-1/send')) return Response.json({id:'upload-1',status:'uploaded'});
  if(u.endsWith(`/v1/pages/${pageId}`) && opts.method==='PATCH') return Response.json({id:pageId,properties:{Photo:{files:[{type:'file',name:'strain.jpg',file:{url:'https://files.example/new-strain.jpg'}}]}}});
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
assert.deepEqual(getData.batches[0].Terps,['Limonene']);
assert.deepEqual(getData.terpenes,[{url:'https://app.notion.com/33333333333333333333333333333333',Name:'Limonene'}]);
assert.equal(getData.strains[0].photo,null);

calls.length=0;
const sessionRes=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'TEST-CODE',batchUrl:'https://app.notion.com/22222222222222222222222222222222',OverallRating:4,Relaxed:'🟢🟢',Sleepy:'🟢🟢',Anxious:'🔴🔴'})}),env);
assert.equal(sessionRes.status,200);
const sessionWrite=JSON.parse(calls.find(c=>c.url.endsWith('/v1/pages')).opts.body);
assert.equal(sessionWrite.properties['Overall Rating'].number,4);
assert.equal(sessionWrite.properties.Sleepy.select.name,'🟢🟢');
assert.equal(sessionWrite.properties.Anxious.select.name,'🔴🔴');

const invalidOverallRes=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'TEST-CODE',batchUrl:'https://app.notion.com/22222222222222222222222222222222',OverallRating:4.5})}),env);
assert.equal(invalidOverallRes.status,500);
assert.match((await invalidOverallRes.json()).error,/whole number/);

calls.length=0;
const strainRes=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'strain',code:'TEST-CODE',strainName:'Test Strain',brand:'Maven',type:'Hybrid',thc:'25',terpUrls:['https://app.notion.com/33333333333333333333333333333333']})}),env);
assert.equal(strainRes.status,200);
const batchWrite=JSON.parse(calls.find(c=>c.url.endsWith('/v1/pages')).opts.body);
assert.deepEqual(batchWrite.properties.Terpenes.relation,[{id:terpId}]);

calls.length=0;
const photoForm=new FormData();
photoForm.append('code','TEST-CODE');
photoForm.append('strainUrl','https://app.notion.com/11111111111111111111111111111111');
photoForm.append('replace','false');
photoForm.append('photo',new File([new Uint8Array([1,2,3])],'strain.jpg',{type:'image/jpeg'}));
const photoRes=await worker.fetch(new Request('https://worker.test/photo',{method:'POST',body:photoForm}),env);
assert.equal(photoRes.status,200);
assert.equal((await photoRes.json()).photo,'https://files.example/new-strain.jpg');
assert.ok(calls.some(c=>c.url.endsWith('/v1/file_uploads')));
assert.ok(calls.some(c=>c.url.endsWith('/v1/file_uploads/upload-1/send')));
const photoPatch=JSON.parse(calls.find(c=>c.url.endsWith(`/v1/pages/${pageId}`)).opts.body);
assert.equal(photoPatch.properties.Photo.files[0].type,'file_upload');

existingPhoto=true;
const amberForm=new FormData();
amberForm.append('code','AMBER-CODE');amberForm.append('strainUrl','https://app.notion.com/11111111111111111111111111111111');amberForm.append('replace','true');amberForm.append('photo',new File([new Uint8Array([4])],'replacement.jpg',{type:'image/jpeg'}));
const amberReplace=await worker.fetch(new Request('https://worker.test/photo',{method:'POST',body:amberForm}),env);
assert.equal(amberReplace.status,500);
assert.match((await amberReplace.json()).error,/Only Cyrus/);

const existingGet=await worker.fetch(new Request('https://worker.test/?code=TEST-CODE'),env);
assert.equal((await existingGet.json()).strains[0].photo,'https://files.example/strain.jpg');

console.log('worker v1 tests passed');
