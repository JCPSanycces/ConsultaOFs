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


// ── SONIDO DE LECTURA ─────────────────────────────────
function reproducirSonido(tipo) {
    const ctx        = new (window.AudioContext || window.webkitAudioContext)();
    const oscilador  = ctx.createOscillator();
    const ganancia   = ctx.createGain();

    oscilador.connect(ganancia);
    ganancia.connect(ctx.destination);

    if (tipo === 'ok') {
        // Pitido corto y agudo: lectura correcta
        oscilador.frequency.setValueAtTime(880, ctx.currentTime);
        oscilador.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
        ganancia.gain.setValueAtTime(0.4, ctx.currentTime);
        ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        oscilador.start(ctx.currentTime);
        oscilador.stop(ctx.currentTime + 0.25);

    } else if (tipo === 'error') {
        // Pitido largo y grave: componente no encontrado
        oscilador.frequency.setValueAtTime(220, ctx.currentTime);
        ganancia.gain.setValueAtTime(0.5, ctx.currentTime);
        ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        oscilador.start(ctx.currentTime);
        oscilador.stop(ctx.currentTime + 0.5);

    } else if (tipo === 'completo') {
        // Melodia corta: OF completada
        const notas = [660, 880, 1100];
        notas.forEach(function (freq, i) {
            const osc = ctx.createOscillator();
            const gan = ctx.createGain();
            osc.connect(gan);
            gan.connect(ctx.destination);
            osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
            gan.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.15);
            gan.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.2);
            osc.start(ctx.currentTime + i * 0.15);
            osc.stop(ctx.currentTime + i * 0.15 + 0.2);
        });
    }
}


// ── BÚSQUEDA DE OF ────────────────────────────────────
async function buscarOF() {

    const inputOF   = document.getElementById('inputOF');
    const numOf     = inputOF.value.trim().toUpperCase();
    inputOF.value   = numOf;
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

    const qtyLanzada = parseFloat(d.QTY_LANZADA_0);
    document.getElementById('rQtyLanzada').textContent = Number.isFinite(qtyLanzada)
        ? qtyLanzada.toFixed(4)
        : (d.QTY_LANZADA_0 || '-');

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
        reproducirSonido('error');
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
        reproducirSonido('ok');
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
    reproducirSonido('ok');

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
    reproducirSonido('completo');
    // Guardar el numero de OF antes de que cerrarPopup lo limpie
    const numOfActual = document.getElementById('rNumOf').textContent.trim();

    // Actualizar ZNUMLECAPP en base de datos
    completarOf(numOfActual);

    setTimeout(function () {
        mostrarPopupCompleto();
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


// ── COMPLETAR OF EN BASE DE DATOS ─────────────────────
async function completarOf(numOf) {
    try {
        const resp = await fetch('/completar', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ num_of: numOf })
        });
        const json = await resp.json();
        if (!resp.ok) {
            console.error('Error al actualizar el número de lecturas:', json.error);
        } else {
            console.log('Número de lecturas actualizado para OF:', json.num_of);
        }
    } catch (e) {
        console.error('Error de conexion al completar OF:', e);
    }
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


// ── POPUP OF COMPLETADA ───────────────────────────────
function mostrarPopupCompleto() {
    const popup = document.getElementById('popupCompleto');
    popup.classList.remove('oculto');
    // Asegurarse de que el popup está por encima de todo
    popup.style.display = 'flex';
}

function cerrarPopup() {
    // Ocultar popup
    const popup = document.getElementById('popupCompleto');
    popup.classList.add('oculto');
    popup.style.display = 'none';

    // Parar cámara si estuviera activa
    if (scanner) {
        scanner.stop().catch(function () {});
        scanner = null;
    }

    // Resetear todo el estado
    eansPendientes  = [];
    eansLeidos      = {};
    modoEscaneoComp = false;

    // Limpiar resultados de la pantalla
    document.getElementById('resultados').classList.add('oculto');
    document.getElementById('mensaje').classList.add('oculto');
    document.getElementById('cuerpoTabla').innerHTML = '';
    document.getElementById('contadorOk').textContent = '0 / 0';
    document.getElementById('totalComp').textContent  = '';
    document.getElementById('mensajeComp').classList.add('oculto');

    // Limpiar campo OF y devolver el foco
    document.getElementById('inputOF').value = '';
    document.getElementById('inputOF').focus();

    // Mostrar botón de cámara por si estaba oculto
    document.getElementById('btnScan').classList.remove('oculto');
    document.getElementById('zonaScanner').classList.add('oculto');
}


// ── LECTURA EAN DESDE PC (lector inalámbrico o teclado) ───────────
document
    .getElementById('inputEan')
    .addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;

        const ean = this.value.trim().toUpperCase();
        this.value = '';  // vaciar siempre para la siguiente lectura

        if (!ean) return;

        if (!modoEscaneoComp) {
            mostrarMensaje('Primero busca una OF', 'error');
            return;
        }

        procesarEscaneo(ean);
    });