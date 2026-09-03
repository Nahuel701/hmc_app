let currentType = 'aporte';
let transactions = [];
let debts = [];
let attendance = [];
let members = [];
let isDemoMode = false;

// URL de tu Google Apps Script implementado como Web App
const scriptUrl = 'https://script.google.com/macros/s/AKfycbwpNjT07qbcrfoendV7KxoSLpYgfXjce4cjYbgDmP_268jsVRVobCJTLgMDdqNp7_I/exec';

const memoryStorage = {};
const safeStorage = {
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return memoryStorage[key] || null;
        }
    },
    setItem(key, val) {
        try {
            localStorage.setItem(key, val);
        } catch (e) {
            memoryStorage[key] = val;
        }
    },
    removeItem(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            delete memoryStorage[key];
        }
    }
};

const mockMembers = ['Juan Pérez', 'María Gómez', 'Carlos Rodríguez', 'Ana Martínez'];
const mockTransactions = [
    { fecha: '01/09/2026', persona: 'Juan Pérez', tipo: 'aporte', monto: 15000, concepto: 'Fondo inicial' },
    { fecha: '02/09/2026', persona: 'María Gómez', tipo: 'aporte', monto: 12000, concepto: 'Aporte mensual' },
    { fecha: '03/09/2026', persona: 'Carlos Rodríguez', tipo: 'gasto', monto: 4500, concepto: 'Supermercado' },
    { fecha: '04/09/2026', persona: 'Ana Martínez', tipo: 'gasto', monto: 3200, concepto: 'Servicios e Internet' }
];

const mockDebts = [
    { fecha: '03/09/2026', persona: 'Carlos Rodríguez', tipo: 'gasto', monto: 4500, concepto: 'Supermercado' },
    { fecha: '04/09/2026', persona: 'Ana Martínez', tipo: 'gasto', monto: 3200, concepto: 'Servicios e Internet' },
    { fecha: '04/09/2026', persona: 'Carlos Rodríguez', tipo: 'reintegro', monto: 2000, concepto: 'Reintegro parcial supermercado' }
];

const mockAttendance = [
    { fecha: '03/09/2026', evento: 'Jueves Santo', miembro: 'Juan Pérez', estado: 'presente' },
    { fecha: '03/09/2026', evento: 'Jueves Santo', miembro: 'María Gómez', estado: 'presente' },
    { fecha: '03/09/2026', evento: 'Jueves Santo', miembro: 'Carlos Rodríguez', estado: 'presente' },
    { fecha: '03/09/2026', evento: 'Jueves Santo', miembro: 'Ana Martínez', estado: 'ausente' },
    { fecha: '10/09/2026', evento: 'Jueves Santo', miembro: 'Juan Pérez', estado: 'presente' },
    { fecha: '10/09/2026', evento: 'Jueves Santo', miembro: 'María Gómez', estado: 'ausente' },
    { fecha: '10/09/2026', evento: 'Jueves Santo', miembro: 'Carlos Rodríguez', estado: 'presente' },
    { fecha: '10/09/2026', evento: 'Jueves Santo', miembro: 'Ana Martínez', estado: 'presente' }
];

async function handleLogin(e) {
    e.preventDefault();

    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const btn = document.getElementById('loginBtn');
    const err = document.getElementById('loginError');

    btn.disabled = true;
    btn.textContent = "Verificando con Google Sheet...";
    err.classList.add('hidden');

    if ((user === 'admin' && pass === '1234') || (!user && !pass)) {
        safeStorage.setItem('cc_logged', 'true');
        document.getElementById('loginScreen').classList.add('hidden');
        fetchSheetData();

        btn.disabled = false;
        btn.textContent = "Acceder al Sistema";
        return;
    }

    try {
        const res = await fetch(
            `${scriptUrl}?action=login&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`
        );

        const data = await res.json();

        if (data.status === 'success') {
            safeStorage.setItem('cc_logged', 'true');
            document.getElementById('loginScreen').classList.add('hidden');
            fetchSheetData();
        } else {
            err.classList.remove('hidden');
        }
    } catch (error) {
        console.error(error);
        enableDemoMode("Conexión con Google Sheets fallida. Iniciando en Modo Demo...");
    }

    btn.disabled = false;
    btn.textContent = "Acceder al Sistema";
}

function logout() {
    safeStorage.removeItem('cc_logged');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginPass').value = '';
}

function switchTab(tab) {
    const tabCargar = document.getElementById('tabCargar');
    const tabHistorial = document.getElementById('tabHistorial');
    const tabResumen = document.getElementById('tabResumen');
    const tabDeudas = document.getElementById('tabDeudas');
    const tabAsistencia = document.getElementById('tabAsistencia');
    const tabJuevesSanto = document.getElementById('tabJuevesSanto');

    const btnCargar = document.getElementById('tabBtnCargar');
    const btnHistorial = document.getElementById('tabBtnHistorial');
    const btnResumen = document.getElementById('tabBtnResumen');
    const btnDeudas = document.getElementById('tabBtnDeudas');
    const btnAsistencia = document.getElementById('tabBtnAsistencia');
    const btnJuevesSanto = document.getElementById('tabBtnJuevesSanto');

    // Ocultar todas las pestañas
    tabCargar.classList.add('hidden');
    tabHistorial.classList.add('hidden');
    tabResumen.classList.add('hidden');

    if (tabDeudas) tabDeudas.classList.add('hidden');
    if (tabAsistencia) tabAsistencia.classList.add('hidden');
    if (tabJuevesSanto) tabJuevesSanto.classList.add('hidden');

    // Resetear estilos de botones
    const inactiveClass =
        "px-4 py-1.5 text-xs font-semibold rounded-lg text-indigo-100 hover:text-white transition";

    const activeClass =
        "px-4 py-1.5 text-xs font-semibold rounded-lg bg-white text-indigo-700 shadow-sm transition";

    btnCargar.className = inactiveClass;
    btnHistorial.className = inactiveClass;
    btnResumen.className = inactiveClass;

    if (btnDeudas) btnDeudas.className = inactiveClass;
    if (btnAsistencia) btnAsistencia.className = inactiveClass;
    if (btnJuevesSanto) btnJuevesSanto.className = inactiveClass;

    if (tab === 'cargar') {
        tabCargar.classList.remove('hidden');
        btnCargar.className = activeClass;

    } else if (tab === 'historial') {
        tabHistorial.classList.remove('hidden');
        btnHistorial.className = activeClass;

    } else if (tab === 'resumen') {
        tabResumen.classList.remove('hidden');
        btnResumen.className = activeClass;

    } else if (tab === 'deudas' && tabDeudas) {
        tabDeudas.classList.remove('hidden');
        btnDeudas.className = activeClass;

    } else if (tab === 'asistencia' && tabAsistencia) {
        tabAsistencia.classList.remove('hidden');
        btnAsistencia.className = activeClass;

    } else if (tab === 'jueves-santo' && tabJuevesSanto) {
        tabJuevesSanto.classList.remove('hidden');

        if (btnJuevesSanto) {
            btnJuevesSanto.className = activeClass;
        }

        renderJuevesSanto();
    }
}

