export class MixClient{
  constructor({api,code,member,fetcher=fetch,writer=fetch,storage=localStorage,clock=Date.now,verified=()=>true}){Object.assign(this,{api,code,member,fetcher,writer,storage,clock,verified});this.reads=new Map();this.cache=new Map();this.scopeIdentity='';this.scopeKey='';this.generation=0;}
  identity(){return String(this.code()||'')+'|'+String(this.member()||'').trim().toLowerCase();}
  async prepareScope(){const identity=this.identity();if(this.scopeIdentity===identity&&this.scopeKey)return this.scopeKey;const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));if(identity!==this.identity())throw Error('Account changed. Reopen Mixes.');this.scopeIdentity=identity;this.scopeKey='slr.mix.draft.v1:'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');return this.scopeKey;}
  persistSync(draft){if(this.scopeIdentity!==this.identity()||!this.scopeKey)throw Error('Reopen Mixes to restore your draft.');this.storage.setItem(this.scopeKey,JSON.stringify({version:1,...draft}));}
  async draft(){const key=await this.prepareScope();try{const item=JSON.parse(this.storage.getItem(key)||'null');return item?.version===1?item:null;}catch{return null;}}
  clearDraft(operationId){if(this.scopeIdentity!==this.identity())return;const value=JSON.parse(this.storage.getItem(this.scopeKey)||'null');if(value?.operationId===operationId)this.storage.removeItem(this.scopeKey);}
  async request(action,data={},write=false){
    if(write&&!this.verified())throw Error('Wait for your Lab profile to finish loading.');
    const identity=this.identity(),code=this.code(),generation=this.generation;if(!code)throw Error('Open the app with your invite code first.');
    const key=identity+'|'+action+'|'+JSON.stringify(data);
    if(!write&&this.reads.has(key))return this.reads.get(key);
    const task=(async()=>{
      const res=await (write?this.writer:this.fetcher)(this.api+'/experiments/'+action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,data}),signal:AbortSignal.timeout(25000)});
      const body=await res.json();if(identity!==this.identity()||(!write&&generation!==this.generation)||(body.viewer&&body.viewer.trim().toLowerCase()!==String(this.member()||'').trim().toLowerCase()))throw Object.assign(Error('Account changed. Reopen Mixes.'),{stale:true});
      if(!res.ok||!body.ok)throw Object.assign(Error(body.error||'Could not save or load mixes.'),{needsCode:res.status===401});
      if(write){this.generation++;this.cache.clear();this.reads.clear();}return body;
    })();
    if(!write){this.reads.set(key,task);task.finally(()=>{if(this.reads.get(key)===task)this.reads.delete(key);}).catch(()=>{});}return task;
  }
  async list(scope,cursor=null,force=false){const key=this.identity()+'|'+scope+'|'+(cursor||''),cached=this.cache.get(key);if(!force&&cached&&this.clock()-cached.at<30000)return cached.data;const identity=this.identity(),data=await this.request('list',{scope,cursor});if(identity===this.identity())this.cache.set(key,{at:this.clock(),data});return data;}
}
