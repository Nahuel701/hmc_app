function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'login') {
      const isValid = checkCredentials(e.parameter.user, e.parameter.pass);
      return createJsonResponse(isValid
        ? { status: 'success', message: 'Login exitoso' }
        : { status: 'error', message: 'Credenciales inválidas' });
    }

    if (action === 'getdata') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const registry = getOrCreateRegistrySheet(ss);
      const membersSheet = ss.getSheetByName('Miembros');
      const attendanceSheet = ss.getSheetByName('Asistencia');
      const membersRows = readSheetRows(membersSheet, 1);
      const registryRows = readSheetRows(registry, 6);
      const attendanceRows = readSheetRows(attendanceSheet, 4);

      return createJsonResponse({
        schemaVersion: 2,
        movements: mapMovementRows(registryRows),
        members: membersRows.slice(1)
          .map(row => row[0])
          .filter(name => name && name.toString().trim() !== '')
          .map(name => name.toString().trim()),
        attendance: mapAttendanceRows(attendanceRows)
      });
    }

    return createJsonResponse({ status: 'error', message: 'Acción no válida' });
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'Sin datos en el cuerpo' });
    }

    const payload = JSON.parse(e.postData.contents);

    if (payload.action === 'add') {
      const allowedTypes = ['gasto', 'reintegro', 'pago_cuota'];
      const tipo = (payload.tipo || '').toString().trim().toLowerCase();
      const monto = parseFloat(payload.monto);
      if (!allowedTypes.includes(tipo) || !payload.persona || !Number.isFinite(monto) || monto <= 0) {
        return createJsonResponse({ status: 'error', message: 'Movimiento inválido' });
      }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const registry = getOrCreateRegistrySheet(ss);
      const id = (payload.id || Utilities.getUuid()).toString();
      if (!hasMovementId(registry, id)) {
        registry.appendRow([
          id,
          payload.fecha || '',
          payload.persona,
          tipo,
          monto,
          payload.concepto || ''
        ]);
      }
      return createJsonResponse({ status: 'success', message: 'Movimiento guardado correctamente', id: id });
    }

    // Guardar Asistencia de Miembros (Sobrescribe si ya existe misma fecha y actividad)
    if (payload.action === 'save_attendance') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheetAtt = ss.getSheetByName('Asistencia');
      if (!sheetAtt) {
        sheetAtt = ss.insertSheet('Asistencia');
        sheetAtt.appendRow(['Fecha', 'Evento', 'Miembro', 'Estado']);
      }

      const fecha = (payload.fecha || '').toString().trim();
      const evento = (payload.evento || 'Reunión General').toString().trim();
      const registros = payload.registros || [];

      // Leer filas existentes para eliminar coincidencias previas de misma Fecha y Evento
      const lastRow = sheetAtt.getLastRow();
      if (lastRow > 1) {
        const data = sheetAtt.getRange(2, 1, lastRow - 1, 2).getValues();
        // Recorrer de abajo hacia arriba para eliminar sin alterar los índices
        for (let i = data.length - 1; i >= 0; i--) {
          let rowDate = data[i][0];
          let formattedRowDate = rowDate;
          if (rowDate instanceof Date) {
            formattedRowDate = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
          } else {
            formattedRowDate = (rowDate || '').toString().trim();
          }

          const rowEvent = (data[i][1] || 'Reunión General').toString().trim();

          if (formattedRowDate === fecha && rowEvent.toLowerCase() === evento.toLowerCase()) {
            sheetAtt.deleteRow(i + 2);
          }
        }
      }

      // Insertar nuevos registros actualizados
      registros.forEach(r => {
        sheetAtt.appendRow([
          fecha,
          evento,
          r.miembro || '',
          r.estado || 'ausente'
        ]);
      });

      return createJsonResponse({ status: 'success', message: 'Asistencia registrada correctamente' });
    }

    // Emitir las cuotas en la misma hoja Registro que los demás movimientos.
    if (payload.action === 'emit_cuota_jueves') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const registry = getOrCreateRegistrySheet(ss);
      const fecha = (payload.fecha || '').toString().trim();
      const cuota = parseFloat(payload.monto) || 0;
      const concepto = (payload.concepto || 'Cuota Jueves Santo').toString().trim();
      const asistentes = payload.asistentes || [];
      const operationId = (payload.id || Utilities.getUuid()).toString();

      if (!fecha || cuota <= 0 || !Array.isArray(asistentes)) {
        return createJsonResponse({ status: 'error', message: 'Emisión de cuota inválida' });
      }

      asistentes.forEach((persona, index) => {
        const id = `${operationId}:${index}`;
        if (!persona || hasMovementId(registry, id)) return;
        registry.appendRow([
          id,
          fecha,
          persona,
          'cuota_jueves',
          cuota,
          concepto
        ]);
      });

      return createJsonResponse({ status: 'success', message: 'Cuotas de Jueves Santo emitidas con éxito' });
    }

    return createJsonResponse({ status: 'error', message: 'Acción POST no reconocida' });

  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

