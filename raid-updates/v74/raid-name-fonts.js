'use strict';
const fs=require('node:fs'),path=require('node:path');
const latin=path.join(__dirname,'raid-unicode-bold.ttf'),math=path.join(__dirname,'raid-unicode-math.ttf');
const korean=['NotoSansKR-Bold.otf','assets/NotoSansKR-Bold.otf','../assets/NotoSansKR-Bold.otf'].map(n=>path.join(__dirname,n)).find(fs.existsSync);
const regular={font:{fontFiles:[latin,math],loadSystemFonts:false,defaultFontFamily:'Noto Sans'}};
const cjk={font:{...regular.font,fontFiles:[latin,math,...(korean?[korean]:[])]}};
const ui=require('./raid-ui-fonts'),subset={font:{...regular.font,fontFiles:[ui.files.latin,ui.files.math,...(korean?[ui.files.korean]:[])]}};
const segments=new Intl.Segmenter('und',{granularity:'grapheme'});
function clip(value,max){const chars=[...segments.segment(String(value??''))].map(x=>x.segment);return chars.length>max?chars.slice(0,max-1).join('')+'…':chars.join('');}
function options(value=''){return ui.supports(value)?subset:cjk;}
module.exports={options,clip};
