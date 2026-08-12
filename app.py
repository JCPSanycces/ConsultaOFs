# app.py - Servidor principal de la app Flask
# Este archivo arranca la app web y gestiona las consultas a Sage X3

from flask import Flask, render_template, request, jsonify
import pyodbc
import config
from datetime import datetime

# Crear la app Flask
app = Flask(__name__)

# Función para conectar a SQL Server
def get_connection():
    """
    Abre una conexión a SQL Server y la devuelve.
    """
    cadena = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={config.SQL_SERVER}\\{config.SQL_INSTANCE};"
        f"DATABASE={config.SQL_DATABASE};"
        f"UID={config.SQL_USER};"
        f"PWD={config.SQL_PASSWORD};"
        "TrustServerCertificate=yes;"
    )

    return pyodbc.connect(cadena, timeout=10)

# Prefijo para las consultas SQL: nombrebbdd.nombreesquema
DB = f"{config.SQL_DATABASE}.{config.SQL_SCHEMA}"

# Página principal
@app.route("/")
def index():
    """
    Muestra la página principal de la app.
    """
    return render_template("index.html")

# Endpoint de búsqueda de OF
@app.route("/buscar", methods=["POST"])
def buscar_of():
    """
    Recibe el número de OF, consulta SQL Server y devuelve los datos.
    """

    # Recoger el número de OF enviado desde la página
    num_of = request.json.get("num_of", "").strip().upper()

    if not num_of:
        return jsonify({
            "error": "Debes introducir un número de OF"
        }), 400

    try:
        conn = get_connection()
        cursor = conn.cursor()

        # La consulta usa la vista creada en SQL Server
        sql = "SELECT * FROM " + DB + ".ZVOFCONSULTA WHERE NUM_OF_0 = ?"
        cursor.execute(sql, num_of)

        # Convertir los resultados a una lista de diccionarios
        columnas = [col[0] for col in cursor.description]
        filas = [
            dict(zip(columnas, fila))
            for fila in cursor.fetchall()
        ]

        cursor.close()
        conn.close()

        if not filas:
            return jsonify({
                "error": "OF no encontrada, no está en estado En Curso o no tiene componentes imprimibles"
            }), 404

        # Convertir fechas a texto para que JSON las entienda
        for fila in filas:
            for clave, valor in fila.items():
                if hasattr(valor, "strftime"):
                    fila[clave] = valor.strftime("%d/%m/%Y")
                elif isinstance(valor, bytes):
                    fila[clave] = valor.hex()
                elif valor is None:
                    fila[clave] = ""

        return jsonify({
            "datos": filas,
            "total": len(filas)
        })

    except pyodbc.Error as e:
        return jsonify({
            "error": f"Error de base de datos: {str(e)}"
        }), 500

    except Exception as e:
        return jsonify({
            "error": f"Error inesperado: {str(e)}"
        }), 500

# Endpoint para actualizar el número de veces que se ha leído correctamente una OF
@app.route('/completar', methods=['POST'])
def completar_of():
    """Incrementa en 1 el campo ZNUMLECAPP de la OF completada."""
    num_of = request.json.get('num_of', '').strip().upper()

    if not num_of:
        return jsonify({'error': 'Numero de OF no proporcionado'}), 400

    try:
        conn   = get_connection()
        cursor = conn.cursor()

        sql = "UPDATE " + DB + ".MFGITM SET ZNUMLECAPP_0 = ISNULL(ZNUMLECAPP_0, 0) + 1 WHERE MFGNUM_0 = ?"
        cursor.execute(sql, num_of)

        if cursor.rowcount == 0:
            conn.rollback()
            cursor.close()
            conn.close()
            return jsonify({'error': 'OF no encontrada en la tabla de artículos lanzados'}), 404

        # Si la OF no lleva serie, y ya ha llegado a la cantidad lanzada,
        # marcar el registro en ZAPPVALIDAOF como procesado = 2
        sql_qty = "SELECT UOMEXTQTY_0, ZNUMLECAPP_0 FROM " + DB + ".MFGITM WHERE MFGNUM_0 = ?"
        cursor.execute(sql_qty, num_of)
        fila_qty = cursor.fetchone()

        if fila_qty:
            qty_lanzada = fila_qty[0] if fila_qty[0] is not None else 0
            num_lec_app = fila_qty[1] if fila_qty[1] is not None else 0

            if num_lec_app >= qty_lanzada:
                sql_proc = "UPDATE " + DB + ".ZAPPVALIDAOF SET ZPROCESADO_0 = 2 WHERE MFGNUM_0 = ? AND ISNULL(NSERIE_0, '') = ''"
                cursor.execute(sql_proc, num_of)

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'ok': True, 'num_of': num_of})

    except pyodbc.Error as e:
        return jsonify({'error': f'Error de base de datos: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Error inesperado: {str(e)}'}), 500

