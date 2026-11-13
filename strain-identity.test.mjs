import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import worker from './worker.js';

const oldId='11111111-1111-1111-1111-111111111111',newId='22222222-2222-2222-2222-222222222222',createdId='33333333-3333-3333-3333-333333333333';
const url=id=>'https://app.notion.com/'+id.replaceAll('-','');
const title=value=>({title:[{plain_text:value}]}),strain=id=>({id,properties:{Name:title('Durban Poison')}});
const batch=(id,brand)=>({properties:{Brand:{select:{name:brand}},Strains:{relation:[{id}]}}});
let strains=[strain(oldId)],batches=[batch(oldId,'Claybourne')],writes=[],paginated=false,cursors=[];
globalThis.fetch=async (address,options={})=>{
  const path=String(address),body=options.body?JSON.parse(options.body):{};
  if(path.includes('ea3be0a8-c8f9-4857-bc1f-3c0ae6399cfb/query'))return Response.json({results:[{id:'44444444-4444-4444-4444-444444444444',properties:{Code:title('fixture'),'Given To':{rich_text:[{plain_text:'Cyrus'}]},Status:{select:{name:'Active'}}}}]});
  if(path.includes('90289161-102c-4070-9fcf-1805edcd28c1/query')){
    cursors.push(body.start_cursor);
    if(paginated&&!body.start_cursor)return Response.json({results:[],has_more:true,next_cursor:'second-page'});
    return Response.json({results:strains,has_more:false});
  }
  if(path.includes('eab15a0d-95a3-4695-b106-62a1e52e312b/query'))return Response.json({results:batches,has_more:false});
  if(path.endsWith('/v1/pages')&&options.method==='POST'){writes.push(body);return Response.json({id:createdId});}
  throw Error('Unexpected operation '+path);
};
async function add(values){
  writes=[];cursors=[];
  const response=await worker.fetch(new Request('https://fixture/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'strain',code:'fixture',strainName:'Durban Poison',brand:'Luana',type:'Sativa',thc:28,...values})}),{NOTION_TOKEN:'fixture'});
  return {status:response.status,data:await response.json(),writes:[...writes]};
}
const batchWrite=result=>result.writes.find(value=>value.parent.data_source_id==='eab15a0d-95a3-4695-b106-62a1e52e312b');
test('different brands stay separate, including older clients with no explicit choice',async()=>{
  const result=await add({});assert.equal(result.status,200);assert.equal(result.writes.length,2);
  assert.equal(result.data.strainId,createdId);assert.equal(batchWrite(result).properties.Strains.relation[0].id,createdId);
  assert.equal(batchWrite(result).properties.Brand.select.name,'Luana');
});
test('older clients reuse only one same-brand match, across paginated catalog reads',async()=>{
  strains=[strain(oldId),strain(newId)];batches=[batch(oldId,'Claybourne'),batch(newId,'Luana')];paginated=true;
  const result=await add({brand:'luana'});assert.equal(result.status,200);assert.equal(result.data.strainId,newId);assert.equal(result.writes.length,1);
  assert.ok(cursors.includes('second-page'));assert.equal(batchWrite(result).properties.Brand.select.name,'Luana');paginated=false;
});
test('explicit separate choice creates a new entry even when name and brand match',async()=>{
  const result=await add({createSeparate:true});assert.equal(result.status,200);assert.equal(result.data.strainId,createdId);assert.equal(result.writes.length,2);
});
test('explicit existing target selects the correct ID; a different-brand target is rejected before writes',async()=>{
  let result=await add({existingStrainUrl:url(newId)});assert.equal(result.status,200);assert.equal(result.data.strainId,newId);assert.equal(result.writes.length,1);
  result=await add({existingStrainUrl:url(oldId)});assert.equal(result.status,500);assert.match(result.data.error,/Different brands/);assert.equal(result.writes.length,0);
  result=await add({existingStrainUrl:url(createdId)});assert.equal(result.status,500);assert.match(result.data.error,/no longer matches/);assert.equal(result.writes.length,0);
});
test('main cards and profile statistics never pool same-name strains or their ratings',()=>{
  const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
  const context=vm.createContext({localStorage:{getItem:()=>null},CARD_VIEW_KEY:'fixture',parseArr:value=>value||[],CURRENT_MEMBER:'Cyrus',SCORE_VIEW:'community',SLRAchievements:{typeFamily:value=>value},mode:values=>values[0],formatRating:value=>String(value)});
  vm.runInContext(html.slice(html.indexOf('const EFFECTS='),html.indexOf('function verdictFor(')),context);
  vm.runInContext(html.slice(html.indexOf('function verdictFor('),html.indexOf('let STRAINS = process(')),context);
  vm.runInContext(html.slice(html.indexOf('function sessionSpecimens('),html.indexOf('function ratColors(')),context);
  Object.assign(context,{RAW_STRAINS:[{url:'clay',Name:'Durban Poison',Batches:['clay-batch']},{url:'luana',Name:'Durban Poison',Batches:['luana-batch']}],RAW_BATCHES:[{url:'clay-batch',Strain:'clay',Brand:'Claybourne',Terps:['Ocimene']},{url:'luana-batch',Strain:'luana',Brand:'Luana',Terps:['Myrcene']}],RAW_SESSIONS:[{Batch:['clay-batch'],Blazers:['Cyrus'],OverallRating:5},{Batch:['luana-batch'],Blazers:['Cyrus'],OverallRating:2}]});
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(process(RAW_STRAINS,RAW_BATCHES,RAW_SESSIONS).map(s=>({id:s.url,score:s.score,brands:s.brands,terps:s.terpenes})))',context)),[{id:'clay',score:5,brands:['Claybourne'],terps:['Ocimene']},{id:'luana',score:2,brands:['Luana'],terps:['Myrcene']}]);
  const stats=JSON.parse(vm.runInContext('JSON.stringify(memberLabStats("Cyrus"))',context));
  assert.equal(stats.strains,2);assert.equal(stats.topRated.length,2);assert.match(stats.topRated[0].strain,/Claybourne/);assert.match(stats.topRated[1].strain,/Luana/);
});
