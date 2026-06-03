# app.py - Servidor principal de la app Flask
# Este archivo arranca la app web y gestiona las consultas a Sage X3

from flask import Flask, render_template, request, jsonify
import pyodbc
import config

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
        cursor.execute(
            """
            SELECT *
            FROM SANYCCES.ZVOFCONSULTA
            WHERE NUM_OF_0 = ?
            """,
            num_of
        )

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