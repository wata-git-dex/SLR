// Controls belong to the review surface, never to the shipped app.
(() => {
  const root=document.documentElement;
  const toolbar=document.createElement('aside');
  toolbar.className='reviewToolbar';
  toolbar.setAttribute('aria-label','Design comparison');
  toolbar.innerHTML='<strong>SLR · Design review</strong><button id="reviewCurrent" aria-pressed="false">Current cards</button><button id="reviewLayered" aria-pressed="true">Layered cards</button><button id="reviewPhotos" aria-pressed="false">Show thumbnails</button><button id="reviewLight" aria-pressed="false">Light mode</button><small>Saved snapshot · no live writes</small>';
  document.body.prepend(toolbar);
  root.classList.add('weather-review','no-card-photos');
  function arrangeCards(){
    document.querySelectorAll('.card:not(.gridCard)').forEach(card=>{
      const head=card.querySelector('.chead'),footer=card.querySelector('.cfoot');
      let score=card.querySelector('.score');
      if(!head||!footer)return;
      const layered=root.classList.contains('weather-review');
      if(layered&&!score){score=document.createElement('div');score.className='score reviewUnrated';score.textContent='—';score.setAttribute('aria-label','No overall rating recorded');head.append(score);}
      if(!layered&&score?.classList.contains('reviewUnrated')){score.remove();score=null;}
      const destination=layered?head:footer;
      if(score&&score.parentElement!==destination)destination.append(score);
      card.tabIndex=0;card.setAttribute('role','button');
      card.setAttribute('aria-label','View '+card.querySelector('.cn')?.textContent);
      if(!card.dataset.keyboardReady){card.dataset.keyboardReady='true';card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();card.click();}});}
    });
  }
  new MutationObserver(arrangeCards).observe(document.getElementById('grid'),{childList:true});
  function choose(layered){root.classList.toggle('weather-review',layered);document.getElementById('reviewCurrent').setAttribute('aria-pressed',String(!layered));document.getElementById('reviewLayered').setAttribute('aria-pressed',String(layered));document.getElementById('reviewPhotos').disabled=!layered;arrangeCards();}
  document.getElementById('reviewCurrent').onclick=()=>choose(false);
  document.getElementById('reviewLayered').onclick=()=>choose(true);
  document.getElementById('reviewPhotos').onclick=event=>{const hidden=root.classList.toggle('no-card-photos');event.currentTarget.textContent=hidden?'Show thumbnails':'Hide thumbnails';event.currentTarget.setAttribute('aria-pressed',String(!hidden));};
  document.getElementById('reviewLight').onclick=event=>{const light=!root.classList.contains('light-mode');setColorMode(light?'light':'dark');event.currentTarget.setAttribute('aria-pressed',String(light));};
  arrangeCards();
  // Allow inspection of forms, but never authentication, refresh, photo or data writes.
  document.addEventListener('click',event=>{
    const action=event.target.closest('#refreshBtn,#asSubmit,#photoSave,#logSubmitBtn,#icSubmit');
    if(action){event.preventDefault();event.stopImmediatePropagation();toast('Design review — changes are not saved.');}
  },true);
  document.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();toast('Design review — changes are not saved.');},true);
})();
