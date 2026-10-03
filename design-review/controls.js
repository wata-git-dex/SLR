// Controls belong to the review surface, never to the shipped app.
(() => {
  const root=document.documentElement;
  const toolbar=document.createElement('aside');
  toolbar.className='reviewToolbar';
  toolbar.setAttribute('aria-label','Design comparison');
  toolbar.innerHTML='<strong>SLR · Design review</strong><small>Current card layout · saved snapshot · no live writes</small>';
  document.body.prepend(toolbar);
  const themes=[['Cyrus · Green / Blue','','cyrus-app-icon-v2-512.png'],['Cyrus · Blue','cyrus-blue-theme','cyrus-app-icon-v2-512.png'],['Cyrus · Purple','cyrus-purple-theme','cyrus-app-icon-v2-512.png'],['Cyrus · Amber','interface-amber-theme','cyrus-app-icon-v2-512.png'],['Amber · Pink','amber-theme','amber-app-icon-512.png'],['Amber · Pink & White','amber-theme amber-light-theme','amber-app-icon-512.png'],['Amber · Amber','amber-theme interface-amber-theme','amber-app-icon-512.png'],['Piero · Red','piero-theme','piero-app-icon-512.png'],['Piero · Purple','piero-theme piero-purple-theme','piero-app-icon-512.png'],['Felipe · Green','felipe-theme','felipe-app-icon-512.png'],['Felipe · Yellow','felipe-theme felipe-yellow-theme','felipe-app-icon-512.png']];
  const select=document.createElement('select');select.setAttribute('aria-label','Theme preview');
  themes.forEach(([label],i)=>{const option=document.createElement('option');option.value=i;option.textContent=label;select.append(option);});toolbar.append(select);
  select.addEventListener('change',()=>{const [,classes,icon]=themes[Number(select.value)];root.classList.remove(...new Set(themes.flatMap(([,c])=>c.split(' ').filter(Boolean))));if(classes)root.classList.add(...classes.split(' '));document.querySelectorAll('.brandimg,.emblem img,.myLabAvatar img').forEach(img=>{img.src=icon;});});
  toolbar.querySelector('small').textContent='Theme only · sample data · no live writes';

  root.classList.add('weather-review','slr-glass');
  const material=document.createElement('button');
  material.textContent='Glass navigation';material.setAttribute('aria-pressed','true');
  material.addEventListener('click',()=>material.setAttribute('aria-pressed',String(root.classList.toggle('slr-glass'))));
  toolbar.append(material);
  // Bounded preview diagnostic: sample frame pacing after the first real scroll
  // in each material. No production instrumentation or recurring timer.
  const sampled=new Set();
  document.addEventListener('scroll',()=>{
    const mode=root.classList.contains('slr-glass')?'glass':'classic';
    if(sampled.has(mode))return;sampled.add(mode);
    const intervals=[];let previous;
    const frame=now=>{
      if(previous!==undefined)intervals.push(now-previous);previous=now;
      if(intervals.length<60){requestAnimationFrame(frame);return;}
      const sorted=[...intervals].sort((a,b)=>a-b);
      toolbar.dataset[mode+'Frames']=JSON.stringify({frames:60,medianMs:sorted[30],p95Ms:sorted[57],over34Ms:intervals.filter(x=>x>34).length});
    };requestAnimationFrame(frame);
  },{passive:true,capture:true});
  // Allow inspection of forms, but never authentication, refresh, photo or data writes.
  document.addEventListener('click',event=>{
    const action=event.target.closest('#refreshBtn,#asSubmit,#photoSave,#logSubmitBtn,#icSubmit');
    if(action){event.preventDefault();event.stopImmediatePropagation();toast('Design review — changes are not saved.');}
  },true);
  document.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();toast('Design review — changes are not saved.');},true);
})();
