'use strict';
const registry=new Map();
function create(name,maxBytes=4*1024*1024,maxEntries=24){const map=new Map();let bytes=0,hits=0,misses=0,writes=0;const api={has:k=>map.has(k),get(k){const v=map.get(k);if(!v){misses++;return;}hits++;map.delete(k);map.set(k,v);return v;},set(k,v){writes++;if(map.has(k)){bytes-=map.get(k).length;map.delete(k);}if(v.length>maxBytes)return api;map.set(k,v);bytes+=v.length;while(map.size>maxEntries||bytes>maxBytes){const first=map.keys().next().value;bytes-=map.get(first).length;map.delete(first);}return api;},clear(){map.clear();bytes=0;},stats:()=>({entries:map.size,bytes,maxBytes,hits,misses,writes})};registry.set(name,api);return api;}
module.exports={create,stats:()=>Object.fromEntries([...registry].map(([k,v])=>[k,v.stats()]))};
