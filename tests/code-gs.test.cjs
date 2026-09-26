const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = vm.createContext({});
const code = fs.readFileSync(path.join(__dirname, '..', 'code.gs'), 'utf8');
vm.runInContext(code, context, { filename: 'code.gs' });

test('parseMoney accepts numeric and Argentine or US currency values', () => {
  const cases = [
    [160000, 160000],
    ['$160,000.00', 160000],
    ['$160.000,00', 160000],
    ['160000,50', 160000.5],
    ['160.000', 160000],
    ['160,000', 160000],
  ];
  for (const [input, expected] of cases) {
    assert.equal(context.parseMoney(input), expected, String(input));
  }
});

test('mapMovementRows preserves currency amounts pasted as formatted text', () => {
  const movements = context.mapMovementRows([
    ['ID', 'Fecha', 'Persona', 'Tipo', 'Monto', 'Concepto'],
    ['DEU-023', '2026-09-17', 'Tade', 'gasto', '$160.000,00', 'Comida'],
    ['DEU-030', '2026-09-17', 'Tade', 'cuota_jueves', '$30.000,00', 'Cuota Jueves Santo'],
    ['DEU-043', '2026-09-26', 'Tade', 'reintegro', '$130.000,00', 'Reintegro'],
  ]);
  assert.deepEqual(Array.from(movements, movement => movement.monto), [160000, 30000, 130000]);
});

test('mapMovementRows rejects a non-empty row with an invalid amount', () => {
  assert.throws(() => context.mapMovementRows([
    ['ID', 'Fecha', 'Persona', 'Tipo', 'Monto', 'Concepto'],
    ['bad', '2026-09-17', 'Tade', 'gasto', 'importe pendiente', 'Comida'],
  ]), /Monto inválido en Registro/);
});
