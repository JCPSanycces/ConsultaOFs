// =====================================================
// app.js - Lógica interactiva de la aplicación
// Consulta de Órdenes de Fabricación Sage X3
// =====================================================


// ── ESTADO GLOBAL ─────────────────────────────────────
let eansPendientes = [];   // lista de EANs de componentes de la OF
let eansLeidos     = {};   // { ean: true/false }
let modoEscaneoComp = false;


// ── EVENTOS ───────────────────────────────────────────
document
    .getElementById('inputOF')
    .addEventListener('keydown', function (e) {
        if (e.key === 'Enter') buscarOF();
    });


// ── BÚSQUEDA DE OF ────────────────────────────────────
async function buscarOF() {

    const numOf     = document.getElementById('inputOF').value.trim().toUpperCase();
    const btnBuscar = document.getElementById('btnBuscar');
    const divMsg    = document.getElementById('mensaje');
    const divRes    = document.getElementById('resultados');

    if (!numOf) {
        mostrarMensaje('Por favor introduce un número de OF', 'error');
        return;
    }

    btnBuscar.disabled    = true;
    btnBuscar.textContent = 'Buscando...';
    mostrarMensaje('Buscando OF ' + numOf + '...', 'cargando');
    divRes.classList.add('oculto');

    // Resetear estado anterior
    eansPendientes  = [];
    eansLeidos      = {};
    modoEscaneoComp = false;

    try {
        const resp = await fetch('/buscar', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ num_of: numOf })
        });

        const json = await resp.json();

        if (!resp.ok) {
            mostrarMensaje(json.error || 'Error desconocido', 'error');
            return;
        }

        mostrarResultados(json.datos);
        divMsg.classList.add('oculto');

    } catch (e) {
        mostrarMensaje(
            'No se pudo conectar con el servidor. Comprueba que la aplicación está arrancada.',
            'error'
        );
    } finally {
        btnBuscar.disabled    = false;
        btnBuscar.textContent = 'Buscar';
    }
}


// ── MENSAJES GENERALES ────────────────────────────────
function mostrarMensaje(texto, tipo) {
    const div       = document.getElementById('mensaje');
    div.textContent = texto;
    div.className   = 'mensaje ' + tipo;
}


// ── RESULTADOS ────────────────────────────────────────
function mostrarResultados(datos) {

    if (!datos || datos.length === 0) return;

    const d = datos[0];

    document.getElementById('rNumOf').textContent        = d.NUM_OF_0        || '-';
    document.getElementById('rEstado').textContent       = d.ESTADO_OF_0     || '-';
    document.getElementById('rFecha').textContent        = d.FECHAINI_OF_0   || '-';
    document.getElementById('rArticulo').textContent     = d.CODART_OF_0     || '-';
    document.getElementById('rDescArticulo').textContent = d.DESART_OF_0     || '-';
    document.getElementById('rEan').textContent          = d.EANART_OF_0     || '-';
    document.getElementById('rQtyLanzada').textContent   = d.QTY_LANZADA_0   || '-';

    const tbody = document.getElementById('cuerpoTabla');
    tbody.innerHTML = '';

    eansPendientes  = [];
    eansLeidos      = {};

    datos.forEach(function (fila) {

        // Saltar filas sin componente
        if (!fila.CODCOMP_OF_0) return;

        const cod = fila.CODCOMP_OF_0.trim();
        const ean = (fila.EANCOMP_OF_0 || '').trim();

        // Solo registrar como pendiente si tiene EAN
        if (ean) {
            eansPendientes.push(ean);
            eansLeidos[ean] = false;
        }

        const tr = document.createElement('tr');
        tr.id = 'fila-' + cod;

        tr.innerHTML =
            '<td class="td-estado"><span class="estado-icono pendiente">○</span></td>' +
            '<td class="td-cod">'  + cod                           + '</td>' +
            '<td>'                 + (fila.DESCOMP_OF_0  || '-')   + '</td>' +
            '<td class="td-cod">'  + (ean || '<span style="color:#94a3b8">Sin EAN</span>') + '</td>' +
            '<td class="td-cant">' + (fila.QTYCOMP_OF_0  || '-')   + '</td>';

        tbody.appendChild(tr);
    });

    document.getElementById('totalComp').textContent = eansPendientes.length;
    actualizarContador();
    document.getElementById('resultados').classList.remove('oculto');

    // Activar modo escaneo solo si hay EANs que leer
    if (eansPendientes.length > 0) {
        modoEscaneoComp = true;
    } else {
        mostrarMensaje(
            'Esta OF no tiene componentes con código EAN asignado.',
            'error'
        );
    }
}


