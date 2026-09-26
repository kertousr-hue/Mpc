const test=require('node:test');
const assert=require('node:assert/strict');
const s=require('../sonilo.js');

test('errorMessage translates safe Sonilo error codes for UI',()=>{
  assert.match(s.errorMessage('sonilo_not_configured'),/secret/i);
  assert.match(s.errorMessage('insufficient_balance'),/crédit|solde/i);
  assert.match(s.errorMessage('rate_limited'),/trop/i);
  assert.match(s.errorMessage('auth_required'),/connexion/i);
});

test('pollDelay respects retry-after and stays bounded',()=>{
  assert.equal(s.pollDelay(null),3000);
  assert.equal(s.pollDelay(7),7000);
  assert.equal(s.pollDelay(99),15000);
});