function getMembersData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Miembros');
  
  if (!sheet) return [];

  const data = readSheetRows(sheet, 1);
  if (data.length <= 1) return [];

  const members = [];
  for (let i = 1; i < data.length; i++) {
    const name = data[i][0];
    if (name && name.toString().trim() !== '') {
      members.push(name.toString().trim());
    }
  }

  return members;
}

function getOrCreateRegistrySheet(ss) {
  const expectedHeaders = ['ID', 'Fecha', 'Persona', 'Tipo', 'Monto', 'Concepto'];
  let sheet = ss.getSheetByName('Registro');
  if (!sheet) sheet = ss.insertSheet('Registro');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expectedHeaders);
  } else {
    const headers = sheet.getRange(1, 1, 1, expectedHeaders.length).getValues()[0];
    if (expectedHeaders.some((header, index) => headers[index] !== header)) {
      throw new Error('La hoja Registro debe tener las columnas: ' + expectedHeaders.join(', '));
    }
  }
  return sheet;
}

function hasMovementId(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  return sheet.getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .some(row => row[0].toString() === id);
}

function mapMovementRows(data) {
  if (!data || data.length <= 1) return [];
  const movements = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[1] && !row[2] && !row[4]) continue;
    const rawDate = row[1];
    const formattedDate = rawDate instanceof Date
      ? Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'dd/MM/yyyy')
      : rawDate;
    movements.push({
      id: row[0] || '',
      fecha: formattedDate,
      persona: row[2] || '',
      tipo: (row[3] || '').toString().trim().toLowerCase(),
      monto: parseFloat(row[4]) || 0,
      concepto: row[5] || ''
    });
  }
  return movements;
}

function getAttendanceData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Asistencia');
  
  if (!sheet) return [];

  const data = readSheetRows(sheet, 4);
  if (data.length <= 1) return [];

  return mapAttendanceRows(data);
}

function mapAttendanceRows(data) {
  if (!data || data.length <= 1) return [];

  const attendance = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[2]) continue;

    let rawDate = row[0];
    let formattedDate = rawDate;

    if (rawDate instanceof Date) {
      formattedDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
    }

    attendance.push({
      fecha: formattedDate,
      evento: row[1] || '',
      miembro: row[2] || '',
      estado: (row[3] || '').toString().toLowerCase().trim()
    });
  }

  return attendance;
}

function readSheetRows(sheet, columnCount) {
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  return sheet.getRange(1, 1, lastRow, columnCount).getValues();
}

function checkCredentials(user, pass) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Usuarios');

  if (!sheet) {
    return (user === 'admin' && pass === '1234');
  }

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const dbUser = data[i][0] ? data[i][0].toString().trim() : '';
    const dbPass = data[i][1] ? data[i][1].toString().trim() : '';

    if (dbUser === user && dbPass === pass) {
      return true;
    }
  }

  return false;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