# Endpoint para registrar una OF validada en la tabla ZAPPVALIDAOF
@app.route('/registrar', methods=['POST'])
def registrar_validacion():
    """Guarda el registro de OF validada en ZAPPVALIDAOF."""
    num_of    = request.json.get('num_of',    '').strip().upper()
    num_serie = request.json.get('num_serie', '').strip().upper()
    correo    = request.json.get('correo',    '').strip().lower()
    linea     = str(request.json.get('linea', '') or '').strip()
    articulo  = request.json.get('articulo',  '').strip().upper()
    ahora     = datetime.now()
    fecha_hoy = ahora.strftime('%d/%m/%Y')
    hora_hoy  = ahora.strftime('%H:%M:%S')

    print(f'[REGISTRAR] num_of={num_of}, num_serie={num_serie}, correo={correo}, linea={linea}')

    if not num_of:
        return jsonify({'error': 'Numero de OF no proporcionado'}), 400

    try:
        conn   = get_connection()
        cursor = conn.cursor()

        # Determinar si la OF lleva serie o no
        lleva_serie = bool(num_serie)

        if lleva_serie:
            # OF con serie: se controla duplicado por MFGNUM_0 + NSERIE_0
            sql_check = (
                "SELECT COUNT(*) "
                "FROM " + DB + ".ZAPPVALIDAOF "
                "WHERE MFGNUM_0 = ? AND NSERIE_0 = ?"
            )
            cursor.execute(sql_check, num_of, num_serie)
            existe = cursor.fetchone()[0]

            if existe > 0:
                cursor.close()
                conn.close()
                return jsonify({'error': 'Esta OF y serie ya están registradas'}), 409

            zprocesado = 2

        else:
            # OF sin serie: permitir una única inserción y usar ZPROCESADO_0 = 1
            sql_check = (
                "SELECT COUNT(*) "
                "FROM " + DB + ".ZAPPVALIDAOF "
                "WHERE MFGNUM_0 = ? AND ISNULL(NSERIE_0, '') = ''"
            )
            cursor.execute(sql_check, num_of)
            existe = cursor.fetchone()[0]

            zprocesado = 1

            # Si ya existe, no volvemos a insertar otra vez
            if existe > 0:
                conn.commit()
                cursor.close()
                conn.close()
                return jsonify({
                    'ok': True,
                    'num_of': num_of,
                    'num_serie': num_serie,
                    'correo': correo,
                    'linea': linea,
                    'zprocesado': zprocesado,
                    'mensaje': 'Registro ya existente para OF sin serie'
                })

        sql = (
                "INSERT INTO " + DB + ".ZAPPVALIDAOF "
                "(MFGNUM_0, MFGLIN_0, ITMREF_0, NSERIE_0, ZPROCESADO_0, CREDATTIM_0, UPDDATTIM_0, "
                "AUUID_0, CREUSR_0, UPDUSR_0, ZCORREOUSER_0, ZFECHACREA_0, ZHORACREA_0) "
                "VALUES (?, ?, ?, ?, ?, GETDATE(), GETDATE(), "
                "CONVERT(binary(16), NEWID()), 'ADMIN', 'ADMIN', ?, ?, ?)"
        )
        cursor.execute(sql, num_of, linea, articulo, num_serie, zprocesado, correo, fecha_hoy, hora_hoy)

        conn.commit()
        cursor.close()
        conn.close()

        print(f'[REGISTRAR] Registro insertado correctamente')
        return jsonify({
            'ok':        True,
            'num_of':    num_of,
            'num_serie': num_serie,
            'correo':    correo,
            'linea':     linea,
            'zprocesado': zprocesado
        })

    except pyodbc.Error as e:
        print(f'[REGISTRAR] Error pyodbc: {str(e)}')
        return jsonify({'error': f'Error de base de datos: {str(e)}'}), 500
    except Exception as e:
        print(f'[REGISTRAR] Error inesperado: {str(e)}')
        return jsonify({'error': f'Error inesperado: {str(e)}'}), 500

