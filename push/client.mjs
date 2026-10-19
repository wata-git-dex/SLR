export function installationRequired(nav=navigator,standalone=matchMedia('(display-mode: standalone)').matches) {
  return (/iPad|iPhone|iPod/.test(nav.userAgent)||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1))&&!standalone&&!nav.standalone;
}
export async function badge(count,nav=navigator) {
  try {if(count>0)await nav.setAppBadge?.(count);else await nav.clearAppBadge?.();}catch{}
}
export function keyBytes(key) {return Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
export class NotificationClient {
  constructor({request,identity,registration}) {this.request=request;this.identity=identity;this.registration=registration;this.generation=0;this.state=null;try{this.device=JSON.parse(localStorage.getItem('slr.push.device.v1')||'null');this.deviceId=this.device?.subject===identity()?this.device.id:null;}catch{}}
  reset(){this.generation++;this.state=null;this.pending=null;this.deviceId=null;void badge(0);}
  async refresh(){
    const owner=this.identity(),generation=this.generation;if(!owner)return null;
    if(this.pending?.owner===owner)return this.pending.promise;
    const promise=(async()=>{const data=await this.request('state');
      if(this.generation!==generation||owner!==this.identity())return null;
      this.state=data;await badge(data.unread);return data;
    })().finally(()=>{if(this.pending?.promise===promise)this.pending=null;});
    this.pending={owner,promise};return promise;
  }
  async markAllRead(){
    const owner=this.identity(),generation=this.generation,through=this.state?.readThrough;
    if(!Number.isSafeInteger(through))throw Error('Reload the inbox before marking all read.');
    if(!navigator.onLine)throw Error('You’re offline. Your unread alerts have not been changed.');
    await this.request('read-all',{through});
    if(owner!==this.identity()||generation!==this.generation)return null;
    // An earlier unfinished state read must not restore the pre-ack count or OS badge.
    this.generation++;this.pending=null;
    return this.refresh();
  }
  async enable(){
    if(installationRequired())throw Error('In Safari, use Share → Add to Home Screen, then open SLR from its icon.');
    if(!globalThis.Notification||!globalThis.PushManager)throw Error('Device notifications are unavailable in this browser.');
    if(!this.state?.publicKey)throw Error('Connect and load notification settings first.');
    const owner=this.identity(),generation=this.generation;
    // Must run synchronously from the user click, before any network/worker awaits.
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw Error('Permission was not granted. You can change this in device notification settings.');
    if(owner!==this.identity()||generation!==this.generation)throw Error('Account changed. Open settings again.');
    let reg=await this.registration();
    if(!reg.active)reg=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Offline setup is still installing. Try again shortly.')),15000);navigator.serviceWorker.ready.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
    const installed=await workerMessage(reg.active,{type:'SLR_VERSION'});
    if(installed?.push!==true)throw Error('Apply the available app update before enabling notifications, or close all SLR windows and reopen the app.');
    let sub=await reg.pushManager.getSubscription();
    if(sub&&this.device?.subject!==owner){await sub.unsubscribe();sub=null;}
    if(sub&&sub.options.applicationServerKey&&Array.from(new Uint8Array(sub.options.applicationServerKey)).join()!==Array.from(keyBytes(this.state.publicKey)).join()){
      await sub.unsubscribe();sub=null;
    }
    sub ||= await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(this.state.publicKey)});
    try{
      if(owner!==this.identity()||generation!==this.generation)throw Error('Account changed. Open settings again.');
      const result=await this.request('subscribe',{subscription:sub.toJSON()});if(owner!==this.identity()||generation!==this.generation)throw Error('Account changed. Open settings again.');this.deviceId=result.id;this.device={subject:owner,id:result.id};try{localStorage.setItem('slr.push.device.v1',JSON.stringify(this.device));}catch{}
    }catch(error){await sub.unsubscribe().catch(()=>{});throw error;}
    return this.refresh();
  }
  async disable(){
    const reg=await this.registration(),sub=await reg.pushManager.getSubscription();
    if(sub){
      // Stop browser delivery even if the server is unreachable. Surface server failure.
      const endpoint=sub.endpoint;if(!await sub.unsubscribe())throw Error('The browser could not disable this subscription.');
      await this.request('unsubscribe',{endpoint});
    }
    this.deviceId=null;this.device=null;try{localStorage.removeItem('slr.push.device.v1');}catch{}return this.refresh();
  }
  async reconcileDevice(){
    const owner=this.identity(),generation=this.generation;
    const reg=await this.registration(),sub=await reg.pushManager.getSubscription();
    if(!sub||globalThis.Notification?.permission!=='granted')return;
    if(this.device?.subject!==owner||!this.state?.devices?.some(d=>d.id===this.device.id)){await sub.unsubscribe();this.deviceId=null;return;}
    if(owner!==this.identity()||generation!==this.generation)return;
    const result=await this.request('subscribe',{subscription:sub.toJSON()});
    if(owner===this.identity()&&generation===this.generation)this.deviceId=result.id;
  }
}
export function workerMessage(worker,message) {
  return new Promise((resolve,reject)=>{
    if(!worker){reject(Error('No installed application worker yet.'));return;}
    const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('Apply the available app update, or close all SLR windows and reopen the app, then retry.'));},4000);
    channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
    worker.postMessage(message,[channel.port2]);
  });
}
