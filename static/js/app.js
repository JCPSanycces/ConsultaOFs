// =====================================================
// app.js - Lógica interactiva de la aplicación
// Consulta de Órdenes de Fabricación Sage X3
// =====================================================


// ── ESTADO GLOBAL ─────────────────────────────────────
let eansPendientes  = [];
let eansLeidos      = {};
let modoEscaneoComp = false;
let datosPendientes = null;
let ofTieneSeries   = false;
let scannerSerie    = null;
let bloqueandoSerie = false;
let bloqueandoScan  = false;
let correoUsuario   = '';
let lineaOf         = '';
let articuloOf      = '';


// ── EVENTOS ───────────────────────────────────────────
document
    .getElementById('inputOF')
    .addEventListener('keydown', function (e) {
        if (e.key === 'Enter') buscarOF();
    });

document
    .getElementById('inputEan')
    .addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        const ean = this.value.trim().toUpperCase();
        this.value = '';
        if (!ean) return;
        if (!modoEscaneoComp) {
            mostrarMensaje('Primero busca una OF', 'error');
            return;
        }
        procesarEscaneo(ean);
    });

document
    .getElementById('inputSerie')
    .addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        const serie = this.value.trim().toUpperCase();
        this.value  = '';
        if (serie) validarSerie(serie);
    });


// ── GESTIÓN DE CORREO DE USUARIO ──────────────────────
function inicializarCorreo() {
    const correoGuardado = localStorage.getItem('correoUsuario');
    if (correoGuardado) {
        correoUsuario = correoGuardado;
        console.log('Correo cargado:', correoUsuario);
    } else {
        mostrarPopupCorreo();
    }
}

// Mostrar popup para introducir correo
function mostrarPopupCorreo() {
    const popup = document.getElementById('popupCorreo');
    popup.classList.remove('oculto');
    popup.style.display = 'flex';
    document.getElementById('inputCorreo').focus();
}

// Guardar correo en localStorage y cerrar popup
function guardarCorreo() {
    const input  = document.getElementById('inputCorreo');
    const correo = input.value.trim().toLowerCase();
    const divMsg = document.getElementById('mensajeCorreo');

    // Validacion basica de formato email
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(correo)) {
        divMsg.textContent = '⚠ Introduce un correo válido';
        divMsg.className   = 'mensaje error';
        divMsg.classList.remove('oculto');
        return;
    }

    correoUsuario = correo;
    localStorage.setItem('correoUsuario', correo);

    const popup = document.getElementById('popupCorreo');
    popup.classList.add('oculto');
    popup.style.display = 'none';

    console.log('Correo guardado:', correoUsuario);
}

// Permitir confirmar con Enter en el campo de correo
document
    .getElementById('inputCorreo')
    .addEventListener('keydown', function (e) {
        if (e.key === 'Enter') guardarCorreo();
    });


