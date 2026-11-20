'use strict';
const path=require('node:path'),files=require('./file-map.json');
const root=__dirname;
// Resolve legacy asset names once at the filesystem boundary. State and cache
// files absent from the manifest retain their stable root-relative locations.
function mapped(absolute){const rel=path.relative(root,absolute).replace(/\\/g,'/');const found=files[rel]||files[rel+'.js']||files[rel+'.cjs']||files[rel+'.json'];return found?path.join(root,found):absolute;}
module.exports={root,directory:dir=>path.join(root,dir),join:(...parts)=>mapped(path.join(...parts)),resolve:(...parts)=>mapped(path.resolve(...parts)),file:(...parts)=>mapped(path.join(root,...parts))};
