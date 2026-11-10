'use strict';
// These fonts are exact glyph/layout subsets of the existing production fonts.
// Arbitrary player names keep the originals whenever a character is not in the
// subset range. Decode XML character references before making that decision.
const path=require('node:path');
const covered=/^[\u0000-\u024f\u2000-\u206f\u20a0-\u20cf\u2190-\u22ff\u2500-\u26ff]*$/u;
function supports(value){
 if(typeof value!=='string'||!value)return false;
 try{return covered.test(value.replace(/&#(?:x([\da-f]+)|(\d+));/gi,(_,hex,dec)=>String.fromCodePoint(parseInt(hex||dec,hex?16:10))));}
 catch{return false;}
}
const files={latin:path.join(__dirname,'raid-ui-latin-subset.ttf'),math:path.join(__dirname,'raid-ui-math-subset.ttf'),korean:path.join(__dirname,'raid-ui-korean-subset.otf')};
module.exports={supports,files};
