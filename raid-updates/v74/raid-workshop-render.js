'use strict';
const {Resvg}=require('@resvg/resvg-js'),fonts=require('./raid-workshop-fonts');
const cache=require('./raid-workshop-cache').create('detail',6*1024*1024,24);
function render(s,section='main'){
 const a=s.account,input={account:{revision:0,job:a.job,allocation:s.draft||a.allocation,slots:a.slots,equipped:a.equipped,inventory:a.inventory,potionStats:a.potionStats,potions:a.potions,lastPotion:a.lastPotion,enhancementFailures:a.enhancementFailures},level:s.level,booster:s.booster,view:s.view,pending:s.pending?{action:s.pending.action,value:s.pending.value,useScroll:s.pending.useScroll}:null,enhancementResult:s.enhancementResult,potionResult:s.potionResult,pointsBalance:s.view==='enhance'?s.pointsBalance:undefined};
 // Rendering comparisons needs the committed allocation and a separate draft.
 input.account.allocation=a.allocation;input.draft=s.draft;
 const result=input.enhancementResult;
 const key=section+JSON.stringify(s.view==='enhance'&&section==='footer'?{slot:s.pending?.value||result?.slot||null}:s.view==='class'?{view:'class',job:a.job,pending:input.pending}:s.view==='enhance'?{view:s.view,slots:a.slots,enhancementFailures:a.enhancementFailures,pending:input.pending,pointsBalance:s.pointsBalance,result:result?{success:result.success,slot:result.slot,target:result.target,attempt:result.attempt,cost:result.cost,mode:result.mode,progress:result.progress,required:result.required}:null}:input);if(cache.has(key))return cache.get(key);
 let source=s.view==='enhance'?require('./raid-workshop-forge')[section==='footer'?'footerSVG':'svg'](input):s.view==='class'?require('./raid-workshop-class').svg(input,require('./raid-workshop-card').portrait):require('./raid-workshop-detail').svg(input);
 if(s.view==='enhance'&&section==='footer')source=source.replace('x="420" y="646" width="650"','x="20" y="646" width="1060"').replaceAll('x="435"','x="35"');
 const sourceWidth=Number(/width="(\d+)"/.exec(source)[1]),h=Number(/height="(\d+)"/.exec(source)[1]),height=s.view==='equipment'?(s.potionResult?h:Math.max(440,h)):s.view==='enhance'?(section==='footer'?260:640):640;
 source=source.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
 const width=1100,scale=s.view==='enhance'?1:Math.min(1,height/h),y=s.view==='enhance'?(section==='footer'?-640:0):(height-h*scale)/2,x=s.view==='enhance'?0:(width-sourceWidth*scale)/2;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><rect width="'+width+'" height="'+height+'" rx="16" fill="#0b1423"/><g transform="translate('+x+' '+y+') scale('+scale+')">'+source+'</g></svg>';
 const png=require('./raid-entry-image-cache').optimizePNG(new Resvg(svg,{...fonts.options(svg),fitTo:{mode:'width',value:1100}}).render().asPng());cache.set(key,png);return png;
}
module.exports={render,clearCache:()=>cache.clear()};
