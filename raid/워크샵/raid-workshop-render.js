const runtimePaths = require("../runtime-paths.cjs");
'use strict';
const {Resvg}=require('@resvg/resvg-js'),fonts=require('./raid-workshop-fonts.js');
const cache=require('./raid-workshop-cache.js').create('detail',6*1024*1024,24);
const fs=require('node:fs'),path=require('node:path');let forgeOdds;
function render(s,section='main'){
 if(s.view==='enhance'&&section==='footer')return forgeOdds??=fs.readFileSync(path.join(__dirname,'이미지','forge-v440-parchment-odds.png'));
 const a=s.account,input={account:{revision:0,job:a.job,allocation:s.draft||a.allocation,slots:a.slots,equipped:a.equipped,inventory:a.inventory,potionStats:a.potionStats,potions:a.potions,lastPotion:a.lastPotion,enhancementFailures:a.enhancementFailures},level:s.level,boostCount:s.boostCount,boostUnavailable:s.boostUnavailable,view:s.view,pending:s.pending?{action:s.pending.action,value:s.pending.value,useScroll:s.pending.useScroll}:null,enhancementResult:s.enhancementResult,potionResult:s.potionResult,equipmentDetailId:s.view==='equipment'?s.equipmentDetailId:undefined,classChangeCost:s.classChangeCost??0,pointsBalance:s.view==='enhance'?s.pointsBalance:undefined};
 // Rendering comparisons needs the committed allocation and a separate draft.
 input.account.allocation=a.allocation;input.draft=s.draft;
 const result=input.enhancementResult;
 const key=section+JSON.stringify(s.view==='class'?{view:'class',job:a.job,pending:input.pending,classChangeCost:input.classChangeCost,legendary:require('../클래스/raid-legendary-appearance.js').active(a.job,a.equipped)}:s.view==='enhance'?{view:s.view,slots:a.slots,enhancementFailures:a.enhancementFailures,pending:input.pending,pointsBalance:s.pointsBalance,result:result?{success:result.success,slot:result.slot,target:result.target,attempt:result.attempt,cost:result.cost,mode:result.mode,progress:result.progress,required:result.required}:null}:input);if(cache.has(key))return cache.get(key);
 let source=s.view==='enhance'?require('./raid-workshop-forge.js').svg(input):s.view==='class'?require('./raid-workshop-class.js').svg(input,require('./raid-workshop-card.js').portrait):require('./raid-workshop-detail.js').svg(input);
 const sourceWidth=Number(/width="(\d+)"/.exec(source)[1]),h=Number(/height="(\d+)"/.exec(source)[1]),height=s.view==='equipment'?(s.potionResult?h:Math.max(440,h)):640;
 source=source.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
 const combined=s.view==='equipment'&&!s.potionResult&&(!s.pending||s.pending.action==='equip');
 const width=combined?1000:1100,scale=s.view==='enhance'?1:Math.min(1,height/h),y=s.view==='enhance'?0:(height-h*scale)/2,x=s.view==='enhance'?0:(width-sourceWidth*scale)/2;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><rect width="'+width+'" height="'+height+'" rx="16" fill="#0b1423"/><g transform="translate('+x+' '+y+') scale('+scale+')">'+source+'</g></svg>';
 const png=require('../보스/전투/raid-entry-image-cache.js').optimizePNG(new Resvg(svg,{...fonts.options(svg,s.view==='enhance'),fitTo:{mode:'width',value:width}}).render().asPng());cache.set(key,png);return png;
}
module.exports={render,clearCache:()=>cache.clear()};
