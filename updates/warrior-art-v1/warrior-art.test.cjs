'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const Art=require('./raid-warrior-art'),P=require('./warrior-art-patch.cjs'),I=require('./install-warrior-art.cjs');
const poses=['idle','thrust_a','thrust_b','deep_thrust_a','deep_thrust_b','slash','parry_success','parry_perfect','ultimate','evade','hit','exhausted','last_stand'];
const frozen=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(frozen);Object.freeze(v);}return v;};
for(const legendary of [false,true])for(const pose of poses)test((legendary?'legendary':'normal')+' '+pose+' decodes within 128px',()=>{
 const f=Art.frame(pose,legendary),p=Buffer.from(f.png,'base64');assert.deepEqual([...p.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(p.readUInt32BE(16),128);assert.equal(p.readUInt32BE(20),128);assert.equal(f.cardPixels.length,128*128*4);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(x<4||y<4||x>=124||y>=124)assert.equal(f.cardPixels[(y*128+x)*4+3],0,'transparent safety margin');
});
for(const deep of [false,true])test((deep?'deep':'normal')+' four thrusts alternate A B A B',()=>{
 const log=[],result=[];
 for(let n=0;n<4;n++){log.push({action:'thrust',warrior:{deep}});const s=frozen({config:{job:'warrior'},log:structuredClone(log)});const before=JSON.stringify(s),chosen={pose:deep?'deep_thrust':'thrust_hit',fx:'thrust'};const a=Art.forState(s,chosen);result.push(a.pose);assert.deepEqual(Art.forState(s,chosen),a);assert.equal(JSON.stringify(s),before);}
 assert.deepEqual(result,[1,2,1,2].map(x=>(deep?'deep_thrust_':'thrust_')+(x===1?'a':'b')));
});
test('a non-thrust turn resets the presentation sequence',()=>{const s={config:{job:'warrior'},log:[{action:'thrust'},{action:'slash'},{action:'thrust'}]};assert.equal(Art.forState(s,{pose:'thrust_hit'}).pose,'thrust_a');});
test('changing depth does not reset consecutive thrust parity',()=>{const s={config:{job:'warrior'},log:[{action:'thrust',warrior:{deep:false}},{action:'thrust',warrior:{deep:true}}]};assert.equal(Art.forState(s,{pose:'deep_thrust'}).pose,'deep_thrust_b');});
test('other classes preserve the exact selector result',()=>{for(const job of ['paladin','berserker']){const c={lastStand:true};assert.equal(Art.forState({config:{job},log:[]},c),c);}});
test('warrior Last Stand uses the new portrait without changing state',()=>{const s=frozen({config:{job:'warrior'},hp:1,log:[{lastStandTriggered:true}]});assert.deepEqual(Art.forState(s,{lastStand:true}),{pose:'last_stand'});assert.equal(s.hp,1);});
test('damage, exhaustion, ultimate and evade retain selector priority',()=>{for(const c of [{pose:'hit'},{pose:'exhausted'},{ultimate:true},{emergency:true}])assert.equal(Art.forState({config:{job:'warrior'},log:[{action:'thrust'}]},c),c);});
test('failed parry cannot display successful blocking art',()=>{assert.equal(Art.frame('parry_failed'),Art.frame('hit'));});
test('unknown poses retain upstream fallback',()=>{assert.equal(Art.frame('unknown-future-pose'),null);});
test('all seven guide icons are PNG and unsupported titles fall back',()=>{for(const skill of ['Slash','Thrust','Deep Thrust','Parry','Perfect Parry','Resonant Wave Slash','Emergency Evade'])assert.match(Art.icon(skill,28,33),/^<image .*data:image\/png;base64,/);assert.equal(Art.icon('Energy Recovery',28,33),'');});
test('only four presentation modules are eligible for modification',()=>{assert.equal(Object.keys(P.expected).length,4);assert.throws(()=>P.patch('warrior-rules.cjs',''),/Refusing/);assert.throws(()=>P.patch('raid-static-card.js','changed source'),/missing/);});
test('normal provider hook leaves other jobs unchanged',()=>{const text=P.patch('raid-portrait-quality.js','function frame(job,pose){return null;}');assert.match(text,/job==='warrior'/);new Function('require',text);});
test('legendary hook remains after the existing equipment gate',()=>{const text=P.patch('raid-legendary-motion.js',"function frame(job,pose,equipped){if(!require('./raid-legendary-appearance').active(job,equipped))return null;return null;}");assert.ok(text.indexOf('.active(job,equipped)')<text.indexOf('.frame(pose,true)'));new Function('require',text);});
test('guide icon hook is valid JS and prebuilt bypass is warrior-only',()=>{
 const input="function example(job,r,s,page,c){let v=''+icon(r.name==='Counter'?'counter':r.icon,28,33,c)+text(65,44,'x');const ready=require('./raid-prebuilt-guide').assets(s,page);return v;}";
 const output=P.patch('raid-skill-guide.js',input);new Function('require',output);assert.match(output,/s.config.job==='warrior'\?null/);
});
test('installer rejects a non-runtime directory without writing',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'warrior-empty-'));try{assert.throws(()=>I.plan(root),/Missing runtime/);assert.deepEqual(fs.readdirSync(root),[]);}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('apply and rollback preserve unrelated combat/data files',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'warrior-rollback-'));try{fs.writeFileSync(path.join(root,'view.js'),'old');fs.writeFileSync(path.join(root,'warrior-rules.cjs'),'unchanged rules');fs.writeFileSync(path.join(root,'user-data.json'),'{"hp":1}');
 const changes=[{name:'view.js',old:Buffer.from('old'),next:Buffer.from('new')},{name:'new-art.json',old:null,next:Buffer.from('{}')}];const backup=I.apply(root,changes);assert.equal(fs.readFileSync(path.join(root,'view.js'),'utf8'),'new');I.restore(backup,root);assert.equal(fs.readFileSync(path.join(root,'view.js'),'utf8'),'old');assert.ok(!fs.existsSync(path.join(root,'new-art.json')));assert.equal(fs.readFileSync(path.join(root,'warrior-rules.cjs'),'utf8'),'unchanged rules');assert.equal(fs.readFileSync(path.join(root,'user-data.json'),'utf8'),'{"hp":1}');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('rollback refuses to overwrite later edits',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'warrior-lease-'));try{fs.writeFileSync(path.join(root,'view.js'),'old');const b=I.apply(root,[{name:'view.js',old:Buffer.from('old'),next:Buffer.from('new')}]);fs.writeFileSync(path.join(root,'view.js'),'newer');assert.throws(()=>I.restore(b,root),/later edits/);assert.equal(fs.readFileSync(path.join(root,'view.js'),'utf8'),'newer');}finally{fs.rmSync(root,{recursive:true,force:true});}});
