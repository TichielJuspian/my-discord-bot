#!/usr/bin/env node
'use strict';
// Read-only pre- and post-patch SHA-256 checker. Does not write to target.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const manifest=require('./manifest.json');
const root=process.argv[2],mode=process.argv[3]||'before';
if(!root||!['before','after'].includes(mode)){
 console.error('Usage: node verify-target.cjs /path/to/target/bot before|after');
 process.exit(2);
}
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
let ok=true;
for(const item of manifest.changes){
 const f=path.resolve(root,item.path),relative=path.relative(path.resolve(root),f);
 if(relative.startsWith('..')||path.isAbsolute(relative)){ok=false;console.error('Invalid path: '+item.path);continue;}
 const exists=fs.existsSync(f);
 const wanted=mode==='before'?item.baseline_sha256:item.patch_sha256;
 if(!wanted){if(exists){ok=false;console.error('MISMATCH new-file already exists: '+item.path);}else console.log('OK absent: '+item.path);continue;}
 if(!exists){ok=false;console.error('MISSING '+item.path);continue;}
 const actual=hash(f);
 if(actual!==wanted){ok=false;console.error('MISMATCH '+item.path+' actual='+actual.slice(0,14));}
 else console.log('OK '+item.path);
}
console.log(ok?'PASS: all source file hashes match.':'FAIL: STOP; do not overwrite mismatching files.');
process.exit(ok?0:1);