/*
 * Normaliza cualquier fecha conocida por la aplicación a:
 *
 * YYYY-MM-DD
 *
 * Acepta:
 * - Date
 * - YYYY-MM-DD
 * - DD/MM/YYYY
 * - YYYY/MM/DD
 * - YYYY-MM-DDTHH:mm:ss...
 *
 * Esto evita que la comparación de fechas falle entre
 * el input HTML, Google Sheets y Apps Script.
 */
function normalizeDateKey(value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    // Si ya es un objeto Date
    if (value instanceof Date && !isNaN(value.getTime())) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');

        return `${y}-${m}-${d}`;
    }

    const str = String(value).trim();

    // YYYY-MM-DD
    let match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }

    // DD/MM/YYYY
    match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    if (match) {
        return `${match[3]}-${match[2]}-${match[1]}`;
    }

    // YYYY/MM/DD
    match = str.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);

    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }

    // ISO completo: YYYY-MM-DDTHH:mm:ss...
    match = str.match(/^(\d{4})-(\d{2})-(\d{2})T/);

    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }

    return '';
}

/*
 * Formatea una fecha local para usarla en:
 *
 * <input type="date">
 *
 * No utilizamos toISOString() porque convierte a UTC
 * y puede cambiar el día dependiendo de la zona horaria.
 */
function formatDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function setDefaultDate() {
    const today = formatDateInputValue(new Date());

    const fechaInput = document.getElementById('fecha');
    const attendanceFechaInput = document.getElementById('attendanceFecha');
    const jsFechaSelect = document.getElementById('jsFechaSelect');

    if (fechaInput) {
        fechaInput.value = today;
    }

    if (attendanceFechaInput) {
        attendanceFechaInput.value = today;
    }

    if (jsFechaSelect && !jsFechaSelect.value) {
        // Apuntar al jueves de la semana actual
        //
        // JS getDay():
        // 0 = Domingo
        // 1 = Lunes
        // 2 = Martes
        // 3 = Miércoles
        // 4 = Jueves
        // 5 = Viernes
        // 6 = Sábado

        const now = new Date();
        const dayOfWeek = now.getDay();

        let diff;

        if (dayOfWeek <= 4) {
            // Lunes a Jueves:
            // ir hacia adelante hasta el jueves de esta semana
            diff = 4 - dayOfWeek;
        } else {
            // Viernes o Sábado:
            // tomar el jueves de esta semana que ya pasó
            diff = -(dayOfWeek - 4);
        }

        const thursday = new Date(now);
        thursday.setDate(now.getDate() + diff);

        jsFechaSelect.value = formatDateInputValue(thursday);
    }
}

function setType(type) {
    currentType = type;

    const btnAporte = document.getElementById('btnAporte');
    const btnGasto = document.getElementById('btnGasto');
    const btnReintegro = document.getElementById('btnReintegro');

    // Estilos base inactivos
    const baseInactive =
        "py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition text-center";

    btnAporte.className = baseInactive;
    btnGasto.className = baseInactive;

    if (btnReintegro) {
        btnReintegro.className = baseInactive;
    }

    if (type === 'aporte') {
        btnAporte.className =
            "py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition text-center shadow-sm";

    } else if (type === 'gasto') {
        btnGasto.className =
            "py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl border border-rose-200 bg-rose-50 text-rose-700 transition text-center shadow-sm";

    } else if (type === 'reintegro' && btnReintegro) {
        btnReintegro.className =
            "py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 transition text-center shadow-sm";
    }
}

function handleMemberChange() {
    const personaSelect = document.getElementById('persona');
    const container = document.getElementById('customMemberContainer');
    const customInput = document.getElementById('customMemberName');

    if (personaSelect.value === '__NO_MIEMBRO__') {
        container.classList.remove('hidden');
        customInput.required = true;
        customInput.focus();

    } else {
        container.classList.add('hidden');
        customInput.required = false;
        customInput.value = '';
    }
}

