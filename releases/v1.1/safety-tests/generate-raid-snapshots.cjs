'use strict';
// Explicitly opt in when creating a NEW approved gameplay baseline. Do not regenerate to hide regressions.
const fs=require('node:fs'),path=require('node:path');
const {allCases,manualRun}=require('./raid-snapshot-helper.cjs');
if(process.argv[2]!=='--write'){
  console.error('Snapshot generation requires --write and approved reference gameplay behavior.');
  process.exitCode=2;
}else{
  const data={schema:1, source:'BotKeep backup, before safety fixes', cases:Object.fromEntries(allCases().map(c=>[c.key, manualRun(c)]))};
  const dest=path.join(__dirname,'fixtures','raid-combat-baseline.json');
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(data,null,2)+'\n');
  console.log(`Wrote ${Object.keys(data.cases).length} deterministic gameplay snapshots`);
}
