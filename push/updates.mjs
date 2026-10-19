// Explicit checks only. The page and its worker can be released independently.
export async function waitForInstall(registration,timeout=15000){
  const worker=registration.installing;if(!worker)return;
  await new Promise((resolve,reject)=>{
    const done=()=>{clearTimeout(timer);worker.removeEventListener('statechange',changed);};
    const changed=()=>{if(worker.state==='installed'||worker.state==='activated'){done();resolve();}else if(worker.state==='redundant'){done();reject(Error('The update could not install. Please try again.'));}};
    const timer=setTimeout(()=>{done();reject(Error('The update is still downloading. Please check again shortly.'));},timeout);
    worker.addEventListener('statechange',changed);changed();
  });
}
export async function checkAppUpdate(registration,currentVersion,fetcher=fetch){
  await registration.update();
  await waitForInstall(registration);
  let response;
  try{response=await fetcher('/',{cache:'no-store',credentials:'omit',headers:{Accept:'text/html'},signal:AbortSignal.timeout(15000)});}
  catch{throw Error('Could not check app updates. Check your connection and try again.');}
  if(!response.ok)throw Error('Could not check app updates. Please try again.');
  const html=await response.text();
  const version=html.match(/const APP_VERSION\s*=\s*['"](v[\d.]+)['"]/)?.[1];
  if(!version)throw Error('Could not confirm the latest app version. Please try again.');
  return {version,available:Boolean(registration.waiting)||version!==currentVersion};
}
export async function applyAppUpdate({registration,safeToUpdate,available,send,reload,serviceWorker,timeout=12000}){
  if(!safeToUpdate())throw Error('Save or close your open form, upload or Lab view before updating.');
  const waiting=registration.waiting;
  if(!waiting){if(!available)throw Error('Check for an update first.');reload();return;}
  const controlled=Boolean(serviceWorker.controller);
  // Listen before requesting takeover so a fast controllerchange cannot be missed.
  let listener,timer;
  const takeover=new Promise((resolve,reject)=>{
    listener=()=>resolve();serviceWorker.addEventListener('controllerchange',listener);
    timer=setTimeout(()=>reject(Error('The update has not finished. Close and reopen SLR when your work is saved.')),timeout);
  });
  // Keep a rejection handled while awaiting the worker response.
  takeover.catch(()=>{});
  try{
    const result=await send(waiting,{type:'SLR_APPLY_UPDATE'});
    if(!result.ok)throw Error(result.error||'The update could not be applied.');
    if(controlled)await takeover;
    if(!safeToUpdate())throw Error('Finish your open work, then reopen SLR to use the update.');
    reload();
  }finally{clearTimeout(timer);serviceWorker.removeEventListener('controllerchange',listener);}
}
