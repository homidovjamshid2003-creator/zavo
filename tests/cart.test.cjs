const { test } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { setup } = require('./helpers.cjs');

test('cart restoration consolidates duplicate IDs and respects stock after a connection failure', async () => {
  const e = setup();
  const saved = JSON.stringify([{ id: 1, quantity: 2 }, { id: '1', quantity: 2 }, { id: 1, quantity: -1 }, null, { id: 999, quantity: 1 }]);
  e.memory.set('zavo-cart', saved);
  e.state.fail = true;
  await e.run('script.js');
  assert.equal(e.memory.get('zavo-cart'), saved);
  e.state.fail = false;
  await e.emit(e.winEvents, 'focus', {});
  assert.deepEqual(JSON.parse(e.memory.get('zavo-cart')), [{ id: 1, quantity: 2 }]);
  assert.equal(Number(e.nodes.get('#cart-count').textContent), 2);
});

test('cart startup caps excessive quantities and rejects fractional or invalid entries', async () => {
  const e = setup();
  e.state.data.products[0].stock_quantity = 200;
  e.memory.set('zavo-cart', JSON.stringify([{ id: 1, quantity: 1000 }, { id: 1, quantity: 0.5 }, { id: 1, quantity: '2' }]));
  await e.run('script.js');
  assert.equal(Number(e.nodes.get('#cart-count').textContent), 99);
});

test('empty checkout is disabled and never sends an order', async () => {
  const e = setup();
  await e.run('script.js');
  assert.equal(e.nodes.get('#checkout-submit').disabled, true);
  const form = e.nodes.get('#checkout-form');
  await e.emit(form.handlers, 'submit', form);
  assert.equal(e.calls.some(c => c[0] === 'edge'), false);
  assert.equal(e.nodes.get('#checkout-error').hidden, false);
});

test('checkout sends the same cart as its fingerprint despite a refresh while hashing', async () => {
  const e = setup();
  e.memory.set('zavo-cart', JSON.stringify([{ id: 1, quantity: 2 }]));
  await e.run('script.js');
  const form = e.nodes.get('#checkout-form');
  form.elements = { payment: { value: 'cash' }, months: { value: '12' } };
  let release, started, hashed;
  const gate = new Promise(resolve => { release = resolve; });
  const hashing = new Promise(resolve => { started = resolve; });
  e.context.crypto = {
    randomUUID: () => webcrypto.randomUUID(),
    subtle: { async digest(algorithm, bytes) {
      hashed = JSON.parse(new TextDecoder().decode(bytes));
      started();
      await gate;
      return webcrypto.subtle.digest(algorithm, bytes);
    } }
  };
  const submission = e.emit(form.handlers, 'submit', form);
  await hashing;
  await e.emit(form.handlers, 'submit', form);
  e.state.data.products[0].stock_quantity = 1;
  await e.emit(e.winEvents, 'focus', {});
  assert.equal(Number(e.nodes.get('#cart-count').textContent), 1);
  release();
  await submission;
  const requests = e.calls.filter(c => c[0] === 'edge');
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0][2].items)), hashed.cart);
  assert.equal(requests[0][2].items[0].quantity, 2);
  assert.equal(e.nodes.get('#checkout-submit').disabled, true);
  assert.deepEqual(JSON.parse(e.memory.get('zavo-cart')), []);
});
