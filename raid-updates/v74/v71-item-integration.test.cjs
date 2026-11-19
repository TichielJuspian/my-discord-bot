const test=require('node:test'),assert=require('node:assert/strict');
test('all catalog art resolves and full inventories stay below Discord component limit',()=>{
 const M=require('./raid-workshop-model'),D=require('./raid-workshop-detail'),V=require('./raid-workshop-view'),a=M.migrate(M.fresh(50),50);
 for(const [id,item]of Object.entries(M.ITEMS)){if(item.type==='consumable')continue;assert.ok(D.slot(0,0,id).length);a.inventory[id]=1;}
 a.inventory['rolled:rare_weapon_1:70']=1;a.inventory.normal_enhance_scroll=1;
 function count(parts){return parts.reduce((n,p)=>n+1+(p.components?count(p.components):0)+(p.items?.length||0),0);}
 for(const view of ['equipment','class','enhance']){const state={id:'123456abcdef',account:a,level:50,name:'Test',view,pointsBalance:10000,pending:view==='enhance'?{action:'enhance',value:'weapon'}:null};const body=V.payload(state,{render:false});assert.ok(count(body.components)<=40,view);if(view==='enhance')assert.ok(body.components.flatMap(p=>p.components||[]).some(b=>b.custom_id.endsWith('toggle_scroll')));}
});
test('failed payment never consumes scroll or gauge progress; paid journal recovery does not double charge',async()=>{
 const M=require('./raid-workshop-model'),S=require('./raid-workshop-store');let a=M.migrate(M.fresh(50),50);a.slots.weapon=20;a.inventory.normal_enhance_scroll=1;let wallet={balance:199,spent:0},failSave=false;
 const wallets={findOne:async()=>structuredClone(wallet),updateOne:async(f,u)=>{if(u.$unset)delete wallet.raidPendingEnhancement;},findOneAndUpdate:async(f,u)=>{if(wallet.balance<f.balance.$gte||wallet.raidPendingEnhancement)return null;wallet.balance+=u.$inc.balance;wallet.spent+=u.$inc.spent;wallet.raidPendingEnhancement=structuredClone(u.$set.raidPendingEnhancement);return structuredClone(wallet);}};
 S.bindDatabase({collection:()=>wallets});const store=S.createStore({workshopRead:()=>structuredClone(a),workshopCommit:(g,u,l,rev,next,id)=>{if(a.receipts.includes(id))return a;if(failSave)throw Error('disk unavailable');assert.equal(a.revision,rev);a=structuredClone(next);return a;}});
 const request=()=>({action:'enhance',value:'weapon',revision:a.revision,id:'paid-one'});
 await assert.rejects(store.apply('g','u',50,request(),.99),/Not enough/);assert.equal(a.slots.weapon,20);assert.equal(a.enhancementFailures.weapon,0);
 a.slots.weapon=3;wallet.balance=100;failSave=true;await assert.rejects(store.apply('g','u',50,{...request(),useScroll:true},.5),/disk unavailable/);assert.equal(wallet.balance,0);assert.equal(a.inventory.normal_enhance_scroll,1);failSave=false;const restored=await store.read('g','u',50);assert.equal(restored.slots.weapon,4);assert.equal(restored.inventory.normal_enhance_scroll,0);await store.apply('g','u',50,{...request(),useScroll:true},0);assert.equal(wallet.spent,100);
});