// ── SONIDO ────────────────────────────────────────────
function reproducirSonido(tipo) {
    const ctx       = new (window.AudioContext || window.webkitAudioContext)();
    const oscilador = ctx.createOscillator();
    const ganancia  = ctx.createGain();

    oscilador.connect(ganancia);
    ganancia.connect(ctx.destination);

    if (tipo === 'ok') {
        oscilador.frequency.setValueAtTime(880, ctx.currentTime);
        oscilador.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
        ganancia.gain.setValueAtTime(0.4, ctx.currentTime);
        ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        oscilador.start(ctx.currentTime);
        oscilador.stop(ctx.currentTime + 0.25);

    } else if (tipo === 'error') {
        oscilador.frequency.setValueAtTime(220, ctx.currentTime);
        ganancia.gain.setValueAtTime(0.5, ctx.currentTime);
        ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        oscilador.start(ctx.currentTime);
        oscilador.stop(ctx.currentTime + 0.5);

    } else if (tipo === 'completo') {
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

        const numlec = json.datos[0].NUMLEC_OF_0 || 0;

        if (numlec > 0) {
            datosPendientes = json.datos;
            mostrarPopupYaLeida(numlec);
        } else {
            mostrarResultados(json.datos);
            divMsg.classList.add('oculto');
        }

    } catch (e) {
        mostrarMensaje('Error: ' + e.message, 'error');
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
    document.getElementById('rLinea').textContent        = d.LINEA_OF_0      || '-';

    // Guardar la linea para usarla al registrar
    lineaOf = d.LINEA_OF_0 || '';

    articuloOf = d.CODART_OF_0 || '';

    const qtyLanzada = parseFloat(d.QTY_LANZADA_0);
    document.getElementById('rQtyLanzada').textContent = Number.isFinite(qtyLanzada)
        ? qtyLanzada.toFixed(4)
        : (d.QTY_LANZADA_0 || '-');

    const tbody = document.getElementById('cuerpoTabla');
    tbody.innerHTML = '';

    eansPendientes = [];
    eansLeidos     = {};

    datos.forEach(function (fila) {
        if (!fila.CODCOMP_OF_0) return;

        const cod = fila.CODCOMP_OF_0.trim();
        const ean = (fila.EANCOMP_OF_0 || '').trim();

        if (ean) {
            eansPendientes.push(ean);
            eansLeidos[ean] = false;
        }

        const tr      = document.createElement('tr');
        tr.id         = 'fila-' + cod;
        tr.innerHTML  =
            '<td class="td-estado"><span class="estado-icono pendiente">○</span></td>' +
            '<td class="td-cod">'  + cod + '</td>' +
            '<td>'                 + (fila.DESCOMP_OF_0  || '-') + '</td>' +
            '<td class="td-cod">'  + (ean || '<span style="color:#94a3b8">Sin EAN</span>') + '</td>' +
            '<td class="td-cant">' + (fila.QTYCOMP_OF_0  || '-') + '</td>';

        tbody.appendChild(tr);
    });

    document.getElementById('totalComp').textContent = eansPendientes.length;
    actualizarContador();
    document.getElementById('resultados').classList.remove('oculto');

    if (eansPendientes.length > 0) {
        modoEscaneoComp = true;
        document.getElementById('inputEan').focus();
    } else {
        mostrarMensaje('Esta OF no tiene componentes con código EAN asignado.', 'error');
    }
}


// ── ESCANEO DE COMPONENTES ────────────────────────────
function procesarEscaneo(codigo) {

    codigo = codigo.trim().toUpperCase();

    if (!modoEscaneoComp) {
        document.getElementById('inputOF').value = codigo;
        buscarOF();
        return;
    }

    const divMensajeComp = document.getElementById('mensajeComp');

    if (!(codigo in eansLeidos)) {
        reproducirSonido('error');
        divMensajeComp.textContent = '⚠ EAN ' + codigo + ' no pertenece a esta OF';
        divMensajeComp.className   = 'mensaje error';
        divMensajeComp.classList.remove('oculto');
        setTimeout(function () { divMensajeComp.classList.add('oculto'); }, 3000);
        return;
    }

    if (eansLeidos[codigo]) {
        reproducirSonido('ok');
        divMensajeComp.textContent = '✓ Este componente ya fue escaneado';
        divMensajeComp.className   = 'mensaje cargando';
        divMensajeComp.classList.remove('oculto');
        setTimeout(function () { divMensajeComp.classList.add('oculto'); }, 2000);
        return;
    }

    eansLeidos[codigo] = true;
    reproducirSonido('ok');

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

    const todosLeidos = eansPendientes.every(function (ean) {
        return eansLeidos[ean];
    });

    if (todosLeidos) {
        reproducirSonido('completo');
        const numOfActual = document.getElementById('rNumOf').textContent.trim();

        fetch('/series', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ num_of: numOfActual })
        })
        .then(function (resp) { return resp.json(); })
        .then(function (json) {
            if (json.tiene_series) {
                ofTieneSeries = true;
                mostrarBloqueSeries(json.total);
            } else {
                ofTieneSeries = false;
                finalizarOf(numOfActual, '');
            }
        })
        .catch(function (e) {
            console.error('Error al comprobar series:', e);
            finalizarOf(numOfActual, '');
        });
    }
}


// ── CONTADOR ──────────────────────────────────────────
function actualizarContador() {
    const leidos = eansPendientes.filter(function (ean) {
        return eansLeidos[ean];
    }).length;
    document.getElementById('contadorOk').textContent = leidos + ' / ' + eansPendientes.length;
}


// ── NÚMEROS DE SERIE ──────────────────────────────────
function mostrarBloqueSeries(total) {
    const popup = document.getElementById('popupSerie');
    popup.classList.remove('oculto');
    popup.style.display = 'flex';

    document.getElementById('textoSeries').textContent =
        'Esta OF tiene ' + total + ' número' + (total > 1 ? 's' : '') +
        ' de serie registrado' + (total > 1 ? 's' : '') +
        '. Escanea uno para validar la OF.';

    document.getElementById('mensajeSerie').classList.add('oculto');
    document.getElementById('inputSerie').value = '';
    document.getElementById('inputSerie').focus();
}