# Endpoint para comprobar si una OF tiene numeros de serie
@app.route('/series', methods=['POST'])
def comprobar_series():
    """Comprueba si una OF tiene numeros de serie en YMFGSERIE."""
    num_of = request.json.get('num_of', '').strip().upper()

    if not num_of:
        return jsonify({'error': 'Numero de OF no proporcionado'}), 400

    try:
        conn   = get_connection()
        cursor = conn.cursor()

        sql = "SELECT * FROM " + DB + ".YMFGSERIE WHERE MFGNUM_0 = ?"
        cursor.execute(sql, num_of)

        columnas = [col[0] for col in cursor.description]
        filas    = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]

        cursor.close()
        conn.close()

        for fila in filas:
            for clave, valor in fila.items():
                if hasattr(valor, "strftime"):
                    fila[clave] = valor.strftime("%d/%m/%Y")
                elif isinstance(valor, bytes):
                    fila[clave] = valor.hex()
                elif valor is None:
                    fila[clave] = ""

        return jsonify({
            'tiene_series': len(filas) > 0,
            'total':        len(filas),
            'series':       filas
        })

    except pyodbc.Error as e:
        return jsonify({'error': f'Error de base de datos: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Error inesperado: {str(e)}'}), 500

# Endpoint para validar si un numero de serie existe en YMFGSERIE
@app.route('/validar-serie', methods=['POST'])
def validar_serie():
    """Comprueba si un numero de serie existe en YMFGSERIE."""
    num_serie = request.json.get('num_serie', '').strip()

    if not num_serie:
        return jsonify({'error': 'Numero de serie no proporcionado'}), 400

    try:
        conn   = get_connection()
        cursor = conn.cursor()

        sql = "SELECT * FROM " + DB + ".YMFGSERIE WHERE NSERIE_0 = ?"
        cursor.execute(sql, num_serie)

        columnas = [col[0] for col in cursor.description]
        filas    = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]

        cursor.close()
        conn.close()

        for fila in filas:
            for clave, valor in fila.items():
                if hasattr(valor, "strftime"):
                    fila[clave] = valor.strftime("%d/%m/%Y")
                elif isinstance(valor, bytes):
                    fila[clave] = valor.hex()
                elif valor is None:
                    fila[clave] = ""

        return jsonify({
            'existe': len(filas) > 0,
            'serie':  filas[0] if filas else None
        })

    except pyodbc.Error as e:
        return jsonify({'error': f'Error de base de datos: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Error inesperado: {str(e)}'}), 500

# Endpoint para comprobar si un numero de serie ya fue registrado en ZAPPVALIDAOF
@app.route('/serie-ya-leida', methods=['POST'])
def serie_ya_leida():
    """Comprueba si el número de serie ya existe en ZAPPVALIDAOF."""
    num_serie = request.json.get('num_serie', '').strip().upper()

    if not num_serie:
        return jsonify({'error': 'Numero de serie no proporcionado'}), 400

    try:
        conn = get_connection()
        cursor = conn.cursor()

        # OJO: ajusta el nombre exacto del campo si en tu tabla es distinto.
        sql = "SELECT COUNT(*) AS CNT FROM " + DB + ".ZAPPVALIDAOF WHERE NSERIE_0 = ?"
        cursor.execute(sql, num_serie)
        row = cursor.fetchone()

        cursor.close()
        conn.close()

        cnt = row[0] if row else 0
        return jsonify({'existe': cnt > 0, 'total': cnt})

    except pyodbc.Error as e:
        return jsonify({'error': f'Error de base de datos: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Error inesperado: {str(e)}'}), 500

