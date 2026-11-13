'use strict';
function svg({account:a,pending,classChangeCost=0},portrait){
 const colors={warrior:'#78c9f4',paladin:'#f4d28b',berserker:'#f17f94'},subtitle={warrior:'Steel. Precision. Resolve.',paladin:'Faith. Protection. Judgment.',berserker:'Fury. Power. Defiance.'};
 const txt=(x,y,v,size=22,color='#fff',anchor='middle')=>'<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'" fill="'+color+'" font-family="Noto Sans" font-size="'+size+'" font-weight="700">'+v+'</text>';
 const change=pending?.action==='job',jobs=change?[a.job,pending.value]:['warrior','paladin','berserker'];
 let out='<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="640"><defs><linearGradient id="base" x2="1" y2="1"><stop stop-color="#1a2940"/><stop offset="1" stop-color="#080f1c"/></linearGradient>';
 for(const j of jobs)out+='<radialGradient id="'+j+'"><stop stop-color="'+colors[j]+'" stop-opacity=".30"/><stop offset="1" stop-color="'+colors[j]+'" stop-opacity="0"/></radialGradient>';
 out+='</defs><rect width="1000" height="640" rx="16" fill="#0a1322"/>'+txt(30,43,change?'A NEW PATH':'CHOOSE YOUR CLASS',27,'#f6dfac','start')+txt(30,69,change?'Cost: '+classChangeCost.toLocaleString('en-US')+' P. Used potions return; stats reset.':classChangeCost?'Changing class costs '+classChangeCost.toLocaleString('en-US')+' P. Confirm before purchase.':'First class selection is free. Used potions return on class change.',15,'#9bb1ca','start');
 for(const [i,j]of jobs.entries()){
  const x=change?(i?560:40):24+i*326,w=change?400:300,c=x+w/2;
  out+='<rect x="'+x+'" y="92" width="'+w+'" height="510" rx="16" fill="url(#base)" stroke="'+colors[j]+'" stroke-opacity=".5"/><ellipse cx="'+c+'" cy="320" rx="'+w/2+'" ry="220" fill="url(#'+j+')"/><path d="M'+(x+20)+' 125V110H'+(x+65)+'M'+(x+w-65)+' 110H'+(x+w-20)+'V125" fill="none" stroke="'+colors[j]+'"/>'+txt(c,133,change?(i?'AFTER':'BEFORE'):(a.job===j?'CURRENT CLASS':'NEW PATH'),13,colors[j])+'<ellipse cx="'+c+'" cy="450" rx="82" ry="14" fill="#020710" opacity=".6"/>'+require('./raid-workshop-portrait-fit').image(portrait(j,j===a.job?a.equipped:undefined),c,450,260,j,w-40)+txt(c,500,require('./raid-class-name').upper(j),28,colors[j])+txt(c,540,subtitle[j],14,'#a9bfd5');
 }
 if(change)out+='<path d="M472 330H522L510 318M522 330L510 342" fill="none" stroke="#f5d18a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
 return out+'</svg>';
}
module.exports={svg};