async function validarSerie(numSerie) {

    numSerie = numSerie.trim().toUpperCase();
    if (!numSerie) return;

    const divMsg = document.getElementById('mensajeSerie');

    try {
        const resp = await fetch('/validar-serie', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ num_serie: numSerie })
        });
        const json = await resp.json();

        if (!resp.ok) {
            reproducirSonido('error');
            divMsg.textContent = '⚠ Error al validar el número de serie';
            divMsg.className   = 'mensaje error';
            divMsg.classList.remove('oculto');
            return;
        }

        if (json.existe) {
            reproducirSonido('completo');

            pararCamaraSerie();

            const popup = document.getElementById('popupSerie');
            popup.classList.add('oculto');
            popup.style.display = 'none';

            const numOf = document.getElementById('rNumOf').textContent.trim();

            // ── CAMBIO: se pasa numSerie a finalizarOf ──────────
            setTimeout(function () { finalizarOf(numOf, numSerie); }, 400);

        } else {
            reproducirSonido('error');
            divMsg.textContent = '⚠ Número de serie ' + numSerie + ' no encontrado. Vuelve a intentarlo.';
            divMsg.className   = 'mensaje error';
            divMsg.classList.remove('oculto');
            document.getElementById('inputSerie').value = '';
            document.getElementById('inputSerie').focus();
            setTimeout(function () { divMsg.classList.add('oculto'); }, 3000);
        }

    } catch (e) {
        reproducirSonido('error');
        divMsg.textContent = '⚠ Error de conexión al validar serie';
        divMsg.className   = 'mensaje error';
        divMsg.classList.remove('oculto');
    }
}


// ── FINALIZAR OF ──────────────────────────────────────
async function finalizarOf(numOf, numSerie) {
    await registrarValidacion(numOf, numSerie || '');
    await completarOf(numOf);
    await imprimirEtiqueta(numOf);
    setTimeout(function () { mostrarPopupCompleto(); }, 400);
}


// ── REGISTRAR VALIDACIÓN EN ZAPPVALIDAOF ─────────────
async function registrarValidacion(numOf, numSerie) {
    try {
        const resp = await fetch('/registrar', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                num_of:    numOf,
                num_serie: numSerie || '',
                correo:    correoUsuario || '',
                linea:     lineaOf || '',
                articulo:  articuloOf || ''
            })
        });
        const json = await resp.json();
        if (!resp.ok) {
            console.error('Error al registrar validacion:', json.error);
        } else {
            console.log('Validacion registrada para OF:', json.num_of);
        }
    } catch (e) {
        console.error('Error de conexion al registrar validacion:', e);
    }
}


// ── ACTUALIZAR BBDD AL COMPLETAR ──────────────────────
async function completarOf(numOf) {
    try {
        const resp = await fetch('/completar', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ num_of: numOf })
        });
        const json = await resp.json();
        if (!resp.ok) console.error('Error al actualizar lecturas:', json.error);
        else console.log('Lecturas actualizadas para OF:', json.num_of);
    } catch (e) {
        console.error('Error de conexion al completar OF:', e);
    }
}


// ── IMPRESIÓN ─────────────────────────────────────────
async function imprimirEtiqueta(numOf) {
    try {
        const resp = await fetch('/imprimir', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ num_of: numOf })
        });
        const json = await resp.json();
        if (!resp.ok) console.error('Error al imprimir:', json.error);
        else console.log('Etiqueta enviada correctamente');
    } catch (e) {
        console.error('Error de conexion al imprimir:', e);
    }
}


// ── POPUP OF COMPLETADA ───────────────────────────────
function mostrarPopupCompleto() {
    const popup = document.getElementById('popupCompleto');
    popup.classList.remove('oculto');
    popup.style.display = 'flex';
}

function cerrarPopup() {
    const popup = document.getElementById('popupCompleto');
    popup.classList.add('oculto');
    popup.style.display = 'none';

    if (scanner) {
        scanner.stop().catch(function () {});
        scanner = null;
    }
    if (scannerComp) {
        scannerComp.stop().catch(function () {});
        scannerComp = null;
    }
    pararCamaraSerie();

    eansPendientes  = [];
    eansLeidos      = {};
    modoEscaneoComp = false;
    ofTieneSeries   = false;
    lineaOf         = '';
    articuloOf      = '';

    document.getElementById('resultados').classList.add('oculto');
    document.getElementById('mensaje').classList.add('oculto');
    document.getElementById('cuerpoTabla').innerHTML = '';
    document.getElementById('contadorOk').textContent = '0 / 0';
    document.getElementById('totalComp').textContent  = '';
    document.getElementById('mensajeComp').classList.add('oculto');

    const popupSerie = document.getElementById('popupSerie');
    popupSerie.classList.add('oculto');
    popupSerie.style.display = 'none';
    document.getElementById('inputSerie').value = '';
    document.getElementById('mensajeSerie').classList.add('oculto');

    document.getElementById('inputOF').value = '';
    document.getElementById('btnScan').classList.remove('oculto');
    document.getElementById('zonaScanner').classList.add('oculto');
    document.getElementById('inputOF').focus();
}


