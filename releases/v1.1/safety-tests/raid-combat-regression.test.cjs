'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {allCases,manualRun,R,config}=require('./raid-snapshot-helper.cjs');
const expected=require('./fixtures/raid-combat-baseline.json');

test('54 seeded manual-combat traces remain byte-for-byte behaviorally identical',()=>{
  assert.equal(expected.schema,1);
  const cases=allCases();assert.equal(cases.length,54);
  assert.deepEqual(Object.keys(expected.cases).sort(),cases.map(c=>c.key).sort());
  for(const c of cases)assert.deepEqual(manualRun(c),expected.cases[c.key],`Combat behavior changed: ${c.key}`);
});

test('diagnostic chooser always uses a legal action and runs to a terminal state (54 scenarios)',()=>{
  let totalTurns=0;
  for(const c of allCases()){
    let s=R.create(config(c.job,c.level,0,c.boss),c.seed);
    for(let steps=0;s.status==='active';steps++){
      assert.ok(steps<=500,`Diagnostic max turns: ${c.key}`);
      const allowed=R.actions(s);
      const action=R.choose(s,'handle');
      assert.ok(allowed.includes(action),`${c.key}: illegal ${action} at turn ${s.turn}, available ${allowed.join(', ')}`);
      s=R.step(s,action);totalTurns++;
    }
    assert.notEqual(s.status,'active',`Still active: ${c.key}`);
  }
  assert.ok(totalTurns>100);
});
