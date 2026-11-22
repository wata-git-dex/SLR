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
