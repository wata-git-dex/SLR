// One private SLR-owned alarm. No cron slot, recurring browser timer or recipient input.
export async function arm(storage,when=Date.now()+1000){
  const current=await storage.getAlarm();if(current==null||when<current)await storage.setAlarm(when);
}
export async function kickDelivery(env){
  if(!env.SLR_DELIVERY||env.SLR_PUSH_DELIVERY_ENABLED!=='on')return;
  const next=await env.SLR_PUSH_DB.prepare("SELECT MIN(due) AS due FROM deliveries WHERE status='pending'").bind().first();if(next?.due==null)return;
  const response=await env.SLR_DELIVERY.get(env.SLR_DELIVERY.idFromName('slr-deliveries')).fetch(new Request('https://slr.internal/kick',{method:'POST'}));
  if(!response.ok)throw Error('Delivery queue could not be scheduled');
}
export async function runAlarm(storage,env,drain){
  if(env.SLR_PUSH_DELIVERY_ENABLED!=='on')return;
  try{
    const due=await env.SLR_PUSH_DB.prepare("SELECT 1 AS pending FROM deliveries WHERE status='pending' AND due<=? LIMIT 1").bind(Date.now()).first();
    if(due)await drain();
    const next=await env.SLR_PUSH_DB.prepare("SELECT MIN(due) AS due FROM deliveries WHERE status='pending'").bind().first();
    if(next?.due!=null)await arm(storage,Math.max(Date.now()+1000,next.due));
  }catch{await arm(storage,Date.now()+60000);}
}