// ── LÓGICA DE ESCANEO DE COMPONENTES ─────────────────
function procesarEscaneo(codigo) {

    codigo = codigo.trim().toUpperCase();

    // Si no hay OF cargada, buscar la OF
    if (!modoEscaneoComp) {
        document.getElementById('inputOF').value = codigo;
        buscarOF();
        return;
    }

    const divMensajeComp = document.getElementById('mensajeComp');

    // Comprobar si el EAN pertenece a esta OF
    if (!(codigo in eansLeidos)) {
        divMensajeComp.textContent = '⚠ EAN ' + codigo + ' no pertenece a esta OF';
        divMensajeComp.className   = 'mensaje error';
        divMensajeComp.classList.remove('oculto');
        setTimeout(function () {
            divMensajeComp.classList.add('oculto');
        }, 3000);
        return;
    }

    // Comprobar si ya estaba leído
    if (eansLeidos[codigo]) {
        divMensajeComp.textContent = '✓ Este componente ya fue escaneado';
        divMensajeComp.className   = 'mensaje cargando';
        divMensajeComp.classList.remove('oculto');
        setTimeout(function () {
            divMensajeComp.classList.add('oculto');
        }, 2000);
        return;
    }

    // Marcar como leído
    eansLeidos[codigo] = true;

    // Buscar la fila por EAN (cuarta columna, índice 3)
    const filas = document.querySelectorAll('#cuerpoTabla tr');
    filas.forEach(function (fila) {
        const celdaEan = fila.cells[3];
        if (celdaEan && celdaEan.textContent.trim() === codigo) {
            fila.classList.add('fila-ok');
            fila.querySelector('.estado-icono').textContent = '✓';
            fila.querySelector('.estado-icono').className   = 'estado-icono ok';
        }
    });

    divMensajeComp.classList.add('oculto');
    actualizarContador();

    // Comprobar si todos los EANs están leídos
    const todosLeidos = eansPendientes.every(function (ean) {
        return eansLeidos[ean];
    });

    if (todosLeidos) {
        setTimeout(function () {
            document.getElementById('popupCompleto').classList.remove('oculto');
        }, 400);
    }
}


// ── CONTADOR DE PROGRESO ──────────────────────────────
function actualizarContador() {
    const leidos = eansPendientes.filter(function (ean) {
        return eansLeidos[ean];
    }).length;
    const total  = eansPendientes.length;
    document.getElementById('contadorOk').textContent = leidos + ' / ' + total;
}


// ── POPUP ─────────────────────────────────────────────
function cerrarPopup() {
    document.getElementById('popupCompleto').classList.add('oculto');
    modoEscaneoComp = false;
    document.getElementById('inputOF').value = '';
    document.getElementById('inputOF').focus();
}


// ── ESCÁNER DE CÁMARA ─────────────────────────────────
let scanner = null;

function activarCamara() {
    document.getElementById('zonaScanner').classList.remove('oculto');
    document.getElementById('btnScan').classList.add('oculto');

    scanner = new Html5Qrcode('visorCamara');

    scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        function (codigoLeido) {
            procesarEscaneo(codigoLeido);
            pararCamara();
        },
        function (error) { }
    ).catch(function (err) {
        mostrarMensaje('No se pudo acceder a la cámara: ' + err, 'error');
        pararCamara();
    });
}

function pararCamara() {
    if (scanner) {
        scanner.stop().then(function () {
            scanner.clear();
            scanner = null;
        }).catch(function () {
            scanner = null;
        });
    }
    document.getElementById('zonaScanner').classList.add('oculto');
    document.getElementById('btnScan').classList.remove('oculto');
}