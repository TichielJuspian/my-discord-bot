'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const boost=require('../raid-booster'), workshop=require('../raid-workshop-boost');
test('one booster stack gives +10 percent ATK; multiple stacks and rally add',()=>{
 A.equal(boost.attack(100,0),100);
 A.equal(boost.attack(100,1),110);
 A.equal(boost.attack(100,2),120);
 A.equal(boost.attack(100,4),140);
 A.equal(boost.attack(100,2,.2),140);
 const state={stats:{attack:100},sharedBuffEffects:{attack:.1}};
 const next=boost.apply(state,2);
 A.equal(next.stats.attack,130);
 A.equal(next.boosterAttackPercent,20);
 A.equal(state.stats.attack,100);
 A.match(workshop.label({boostCount:1}),/ATK \+10%/);
 A.match(workshop.label({boostCount:4}),/ATK \+40%/);
});
