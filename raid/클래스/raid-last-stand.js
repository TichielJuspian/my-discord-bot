const runtimePaths = require("../runtime-paths.cjs");
'use strict';
const fs=require('node:fs'),path=require('node:path'),{Resvg}=require('@resvg/resvg-js');
const portraits=new Map();
function card(a){
 const job=a.state.config.job;
 if(!['warrior','paladin','berserker'].includes(job))throw Error('Unsupported Last Stand portrait');
 if(!portraits.has(job))portraits.set(job,require('./raid-portrait-quality.js').frame(job,'last_stand')?.png||fs.readFileSync(runtimePaths.join(runtimePaths.directory("."),job+'-last-stand.png')).toString('base64'));
 const legendary=require('./raid-legendary-motion.js').frame(job,'last_stand',a.state.workshop?.equipped,job==='berserker'&&require('./광전사/berserker-rules.cjs').enraged(a.state));
 let svg=require('../보스/전투/raid-profile-card.js')(a,'data:image/png;base64,'+(legendary?.png||portraits.get(job)));
 const badge='<rect x="33" y="145" width="121" height="16" rx="5" fill="#48321e" stroke="#ffdb7d"/><text x="93" y="157" text-anchor="middle" font-family="Noto Sans KR" font-size="9" font-weight="bold" fill="#ffe8a8">LAST STAND / 1 HP</text>';
 svg=svg.replace('</svg>',badge+'</svg>');
 const font=['NotoSansKR-Bold.otf','assets/NotoSansKR-Bold.otf'].map(n=>runtimePaths.join(runtimePaths.directory("."),n)).find(fs.existsSync);
 return new Resvg(svg,{font:{fontFiles:font?[font]:[],defaultFontFamily:'Noto Sans KR',loadSystemFonts:!font}}).render().asPng();
}
module.exports={card};
