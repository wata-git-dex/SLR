// Recipe naming and equal-share color stops shared by the app and API.
export const defaultMixTitle=ingredients=>ingredients.map(row=>row.name).filter(Boolean).join(' × ');
export function displayMixTitle(record){
  const legacy=record.ingredients.map(row=>row.name).join(' + ').slice(0,80);
  return !record.title||record.title===legacy?defaultMixTitle(record.ingredients):record.title;
}
export function mixStripe(colors){
  if(!colors.length)return 'none';
  const share=100/colors.length,feather=Math.min(6,share/5),percent=value=>Number(value.toFixed(3))+'%';
  return 'linear-gradient(90deg,'+colors.flatMap((color,index)=>[
    color+' '+percent(index?index*share+feather:0),
    color+' '+percent(index===colors.length-1?100:(index+1)*share-feather)
  ]).join(',')+')';
}

// Distinct, separated serrated leaflets keep broad types readable at small sizes.
export function broadLeafSVG(family){
  const indica=family==='Indica',angles=indica?[-78,-39,0,39,78]:[-78,-52,-26,0,26,52,78];
  const paths=angles.map((angle,index)=>{
    const distance=Math.abs(index-(angles.length-1)/2),length=(indica?23:25)-distance*2,width=(indica?3.9:2.7)*(1-distance*.1);
    const points=[[0,indica?-4:0],[-width*.5,-length*.2],[-width*.85,-length*.3],[-width*.58,-length*.43],[-width,-length*.52],[-width*.66,-length*.64],[-width*.75,-length*.73],[-width*.38,-length*.8],[0,-length],[width*.38,-length*.8],[width*.75,-length*.73],[width*.66,-length*.64],[width,-length*.52],[width*.58,-length*.43],[width*.85,-length*.3],[width*.5,-length*.2]];
    return `${indica?`<path d="M0,0V-4.8" transform="translate(16,27) rotate(${angle})" stroke="currentColor" stroke-width=".7"/>`:''}<path d="M${points.map(([x,y])=>x.toFixed(2)+','+y.toFixed(2)).join(' L')}Z" transform="translate(16,27) rotate(${angle})" fill="currentColor"/>`;
  }).join('');
  return `<svg viewBox="-5 0 42 33" aria-hidden="true">${paths}<path d="M16 26v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}
