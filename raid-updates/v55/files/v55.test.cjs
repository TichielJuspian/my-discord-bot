'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('./raid-workshop-model'),R=require('./raid-engine/progression-combat.cjs');
const {test}=require('node:test');
test('Paladin weapon base crit damage is 40; other weapons and upgrades stay intact',()=>{
 A.equal(M.ITEMS.paladin_legendary_weapon.critDamagePercent,40);A.equal(M.ITEMS.warrior_legendary_weapon.critDamagePercent,50);
 const a=M.migrate(M.fresh(50),50);a.job='paladin';M.grantClassGear(a);a.equipped.weapon='paladin_legendary_weapon';
 const base=M.battle(a,50).stats.critDamagePercent;a.slots.weapon=10;
 A.equal(M.battle(a,50).stats.critDamagePercent-base,10);
});
test('Colossus starts idle for every class and seed; right punch only after a turn',()=>{
 const panels=require('./raid-panels');for(const job of M.JOBS)for(const seed of [1,2,3,50]){
 const s=M.battle({...M.migrate(M.fresh(50),50),job},50,'earth',seed);
 A.equal(panels.bossArt(s)[0],'colossus-ready-v55.jpg');
 s.log=[{phase:'normal',hand:'right',bossEnrageLevel:0}];s.turn=2;A.equal(require('./raid-colossus-art').art(s)[0],'boss-heavy.jpg');
 }
});
test('Smash name is consistent in guide and displayed strings',()=>{
 for(const f of ['raid-panels.js','raid-skill-guide.js','raid-energy-log.js','raid-item-effect-card.js','raid-metal-ui.js','raid-compact-effects.js'])A(!fs.readFileSync(f,'utf8').includes('Hammer Smash'),f);
 const s=M.battle({...M.migrate(M.fresh(50),50),job:'paladin'},50);
 A(require('./raid-skill-guide').assets(s,'core').some(f=>/Smash/.test(f.description)));
});
function harness(){
 let captured,seq=0,holdDeletes=false,failHistory=false;const releases=[];
 const characters=require('./raid-characters').createStore();characters.choose('g','u','warrior',0);characters.workshopRead('g','u',50,true);characters.markRaidPrepared('g','u');
 const messages=new Map();
 function message(id){return {id,guildId:'g',url:'https://discord.com/channels/g/c/'+id,author:{id:'bot'},components:[],attachments:new Map(),edit:async function(b){this.components=b.components||[];return this},delete:async function(){if(holdDeletes)await new Promise(r=>releases.push(r));messages.delete(this.id);}};}
 const channel={id:'c',guildId:'g',messages:{fetch:async()=>{if(failHistory)throw Error('Missing permission');return new Map([...messages].reverse());}},send:async b=>{const m=message('l'+(++seq));m.components=b.components;messages.set(m.id,m);return m;}};
 const nativeRequire=require;
 const fakeRequire=id=>id==='./raid-panels'?{display:a=>{captured=a;return {components:[]}},bossArt:()=>['boss-panel.jpg']}:id==='./raid-card-motion'?{asset:()=>({name:'pose'})}:id==='./raid-attachment-cache'?{prepare:(a,b)=>({body:b,signatures:[]}),remember:()=>{}}:nativeRequire(id);
 const mod={exports:{}};vm.runInNewContext(fs.readFileSync('raid-test.js','utf8'),{require:fakeRequire,module:mod,exports:mod.exports,console,performance,structuredClone,Buffer,setTimeout,clearTimeout,__dirname:__dirname});
 const controller=mod.exports.createRaidTest({ownerId:'u',guildId:'g',characterStore:characters,storageFile:null,characterStorageFile:null,readServerLevel:async()=>50});
 function input(customId=null,source=null){const out=[],m=source||message('b'+(++seq));const i={id:'i'+(++seq),user:{id:'u',username:'Tester'},guildId:'g',member:{},client:{user:{id:'bot'}},guild:{channels:{fetch:async()=>channel}},channel,message:m,customId,commandName:customId?undefined:'raidtest',options:{getSubcommand:()=> 'colossus'},isButton:()=>!!customId,isChatInputCommand:()=>!customId,deferReply:async()=>{i.deferred=true},deferUpdate:async()=>{i.deferred=true},reply:async b=>{out.push(b);return m},editReply:async b=>{out.push(b);return m},fetchReply:async()=>m,deleteReply:async()=>m.delete(),followUp:async b=>{out.push(b);return m},out};return i;}
 function join(){const lobby=[...messages.values()].at(-1);const nodes=c=>(c||[]).flatMap(x=>[x,...nodes(x.components)]);const b=nodes(lobby.components).find(x=>x.custom_id?.endsWith(':join'));A(b);return input(b.custom_id,lobby);}
 return {controller,input,join,get active(){return captured},get latest(){return [...messages.values()].at(-1)},blockDeletes(){holdDeletes=true},release(){holdDeletes=false;releases.splice(0).forEach(r=>r())},failHistory(){failHistory=true}};
}
test('public Join -> zero-turn End -> Join works repeatedly without orphan admission',async()=>{
 const h=harness();await h.controller.handle(h.input());
 for(let n=0;n<3;n++){
 const j=h.join();await h.controller.handle(j);const a=h.active;A(a);A.equal(a.state.status,'active');A.equal(a.state.log.length,0);
 await h.controller.handle(h.input('raidtest:'+a.id+':'+a.state.turn+':retreat',{id:a.displayMessageId}));A(a.finished);
 }
 h.release();
});
test('reset succeeds while previous message deletion is stalled; history failures do not block new raid',async()=>{
 const h=harness();await h.controller.handle(h.input());await h.controller.handle(h.join());h.blockDeletes();
 const old=h.active,previous=h.latest.id;const reset=h.input();await h.controller.handle(reset);A.notEqual(h.latest.id,previous);A(old.finished);
 const again=h.input();await h.controller.handle(again);A(again.out.some(b=>b.content?.includes('All previous raid sessions reset')));
 h.release();h.failHistory();const fallback=h.input();await h.controller.handle(fallback);A(fallback.out.some(b=>b.content?.includes('All previous raid sessions reset')));
});
test('reset invalidates an in-flight turn before it can mutate the new raid',async()=>{
 const h=harness();await h.controller.handle(h.input());await h.controller.handle(h.join());const old=h.active;
 let release,started;const ready=new Promise(r=>started=r),action=h.input('raidtest:'+old.id+':1:attack',{id:old.displayMessageId});action.deferUpdate=async()=>{action.deferred=true;started();await new Promise(r=>release=r)};
 const pending=h.controller.handle(action);await ready;await h.controller.handle(h.input());release();await pending;
 A(old.finished);A.equal(old.state.log.length,0);await h.controller.handle(h.join());A.equal(h.active.state.status,'active');A.equal(h.active.state.totals.damage,0);
});
test('private results keep lower subsequent runs, never disclose another user; recent records only move on a new best',async()=>{
 let now=1000;const L=require('./raid-lobby').createLobby({clock:()=>now,storageFile:null});
 const msg={id:'l',guildId:'g',url:'lobby',edit:async()=>msg,delete:async()=>{}};
 const i={deferred:true,user:{id:'u'},channel:{id:'c',guildId:'g',send:async()=>msg},editReply:async()=>{}};await L.publish(i,async()=>50,{freshOnly:true});
 function finish(user,id,damage,turn){now+=1000;const initial=R.create({job:'warrior',level:50},1),admission=L.admit(initial,user,id);A(admission.allowed);const s={...admission.state,status:'retreated',turn:turn+1,totals:{...initial.totals,damage},log:[{action:'attack',turn,damage},{action:'retreat',turn:turn+1}]};L.record({id,playerName:user,state:s},user);}
 finish('Alice','a1',1200,12);finish('Bob','b1',900,9);finish('Alice','a2',600,6);
 let own=JSON.stringify(L.results('Alice'));A(own.includes('1,200'));A(own.includes('600'));A(!own.includes('900'));A(!JSON.stringify(L.results('Charlie')).includes('1,200'));
 let body=L.body();A(!JSON.stringify(body.components).includes('Latest run:'));A(!JSON.stringify(body.components).includes('My Results'));A(!JSON.stringify(body.components).includes('RAID RESULTS')); 
 let recent=body.files.find(f=>f.name==='raid-recent-battles.png');A(recent.description.indexOf('Bob')<recent.description.indexOf('Alice'));
 finish('Alice','a3',1500,15);recent=L.body().files.find(f=>f.name==='raid-recent-battles.png');A(recent.description.indexOf('Alice')<recent.description.indexOf('Bob'));
 await L.publish(i,async()=>50,{freshOnly:true});A(!JSON.stringify(L.results('Alice')).includes('1,500'));L.retire();
});
