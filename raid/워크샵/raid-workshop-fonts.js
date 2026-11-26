const runtimePaths = require("../runtime-paths.cjs");
'use strict';
const base=require('../보스/전투/raid-name-fonts.js'),path=require('node:path');
function options(value,forge=false){const o=base.options(value);return {...o,font:{...o.font,fontFiles:[...o.font.fontFiles,runtimePaths.join(runtimePaths.directory("."),'workshop-rajdhani-semibold.ttf'),...(forge?[path.join(__dirname,'이미지','forge-v440-rajdhani-bold.ttf')]:[])]}};}
module.exports={options};
