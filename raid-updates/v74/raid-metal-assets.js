'use strict';
const fs=require('node:fs'),path=require('node:path'),{Resvg}=require('@resvg/resvg-js'),skin=require('./raid-metal-ui');
const fontFiles=['raid-latin-bold.otf','NotoSansKR-Bold.otf'].map(f=>path.join(__dirname,f)).filter(fs.existsSync);
const options={font:{fontFiles,defaultFontFamily:'Noto Sans KR',loadSystemFonts:fontFiles.length===0}};
const ui=require('./raid-ui-fonts'),subsetOptions={font:{...options.font,fontFiles:fontFiles.map(f=>f.endsWith('NotoSansKR-Bold.otf')?ui.files.korean:f)}};
const raster=svg=>new Resvg(svg,ui.supports(svg)?subsetOptions:options).render().asPng();
function boss(a,name){const s=a.state,stage=require('./raid-engine/enrage-stages.cjs').level(s),enrage=(['','ENRAGE I','ENRAGE II','MAXIMUM'][stage]??'MAXIMUM');const data={name:name.toUpperCase(),turn:s.config.boss==='earth'?(s.log.at(-1)?.turn??s.turn):s.turn,hp:s.worldBossHP??s.bossHP,maxHP:s.bossMaxHP||require('./raid-boss-health').maximum(s.config.boss),enrage},key=JSON.stringify(data);if(a.metalBoss?.key===key)return a.metalBoss.asset;const asset={name:'boss-status-'+s.turn+'.png',attachment:raster(skin.bossSVG(data)),description:name+' / Turn '+s.turn+' / '+data.hp+' / '+data.maxHP+' HP / '+(s.bossHP<=0?'BOSS SURRENDERED / RAID COMPLETE':enrage)};a.metalBoss={key,asset};return asset;}
module.exports={raster,boss};