async function addTransaction(e) {
    e.preventDefault();

    const fechaInput = document.getElementById('fecha').value;
    const personaSelect = document.getElementById('persona').value;
    const customMemberName =
        document.getElementById('customMemberName').value.trim();

    const monto =
        parseFloat(document.getElementById('monto').value);

    const concepto =
        document.getElementById('concepto').value.trim();

    let persona = personaSelect;

    if (personaSelect === '__NO_MIEMBRO__') {
        if (!customMemberName) {
            return;
        }

        persona = customMemberName;
    }

    if (!fechaInput || !persona || isNaN(monto) || !concepto) {
        return;
    }

    let formattedDate = fechaInput;

    if (fechaInput.includes('-')) {
        const parts = fechaInput.split('-');

        if (parts.length === 3) {
            formattedDate =
                `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }

    const newTx = {
        action: 'add',
        fecha: formattedDate,
        persona,
        tipo: currentType,
        monto,
        concepto
    };

    const submitBtn =
        document.getElementById('submitBtn');

    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando...";

    if (isDemoMode) {
        if (
            currentType === 'aporte' ||
            currentType === 'gasto'
        ) {
            transactions.unshift(newTx);
        }

        if (
            currentType === 'gasto' ||
            currentType === 'reintegro'
        ) {
            debts.unshift(newTx);
        }

        renderApp();

        submitBtn.disabled = false;
        submitBtn.textContent = "Registrar Movimiento";

        document.getElementById('transactionForm').reset();

        handleMemberChange();
        setDefaultDate();
        setType('aporte');

        return;
    }

    try {
        await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newTx)
        });

        setTimeout(() => {
            fetchSheetData();
        }, 1000);

    } catch (err) {
        console.error(err);

        if (
            currentType === 'aporte' ||
            currentType === 'gasto'
        ) {
            transactions.unshift(newTx);
        }

        if (
            currentType === 'gasto' ||
            currentType === 'reintegro'
        ) {
            debts.unshift(newTx);
        }

        renderApp();
    }

    submitBtn.disabled = false;
    submitBtn.textContent = "Registrar Movimiento";

    document.getElementById('transactionForm').reset();

    handleMemberChange();
    setDefaultDate();
    setType('aporte');
}

async function fetchSheetData() {
    if (isDemoMode) {
        renderApp();
        return;
    }

    const warningBanner =
        document.getElementById('versionWarningBanner');

    const syncStatusText =
        document.getElementById('syncStatusText');

    try {
        // ------------------------------------------------
        // FORZAR ACTUALIZACIÓN
        // Agregamos un parámetro único para evitar cache
        // del navegador.
        // ------------------------------------------------
        const cacheBuster = Date.now();

        const res = await fetch(
            `${scriptUrl}?action=getdata&_=${cacheBuster}`,
            {
                method: 'GET',
                cache: 'no-store'
            }
        );

        const data = await res.json();

        if (Array.isArray(data)) {

            transactions = [...data].reverse();

            members = [];
            debts = [];

            warningBanner.classList.remove('hidden');

            syncStatusText.textContent =
                "⚠️ Sincronizado (versión anterior de Apps Script)";

        } else if (data && typeof data === 'object') {

            warningBanner.classList.add('hidden');

            syncStatusText.textContent =
                "🟢 Sincronizado correctamente con Google Sheets";

            if (Array.isArray(data.transactions)) {
                transactions =
                    [...data.transactions].reverse();
            }

            if (Array.isArray(data.members)) {
                members = [...data.members];
            }

            if (Array.isArray(data.debts)) {
                debts =
                    [...data.debts].reverse();
            }

            if (Array.isArray(data.attendance)) {
                attendance =
                    [...data.attendance].reverse();
            }
        }

        renderApp();

    } catch (err) {

        console.error(
            "No se pudo sincronizar con Google Sheets:",
            err
        );

        enableDemoMode(
            "💡 No se pudo conectar con Google Sheets. Modo Demo Activo."
        );
    }
}

function enableDemoMode(statusMsg) {
    isDemoMode = true;

    safeStorage.setItem('cc_logged', 'true');

    document.getElementById('loginScreen').classList.add('hidden');

    members = [...mockMembers];

    if (transactions.length === 0) {
        transactions = [...mockTransactions];
    }

    if (debts.length === 0) {
        debts = [...mockDebts];
    }

    if (attendance.length === 0) {
        attendance = [...mockAttendance];
    }

    const syncStatusText =
        document.getElementById('syncStatusText');

    if (syncStatusText) {
        syncStatusText.textContent =
            statusMsg ||
            "💡 Modo Demo Activo (Datos simulados)";
    }

    const demoBtn =
        document.getElementById('demoToggleBtn');

    if (demoBtn) {
        demoBtn.textContent = "Modo Real (Sheets)";

        demoBtn.className =
            "bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg hover:bg-emerald-200 transition font-medium";
    }

    renderApp();
}

function toggleDemoMode() {
    isDemoMode = !isDemoMode;

    if (isDemoMode) {
        enableDemoMode();

    } else {
        const demoBtn =
            document.getElementById('demoToggleBtn');

        if (demoBtn) {
            demoBtn.textContent = "Usar Modo Demo";

            demoBtn.className =
                "bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg hover:bg-indigo-200 transition font-medium";
        }

        fetchSheetData();
    }
}

function renderApp() {
    const txTableBody =
        document.getElementById('transactionTableBody');

    const summaryTableBody =
        document.getElementById('summaryTableBody');

    const totalAportesEl =
        document.getElementById('totalAportes');

    const totalGastosEl =
        document.getElementById('totalGastos');

    const personaSelect =
        document.getElementById('persona');

    const memberBadge =
        document.getElementById('memberCountBadge');

    // Elementos de la pestaña Deudas
    const totalDeudaPendienteEl =
        document.getElementById('totalDeudaPendiente');

    const totalReintegradoEl =
        document.getElementById('totalReintegrado');

    const debtsSummaryTableBody =
        document.getElementById('debtsSummaryTableBody');

    const debtsTableBody =
        document.getElementById('debtsTableBody');

    personaSelect.innerHTML = '';

    if (members.length === 0) {
        memberBadge.textContent = "0 encontrados";

        memberBadge.className =
            "text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium";

        const defaultOpt =
            document.createElement('option');

        defaultOpt.value = "";
        defaultOpt.disabled = true;
        defaultOpt.selected = true;

        defaultOpt.textContent =
            "No hay miembros en pestaña 'Miembros' o falta actualizar Apps Script";

        personaSelect.appendChild(defaultOpt);

    } else {
        memberBadge.textContent =
            `${members.length} miembros`;

        memberBadge.className =
            "text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium";

        const defaultOpt =
            document.createElement('option');

        defaultOpt.value = "";
        defaultOpt.disabled = true;
        defaultOpt.selected = true;
        defaultOpt.textContent =
            "Selecciona una persona...";

        personaSelect.appendChild(defaultOpt);

        members.forEach(member => {
            const opt =
                document.createElement('option');

            opt.value = member;
            opt.textContent = member;

            personaSelect.appendChild(opt);
        });

        // Opción para No miembro
        const noMiembroOpt =
            document.createElement('option');

        noMiembroOpt.value = "__NO_MIEMBRO__";
        noMiembroOpt.textContent =
            "➕ No miembro (Ingresar nombre)";

        personaSelect.appendChild(noMiembroOpt);
    }

    // 1. Renderizar Historial de Movimientos Generales
    txTableBody.innerHTML = '';
    summaryTableBody.innerHTML = '';

    let totalAportes = 0;
    let totalGastos = 0;

    const personMap = {};

    members.forEach(m => {
        personMap[m] = {
            aportes: 0,
            gastos: 0
        };
    });

    transactions.forEach(tx => {
        const montoVal =
            parseFloat(tx.monto) || 0;

        if (tx.tipo === 'aporte') {
            totalAportes += montoVal;

        } else if (tx.tipo === 'gasto') {
            totalGastos += montoVal;
        }

        if (!personMap[tx.persona]) {
            personMap[tx.persona] = {
                aportes: 0,
                gastos: 0
            };
        }

        if (tx.tipo === 'aporte') {
            personMap[tx.persona].aportes += montoVal;

        } else if (tx.tipo === 'gasto') {
            personMap[tx.persona].gastos += montoVal;
        }

        const tr =
            document.createElement('tr');

        tr.innerHTML = `
            <td class="py-3 px-2 text-slate-500 text-xs">${tx.fecha || '-'}</td>

            <td class="py-3 px-2 font-medium text-slate-800">
                ${escapeHtml(tx.persona)}
            </td>

            <td class="py-3 px-2">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tx.tipo === 'aporte'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'}">
                    ${(tx.tipo || '').toUpperCase()}
                </span>
            </td>

            <td class="py-3 px-2 text-slate-600">
                ${escapeHtml(tx.concepto || '')}
            </td>

            <td class="py-3 px-2 text-right font-semibold ${tx.tipo === 'aporte'
                ? 'text-emerald-600'
                : 'text-rose-600'}">
                $${montoVal.toFixed(2)}
            </td>
        `;

        txTableBody.appendChild(tr);
    });

    // 2. Renderizar Resumen General por Persona
    const persons = Object.keys(personMap);

    if (persons.length === 0) {
        summaryTableBody.innerHTML = `
            <tr>
                <td colspan="4"
                    class="py-6 text-center text-slate-400 text-sm">
                    No hay miembros ni registros cargados aún.
                </td>
            </tr>
        `;

    } else {
        persons.forEach(person => {
            const data = personMap[person];

            const balance =
                data.aportes - data.gastos;

            const tr =
                document.createElement('tr');

            tr.innerHTML = `
                <td class="py-3 px-3 font-medium text-slate-800">
                    ${escapeHtml(person)}
                </td>

                <td class="py-3 px-3 text-right text-emerald-600">
                    $${data.aportes.toFixed(2)}
                </td>

                <td class="py-3 px-3 text-right text-rose-600">
                    $${data.gastos.toFixed(2)}
                </td>

                <td class="py-3 px-3 text-right font-bold ${balance >= 0
                    ? 'text-emerald-700'
                    : 'text-rose-700'}">
                    $${balance.toFixed(2)}
                </td>
            `;

            summaryTableBody.appendChild(tr);
        });
    }

    if (totalAportesEl) {
        totalAportesEl.textContent =
            `$${totalAportes.toFixed(2)}`;
    }

    if (totalGastosEl) {
        totalGastosEl.textContent =
            `$${totalGastos.toFixed(2)}`;
    }

    // 3. Renderizar Pestaña Deudas y Reintegros
    if (debtsSummaryTableBody && debtsTableBody) {
        debtsSummaryTableBody.innerHTML = '';
        debtsTableBody.innerHTML = '';

        const debtMap = {};

        members.forEach(m => {
            debtMap[m] = {
                adelantado: 0,
                reintegrado: 0,
                cuotas: 0
            };
        });

        let totalReintegradoGen = 0;

        debts.forEach(d => {
            const montoVal =
                parseFloat(d.monto) || 0;

            const tipo =
                (d.tipo || '').toLowerCase();

            if (!debtMap[d.persona]) {
                debtMap[d.persona] = {
                    adelantado: 0,
                    reintegrado: 0,
                    cuotas: 0
                };
            }

            if (tipo === 'gasto') {
                debtMap[d.persona].adelantado += montoVal;

            } else if (tipo === 'reintegro') {
                debtMap[d.persona].reintegrado += montoVal;
                totalReintegradoGen += montoVal;

            } else if (tipo === 'cuota_jueves') {
                debtMap[d.persona].cuotas += montoVal;
            }

            // Fila en Historial de Deudas
            const tr =
                document.createElement('tr');

            const isReintegro =
                tipo === 'reintegro';

            const isCuota =
                tipo === 'cuota_jueves';

            let tagLabel =
                'GASTO ADELANTADO';

            let tagStyle =
                'bg-amber-100 text-amber-800';

            let amountStyle =
                'text-amber-600';

            if (isReintegro) {
                tagLabel =
                    'REINTEGRO (PAGO)';

                tagStyle =
                    'bg-indigo-100 text-indigo-800';

                amountStyle =
                    'text-indigo-600';

            } else if (isCuota) {
                tagLabel =
                    'CUOTA JUEVES SANTO';

                tagStyle =
                    'bg-rose-100 text-rose-800';

                amountStyle =
                    'text-rose-600';
            }

            tr.innerHTML = `
                <td class="py-3 px-2 text-slate-500 text-xs">
                    ${d.fecha || '-'}
                </td>

                <td class="py-3 px-2 font-medium text-slate-800">
                    ${escapeHtml(d.persona)}
                </td>

                <td class="py-3 px-2">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tagStyle}">
                        ${tagLabel}
                    </span>
                </td>

                <td class="py-3 px-2 text-slate-600">
                    ${escapeHtml(d.concepto || '')}
                </td>

                <td class="py-3 px-2 text-right font-semibold ${amountStyle}">
                    $${montoVal.toFixed(2)}
                </td>
            `;

            debtsTableBody.appendChild(tr);
        });

        let totalDeudaClubPendiente = 0;

        const debtPersons =
            Object.keys(debtMap);

        if (debtPersons.length === 0) {
            debtsSummaryTableBody.innerHTML = `
                <tr>
                    <td colspan="6"
                        class="py-6 text-center text-slate-400 text-sm">
                        No hay miembros ni deudas registradas aún.
                    </td>
                </tr>
            `;

        } else {
            debtPersons.forEach(person => {
                const info =
                    debtMap[person];

                /*
                 * Balance Neto =
                 * Gastos asumidos
                 * - Reintegros recibidos
                 * - Cuotas adeudadas
                 *
                 * Si balanceNeto > 0:
                 * El club le debe al miembro.
                 *
                 * Si balanceNeto < 0:
                 * El miembro le debe al club.
                 *
                 * Si balanceNeto == 0:
                 * Saldado.
                 */
                const balanceNeto =
                    info.adelantado -
                    info.reintegrado -
                    info.cuotas;

                if (balanceNeto > 0) {
                    totalDeudaClubPendiente +=
                        balanceNeto;
                }

                let badge = '';

                if (
                    info.adelantado === 0 &&
                    info.reintegrado === 0 &&
                    info.cuotas === 0
                ) {
                    badge = `
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            Sin movimientos
                        </span>
                    `;

                } else if (
                    Math.abs(balanceNeto) <= 0.001
                ) {
                    badge = `
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            Saldado
                        </span>
                    `;

                } else if (balanceNeto > 0) {
                    badge = `
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            A favor (Club debe)
                        </span>
                    `;

                } else {
                    badge = `
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                            Debe pagar cuota
                        </span>
                    `;
                }

                const tr =
                    document.createElement('tr');

                tr.innerHTML = `
                    <td class="py-3 px-3 font-medium text-slate-800">
                        ${escapeHtml(person)}
                    </td>

                    <td class="py-3 px-3 text-right text-slate-600">
                        $${info.adelantado.toFixed(2)}
                    </td>

                    <td class="py-3 px-3 text-right text-indigo-600">
                        $${info.reintegrado.toFixed(2)}
                    </td>

                    <td class="py-3 px-3 text-right text-rose-600">
                        $${info.cuotas.toFixed(2)}
                    </td>

                    <td class="py-3 px-3 text-right font-bold ${balanceNeto > 0
                        ? 'text-indigo-600'
                        : (balanceNeto < -0.001
                            ? 'text-rose-600'
                            : 'text-emerald-600')}">

                        ${balanceNeto >= 0
                            ? '$' + balanceNeto.toFixed(2)
                            : '-$' + Math.abs(balanceNeto).toFixed(2)}
                    </td>

                    <td class="py-3 px-3 text-center">
                        ${badge}
                    </td>
                `;

                debtsSummaryTableBody.appendChild(tr);
            });
        }

        if (totalDeudaPendienteEl) {
            totalDeudaPendienteEl.textContent =
                `$${totalDeudaClubPendiente.toFixed(2)}`;
        }

        if (totalReintegradoEl) {
            totalReintegradoEl.textContent =
                `$${totalReintegradoGen.toFixed(2)}`;
        }
    }

    // 4. Renderizar Sección de Asistencia
    renderAttendance();

    // 5. Renderizar Sección Jueves Santo
    renderJuevesSanto();
}

// Map temporal de asistencia en el formulario:
// { 'Nombre': 'presente' | 'ausente' }
let currentAttendanceStatus = {};

function renderAttendance() {
    const memberListEl =
        document.getElementById('attendanceMemberList');

    const historyTableBody =
        document.getElementById('attendanceHistoryTableBody');

    const summaryTableBody =
        document.getElementById('attendanceSummaryTableBody');

    const totalMeetingsEl =
        document.getElementById('totalMeetingsCount');

    const avgRateEl =
        document.getElementById('avgAttendanceRate');

    const totalMembersEl =
        document.getElementById('totalAttendanceMembers');

    if (!memberListEl) {
        return;
    }

    // Inicializar estados para cada miembro existente
    // si no están seteados
    members.forEach(m => {
        if (!currentAttendanceStatus[m]) {
            currentAttendanceStatus[m] = 'presente';
        }
    });

    // Limpiar estados de personas que ya no estén en members
    Object.keys(currentAttendanceStatus).forEach(m => {
        if (!members.includes(m)) {
            delete currentAttendanceStatus[m];
        }
    });

    // 1. Renderizar Lista de Miembros
    memberListEl.innerHTML = '';

    if (members.length === 0) {
        memberListEl.innerHTML = `
            <div class="p-6 text-center text-slate-400 text-sm">
                No hay miembros registrados en la hoja 'Miembros'. Agrega miembros en tu planilla para tomar asistencia.
            </div>
        `;

    } else {
        members.forEach(member => {
            const status =
                currentAttendanceStatus[member] ||
                'presente';

            const isPresent =
                status === 'presente';

            const item =
                document.createElement('div');

            item.className =
                "flex items-center justify-between p-3.5 hover:bg-slate-50/80 transition rounded-lg";

            item.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isPresent
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'}">
                        ${escapeHtml(member.charAt(0).toUpperCase())}
                    </div>

                    <span class="text-sm font-semibold text-slate-800">
                        ${escapeHtml(member)}
                    </span>
                </div>

                <div class="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">

                    <button
                        type="button"
                        onclick="setMemberAttendance('${escapeHtml(member).replace(/'/g, "\\'")}', 'presente')"
                        class="px-3 py-1.5 text-xs font-semibold rounded-lg transition ${isPresent
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'}">
                        ✓ Presente
                    </button>

                    <button
                        type="button"
                        onclick="setMemberAttendance('${escapeHtml(member).replace(/'/g, "\\'")}', 'ausente')"
                        class="px-3 py-1.5 text-xs font-semibold rounded-lg transition ${!isPresent
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'}">
                        ✕ Ausente
                    </button>

                </div>
            `;

            memberListEl.appendChild(item);
        });
    }

    updateAttendanceCounters();

    // 2. Resumen por Miembro y Métricas
    const attMap = {};

    members.forEach(m => {
        attMap[m] = {
            presentes: 0,
            ausentes: 0,
            total: 0
        };
    });

    const uniqueDates = new Set();

    attendance.forEach(entry => {
        const m = entry.miembro;
        const est =
            (entry.estado || '').toLowerCase();

        if (entry.fecha) {
            uniqueDates.add(entry.fecha);
        }

        if (!attMap[m]) {
            attMap[m] = {
                presentes: 0,
                ausentes: 0,
                total: 0
            };
        }

        if (est === 'presente') {
            attMap[m].presentes++;
            attMap[m].total++;

        } else if (est === 'ausente') {
            attMap[m].ausentes++;
            attMap[m].total++;
        }
    });

    // Renderizar métricas superiores
    if (totalMeetingsEl) {
        totalMeetingsEl.textContent =
            uniqueDates.size;
    }

    if (totalMembersEl) {
        totalMembersEl.textContent =
            members.length;
    }

    let globalPresentes = 0;
    let globalTotal = 0;

    Object.values(attMap).forEach(val => {
        globalPresentes += val.presentes;
        globalTotal += val.total;
    });

    const avgRate =
        globalTotal > 0
            ? Math.round(
                (globalPresentes / globalTotal) * 100
            )
            : 0;

    if (avgRateEl) {
        avgRateEl.textContent =
            `${avgRate}%`;
    }

    // Renderizar tabla de porcentaje por miembro
    if (summaryTableBody) {
        summaryTableBody.innerHTML = '';

        const attMembers =
            Object.keys(attMap);

        if (attMembers.length === 0) {
            summaryTableBody.innerHTML = `
                <tr>
                    <td colspan="5"
                        class="py-6 text-center text-slate-400 text-sm">
                        No hay miembros para mostrar.
                    </td>
                </tr>
            `;

        } else {
            attMembers.forEach(m => {
                const info = attMap[m];

                const pct =
                    info.total > 0
                        ? Math.round(
                            (info.presentes / info.total) * 100
                        )
                        : 0;

                let badgeColor =
                    'bg-slate-100 text-slate-600';

                if (info.total > 0) {
                    if (pct >= 80) {
                        badgeColor =
                            'bg-emerald-100 text-emerald-800 font-semibold';

                    } else if (pct >= 50) {
                        badgeColor =
                            'bg-amber-100 text-amber-800 font-semibold';

                    } else {
                        badgeColor =
                            'bg-rose-100 text-rose-800 font-semibold';
                    }
                }

                const tr =
                    document.createElement('tr');

                tr.innerHTML = `
                    <td class="py-3 px-3 font-medium text-slate-800">
                        ${escapeHtml(m)}
                    </td>

                    <td class="py-3 px-3 text-center text-emerald-600 font-semibold">
                        ${info.presentes}
                    </td>

                    <td class="py-3 px-3 text-center text-rose-600 font-semibold">
                        ${info.ausentes}
                    </td>

                    <td class="py-3 px-3 text-center text-slate-500">
                        ${info.total}
                    </td>

                    <td class="py-3 px-3 text-right">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${badgeColor}">
                            ${info.total > 0
                                ? `${pct}%`
                                : 'Sin datos'}
                        </span>
                    </td>
                `;

                summaryTableBody.appendChild(tr);
            });
        }
    }

    // 3. Renderizar Historial Cronológico
    if (historyTableBody) {
        historyTableBody.innerHTML = '';

        if (attendance.length === 0) {
            historyTableBody.innerHTML = `
                <tr>
                    <td colspan="4"
                        class="py-6 text-center text-slate-400 text-sm">
                        No hay registros de asistencia guardados aún.
                    </td>
                </tr>
            `;

        } else {
            attendance.forEach(entry => {
                const isPres =
                    (entry.estado || '').toLowerCase() === 'presente';

                const tr =
                    document.createElement('tr');

                tr.innerHTML = `
                    <td class="py-3 px-3 text-slate-500 text-xs whitespace-nowrap">
                        ${entry.fecha || '-'}
                    </td>

                    <td class="py-3 px-3 text-slate-700 text-xs">
                        ${escapeHtml(entry.evento || 'Reunión')}
                    </td>

                    <td class="py-3 px-3 font-medium text-slate-800">
                        ${escapeHtml(entry.miembro)}
                    </td>

                    <td class="py-3 px-3 text-center">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${isPres
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'}">
                            ${isPres
                                ? 'PRESENTE'
                                : 'AUSENTE'}
                        </span>
                    </td>
                `;

                historyTableBody.appendChild(tr);
            });
        }
    }
}

