'use strict';
// Offline candidate. Persist wallet, receipt, revision, inventory and slot state atomically in a live adapter.
const MAX=40,SLOTS=['weapon','armor','accessory'];
const CHANCE=[100,100,100,45,40,35,30,25,25,25,10,10,10,10,5,5,5,5,5,5,...Array(10).fill(3),...Array(10).fill(1)];
const SHOP={id:'raid',name:'Raid Shop',currency:'community_points'};
function integer(n,min,max){return Number.isSafeInteger(n)&&n>=min&&n<=max;}
function quote(target,failures=0,useScroll=false){
 if(!integer(target,1,MAX)||!integer(failures,0,1000000))throw Error('Invalid target or pity');
 if(useScroll&&target>20)throw Error('Normal scrolls can only be used through +20.');
 const cost=target<=3?0:target<=20?100:target<=30?200:300;
 if(target>30){const required=target<=35?150:300,progress=Math.min(required,failures+1);return {target,cost,mode:'gauge',required,progress,baseChance:0,pity:0,chance:progress>=required?100:0,itemId:'raid_upgrade_'+target};}
 const baseChance=target>=26?.2:target>=21?.5:target>=19?1:CHANCE[target-1];
 const increment=target>=26?.02:target>=21?.05:target>=19?.1:target>=10?1.5:0;
 const guarantee=target>=26?150:target>=21?100:target>=19?60:null;
 const pity=Math.min(100-baseChance,Math.round(failures*increment*100)/100),scroll=useScroll?10:0;
 const chance=guarantee&&failures+1>=guarantee?100:Math.min(100,Math.round((baseChance+pity+scroll)*100)/100);
 return {target,cost,mode:'chance',baseChance,pity,chance,scroll,guarantee,attempt:failures+1,itemId:'raid_upgrade_'+target};
}
const MILESTONES={
 weapon:{10:{attack:10,critDamagePercent:10},20:{attack:20,crit:10},25:{attack:30,critDamagePercent:10},30:{attack:50,critDamagePercent:20},35:{attack:80,critDamagePercent:30},40:{attack:120,critDamagePercent:50}},
 armor:{10:{hp:50},20:{hp:200,defense:20},25:{hp:100,defense:15},30:{hp:200,defense:30},35:{hp:300,defense:45},40:{hp:500,defense:70}},
 accessory:{10:{crit:10},20:{crit:10,evasion:5},25:{critDamagePercent:15},30:{crit:10,critDamagePercent:20},35:{critDamagePercent:30,evasion:3},40:{crit:10,critDamagePercent:50,evasion:5}}
};
function levels(input={}){const out={};for(const k of Object.keys(input))if(!SLOTS.includes(k))throw Error('Invalid slot');for(const k of SLOTS){out[k]=input[k]??0;if(!integer(out[k],0,MAX))throw Error('Invalid enhancement');}return out;}
function bonuses(input){const x=levels(input),out={attack:x.weapon*2,hp:0,defense:x.armor,crit:0,critDamagePercent:0,evasion:x.accessory*.5};for(const slot of SLOTS)for(const [level,stats]of Object.entries(MILESTONES[slot]))if(x[slot]>=Number(level))for(const [key,n]of Object.entries(stats))out[key]+=n;return out;}
function createAccount(points=0){if(!integer(points,0,Number.MAX_SAFE_INTEGER))throw Error('Invalid points');return {points,revision:0,slots:levels(),tickets:{},receipts:{},dailyEntries:{}};}
function begin(s,request){if(!request.id||typeof request.id!=='string'||['__proto__','constructor','prototype'].includes(request.id))throw Error('Invalid request');if(Object.hasOwn(s.receipts,request.id))return s;if(s.revision!==request.revision)throw Error('Stale revision');return null;}
function finish(s,request,receipt){s.receipts[request.id]=receipt;s.revision++;return s;}
function buy(original,request){const prior=begin(original,request);if(prior)return prior;if(request.shop!=='raid')throw Error('Wrong shop');const q=quote(request.target);if(original.points<q.cost)throw Error('Insufficient points');const s=structuredClone(original);s.points-=q.cost;s.tickets[q.itemId]=(s.tickets[q.itemId]||0)+1;return finish(s,request,{type:'buy',...q});}
function enhance(original,request,roll){const prior=begin(original,request);if(prior)return prior;if(!SLOTS.includes(request.slot))throw Error('Invalid slot');const current=levels(original.slots)[request.slot],q=quote(current+1,original.enhancementFailures?.[request.slot]||0);if(request.target!==q.target)throw Error('Wrong tier ticket');if(!(Number.isFinite(roll)&&roll>=0&&roll<1))throw Error('Invalid roll');if(!(original.tickets[q.itemId]>0))throw Error('Missing ticket');const s=structuredClone(original),success=roll<q.chance/100;s.tickets[q.itemId]--;s.enhancementFailures??={};s.enhancementFailures[request.slot]=success?0:(original.enhancementFailures?.[request.slot]||0)+1;if(success)s.slots[request.slot]++;return finish(s,request,{type:'enhance',slot:request.slot,success,from:current,to:s.slots[request.slot],ticket:q.itemId});}
function dailyTier(level){if(!integer(level,1,100))throw Error('Invalid level');return level>=50?'advanced':'standard';}
function cycleDay(now){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));const d=new Date(Date.UTC(+p.year,+p.month-1,+p.day));if(+p.hour<18)d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);}
function enterDaily(original,request){const prior=begin(original,request);if(!integer(request.now,0,Number.MAX_SAFE_INTEGER))throw Error('Invalid clock');if(prior)return prior;const tier=dailyTier(request.level),day=cycleDay(request.now);if(request.tier!==tier)throw Error('Wrong daily tier');if(original.dailyEntries[day])throw Error('Already participated today');const s=structuredClone(original);s.dailyEntries[day]={tier,level:request.level};return finish(s,request,{type:'daily',tier,day});}
module.exports={MAX,SLOTS,SHOP,MILESTONES,quote,levels,bonuses,createAccount,buy,enhance,dailyTier,cycleDay,enterDaily};