// ── POPUP OF YA LEIDA ─────────────────────────────────
function mostrarPopupYaLeida(veces) {
    const msg = veces === 1
        ? 'Esta OF ya fue leída 1 vez anteriormente. ¿Desea continuar?'
        : 'Esta OF ya fue leída ' + veces + ' veces anteriormente. ¿Desea continuar?';

    document.getElementById('popupYaLeidaMensaje').textContent = msg;

    const popup = document.getElementById('popupYaLeida');
    popup.classList.remove('oculto');
    popup.style.display = 'flex';
}

function popupYaLeidaSi() {
    const popup = document.getElementById('popupYaLeida');
    popup.classList.add('oculto');
    popup.style.display = 'none';

    if (datosPendientes) {
        mostrarResultados(datosPendientes);
        document.getElementById('mensaje').classList.add('oculto');
        datosPendientes = null;
    }
}

function popupYaLeidaNo() {
    const popup = document.getElementById('popupYaLeida');
    popup.classList.add('oculto');
    popup.style.display = 'none';

    datosPendientes = null;
    eansPendientes  = [];
    eansLeidos      = {};
    modoEscaneoComp = false;

    document.getElementById('resultados').classList.add('oculto');
    document.getElementById('mensaje').classList.add('oculto');
    document.getElementById('inputOF').value = '';
    document.getElementById('inputOF').focus();
}


// ── CÁMARA OF (búsqueda inicial) ──────────────────────
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
        }).catch(function () { scanner = null; });
    }
    document.getElementById('zonaScanner').classList.add('oculto');
    document.getElementById('btnScan').classList.remove('oculto');
}


// ── CÁMARA COMPONENTES ────────────────────────────────
let scannerComp = null;

function activarCamaraComp() {
    if (!modoEscaneoComp) {
        mostrarMensaje('Primero busca una OF', 'error');
        return;
    }

    document.getElementById('zonaScannerComp').classList.remove('oculto');
    document.getElementById('btnScanComp').classList.add('oculto');

    scannerComp = new Html5Qrcode('visorCamaraComp');

    scannerComp.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        function (codigoLeido) {
            if (bloqueandoScan) return;
            bloqueandoScan = true;
            setTimeout(function () { bloqueandoScan = false; }, 1500);

            procesarEscaneo(codigoLeido);

            const todosLeidos = eansPendientes.every(function (ean) {
                return eansLeidos[ean];
            });
            if (todosLeidos) pararCamaraComp();
        },
        function (error) { }
    ).catch(function (err) {
        mostrarMensaje('No se pudo acceder a la cámara: ' + err, 'error');
        pararCamaraComp();
    });
}

function pararCamaraComp() {
    if (scannerComp) {
        scannerComp.stop().then(function () {
            scannerComp.clear();
            scannerComp = null;
        }).catch(function () { scannerComp = null; });
    }
    document.getElementById('zonaScannerComp').classList.add('oculto');
    document.getElementById('btnScanComp').classList.remove('oculto');
    bloqueandoScan = false;
}


// ── CÁMARA NÚMERO DE SERIE ────────────────────────────
function activarCamaraSerie() {
    document.getElementById('zonaScannerSerie').classList.remove('oculto');
    document.getElementById('btnScanSerie').classList.add('oculto');

    scannerSerie = new Html5Qrcode('visorCamaraSerie');

    scannerSerie.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        function (codigoLeido) {
            if (bloqueandoSerie) return;
            bloqueandoSerie = true;
            setTimeout(function () { bloqueandoSerie = false; }, 2000);

            pararCamaraSerie();
            validarSerie(codigoLeido);
        },
        function (error) { }
    ).catch(function (err) {
        document.getElementById('mensajeSerie').textContent =
            'No se pudo acceder a la cámara: ' + err;
        document.getElementById('mensajeSerie').className = 'mensaje error';
        document.getElementById('mensajeSerie').classList.remove('oculto');
        pararCamaraSerie();
    });
}

// ── PARAR CÁMARA NÚMERO DE SERIE ───────────────────────
function pararCamaraSerie() {
    if (scannerSerie) {
        scannerSerie.stop().then(function () {
            scannerSerie.clear();
            scannerSerie = null;
        }).catch(function () { scannerSerie = null; });
    }
    if (document.getElementById('zonaScannerSerie')) {
        document.getElementById('zonaScannerSerie').classList.add('oculto');
    }
    if (document.getElementById('btnScanSerie')) {
        document.getElementById('btnScanSerie').classList.remove('oculto');
    }
    bloqueandoSerie = false;
}

// ── INICIO ────────────────────────────────────────────
inicializarCorreo();