# Endpoint para imprimir una etiqueta al finalizar el escaneo de todos los componentes de la OF
@app.route('/imprimir', methods=['POST'])
def imprimir_etiqueta():
    """Envía etiqueta ZPL a las dos impresoras por TCP."""
    import socket

    num_of   = request.json.get('num_of', '').strip().upper()
    if not num_of:
        return jsonify({'error': 'Numero de OF no proporcionado'}), 400

    ahora     = datetime.now()
    mascara   = ahora.strftime('%S%M%H%y%m%d')  # ssmmHHYYMMDD

    # ── Etiqueta ZPL ZEBRA ───────────────────────────────────────────
    # Ajusta ^LL (altura etiqueta) y ^PW (ancho) segun el tamaño
    # de tus etiquetas. Los valores son en dots a 203dpi.
    # ^LL203 = etiqueta de 1 pulgada de alto (25mm)
    # ^PW609 = etiqueta de 3 pulgadas de ancho (76mm)
    zpl_zebra = (
        "^XA"
        "^CI28"
        "^PW812"
        "^LL482"
        "^MMT"
        "^MNM"

        # ── Numero de OF centrado ────────────────────────────
        "^FO0,20"
        "^FB812,1,0,C,0"                   # FB = field block, ancho 812, centrado
        "^A0N,35,35"
        "^FDOrden de Fabricacion:^FS"

        "^FO0,60"
        "^FB812,1,0,C,0"
        "^A0N,50,50"
        f"^FD{num_of}^FS"

        # ── Linea separadora superior ────────────────────────
        "^FO30,122"
        "^GB752,2,2^FS"

        # ── Centro izquierda: Control de calidad ─────────────
        "^FO30,140"
        "^A0N,38,38"
        "^FDControl de calidad.^FS"

        "^FO30,188"
        "^A0N,38,38"
        "^FDLectura correcta^FS"

        # ── Centro derecha: fecha enmascarada ─────────────────
        # ^FB con alineacion derecha (R) para justificar a la derecha
        "^FO0,140"
        "^FB782,1,0,R,0"
        "^A0N,30,30"
        f"^FD{mascara}^FS"

        # ── Linea separadora inferior ────────────────────────
        "^FO30,242"
        "^GB752,2,2^FS"

        # ── Codigo de barras centrado y mas grande ────────────
        "^FO156,258"
        "^BY3,3,100"
        "^BCN,100,Y,N,N"
        f"^FD{num_of}^FS"

        "^XZ"
    )

    # ── Etiqueta ZPL GODEX ───────────────────────────────────────────
    # Ajustada para Godex G500 (coordenadas y tamaños algo más conservadores)
    zpl_godex = (
        "^XA"
        "^CI28"
        "^PW812"
        "^LL482"
        "^MMT"
        "^MNM"

        # ── Numero de OF centrado ────────────────────────────
        "^FO0,24"
        "^FB812,1,0,C,0"
        "^A0N,32,32"
        "^FDOrden de Fabricacion:^FS"

        "^FO0,64"
        "^FB812,1,0,C,0"
        "^A0N,46,46"
        f"^FD{num_of}^FS"

        # ── Linea separadora superior ────────────────────────
        "^FO28,124"
        "^GB756,2,2^FS"

        # ── Centro izquierda: Control de calidad ─────────────
        "^FO30,142"
        "^A0N,34,34"
        "^FDControl de calidad.^FS"

        "^FO30,184"
        "^A0N,34,34"
        "^FDLectura correcta^FS"

        # ── Centro derecha: fecha enmascarada ─────────────────
        "^FO0,142"
        "^FB782,1,0,R,0"
        "^A0N,28,28"
        f"^FD{mascara}^FS"

        # ── Linea separadora inferior ────────────────────────
        "^FO28,238"
        "^GB756,2,2^FS"

        # ── Codigo de barras centrado y mas grande ────────────
        "^FO150,256"
        "^BY2,3,92"
        "^BCN,92,Y,N,N"
        f"^FD{num_of}^FS"

        "^XZ"
    )

    # Seleccionar plantilla y impresora según config
    if config.IMPRESORA_ACTIVA == 'ZEBRA':
        zpl = zpl_zebra
    elif config.IMPRESORA_ACTIVA == 'GODEX':
        zpl = zpl_godex
    else:
        return jsonify({'error': 'IMPRESORA_ACTIVA no configurada correctamente'}), 500

    zpl_bytes = zpl.encode('utf-8')

    impresora = config.IMPRESORAS[config.IMPRESORA_ACTIVA]
    impresoras = [impresora]

    errores = []

    for imp in impresoras:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            sock.connect((imp['ip'], imp['puerto']))
            sock.sendall(zpl_bytes)
            sock.close()
        except Exception as e:
            errores.append(f"{imp['nombre']} ({imp['ip']}): {str(e)}")

    if errores:
        return jsonify({
            'ok':     False,
            'avisos': errores
        }), 207  # 207 = exito parcial

    return jsonify({'ok': True})


# Arrancar la app
if __name__ == '__main__':
    print('Arrancando app OF Sage X3...')
    print(f'Abre en el navegador: http://localhost:{config.FLASK_PORT}')
    print(f'Movil: http://192.168.1.44:{config.FLASK_PORT}')
    app.run(
        host=config.FLASK_HOST,
        port=config.FLASK_PORT,
        debug=config.FLASK_DEBUG
    )
