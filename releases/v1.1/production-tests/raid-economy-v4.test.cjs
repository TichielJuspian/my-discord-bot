'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const R=require('../raid-point-rewards'), B=require('../raid-booster');
test('v4 success 900, failure 100, rank bonus 500/400/300/200/100',()=>{
 const rows=[{id:'1',damage:1000},{id:'2',damage:900},{id:'3',damage:800},{id:'4',damage:750},{id:'5',damage:700},{id:'6',damage:600},...Array.from({length:20},(_,i)=>({id:String(i+7),damage:500-i}))];
 const win=R.rewards(rows,true,4),lose=R.rewards(rows,false,4);
 A.deepEqual(win.slice(0,6).map(r=>r.points),[1400,1300,1200,1200,1200,1100]);
 A.deepEqual(lose.slice(0,6).map(r=>r.points),[600,500,400,400,400,300]);
 A.equal(win.at(-1).points,1000);A.equal(lose.at(-1).points,200);
});
test('historical v2/v3 payouts remain interpretable',()=>{
 const rows=[{id:'1',damage:1000}];
 A.equal(R.rewards(rows,true,2)[0].points,1500);
 A.equal(R.rewards(rows,true,3)[0].points,1400);
 A.equal(R.rewards(rows,false,3)[0].points,700);
 A.equal(R.rewards(rows,false,4)[0].points,600);
});
test('ties share rank; zero damage never receives rank rewards',()=>{
 A.deepEqual(R.rewards([{id:'a',damage:100},{id:'b',damage:100},{id:'z',damage:0},{id:'c',damage:90}],false,4).map(r=>[r.rank,r.points]),[[1,600],[1,600],[3,400]]);
});
test('boost stacks grant 10% base ATK, additive with rally; never change images',()=>{
 A.equal(B.attack(100,0),100);A.equal(B.attack(100,1),110);A.equal(B.attack(100,4),140);
 A.equal(B.attack(100,2,.1),130);
 const s={stats:{attack:100},sharedBuffEffects:{attack:.1}};
 const out=B.apply(s,2);
 A.equal(out.stats.attack,130);A.equal(out.boosterAttackPercent,20);A.equal(s.stats.attack,100);
});
