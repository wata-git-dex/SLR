import {NotificationClient,installationRequired,workerMessage,badge} from './client.mjs?v=2.6.17';
import {checkAppUpdate,applyAppUpdate} from './updates.mjs';
const host=window.SLRPushHost;
const root=document.getElementById('slrPush'),updates=document.getElementById('slrUpdates');
const status=document.getElementById('pushStatus'),updateStatus=document.getElementById('pushUpdateStatus');
const get=id=>document.getElementById(id);
let registrationPromise,client,identity='',identityCode='',busy=false,lastRead=0,applying=false,reg,updateBusy=false,updateAvailable=false;
const supported=()=>isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
function say(text){status.textContent=text;}
function openInbox(refreshInbox=true){
  if(!identity)return;
  host.openSettings();root.open=true;
  get('pushInbox').scrollIntoView({block:'start'});
  get('pushInboxHeading').focus({preventScroll:true});
  if(refreshInbox)void run(()=>refresh(true),'Loading alerts…');
}
function showUpdate(text){updateStatus.textContent=text;}
async function registration(){
  if(!isSecureContext||!('serviceWorker' in navigator))throw Error('App updates are unavailable in this browser.');
  registrationPromise ||= navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(error=>{registrationPromise=null;throw error;});
  reg=await registrationPromise;
  if(!reg.slrWatching){
    reg.slrWatching=true;
    reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&reg.waiting)updateReady();});});
  }
  return reg;
}
export async function request(action,data,code=host.code()){
  if(!code)throw Error('Enter your invite code first.');
  const response=await fetch(host.api+'/notifications/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,data}),cache:'no-store',credentials:'omit'});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Notification request failed.');return result;
}
const make=(tag,text)=>{const element=document.createElement(tag);if(text)element.textContent=text;return element;};
function button(label,fn,icon=false){const b=make('button',icon?'✓':label);b.className=icon?'slrPushQuiet slrPushIcon':'slrPushQuiet';if(icon){b.setAttribute('aria-label',label);b.title=label;}b.type='button';b.disabled=busy;b.addEventListener('click',()=>run(fn));return b;}
function preferenceRows(parent,device,deviceLabel='this device'){
  for(const [key,label]of [['achievement_enabled','Achievements'],['account_enabled','Device alerts']]){
    const wrap=make('label'),toggle=make('input');wrap.className='slrPushSetting';toggle.type='checkbox';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label',`${label}, ${deviceLabel}`);toggle.checked=Boolean(device[key]);toggle.disabled=busy;wrap.append(make('span',label),toggle);
    toggle.addEventListener('change',()=>{const checked=toggle.checked;void run(async()=>{const values={account:Boolean(device.account_enabled),achievements:Boolean(device.achievement_enabled)};values[key==='account_enabled'?'account':'achievements']=checked;await request('preferences',{id:device.id,...values});await refresh(true);});});parent.append(wrap);
  }
}
function render(){
  get('pushRefresh').disabled=busy;const state=client?.state;if(!state)return;
  get('pushCount').textContent=state.unread?` · ${state.unread} unread`:'';
  const current=state.devices.find(device=>device.id===client.deviceId);
  const needsInstall=installationRequired();
  get('pushPermission').textContent=!supported()?'Device alerts are unavailable in this browser.':needsInstall?'Open SLR from its Home Screen icon to enable alerts.':globalThis.Notification?.permission==='denied'?'Allow notifications in your device settings to turn these on.':current?'Notifications are on.':'Get notified about new achievements.';
  get('pushEnabled').checked=Boolean(current);get('pushEnabled').disabled=busy||needsInstall||!supported();
  const currentPanel=get('pushCurrent');currentPanel.replaceChildren();if(current)preferenceRows(currentPanel,current);
  const devices=get('pushDevices');devices.replaceChildren();
  const others=state.devices.filter(device=>device.id!==client.deviceId);get('pushOther').hidden=!others.length;get('pushDeviceCount').textContent=` · ${others.length}`;
  others.forEach((device,index)=>{
    const row=make('div');row.className='slrPushDevice';const head=make('div');head.className='slrPushDeviceHead';head.append(make('b',`Device ${index+1}`),button('Remove',async()=>{await request('remove-device',{id:device.id});await refresh(true);}));row.append(head);preferenceRows(row,device,`device ${index+1}`);devices.append(row);
  });
  const events=get('pushEvents');events.replaceChildren();
  if(!state.events.length)events.append(make('p','No notifications yet. New achievements will appear here.'));
  state.events.forEach(event=>{
    const row=make('div');row.className='slrPushRow';if(event.read_at===null)row.dataset.unread='';
    const label=make('span',event.category==='achievement'?'New achievement':event.category==='test'?'Test notification':'Device enabled');const time=make('time',new Date(event.created).toLocaleString());time.dateTime=new Date(event.created).toISOString();label.append(time);row.append(label);
    const read=async()=>{await request('read',{ids:[event.id]});await refresh(true);};
    if(event.category==='achievement')row.append(button('View',async()=>{await read();host.profile();}));
    else if(event.read_at===null)row.append(button('Mark read',read,true));events.append(row);
  });
  get('pushRead').disabled=busy||!state.unread||!Number.isSafeInteger(state.readThrough);
  get('pushRefresh').disabled=busy;get('pushTest').hidden=!current;get('pushTest').disabled=busy||!current;
}
async function refresh(force=false){
  if(!identity||document.hidden)return;
  if(!navigator.onLine){if(force)throw Error('You’re offline. Your unread alerts have not been changed.');return;}
  if(!force&&Date.now()-lastRead<30000)return;
  const c=client;const state=await c.refresh();if(c!==client||!state)return;lastRead=Date.now();render();
}
async function run(action,message=''){
  if(busy)return;busy=true;const owner=identity;say(message);get('pushEvents').setAttribute('aria-busy','true');render();
  try{await action();if(status.textContent===message)say('');}catch(error){if(owner===identity){if(!client?.state)get('pushPermission').textContent='Couldn’t load notification settings.';say(error.message);}}finally{busy=false;get('pushEvents').setAttribute('aria-busy','false');render();}
}
function updateReady(){updateAvailable=true;get('pushApply').hidden=false;showUpdate('Update ready. Save your work before updating.');}
async function authenticated(member){
  const code=host.code();
  if(member!==identity||code!==identityCode){client?.reset();identity=member;identityCode=code;lastRead=0;say('');client=new NotificationClient({identity:()=>identity,request:(action,data)=>request(action,data,code),registration});}
  root.hidden=!identity;updates.hidden=!identity;get('pushVersion').textContent=`App ${host.version}`;
  if(!identity)return;
  // App updates do not depend on notification permission or push support.
  try{await registration();if(reg.waiting)updateReady();}catch(error){showUpdate(error.message);}
  try{await refresh();if(supported()&&client?.state){await client.reconcileDevice();render();}}catch(error){get('pushPermission').textContent='Couldn’t load notification settings.';say(error.message);}
  if(location.hash==='#notifications')openInbox(false);
}
async function signOut(code){
  identity='';identityCode='';client?.reset();client=null;root.hidden=true;updates.hidden=true;await badge(0);
  try{const r=await registration(),sub=await r.pushManager.getSubscription();if(sub){const endpoint=sub.endpoint;await sub.unsubscribe();await request('unsubscribe',{endpoint},code);}}catch{/* No credentials are saved in the worker. Revoked invites are checked at dispatch. */}
  try{localStorage.removeItem('slr.push.device.v1');}catch{}
}
get('pushEnabled').addEventListener('change',()=>{const enabled=get('pushEnabled').checked;void run(async()=>{if(enabled)await client.enable();else await client.disable();});});
get('pushTest').addEventListener('click',()=>run(async()=>{await request('test',{});await refresh(true);say('Test queued. Check your device notifications.');}));
get('pushRead').addEventListener('click',()=>run(async()=>{await client.markAllRead();render();},'Marking all read…'));
get('pushRefresh').addEventListener('click',()=>run(()=>refresh(true),'Loading alerts…'));
async function runUpdate(action){
  if(updateBusy)return;updateBusy=true;get('pushCheck').disabled=true;get('pushApply').disabled=true;
  try{await action();}catch(error){showUpdate(error.message);}finally{updateBusy=false;get('pushCheck').disabled=false;get('pushApply').disabled=false;}
}
get('pushCheck').addEventListener('click',()=>runUpdate(async()=>{
  showUpdate('Checking for updates…');
  const result=await checkAppUpdate(await registration(),host.version);
  updateAvailable=result.available;get('pushApply').hidden=!result.available;
  showUpdate(result.available?`Update ready (${result.version}). Save your work before updating.`:`You’re up to date (${host.version}).`);
}));
get('pushApply').addEventListener('click',()=>runUpdate(async()=>{
  showUpdate('Applying update…');applying=true;
  try{await applyAppUpdate({registration:await registration(),safeToUpdate:host.safeToUpdate,available:updateAvailable,send:workerMessage,reload:()=>location.reload(),serviceWorker:navigator.serviceWorker});}
  finally{applying=false;}
}));
root.addEventListener('toggle',()=>{if(root.open)void run(()=>refresh(),'Loading alerts…');});
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',event=>{if(['SLR_NOTIFICATION','SLR_SUBSCRIPTION_CHANGED'].includes(event.data?.type))void run(()=>refresh(true));});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void run(()=>refresh());});
window.addEventListener('online',()=>void run(()=>refresh(true)));
// An explicit update freezes editing until takeover; errors restore interaction.
document.addEventListener('click',event=>{if(applying){event.preventDefault();event.stopImmediatePropagation();}},true);
document.addEventListener('keydown',event=>{if(applying){event.preventDefault();event.stopImmediatePropagation();}},true);
window.SLRPush={authenticated,signOut,openInbox};
if(host.member())void authenticated(host.member());
