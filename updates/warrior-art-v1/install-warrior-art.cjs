'use strict';
// Offline, explicit apply, exact source guards. Never starts or restarts the bot.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {expected,patch}=require('./warrior-art-patch.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const blob=b=>crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
function checkJS(name,content){const r=spawnSync(process.execPath,['--check'],{input:content,encoding:'utf8'});if(r.status!==0)throw Error(name+': '+r.stderr);}
function safeWrite(file,bytes){const tmp=file+'.warrior-art-'+crypto.randomBytes(5).toString('hex')+'.tmp';try{fs.writeFileSync(tmp,bytes,{flag:'wx'});fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
function verifyPayload(){
 const m=JSON.parse(fs.readFileSync(path.join(__dirname,'payload-manifest.json'),'utf8'));
 for(const [f,h] of Object.entries(m.files)){if(path.basename(f)!==f)throw Error('Unsafe payload path');if(sha(fs.readFileSync(path.join(__dirname,f)))!==h)throw Error('Payload checksum mismatch: '+f);}
 const p=require('./raid-warrior-art-v1.json');if(p.schema!==1)throw Error('Invalid asset schema');
 return m;
}
function plan(root){
 verifyPayload();const out=[];
 for(const [name,hash]of Object.entries(expected)){
  const f=path.join(root,name);if(!fs.existsSync(f))throw Error('Missing runtime file: '+name+' (repository root is NOT the current raid runtime)');
  const old=fs.readFileSync(f);if(blob(old)!==hash)throw Error('Runtime version mismatch: '+name+'. No files changed; reconcile with the current server version first.');
  const next=Buffer.from(patch(name,old.toString('utf8')));checkJS(name,next);out.push({name,old,next});
 }
 for(const name of ['raid-warrior-art.js','raid-warrior-art-v1.json']){
  const dest=path.join(root,name);if(fs.existsSync(dest))throw Error('New asset destination already exists: '+name);
  const next=fs.readFileSync(path.join(__dirname,name));if(name.endsWith('.js'))checkJS(name,next);out.push({name,old:null,next});
 }
 return out;
}
function restore(backup,root,forceInternal=false){
 const receipt=JSON.parse(fs.readFileSync(path.join(backup,'receipt.json'),'utf8'));
 if(path.resolve(receipt.root)!==path.resolve(root))throw Error('Rollback root mismatch');
 for(const f of receipt.files){
  if(path.basename(f.name)!==f.name)throw Error('Unsafe rollback path');
  const dest=path.join(root,f.name),current=fs.existsSync(dest)?fs.readFileSync(dest):null;
  if(!forceInternal&&(!current||sha(current)!==f.after))throw Error('Rollback would overwrite later edits: '+f.name);
  if(f.before!==null&&sha(fs.readFileSync(path.join(backup,f.name)))!==f.before)throw Error('Corrupt backup: '+f.name);
 }
 for(const f of receipt.files){const dest=path.join(root,f.name);if(f.before===null){if(fs.existsSync(dest))fs.unlinkSync(dest);}else safeWrite(dest,fs.readFileSync(path.join(backup,f.name)));}
}
function apply(root,changes){
 const backup=path.join(root,'.warrior-art-backups',new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex'));
 fs.mkdirSync(backup,{recursive:true});
 const receipt={root:path.resolve(root),files:changes.map(f=>({name:f.name,before:f.old===null?null:sha(f.old),after:sha(f.next)}))};
 for(const f of changes)if(f.old!==null)fs.writeFileSync(path.join(backup,f.name),f.old,{flag:'wx'});
 fs.writeFileSync(path.join(backup,'receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'});
 // Recheck before writes; prevents knowingly overwriting a changed snapshot.
 for(const f of changes){const dest=path.join(root,f.name);if(f.old===null?fs.existsSync(dest):!fs.existsSync(dest)||sha(fs.readFileSync(dest))!==sha(f.old))throw Error('Files changed during preparation: '+f.name);}
 try{for(const f of changes)safeWrite(path.join(root,f.name),f.next);for(const f of changes)if(sha(fs.readFileSync(path.join(root,f.name)))!==sha(f.next))throw Error('Write verification failed');}
 catch(e){restore(backup,root,true);throw e;}
 return backup;
}
function main(args){
 let root=null,write=false,rollback=null;
 for(let i=0;i<args.length;i++){if(args[i]==='--root')root=args[++i];else if(args[i]==='--apply')write=true;else if(args[i]==='--rollback')rollback=args[++i];else throw Error('Unknown argument: '+args[i]);}
 if(!root)throw Error('Usage: node install-warrior-art.cjs --root /actual/bot/runtime [--apply | --rollback /backup/path]');
 root=path.resolve(root);if(rollback){if(write)throw Error('Choose apply OR rollback');restore(path.resolve(rollback),root);console.log('Rollback complete. No bot restart was performed.');return;}
 const changes=plan(root);console.log('Validated presentation files:',changes.map(f=>f.name).join(', '));
 if(!write){console.log('DRY RUN ONLY. No files changed. Stop the bot before running again with --apply.');return;}
 const backup=apply(root,changes);console.log('Artwork installed; combat code and user data unchanged. Backup:',backup);console.log('Bot has NOT been restarted. Review the preview, then restart through the normal deployment procedure.');
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={blob,plan,apply,restore,main};
