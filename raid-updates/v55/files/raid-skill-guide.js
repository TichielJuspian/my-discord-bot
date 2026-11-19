'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{Resvg}=require('@resvg/resvg-js');
const build=require('./raid-test-build');
const cache=new Map();
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const rect=(x,y,w,h,fill,r=14,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const text=(x,y,t,size=22,color='#e9eef8',extra='')=>`<text x="${x}" y="${y}" font-family="Noto Sans KR" font-weight="bold" font-size="${size}" fill="${color}" ${extra}>${esc(t)}</text>`;
function crc(b){let c=0xffffffff;for(const v of b){c^=v;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,b){const t=Buffer.from(type),h=Buffer.alloc(4),c=Buffer.alloc(4);h.writeUInt32BE(b.length);c.writeUInt32BE(crc(Buffer.concat([t,b])));return Buffer.concat([h,t,b,c]);}
function png(rgba){const h=Buffer.alloc(13);h.writeUInt32BE(80);h.writeUInt32BE(80,4);h[8]=8;h[9]=6;const rows=Buffer.alloc(80*321);for(let y=0;y<80;y++)rgba.copy(rows,y*321+1,y*320,(y+1)*320);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
const sprites=new Map();
function sprite(job,pose,equipped){const improved=require('./raid-legendary-motion').frame(job,pose,equipped)||require('./raid-portrait-quality').frame(job,pose);if(improved)return improved.png;const key=job+':'+pose;if(sprites.has(key))return sprites.get(key);
 if(job==='berserker'){const pack=require('./berserker-live-frames.json'),f=pack[pose]||pack.idle;const value=png(zlib.inflateSync(Buffer.from(f.rgba,'base64'))).toString('base64');sprites.set(key,value);return value;}if(pose==='last_stand'){const value=fs.readFileSync(path.join(__dirname,job+'-last-stand.png')).toString('base64');sprites.set(key,value);return value;}
 let f;if(job==='paladin'){const p=require('./paladin-live-frames.json');f=p[pose]||p.idle;}else if(pose==='attack')f=require('./raid-motion-frames.json')[5];else if(pose==='evade')f=require('./raid-emergency-frame.json');else if(pose==='ultimate')f=require('./raid-ultimate-frame.json');else f=require('./raid-action-frames.json')[pose]||require('./raid-action-frames.json').idle;
 const value=f.png||png(zlib.inflateSync(Buffer.from(f.rgba,'base64'))).toString('base64');sprites.set(key,value);return value;}
function rawRows(job,s,page){if(job==='berserker')return require('./berserker-guide.cjs')(s,page);const p=job==='paladin',lv=s.config.level;
 if(page==='passives')return [
 {name:p?'Divine Grace':'Counter',lv:1,cost:'AUTOMATIC / NO ENERGY / NO ACTION',pose:p?'divine_grace':'counter',icon:p?'cross':'counter',lines:p?[
 '40% chance when struck by a damaging boss attack: recover 1 energy.',
 'Requires both you and the boss to remain alive.',
 'Separate from regular Energy Recovery; capped at max energy.',
 'No bonus damage or healing. Disabled while class passives are sealed.'
 ]:[
 '60% trigger chance after a direct hit; you must survive.',
 'Counter damage: 30% of ATK, rounded down; can critically hit.',
 'Once per turn, including multi-hit attacks. No energy cost.',
 'Does not block mechanic penalties or cleanse curses.',
 'Disabled while class passives are sealed.'
 ]},
 {name:'Energy Recovery',lv:1,cost:'AUTOMATIC / NO ACTION',pose:'idle',icon:'energy',lines:[
 'Recover 1 energy at the end of every 3 turns.',
 'Only while both combatants remain alive; capped at max energy.'
 ]}
 ];
 if(page==='advanced')return [
 {name:'Emergency Evade',lv:0,cost:'FREE / '+(lv>=100?2:1)+' USES PER BATTLE',pose:'evade',icon:'wind',lines:[
 'Avoid the current direct attack and mechanic-failure damage.',
 'Prevents new curse application this turn; does not cleanse existing curses.',
 'Consumes your action. No energy cost or success roll.',
 'Available from the start; a second use unlocks at level 100.'
 ]},
 {name:p?'Judgment':'Resonant Wave Slash',lv:10,cost:'3 ENERGY / '+(lv>=90?2:1)+' USES PER BATTLE',pose:p?'judgment':'ultimate',icon:'star',lines:[
 'Base damage: 6 x ATK + 3 x Level.',
 'Can critically hit; buffs and boss vulnerability modify final damage.',
 'Cancels the current direct attack and mechanic resolution.',
 'Does not cleanse existing curses. Uses your action.',
 'One use per battle; a second use unlocks at level 90.'
 ]},
 {name:'Improved Recovery',lv:30,cost:'AUTOMATIC / NO ACTION',pose:'idle',icon:'energy',lines:[
 'Recover 1 energy every 2 turns instead of every 3.',
 'Applies automatically from level 30; energy cannot exceed its cap.'
 ]},
 {name:'Last Stand',lv:50,cost:'AUTOMATIC / ONCE PER BATTLE',pose:'last_stand',icon:'shield',lines:[
 'Survive one lethal hit with exactly 1 HP.',
 '100% activation when eligible; no energy cost or action.',
 'Available from level 50. Does not restore health afterward.',
 'Cannot activate while class passives are sealed.'
 ]}
 ];
 return [
 {name:'Attack',lv:1,cost:'FREE / USES YOUR ACTION',pose:'attack',icon:'sword',lines:[
 'Base damage: 100% ATK.',
 'Can critically hit; buffs and boss vulnerability modify final damage.',
 'No energy cost. Does not interrupt skill-only boss mechanics.'
 ]},
 {name:'Guard',lv:1,cost:'FREE / RECOVER UP TO 1 ENERGY',pose:'guard_block',icon:'shield',lines:[
 'Reduce direct damage by 40% after defense.',
 'Recover 1 energy if both you and the boss remain alive.',
 'Consumes your action; no success roll.',
 'Does not reduce mechanic-failure damage or cleanse curses.'
 ]},
 {name:p?'Smash':'Thrust',lv:1,cost:(p?'1':'2')+' ENERGY / USES YOUR ACTION',pose:p?'holy_smash':'thrust_hit',icon:p?'hammer':'sword',lines:[
 'Base damage: '+(p?'150% ATK.':'200% ATK.'),
 'Can critically hit; buffs and boss vulnerability modify final damage.',
 'A landed hit interrupts curse casting.',
 'Counts as one skill hit toward the two-hit special mechanic.'
 ]},
 {name:p?'Protection':'Parry',lv:1,cost:p?'2 ENERGY / USES YOUR ACTION':'1 ENERGY / USES YOUR ACTION',pose:p?'protection':'parry_perfect',icon:p?'cross':'parry',lines:p?[
 'Base Heal = 50 + 10% of maximum HP.',
 'Final healing is rounded down.',
 'Weak (5% chance): floor(Base Heal x 0.5).',
 'Normal (76% chance): Base Heal.',
 'Perfect (19% chance): floor(Base Heal x 1.5).',
 'Next landed attack adds 20% ATK to base damage.',
 'One charge; stays until used. Recasting refreshes, never stacks.',
 'Healing is capped at missing HP; does not cleanse curses.'
 ]:[
 'Success 75%: 60% less direct damage; recover 1 energy.',
 'Perfect 20%: block direct damage; recover 2 energy.',
 'Failure 5%: 30% less direct damage; no energy recovery.',
 'Successful or perfect parry: gain 1 stack, up to 3. Next landed attack consumes all stacks: +40% ATK base damage per stack.',
 'Can also block heavy attacks. Cannot parry mechanic penalties or curses.'
 ]}
 ];}

function rows(job,s,page){return rawRows(job,s,page).map(r=>{
 if(job==='warrior'){if(r.name==='Counter')r={...r,name:'Keen Instinct',icon:'star'};if(page==='core'&&r.name==='Guard')r={...r,name:'Parry',pose:'parry_perfect',icon:'parry'};else if(page==='core'&&r.name==='Parry')r={...r,name:'Slash',cost:'1 ENERGY / USES YOUR ACTION',pose:'slash',icon:'sword'};}
 const common={
 'Energy Recovery':['Recover 1 energy every 3 turns.'],
 'Improved Recovery':['Recover 1 energy every 2 turns instead of every 3.'],
 'Last Stand':['Survive a fatal hit with 1 HP.','Unavailable while class passives are sealed.'],
 'Counter':['60% chance when hit: counterattack.','Counter damage: floor(ATK x 0.3). Can critically hit.'],
 'Divine Grace':['60% chance after surviving a damaging direct hit: heal floor(20 + ATK x 0.2) HP.','No energy recovery. Disabled while class passives are sealed.'],
 'Smash':['Base damage: 200% ATK. Critical chance +30 percentage points.','Each landed Smash grants 1 Blessing stack for this battle.','Every 2 stacks increase Smash damage by 1%.','A landed hit interrupts curse casting and counts toward skill mechanics.'],
 'Protection':['2 energy. ATK bonus: 10%, 15%, 20%, 25%, 30% over 5 turns.','DEF +30% and direct damage taken -20% for 5 turns, including the casting turn.','Ends on turn 6. Recasting restarts the duration and ATK bonus.'],
 'Guard':['Reduce direct damage by 40% after defense.','Recover 1 energy.'],
 'Emergency Evade':['Avoid direct attacks and mechanic-failure damage.','Prevent new curses this turn.',...(job==='berserker'?['Clears all charge.']:[])],
 'Resonant Wave Slash':['Base damage: 600% ATK.','Can critically hit.','Cancels the current attack and mechanic resolution.'],
 'Judgment':['Base damage: 900% ATK.','Can critically hit.','Cancels the current attack and mechanic resolution.'],
 'Ragnarok':r.name==='Ragnarok'?r.lines:[]
 };
 let lines=common[r.name]||r.lines.filter(x=>!/(?:Disabled while class passives|No energy cost\. Does not interrupt|Healing is capped)/.test(x));
 if(job==='warrior'){
 if(r.name==='Keen Instinct')lines=['40% chance after surviving a damaging direct hit: next Parry gets +10 percentage points to its Perfect chance.','Does not stack. Disabled while class passives are sealed.'];
 if(r.name==='Parry'){r.cost='FREE ON CONTACT / NO CONTACT: -1 ENERGY';lines=['Perfect chance: 20% + current total DEF / 10 percentage points (max 100%).','Normal: direct damage -60%; heal 3% of missing HP; recover 1 energy.','Perfect: direct damage reduction = 80% + current total DEF / 10 (max 95%); heal 3% of missing HP; recover 2 energy.','Each normal Parry adds +10 percentage points to future Perfect chance; stacks reset on Perfect.','Slash adds +10 points for the next turn; Keen Instinct adds +10 points to the next Parry.','Normal / Perfect: next Thrust CRIT +30 / +50 points and damage +30% / +50%.','Perfect also grants DEF +20% for the next 2 turns. No direct contact: fail, lose up to 1 energy, gain no Parry effects.','Cannot mitigate curses or mechanic true damage.'];}
 if(r.name==='Thrust')lines=['2 energy. Base damage: 250% ATK.','At '+(s.config.warriorEvolutionWeapon?15:20)+' evolution progress, evolves into Deep Thrust: 350% ATK for this battle.','Consumes the stored Parry bonus. Slash grants 2 evolution progress before evolution.','Can critically hit. Evolution progress resets each battle.'];
 if(r.name==='Slash')lines=['1 energy. Base damage: 150% ATK, one hit. Can critically hit.','Before evolution: a landed Slash grants 2 evolution progress.','A landed Slash grants +10 percentage points to Perfect Parry chance for the next turn only.','One landed Slash contributes 1 mechanic-interrupt hit; also interrupts curse casting.','No Thrust damage buff or Bleed effect.'];
 }
 if(s.config.paladinHammerRefund&&r.name==='Smash')lines=[...lines,'Legendary hammer: 20% chance on cast to refund 1 energy.'];
 if(job==='berserker'&&r.name==='Ragnarok')lines=r.lines;
 return {...r,lines:lines.map(x=>x.replace('No success roll; ',''))};
});}

function icon(kind,x,y,color){let body=kind==='counter'?'<path d="M-17 6A19 19 0 0 1 12-14M12-22V-13H3M-10 14L13-9M7-15L19-3M-17 17L-8 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>':kind==='parry'?'<path d="M-12 18L3-7L9-3L-6 22M-14 7L8 19M6-17L9-10L17-9L10-5L8 3L4-4L-4-6L3-10Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>':kind==='enrage'?'<path d="M0-22C12-9 6-5 15-10C25 12 12 23 0 23C-18 23-25 8-13-8C-13 2-5 2 0-22Z" fill="currentColor"/><path d="M0-2C9 9 8 17 0 19C-9 18-8 8 0-2Z" fill="#fff0d5"/>':kind==='potion'?'<path d="M-6-21H6V-9L16 6Q23 21 0 21Q-23 21-16 6L-6-9ZM-9-21H9M-14 6H14M0 6V16M-5 11H5" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>':kind==='shield'?'<path d="M-13-15H13V0Q13 13 0 19Q-13 13-13 0Z" fill="none" stroke="currentColor" stroke-width="3"/>':kind==='cross'?'<path d="M-4-17H4V-5H16V3H4V17H-4V3H-16V-5H-4Z" fill="currentColor"/>':kind==='hammer'?'<path d="M-15-14H15V0H-15Z M-3 0H3V19H-3Z" fill="currentColor"/>':kind==='energy'?'<path d="M2-19L-13 3H-2L-6 20L14-5H3Z" fill="currentColor"/>':kind==='wind'?'<path d="M-17-8H9Q20-8 15-17M-18 2H17M-12 12H6Q18 12 13 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>':kind==='star'?'<path d="M0-20L5-5L20 0L5 5L0 20L-5 5L-20 0L-5-5Z" fill="currentColor"/>':'<path d="M11-20L18-13L-4 9L-11 2Z M-16 4L-2 18 M-11 9L-19 17" fill="none" stroke="currentColor" stroke-width="4"/>';
 return `<g transform="translate(${x} ${y})" color="${color}">${body}</g>`;}
function unlocks(){return [
 {lv:0,label:'Emergency Evade / Default',note:'One free use per battle from the start'},
 {lv:10,label:'Ultimate',note:'Judgment or Resonant Wave Slash / One use'},
 {lv:20,label:'Maximum Energy +1',note:'Maximum energy: 4'},
 {lv:30,label:'Improved Recovery',note:'Restore 1 energy every 2 turns'},
 {lv:40,label:'Maximum Energy +1',note:'Maximum energy: 5'},
 {lv:50,label:'Last Stand',note:'Survive one lethal hit at 1 HP'},
 {lv:60,label:'Protection / RAID-WIDE BUFF',note:'3 hours / HP +30 / Max 5 stacks / Choose 1 buff'},
 {lv:70,label:'Battle Rally / RAID-WIDE BUFF',note:'3 hours / ATK +10% / Max 3 stacks / Choose 1 buff'},
 {lv:80,label:'Blessing / RAID-WIDE BUFF',note:'3 hours / CRIT and CRIT DMG +10% / Max 1 / Choose 1 buff'},
 {lv:90,label:'Ultimate +1 Use',note:'Two uses per battle / 3 energy each'},
 {lv:100,label:'Emergency Evade +1 Use',note:'Two free uses per battle'}];}
function sheets(s,page='passives'){
 const job=s.config.job,lv=s.config.level,c=job==='paladin'?'#f0cd7c':job==='berserker'?'#ff8398':'#79c9ff',wrap=require('./raid-battle-feed').wrap||require('./berserker-text.cjs').wrap;
 const frame=h=>'<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="'+h+'">';
 if(page==='growth'){const entries=unlocks().map(r=>r.lv===10?{...r,note:({warrior:'Resonant Wave Slash',paladin:'Judgment',berserker:'Ragnarok'}[job])+' / One use'}:r),out=[];for(let k=0;k<entries.length;k+=4){const part=entries.slice(k,k+4);const top=k===0?65:8;let v=frame(top+part.length*98)+(k===0?text(20,36,'LEVEL UNLOCKS / '+job.toUpperCase(),27,c):'');part.forEach((r,i)=>{const y=top+i*98,open=lv>=r.lv;v+='<path d="M20 '+(y+84)+'H1020" stroke="#334459"/>'+text(20,y+31,'LV '+r.lv,24,open?c:'#8ca4bd')+text(145,y+30,r.label,25,open?'#f0f5fd':'#a2b6cc');wrap(r.note,22,850,2).forEach((t,j)=>v+=text(145,y+62+j*25,t,22,'#b5cbe0'));});out.push(v+'</svg>');}return out;}
 return rows(job,s,page).flatMap(r=>{
 const groups=r.name==='Parry'?[{...r,name:'Parry',lines:r.lines.slice(0,3)},{...r,name:'Parry / Perfect Chance',cost:'',lines:r.lines.slice(3,5)},{...r,name:'Parry / Follow-up',cost:'',lines:r.lines.slice(5)}]:r.name==='Thrust'?[r,{...r,name:'Deep Thrust',pose:'deep_thrust',lines:['Evolved Thrust: 350% ATK. Costs 2 energy.','Unlocks at '+(s.config.warriorEvolutionWeapon?15:20)+' evolution progress; lasts for this battle.','Keeps Thrust critical hits, stored Parry bonuses and mechanic interrupts.','Each Thrust adds 1 progress; each landed Slash adds 2 before evolution.']}]:r.name==='Prayer'?[{...r,lines:r.lines.slice(0,5)},{...r,name:'Prayer / Attack Enchant',lines:r.lines.slice(5)}]:r.name==='Blood Draw'?[{...r,lines:r.lines.slice(0,3)},{...r,name:'Blood Draw / Bonus Damage',cost:'',lines:r.lines.slice(3)}]:[r];
 return groups.map(r=>{
 const open=lv>=r.lv;
 const segments=false?[
  ['OUTCOMES',[...r.lines.slice(0,3),...r.lines.slice(4)]],
  ['FOLLOW-UP',r.lines.slice(3,4)],
 ]:r.name==='Prayer'?[
  ['HEALING',r.lines.slice(0,5)],['ATTACK ENCHANT',r.lines.slice(5)]
 ]:[['EFFECT',r.lines]];
 let y=page==='passives'?99:143,body='';
 for(const [label,items]of segments){if(!items.length)continue;body+=text(275,y,label,18,c);y+=37;
  for(const line of items){const wrapped=wrap(line,25,710,12);for(const [i,t]of wrapped.entries()){body+=text(275+(i?16:0),y,(i?'':' ')+t,25,open?'#dce9f6':'#9bafc6');y+=34;}y+=12;}y+=19;
 }
 const h=Math.max(330,y+4);let v=frame(h)+icon(r.name==='Counter'?'counter':r.name==='Parry'?'parry':r.name==='Enrage'?'enrage':/Blood Draw|Transfusion/.test(r.name)?'potion':r.icon,28,33,c)+text(65,44,r.name,33,open?'#f5f7fc':'#a9b9cf')+text(1015,40,'LV '+r.lv,20,c,'text-anchor="end"');
 v+='<path d="M12 62H1024" stroke="'+c+'" opacity=".4"/><image href="data:image/png;base64,'+sprite(job,r.pose,s.workshop?.equipped)+'" x="12" y="100" width="230" height="230" opacity="'+(open?1:.45)+'"/>'+(page==='passives'||r.cost.startsWith('AUTOMATIC')||r.cost.startsWith('PASSIVE')?'':text(275,99,r.cost,20,c))+body;
 return v+'</svg>';
 });
 });
}

function svg(s,page='passives'){return sheets(s,page)[0];}
function assets(s,page='passives'){if(!['passives','core','advanced','growth'].includes(page))page='passives';const key=JSON.stringify([s.config.job,s.config.level,s.config.warriorEvolutionWeapon,s.config.paladinHammerRefund,s.workshop?.equipped,page]);if(cache.has(key))return cache.get(key);const out=sheets(s,page).map((v,i)=>({name:'skill-guide-'+s.config.job+'-'+page+'-'+i+'.png',attachment:require('./raid-entry-image-cache').raster(v),description:s.config.job+' / '+page+' / '+(page==='growth'?'Level unlocks '+(i*4+1):(/<text[^>]*x="65"[^>]*>([^<]+)/.exec(v)||[])[1]||'Skill guide')}));cache.set(key,out);while(cache.size>32)cache.delete(cache.keys().next().value);return out;}
function asset(s,page='passives'){return assets(s,page)[0];}
function payload(a){const page=a.guidePage||'passives',files=assets(a.state,page),button=(id,label,style=2)=>({type:2,style,label,custom_id:'raidtest:'+a.id+':'+a.state.turn+':'+id});return {flags:32768,allowedMentions:{parse:[]},attachments:[],files,components:[{type:10,content:'### '+a.state.config.job.toUpperCase()+' / Skill guide'},{type:1,components:[button('skills_passives','Passives',page==='passives'?1:2),button('skills_core','Core skills',page==='core'?1:2),button('skills_advanced','Advanced',page==='advanced'?1:2),button('skills_growth','Level unlocks',page==='growth'?1:2)]},...files.map(f=>({type:12,items:[{media:{url:'attachment://'+f.name},description:f.description}]})),{type:1,components:[button('menu','Menu'),button('battle','Back to battle',1)]}]};}
module.exports={sprite,icon,svg,sheets,assets,asset,payload,rows,unlocks};


module.exports.clearCache=()=>{cache.clear();sprites.clear();};
