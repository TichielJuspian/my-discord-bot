'use strict';
const expected=Object.freeze({
 'raid-portrait-quality.js':'7e8c955e3c1e764def77e3aa35e9724358367ec3',
 'raid-legendary-motion.js':'d86a1e0641451d9e2a2d62e56f07de315561b3af',
 'raid-static-card.js':'49519610d130401425c9e3523683ba747ec54e73',
 'raid-skill-guide.js':'e7487bf3a807f71e1283b92f1e975d12476fb5a0'
});
function replaceOne(source,old,next){
 if(source.split(old).length!==2)throw Error('Presentation hook missing or ambiguous: '+old.slice(0,90));
 return source.replace(old,next);
}
function patch(file,input){let s=input;
 if(file==='raid-portrait-quality.js')s=replaceOne(s,'function frame(job,pose){',"function frame(job,pose){\n if(job==='warrior'){const f=require('./raid-warrior-art').frame(pose,false);if(f)return f;}");
 else if(file==='raid-legendary-motion.js')s=replaceOne(s,"if(!require('./raid-legendary-appearance').active(job,equipped))return null;","if(!require('./raid-legendary-appearance').active(job,equipped))return null;\n if(job==='warrior'){const f=require('./raid-warrior-art').frame(pose,true);if(f)return f;}");
 else if(file==='raid-static-card.js')s=replaceOne(s,'const chosen=select(s);',"const chosen=require('./raid-warrior-art').forState(s,select(s));");
 else if(file==='raid-skill-guide.js'){
  s=replaceOne(s,"const ready=require('./raid-prebuilt-guide').assets(s,page);","const ready=s.config.job==='warrior'?null:require('./raid-prebuilt-guide').assets(s,page);");
  s=replaceOne(s,"+icon(r.name==='Counter'", "+(job==='warrior'&&require('./raid-warrior-art').icon(r.name,28,33,44)||icon(r.name==='Counter'");
  s=replaceOne(s,'r.icon,28,33,c)+text(65,44','r.icon,28,33,c))+text(65,44');
 }else throw Error('Refusing to patch non-presentation file: '+file);
 return s;
}
module.exports={expected,patch};
