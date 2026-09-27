const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const document = {
  getElementById: () => null,
  addEventListener: () => {},
};
const localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const context = vm.createContext({ document, localStorage, console });
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
vm.runInContext(app, context, { filename: 'app.js' });

test('club net adds quota payments and offsets expenses by reimbursements and outstanding fees', () => {
  const net = vm.runInContext(`
    members = ['Tade', 'Pata'];
    movements = [
      { persona: 'Tade', tipo: 'gasto', monto: 160000 },
      { persona: 'Tade', tipo: 'reintegro', monto: 130000 },
      { persona: 'Tade', tipo: 'cuota_jueves', monto: 30000 },
      { persona: 'Pata', tipo: 'gasto', monto: 20000 },
      { persona: 'Pata', tipo: 'reintegro', monto: 5000 },
      { persona: 'Pata', tipo: 'cuota_jueves', monto: 10000 },
      { persona: 'Pata', tipo: 'pago_cuota', monto: 4000 },
    ];
    calculateClubNetBalance();
  `, context);
  assert.equal(net, -5000);
});

test('club net can show when members owe more than the club', () => {
  const net = vm.runInContext(`
    members = ['Pata'];
    movements = [{ persona: 'Pata', tipo: 'cuota_jueves', monto: 30000 }];
    calculateClubNetBalance();
  `, context);
  assert.equal(net, 30000);
});

test('member and guest quota payments are club credits against member expenses', () => {
  const result = vm.runInContext(`
    members = ['Ruso'];
    movements = [
      { persona: 'Ruso', tipo: 'gasto', monto: 281300 },
      { persona: 'Ruso', tipo: 'reintegro', monto: 57500 },
      { persona: 'Ruso', tipo: 'cuota_jueves', monto: 100000 },
      { persona: 'Ruso', tipo: 'pago_cuota', monto: 30000 },
      { persona: 'Amigo Gaspo 1', tipo: 'pago_cuota', monto: 30000 },
      { persona: 'Hermano Gaspo', tipo: 'pago_cuota', monto: 30000 },
    ];
    ({
      net: calculateClubNetBalance(),
      quotaPayments: calculateQuotaPayments(),
      debtToSettle: calculateClubDebtToSettle(),
    });
  `, context);
  assert.equal(result.net, -63800);
  assert.equal(result.quotaPayments, 90000);
  assert.equal(result.debtToSettle, 63800);
});
