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

test('settlement gap adds paid quotas and offsets member expenses by outstanding Thursday fees', () => {
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
    calculateClubSettlementGap();
  `, context);
  assert.equal(net, -140000);
});

test('club net can show when members owe more than the club', () => {
  const net = vm.runInContext(`
    members = ['Pata'];
    movements = [{ persona: 'Pata', tipo: 'cuota_jueves', monto: 30000 }];
    calculateClubSettlementGap();
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
      settlementGap: calculateClubSettlementGap(),
      quotaPayments: calculateQuotaPayments(),
      cash: calculateClubCashBalance(),
      reimbursementsOwed: calculatePendingReimbursements(),
      debtToSettle: calculateClubDebtToSettle(),
    });
  `, context);
  assert.equal(result.settlementGap, -121300);
  assert.equal(result.quotaPayments, 90000);
  assert.equal(result.cash, 32500);
  assert.equal(result.reimbursementsOwed, 153800);
  assert.equal(result.debtToSettle, 121300);
});

test('reimbursements owed exclude amounts offset by member fees due', () => {
  const owed = vm.runInContext(`
    members = ['Ruso', 'Pata'];
    movements = [
      { persona: 'Ruso', tipo: 'gasto', monto: 223800 },
      { persona: 'Ruso', tipo: 'cuota_jueves', monto: 70000 },
      { persona: 'Pata', tipo: 'gasto', monto: 250000 },
      { persona: 'Pata', tipo: 'cuota_jueves', monto: 250000 },
    ];
    calculatePendingReimbursements();
  `, context);
  assert.equal(owed, 153800);
});

test('cash and reimbursements owed are tracked separately from the settlement gap', () => {
  const result = vm.runInContext(`
    members = ['Pata'];
    movements = [
      { persona: 'Pata', tipo: 'gasto', monto: 100000 },
      { persona: 'Pata', tipo: 'reintegro', monto: 100000 },
    ];
    ({
      settlementGap: calculateClubSettlementGap(),
      cash: calculateClubCashBalance(),
      reimbursementsOwed: calculatePendingReimbursements(),
    });
  `, context);
  assert.equal(result.settlementGap, -100000);
  assert.equal(result.cash, -100000);
  assert.equal(result.reimbursementsOwed, 0);
});
