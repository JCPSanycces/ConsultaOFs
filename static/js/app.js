// =====================================================
// app.js - Lógica interactiva de la aplicación
// =====================================================

// ── EVENTOS ──────────────────────────────────────────
document
    .getElementById("inputOF")
    .addEventListener("keydown", function (e) {
        if (e.key === "Enter") buscarOF();
    });


// ── BÚSQUEDA DE OF ────────────────────────────────────
async function buscarOF() {

    const numOf = document.getElementById("inputOF").value.trim().toUpperCase();
    const btnBuscar = document.getElementById("btnBuscar");
    const divMsg    = document.getElementById("mensaje");
    const divRes    = document.getElementById("resultados");

    if (!numOf) {
        mostrarMensaje("Por favor introduce un número de OF", "error");
        return;
    }

    btnBuscar.disabled    = true;
    btnBuscar.textContent = "Buscando...";
    mostrarMensaje(`Buscando OF ${numOf}...`, "cargando");
    divRes.classList.add("oculto");

    try {
        const resp = await fetch("/buscar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ num_of: numOf })
        });

        const json = await resp.json();

        if (!resp.ok) {
            mostrarMensaje(json.error || "Error desconocido", "error");
            return;
        }

        mostrarResultados(json.datos);
        divMsg.classList.add("oculto");

    } catch (e) {
        mostrarMensaje(
            "No se pudo conectar con el servidor. Comprueba que la aplicación está arrancada.",
            "error"
        );
    } finally {
        btnBuscar.disabled    = false;
        btnBuscar.textContent = "Buscar";
    }
}


// ── MENSAJES ──────────────────────────────────────────
function mostrarMensaje(texto, tipo) {
    const div = document.getElementById("mensaje");
    div.textContent = texto;
    div.className   = `mensaje ${tipo}`;
}


// ── RESULTADOS ────────────────────────────────────────
function mostrarResultados(datos) {

    if (!datos || datos.length === 0) return;

    const d = datos[0];

    document.getElementById("rNumOf").textContent       = d.NUM_OF_0       || "-";
    document.getElementById("rEstado").textContent      = d.ESTADO_OF_0    || "-";
    document.getElementById("rFecha").textContent       = d.FECHAINI_OF_0  || "-";
    document.getElementById("rArticulo").textContent    = d.CODART_OF_0    || "-";
    document.getElementById("rDescArticulo").textContent= d.DESART_OF_0    || "-";
    document.getElementById("rEan").textContent         = d.EANART_OF_0    || "-";
    const qtyLanzada = parseFloat(d.QTY_LANZADA_0);
    document.getElementById("rQtyLanzada").textContent  = Number.isFinite(qtyLanzada)
        ? qtyLanzada.toFixed(2)
        : (d.QTY_LANZADA_0 || "-");

    const tbody = document.getElementById("cuerpoTabla");
    tbody.innerHTML = "";

    const qtyLanzadaGeneral = parseFloat(d.QTY_LANZADA_0);

    datos.forEach(function (fila) {
        if (!fila.CODCOMP_OF_0) return;

        const estadoComp = fila.ESTADO_COMP_OF_0 ?? fila.ESTADO_COMP_0 ?? fila.ESTADO_COMP ?? "-";
        const qtyComp = parseFloat(fila.QTYCOMP_OF_0);
        const cantidad = Number.isFinite(qtyComp) && Number.isFinite(qtyLanzadaGeneral) && qtyLanzadaGeneral !== 0
            ? (qtyComp / qtyLanzadaGeneral).toFixed(2)
            : (fila.QTYCOMP_OF_0 || "-");

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="td-cod">${fila.CODCOMP_OF_0}</td>
            <td>${fila.DESCOMP_OF_0 || "-"}</td>
            <td>${estadoComp}</td>
            <td class="td-cant">${cantidad}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById("totalComp").textContent = datos.length;
    document.getElementById("resultados").classList.remove("oculto");
}


// ── ESCÁNER DE CÁMARA ─────────────────────────────────
let scanner = null;

function activarCamara() {
    document.getElementById('zonaScanner').classList.remove('oculto');
    document.getElementById('btnScan').classList.add('oculto');

    scanner = new Html5Qrcode('visorCamara');

    scanner.start(
        { facingMode: 'environment' },   // cámara trasera
        {
            fps: 10,
            qrbox: { width: 250, height: 150 }
        },
        function (codigoLeido) {
            // Código leído correctamente
            document.getElementById('inputOF').value = codigoLeido;
            pararCamara();
            buscarOF();
        },
        function (error) {
            // Errores de "no encontrado todavía", los ignoramos
        }
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