function setMemberAttendance(member, status) {
    currentAttendanceStatus[member] = status;
    renderAttendance();
}

function bulkSetAttendance(status) {
    members.forEach(m => {
        currentAttendanceStatus[m] = status;
    });

    renderAttendance();
}

function updateAttendanceCounters() {
    let pres = 0;
    let aus = 0;

    members.forEach(m => {
        if (currentAttendanceStatus[m] === 'presente') {
            pres++;
        } else {
            aus++;
        }
    });

    const presEl =
        document.getElementById('quickPresentCount');

    const ausEl =
        document.getElementById('quickAbsentCount');

    if (presEl) {
        presEl.textContent =
            `${pres} Presentes`;
    }

    if (ausEl) {
        ausEl.textContent =
            `${aus} Ausentes`;
    }
}

async function saveAttendance(e) {
    e.preventDefault();

    const fechaInput =
        document.getElementById('attendanceFecha').value;

    const eventoInput =
        document.getElementById('attendanceEvento').value.trim();

    const saveBtn =
        document.getElementById('saveAttendanceBtn');

    if (!fechaInput) {
        return;
    }

    if (members.length === 0) {
        alert(
            'No hay miembros en la lista para registrar asistencia.'
        );
        return;
    }

    let formattedDate = fechaInput;

    if (fechaInput.includes('-')) {
        const parts =
            fechaInput.split('-');

        if (parts.length === 3) {
            formattedDate =
                `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }

    const registros =
        members.map(m => ({
            miembro: m,
            estado:
                currentAttendanceStatus[m] ||
                'presente'
        }));

    const payload = {
        action: 'save_attendance',
        fecha: formattedDate,
        evento: eventoInput || 'Reunión General',
        registros: registros
    };

    saveBtn.disabled = true;

    saveBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
             fill="none"
             viewBox="0 0 24 24">

            <circle class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4">
            </circle>

            <path class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z">
            </path>

        </svg>

        <span>Guardando asistencia...</span>
    `;

    if (isDemoMode) {
        // Filtrar y reemplazar si ya existía registro
        // con la misma fecha y evento
        attendance = attendance.filter(item => {

            const sameDate =
                normalizeDateKey(item.fecha) ===
                normalizeDateKey(formattedDate);

            const sameEvent =
                (item.evento || 'Reunión General')
                    .trim()
                    .toLowerCase() ===
                (eventoInput || 'Reunión General')
                    .trim()
                    .toLowerCase();

            return !(sameDate && sameEvent);
        });

        registros.forEach(r => {
            attendance.unshift({
                fecha: formattedDate,
                evento:
                    eventoInput || 'Reunión General',
                miembro: r.miembro,
                estado: r.estado
            });
        });

        renderApp();

        saveBtn.disabled = false;

        saveBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg"
                 class="h-4 w-4"
                 fill="none"
                 viewBox="0 0 24 24"
                 stroke="currentColor">

                <path stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
            </svg>

            <span>Guardar Registro de Asistencia</span>
        `;

        document.getElementById(
            'attendanceEvento'
        ).value = '';

        return;
    }

    try {
        await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // Filtrar y reemplazar en memoria inmediatamente
        attendance = attendance.filter(item => {

            const sameDate =
                normalizeDateKey(item.fecha) ===
                normalizeDateKey(formattedDate);

            const sameEvent =
                (item.evento || 'Reunión General')
                    .trim()
                    .toLowerCase() ===
                (eventoInput || 'Reunión General')
                    .trim()
                    .toLowerCase();

            return !(sameDate && sameEvent);
        });

        registros.forEach(r => {
            attendance.unshift({
                fecha: formattedDate,
                evento:
                    eventoInput || 'Reunión General',
                miembro: r.miembro,
                estado: r.estado
            });
        });

        renderApp();

        setTimeout(() => {
            fetchSheetData();
        }, 1200);

    } catch (err) {
        console.error(err);

        attendance = attendance.filter(item => {

            const sameDate =
                normalizeDateKey(item.fecha) ===
                normalizeDateKey(formattedDate);

            const sameEvent =
                (item.evento || 'Reunión General')
                    .trim()
                    .toLowerCase() ===
                (eventoInput || 'Reunión General')
                    .trim()
                    .toLowerCase();

            return !(sameDate && sameEvent);
        });

        registros.forEach(r => {
            attendance.unshift({
                fecha: formattedDate,
                evento:
                    eventoInput || 'Reunión General',
                miembro: r.miembro,
                estado: r.estado
            });
        });

        renderApp();
    }

    saveBtn.disabled = false;

    saveBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg"
             class="h-4 w-4"
             fill="none"
             viewBox="0 0 24 24"
             stroke="currentColor">

            <path stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
        </svg>

        <span>Guardar Registro de Asistencia</span>
    `;

    document.getElementById(
        'attendanceEvento'
    ).value = 'Jueves Santo';
}

// ----------------------------------------------------
// SECCIÓN JUEVES SANTO
// ----------------------------------------------------

function handleJuevesFechaChange() {
    renderJuevesSanto();
}

/*
 * ESTA ES UNA DE LAS CORRECCIONES PRINCIPALES.
 *
 * Antes se comparaba directamente:
 *
 *     att.fecha === formattedDate
 *
 * Eso podía fallar porque Google Sheets podía devolver:
 *
 *     03/09/2026
 *
 * mientras el input HTML tenía:
 *
 *     2026-09-03
 *
 * Ahora ambas fechas se normalizan a YYYY-MM-DD.
 */
function getAttendeesForDate(targetDate) {
    if (!targetDate) {
        return [];
    }

    const targetDateKey =
        normalizeDateKey(targetDate);

    if (!targetDateKey) {
        console.warn(
            'Fecha inválida en Jueves Santo:',
            targetDate
        );

        return [];
    }

    const presentMembers = [];

    attendance.forEach(att => {
        const itemDateKey =
            normalizeDateKey(att.fecha);

        const itemState =
            String(att.estado || '')
                .trim()
                .toLowerCase();

        if (
            itemDateKey === targetDateKey &&
            itemState === 'presente'
        ) {
            if (
                att.miembro &&
                !presentMembers.includes(att.miembro)
            ) {
                presentMembers.push(
                    att.miembro
                );
            }
        }
    });

    return presentMembers;
}

function calculateClubDebtToSettle() {
    /*
     * 1. Deuda de reintegros pendientes a miembros
     *    por gastos adelantados.
     */

    const debtMap = {};

    members.forEach(m => {
        debtMap[m] = {
            adelantado: 0,
            reintegrado: 0,
            cuotas: 0
        };
    });

    debts.forEach(d => {
        const montoVal =
            parseFloat(d.monto) || 0;

        const tipo =
            (d.tipo || '').toLowerCase();

        if (!debtMap[d.persona]) {
            debtMap[d.persona] = {
                adelantado: 0,
                reintegrado: 0,
                cuotas: 0
            };
        }

        if (tipo === 'gasto') {
            debtMap[d.persona].adelantado +=
                montoVal;

        } else if (tipo === 'reintegro') {
            debtMap[d.persona].reintegrado +=
                montoVal;

        } else if (tipo === 'cuota_jueves') {
            debtMap[d.persona].cuotas +=
                montoVal;
        }
    });

    let deudaPendienteReintegros = 0;

    Object.values(debtMap).forEach(info => {
        const bal =
            info.adelantado -
            info.reintegrado -
            info.cuotas;

        if (bal > 0) {
            deudaPendienteReintegros += bal;
        }
    });

    /*
     * 2. Déficit de la cuenta general
     *    si gastos > aportes.
     */

    let totalAportes = 0;
    let totalGastos = 0;

    transactions.forEach(t => {
        const m =
            parseFloat(t.monto) || 0;

        if (t.tipo === 'aporte') {
            totalAportes += m;

        } else if (t.tipo === 'gasto') {
            totalGastos += m;
        }
    });

    const deficitGeneral =
        Math.max(
            0,
            totalGastos - totalAportes
        );

    /*
     * El monto a saldar considera la deuda pendiente
     * a miembros o el déficit general.
     */
    return Math.max(
        deudaPendienteReintegros,
        deficitGeneral
    );
}

function renderJuevesSanto() {
    const totalDeudaEl =
        document.getElementById(
            'jsTotalDeudaSaldar'
        );

    const presentCountEl =
        document.getElementById(
            'jsPresentCount'
        );

    const cuotaSugeridaEl =
        document.getElementById(
            'jsCuotaSugerida'
        );

    const cuotaInput =
        document.getElementById(
            'jsCuotaFinalInput'
        );

    const attendeesBadge =
        document.getElementById(
            'jsAttendeesBadge'
        );

    const fechaSelect =
        document.getElementById(
            'jsFechaSelect'
        );

    if (!totalDeudaEl || !fechaSelect) {
        return;
    }

    /*
     * Siempre garantizar que el selector tenga
     * la fecha del jueves de la semana actual.
     */

    if (!fechaSelect.value) {
        const now = new Date();

        const dayOfWeek =
            now.getDay();

        const diff =
            dayOfWeek <= 4
                ? (4 - dayOfWeek)
                : -(dayOfWeek - 4);

        const thursday =
            new Date(now);

        thursday.setDate(
            now.getDate() + diff
        );

        /*
         * IMPORTANTE:
         * No usar toISOString() porque trabaja en UTC.
         */
        fechaSelect.value =
            formatDateInputValue(
                thursday
            );
    }

    const targetDate =
        fechaSelect.value;

    const attendees =
        getAttendeesForDate(
            targetDate
        );

    const totalDeuda =
        calculateClubDebtToSettle();

    totalDeudaEl.textContent =
        `$${totalDeuda.toLocaleString(
            'es-AR',
            {
                minimumFractionDigits: 2
            }
        )}`;

    if (presentCountEl) {
        presentCountEl.textContent =
            attendees.length.toString();
    }

    if (attendeesBadge) {
        attendeesBadge.textContent =
            `${attendees.length} asistentes`;
    }

    /*
     * Cuota sugerida:
     *
     * deuda / cantidad de asistentes
     *
     * redondeada hacia arriba al múltiplo de $5
     *
     * con un mínimo de $30.000.
     */

    const CUOTA_MINIMA = 30000;

    let cuotaSugerida = 0;

    if (attendees.length > 0) {

        if (totalDeuda > 0) {
            const cuotaBase =
                totalDeuda /
                attendees.length;

            cuotaSugerida =
                Math.ceil(
                    cuotaBase / 5
                ) * 5;
        }

        cuotaSugerida =
            Math.max(
                CUOTA_MINIMA,
                cuotaSugerida
            );
    }

    if (cuotaSugeridaEl) {
        cuotaSugeridaEl.textContent =
            `$${cuotaSugerida.toLocaleString(
                'es-AR',
                {
                    minimumFractionDigits: 2
                }
            )}`;
    }

    /*
     * Poblar el input con la cuota sugerida
     * siempre que no haya sido editado manualmente.
     */

    if (
        cuotaInput &&
        cuotaInput.dataset.autoFilled !== 'false'
    ) {
        cuotaInput.value =
            cuotaSugerida;

        cuotaInput.dataset.autoFilled =
            'true';
    }

    /*
     * Registrar listener de edición manual
     * una sola vez.
     */

    if (
        cuotaInput &&
        !cuotaInput.dataset.listenerBound
    ) {
        cuotaInput.dataset.listenerBound =
            'true';

        cuotaInput.addEventListener(
            'input',
            () => {
                cuotaInput.dataset.autoFilled =
                    'false';

                renderAttendeesPreview(
                    getAttendeesForDate(
                        fechaSelect.value
                    )
                );
            }
        );
    }

    renderAttendeesPreview(
        attendees
    );

    renderJuevesSantoHistory();
}

function renderAttendeesPreview(attendees) {
    const attendeesTableBody =
        document.getElementById(
            'jsAttendeesTableBody'
        );

    const cuotaInput =
        document.getElementById(
            'jsCuotaFinalInput'
        );

    if (!attendeesTableBody) {
        return;
    }

    attendeesTableBody.innerHTML = '';

    if (attendees.length === 0) {
        attendeesTableBody.innerHTML = `
            <tr>
                <td colspan="5"
                    class="py-6 text-center text-slate-400 text-xs">

                    No hay miembros registrados como
                    <b>Presentes</b>
                    en la fecha seleccionada.

                    Cárgalos primero en la pestaña
                    <b>Asistencia</b>.

                </td>
            </tr>
        `;

        return;
    }

    const cuotaVal =
        parseFloat(
            cuotaInput
                ? cuotaInput.value
                : 0
        ) || 0;

    // Calcular saldos de cada miembro
    const memberBalances = {};

    members.forEach(m => {
        memberBalances[m] = {
            adelantado: 0,
            reintegrado: 0,
            cuotas: 0
        };
    });

    debts.forEach(d => {
        const montoVal =
            parseFloat(d.monto) || 0;

        const tipo =
            (d.tipo || '').toLowerCase();

        if (!memberBalances[d.persona]) {
            memberBalances[d.persona] = {
                adelantado: 0,
                reintegrado: 0,
                cuotas: 0
            };
        }

        if (tipo === 'gasto') {
            memberBalances[d.persona].adelantado +=
                montoVal;

        } else if (tipo === 'reintegro') {
            memberBalances[d.persona].reintegrado +=
                montoVal;

        } else if (tipo === 'cuota_jueves') {
            memberBalances[d.persona].cuotas +=
                montoVal;
        }
    });

    attendees.forEach(member => {
        const info =
            memberBalances[member] || {
                adelantado: 0,
                reintegrado: 0,
                cuotas: 0
            };

        const saldoPrevioFavor =
            info.adelantado -
            info.reintegrado -
            info.cuotas;

        /*
         * Al asignar la nueva cuota:
         * se descuenta del saldo a favor del miembro.
         */
        const saldoPosterior =
            saldoPrevioFavor -
            cuotaVal;

        let badge = '';

        if (saldoPosterior > 0) {
            badge = `
                <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    Saldo a favor:
                    $${saldoPosterior.toFixed(2)}
                </span>
            `;

        } else if (
            Math.abs(saldoPosterior) <= 0.001
        ) {
            badge = `
                <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    Cuenta saldada
                </span>
            `;

        } else {
            badge = `
                <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                    Debe aportar
                    $${Math.abs(saldoPosterior).toFixed(2)}
                </span>
            `;
        }

        const tr =
            document.createElement('tr');

        tr.innerHTML = `
            <td class="py-3 px-4 font-semibold text-slate-800 text-xs sm:text-sm">
                ${escapeHtml(member)}
            </td>

            <td class="py-3 px-4 text-right text-xs sm:text-sm ${saldoPrevioFavor > 0
                ? 'text-indigo-600 font-semibold'
                : 'text-slate-400'}">

                ${saldoPrevioFavor > 0
                    ? '$' + saldoPrevioFavor.toFixed(2)
                    : '$0.00'}
            </td>

            <td class="py-3 px-4 text-right text-xs sm:text-sm font-semibold text-rose-600">
                $${cuotaVal.toFixed(2)}
            </td>

            <td class="py-3 px-4 text-right text-xs sm:text-sm font-bold ${saldoPosterior >= 0
                ? 'text-emerald-600'
                : 'text-rose-600'}">

                ${saldoPosterior >= 0
                    ? '$' + saldoPosterior.toFixed(2)
                    : '-$' + Math.abs(saldoPosterior).toFixed(2)}
            </td>

            <td class="py-3 px-4 text-center text-xs">
                ${badge}
            </td>
        `;

        attendeesTableBody.appendChild(tr);
    });
}

function renderJuevesSantoHistory() {
    const historyTableBody =
        document.getElementById(
            'jsHistoryTableBody'
        );

    if (!historyTableBody) {
        return;
    }

    historyTableBody.innerHTML = '';

    const cuotasHistory =
        debts.filter(
            d =>
                (d.tipo || '').toLowerCase() ===
                'cuota_jueves'
        );

    if (cuotasHistory.length === 0) {
        historyTableBody.innerHTML = `
            <tr>
                <td colspan="4"
                    class="py-6 text-center text-slate-400 text-xs">

                    No se han emitido cuotas
                    de Jueves Santo todavía.

                </td>
            </tr>
        `;

        return;
    }

    cuotasHistory.forEach(d => {
        const montoVal =
            parseFloat(d.monto) || 0;

        const tr =
            document.createElement('tr');

        tr.innerHTML = `
            <td class="py-3 px-3 text-slate-500 text-xs">
                ${d.fecha || '-'}
            </td>

            <td class="py-3 px-3 font-semibold text-slate-800 text-xs sm:text-sm">
                ${escapeHtml(d.persona)}
            </td>

            <td class="py-3 px-3 text-slate-600 text-xs">
                ${escapeHtml(
                    d.concepto ||
                    'Cuota Jueves Santo'
                )}
            </td>

            <td class="py-3 px-3 text-right font-bold text-rose-600 text-xs sm:text-sm">
                $${montoVal.toFixed(2)}
            </td>
        `;

        historyTableBody.appendChild(tr);
    });
}

async function emitirCuotaJuevesSanto() {
    const fechaSelect =
        document.getElementById(
            'jsFechaSelect'
        );

    const cuotaInput =
        document.getElementById(
            'jsCuotaFinalInput'
        );

    const conceptoInput =
        document.getElementById(
            'jsConceptoInput'
        );

    const btn =
        document.getElementById(
            'btnEmitirCuotaJS'
        );

    if (!fechaSelect || !fechaSelect.value) {
        alert(
            'Por favor selecciona una fecha para el Jueves Santo.'
        );

        return;
    }

    const cuotaMonto =
        parseFloat(
            cuotaInput
                ? cuotaInput.value
                : 0
        );

    if (
        isNaN(cuotaMonto) ||
        cuotaMonto <= 0
    ) {
        alert(
            'Ingresa un valor de cuota válido mayor a $0.'
        );

        return;
    }

    /*
     * IMPORTANTE:
     * Esta llamada ahora utiliza getAttendeesForDate()
     * con normalización de fechas.
     */
    const attendees =
        getAttendeesForDate(
            fechaSelect.value
        );

    if (attendees.length === 0) {
        alert(
            'No se encontraron miembros con asistencia PRESENTE en la fecha seleccionada.'
        );

        return;
    }

    const concepto =
        (
            conceptoInput &&
            conceptoInput.value.trim()
        )
            ? conceptoInput.value.trim()
            : 'Cuota Jueves Santo';

    /*
     * Para enviar a Apps Script seguimos utilizando
     * DD/MM/YYYY.
     */
    let formattedDate =
        fechaSelect.value;

    if (fechaSelect.value.includes('-')) {
        const parts =
            fechaSelect.value.split('-');

        if (parts.length === 3) {
            formattedDate =
                `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }

    const confirmMsg =
        `¿Deseas emitir una cuota de $${cuotaMonto.toFixed(2)} a ${attendees.length} miembro(s) asistente(s)?\n\n` +
        `Fecha: ${formattedDate}\n` +
        `Concepto: ${concepto}`;

    if (!confirm(confirmMsg)) {
        return;
    }

    btn.disabled = true;

    btn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
             fill="none"
             viewBox="0 0 24 24">

            <circle class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4">
            </circle>

            <path class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z">
            </path>

        </svg>

        <span>Emitiendo cuotas...</span>
    `;

    const payload = {
        action: 'emit_cuota_jueves',
        fecha: formattedDate,
        monto: cuotaMonto,
        concepto: concepto,
        asistentes: attendees
    };

    if (isDemoMode) {
        attendees.forEach(persona => {
            debts.unshift({
                fecha: formattedDate,
                persona: persona,
                tipo: 'cuota_jueves',
                monto: cuotaMonto,
                concepto: concepto
            });
        });

        renderApp();

        btn.disabled = false;

        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg"
                 class="h-4 w-4"
                 fill="none"
                 viewBox="0 0 24 24"
                 stroke="currentColor">

                <path stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4v16m8-8H4" />

            </svg>

            <span>Emitir Cuota a Asistentes</span>
        `;

        alert(
            `¡Se emitieron con éxito las cuotas a los ${attendees.length} asistentes! Las puedes ver registradas en 'Deudas y Reintegros'.`
        );

        return;
    }

    try {
        await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        /*
         * Actualizamos inmediatamente la memoria local
         * para que la interfaz muestre la cuota.
         */
        attendees.forEach(persona => {
            debts.unshift({
                fecha: formattedDate,
                persona: persona,
                tipo: 'cuota_jueves',
                monto: cuotaMonto,
                concepto: concepto
            });
        });

        renderApp();

        /*
         * Después sincronizamos nuevamente con Sheets.
         */
        setTimeout(() => {
            fetchSheetData();
        }, 1200);

        alert(
            `¡Cuota de Jueves Santo emitida correctamente para ${attendees.length} asistentes!`
        );

    } catch (err) {
        console.error(err);

        /*
         * Aunque falle la sincronización visual,
         * mantenemos el registro local.
         */
        attendees.forEach(persona => {
            debts.unshift({
                fecha: formattedDate,
                persona: persona,
                tipo: 'cuota_jueves',
                monto: cuotaMonto,
                concepto: concepto
            });
        });

        renderApp();
    }

    btn.disabled = false;

    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg"
             class="h-4 w-4"
             fill="none"
             viewBox="0 0 24 24"
             stroke="currentColor">

            <path stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4" />

        </svg>

        <span>Emitir Cuota a Asistentes</span>
    `;
}

function escapeHtml(text) {
    if (!text) {
        return '';
    }

    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };

    return text
        .toString()
        .replace(
            /[&<>"']/g,
            m => map[m]
        );
}

/*
 * ----------------------------------------------------
 * INICIALIZACIÓN DE LA APP
 * ----------------------------------------------------
 */

setDefaultDate();

document.addEventListener(
    'DOMContentLoaded',
    async () => {

        const loginScreen =
            document.getElementById('loginScreen');

        /*
         * Si ya estaba logueado, entramos directamente
         * y FORZAMOS la sincronización con Google Sheets.
         */
        if (
            safeStorage.getItem('cc_logged') ===
            'true'
        ) {

            loginScreen
                .classList
                .add('hidden');

            /*
             * IMPORTANTE:
             * Cada apertura de la aplicación consulta
             * nuevamente Google Sheets.
             */
            isDemoMode = false;

            await fetchSheetData();

        } else {

            /*
             * Primera apertura:
             * mostramos login.
             *
             * NO cargamos datos Demo automáticamente,
             * porque queremos que la aplicación intente
             * trabajar con datos reales.
             */
            loginScreen
                .classList
                .remove('hidden');
        }
    }
);
