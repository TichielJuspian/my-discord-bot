'use strict';
// Skill-guide presentation only. Reuse approved runtime effect PNGs unchanged.
const fs=require('node:fs'),path=require('node:path'),{Resvg}=require('@resvg/resvg-js');
const FILES=Object.freeze({
 warrior:Object.freeze({'Sharp Eye':'sharp-eye.png','Sixth Sense':'sixth-sense.png',Hone:'hone.png','Defense Up':'defense-up.png','BLADE TRANCE':'blade-trance.png'}),
 paladin:Object.freeze({'Divine Punishment':'paladin-divine-punishment.png',Blessing:'paladin-blessing.png','Divine Grace':'paladin-divine-grace.png'}),
 berserker:Object.freeze({'Blood Draw':'berserker-blood-draw.png'})
});
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const widths=new Map(),icons=new Map();
const fontFiles=['raid-latin-bold.otf','NotoSansKR-Bold.otf'].map(f=>path.join(__dirname,f)).filter(fs.existsSync);
const fontOptions={font:{fontFiles,defaultFontFamily:'Noto Sans KR',loadSystemFonts:fontFiles.length===0}};
function normalize(value){return String(value).replace(/\bCrit Rate\b/gi,'Crit Chance').replace(/\bCRIT DMG\b/g,'Crit Damage').replace(/\bCRIT\b/g,'Crit Chance').replace(/\bcritical chance\b/gi,'Crit Chance').replace(/ (?:percentage points?|pp)\b/g,'%');}
function image(job,name){
 const file=FILES[job]?.[name];if(!file)return null;
 if(!icons.has(file)){const p=path.join(__dirname,'raid15','assets',file);icons.set(file,fs.existsSync(p)?fs.readFileSync(p).toString('base64'):null);}
 return icons.get(file);
}
function measure(value,size){
 const key=size+':'+value;if(widths.has(key))return widths.get(key);
 // Boundary markers retain leading/trailing spaces in the measured advance.
 const box=t=>new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="100"><text x="0" y="60" font-family="Noto Sans KR" font-weight="bold" font-size="'+size+'">'+esc(t)+'</text></svg>',fontOptions).innerBBox();
 const markerKey='marker:'+size;if(!widths.has(markerKey))widths.set(markerKey,box('MM')?.width||0);
 const result=Math.max(0,(box('M'+value+'M')?.width||0)-widths.get(markerKey));
 widths.set(key,result);if(widths.size>1024)widths.delete(widths.keys().next().value);return result;
}
function tokens(value,job){
 const names=Object.keys(FILES[job]||{});if(!names.length)return null;
 const pattern=new RegExp('\\[\\[('+names.join('|')+')(?::(\\d+))?\\]\\]|\\b('+names.join('|')+')\\b','g');let last=0,match,out=[],hasIcon=false,hasMarker=false;
 const plain=s=>{for(const word of s.match(/\S+\s*|\s+/g)||[])out.push({text:word});};
 while((match=pattern.exec(value))){plain(value.slice(last,match.index));const name=match[1]||match[3],png=image(job,name),badge=match[2]?Number(match[2]):null;out.push({text:match[1]&&png?'':name+(badge?' x'+badge:''),png,name,badge});if(png)hasIcon=true;if(match[1])hasMarker=true;last=pattern.lastIndex;}
 plain(value.slice(last));return hasIcon||hasMarker?out:null;
}
function drawing(value,{job,x=275,y,size=25,maxWidth=710,lineHeight=34,color='#dce9f6'}={}){
 const parts=tokens(value,job);if(!parts)return null;
 const iconSize=27,iconGap=5,rows=[],continuation=16;let row=[],used=0,indent=0;
 const add=(part,w)=>{row.push({...part,x:x+indent+used,width:w});used+=w;};
 add({text:'• '},measure('• ',size));
 for(const original of parts){let part={...original},w=(part.png?iconSize+iconGap+(part.badge?8:0):0)+measure(part.text,size);
  if(used+w>maxWidth-indent&&row.length){rows.push(row);row=[];used=0;indent=continuation;part.text=part.text.replace(/^\s+/,'');w=(part.png?iconSize+iconGap+(part.badge?8:0):0)+measure(part.text,size);}
  if(!part.text&&!part.png)continue;
  add(part,w);
 }
 if(row.length)rows.push(row);
 let svg='';
 rows.forEach((items,index)=>{const baseline=y+index*lineHeight;for(const item of items){let tx=item.x;if(item.png){svg+='<g role="img" aria-label="'+esc(item.name+(item.badge?', '+item.badge+' stacks':''))+'"><image data-guide-effect="'+esc(item.name)+'" x="'+tx+'" y="'+(baseline-size*.76)+'" width="'+iconSize+'" height="'+iconSize+'" href="data:image/png;base64,'+item.png+'"/>';if(item.badge)svg+='<circle data-guide-stack="'+item.badge+'" cx="'+(tx+iconSize-2)+'" cy="'+(baseline+4)+'" r="9" fill="#101625" stroke="#79c9ff"/><text x="'+(tx+iconSize-2)+'" y="'+(baseline+9)+'" text-anchor="middle" font-family="Noto Sans KR" font-weight="bold" font-size="13" fill="#ffffff">'+item.badge+'</text>';svg+='</g>';tx+=iconSize+iconGap+(item.badge?8:0);}if(item.text)svg+='<text xml:space="preserve" x="'+tx+'" y="'+baseline+'" font-family="Noto Sans KR" font-weight="bold" font-size="'+size+'" fill="'+color+'">'+esc(item.text)+'</text>';}});
 return {svg,lines:rows.length,rows};
}
module.exports={FILES,normalize,image,drawing};
