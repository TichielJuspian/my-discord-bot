'use strict';
const base=require('./raid-name-fonts'),path=require('node:path');
function options(value){const o=base.options(value);return {...o,font:{...o.font,fontFiles:[...o.font.fontFiles,path.join(__dirname,'workshop-rajdhani-semibold.ttf')]}};}
module.exports={options};
