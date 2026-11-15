'use strict';
const grouped=new WeakMap();
function context(s){const job=s.pending?.action==='job'?s.pending.value:s.account.job;return {config:{job,level:s.level},workshop:{equipped:job===s.account.job?s.account.equipped:{}}};}
function page(s){return require('./raid-skill-guide').resolvePage(context(s),s.guidePage||'core');}
function pages(s){return require('./raid-skill-guide').pages(context(s));}
function compact(files){
 // The workshop has four fixed images. Preserve every skill within its ten-file budget.
 if(files.length<=6)return files;if(grouped.has(files))return grouped.get(files);
 const out=[];
 for(let start=0;start<files.length;start+=2){
  const pair=files.slice(start,start+2);let width=0,height=0,body='';
  for(const file of pair){const png=file.attachment;if(!Buffer.isBuffer(png)||png.length<24||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Guide card must be a PNG');const w=png.readUInt32BE(16),h=png.readUInt32BE(20);if(!w||!h||(width&&width!==w))throw Error('Guide cards must have matching widths');width=w;body+='<image href="data:image/png;base64,'+png.toString('base64')+'" x="0" y="'+height+'" width="'+w+'" height="'+h+'"/>';height+=h;}
  out.push({name:pair[0].name.replace(/\.png$/,'-group.png'),attachment:require('./raid-entry-image-cache').raster('<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'">'+body+'</svg>'),description:pair.map(f=>f.description).join(' / ')});
 }
 grouped.set(files,out);return out;
}
function assets(s){return compact(require('./raid-skill-guide').assets(context(s),page(s)));}
module.exports={assets,page,pages};
