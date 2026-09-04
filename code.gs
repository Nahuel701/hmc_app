function doGet(e) {
  try {
    const action = e.parameter.action;
    
    // 1. Manejo del inicio de sesión
    if (action === 'login') {
      const user = e.parameter.user;
      const pass = e.parameter.pass;
      const isValid = checkCredentials(user, pass);
      
      if (isValid) {
        return createJsonResponse({ status: 'success', message: 'Login exitoso' });
      } else {
        return createJsonResponse({ status: 'error', message: 'Credenciales inválidas' });
      }
    }
    
    // 2. Manejo de obtención de datos (Transacciones + Lista de Miembros + Deudas + Asistencia)
    if (action === 'getdata') {
      const data = {
        transactions: getTransactionsData(),
        members: getMembersData(),
        debts: getDebtsData(),
        attendance: getAttendanceData()
      };
      return createJsonResponse(data);
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
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const tipo = (payload.tipo || '').toString().toLowerCase();

      // Si es un Aporte o un Gasto, va a la hoja Movimientos (estado general del club)
      if (tipo === 'aporte' || tipo === 'gasto') {
        let sheetMov = ss.getSheetByName('Movimientos');
        if (!sheetMov) {
          sheetMov = ss.insertSheet('Movimientos');
          sheetMov.appendRow(['Fecha', 'Persona', 'Tipo', 'Monto', 'Concepto']);
        }
        sheetMov.appendRow([
          payload.fecha || '',
          payload.persona || '',
          payload.tipo || '',
          payload.monto || 0,
          payload.concepto || ''
        ]);
      }

      // Si es un Gasto, Reintegro o Aporte, se registra en la hoja Deudas
      if (tipo === 'gasto' || tipo === 'reintegro' || tipo === 'aporte') {
        let sheetDeudas = ss.getSheetByName('Deudas');
        if (!sheetDeudas) {
          sheetDeudas = ss.insertSheet('Deudas');
          sheetDeudas.appendRow(['Fecha', 'Persona', 'Tipo', 'Monto', 'Concepto']);
        }
        sheetDeudas.appendRow([
          payload.fecha || '',
          payload.persona || '',
          tipo,
          payload.monto || 0,
          payload.concepto || ''
        ]);
      }

      return createJsonResponse({ status: 'success', message: 'Registro guardado correctamente' });
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

    // Emitir Cuota Jueves Santo para Miembros Asistentes
    if (payload.action === 'emit_cuota_jueves') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheetDeudas = ss.getSheetByName('Deudas');
      if (!sheetDeudas) {
        sheetDeudas = ss.insertSheet('Deudas');
        sheetDeudas.appendRow(['Fecha', 'Persona', 'Tipo', 'Monto', 'Concepto']);
      }

      const fecha = (payload.fecha || '').toString().trim();
      const cuota = parseFloat(payload.monto) || 0;
      const concepto = (payload.concepto || 'Cuota Jueves Santo').toString().trim();
      const asistentes = payload.asistentes || [];

      asistentes.forEach(persona => {
        sheetDeudas.appendRow([
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

  const data = sheet.getDataRange().getValues();
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

function getTransactionsData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Movimientos');
  
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const transactions = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[1] && !row[3]) continue;

    let rawDate = row[0];
    let formattedDate = rawDate;

    if (rawDate instanceof Date) {
      formattedDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
    }

    transactions.push({
      fecha: formattedDate,
      persona: row[1] || '',
      tipo: (row[2] || '').toString().toLowerCase(),
      monto: parseFloat(row[3]) || 0,
      concepto: row[4] || ''
    });
  }

  return transactions;
}

function getDebtsData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Deudas');
  
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const debts = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[1] && !row[3]) continue;

    let rawDate = row[0];
    let formattedDate = rawDate;

    if (rawDate instanceof Date) {
      formattedDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
    }

    debts.push({
      fecha: formattedDate,
      persona: row[1] || '',
      tipo: (row[2] || '').toString().toLowerCase(),
      monto: parseFloat(row[3]) || 0,
      concepto: row[4] || ''
    });
  }

  return debts;
}

function getAttendanceData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Asistencia');
  
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

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
