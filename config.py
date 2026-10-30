# *********VERSIÓN 2.0 - 03/06/2026*********

# config.py - Configuración leída de variables de entorno
# Los valores reales se definen en el fichero .env (no versionado)
# o como variables de entorno del sistema.

import os
from pathlib import Path

RUTA_ENV = Path(__file__).with_name(".env")


def _cargar_env(ruta):
    """Carga el .env: usa python-dotenv si está instalado y, si no, un lector simple."""
    if not ruta.exists():
        return

    try:
        from dotenv import load_dotenv
        load_dotenv(ruta)
        return
    except ImportError:
        pass

    for linea in ruta.read_text(encoding="utf-8-sig").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, valor = linea.split("=", 1)
        os.environ.setdefault(clave.strip(), valor.strip().strip("'\""))


_cargar_env(RUTA_ENV)


def _obligatoria(nombre):
    """Devuelve la variable de entorno o falla con un mensaje claro."""
    valor = (os.getenv(nombre) or "").strip()
    if not valor:
        raise RuntimeError(
            f"Falta la variable de entorno {nombre}. "
            "Defínela en el fichero .env junto a config.py o en el sistema."
        )
    return valor


# Datos de conexión a SQL Server
SQL_SERVER = _obligatoria("SQL_SERVER")          # IP del servidor SQL Server
SQL_INSTANCE = os.getenv("SQL_INSTANCE", "SAGEX3")  # Nombre de la instancia
SQL_DATABASE = os.getenv("SQL_DATABASE", "x3prd")   # Nombre de la base de datos
SQL_SCHEMA = os.getenv("SQL_SCHEMA", "SANYCCES")    # Nombre del esquema
SQL_USER = _obligatoria("SQL_USER")              # Usuario de SQL Server
SQL_PASSWORD = _obligatoria("SQL_PASSWORD")      # Contraseña

# Flask
# 0.0.0.0 significa que acepta conexiones de CUALQUIER dispositivo de la red
FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))
FLASK_DEBUG = os.getenv("FLASK_DEBUG", "0").lower() in ("1", "true", "yes")

# Configuración de la impresora (IMPRESORA_ACTIVA = 'ZEBRA' o 'GODEX')
IMPRESORA_ACTIVA = os.getenv("IMPRESORA_ACTIVA", "GODEX")
IMPRESORAS = {
    "ZEBRA": {
        "nombre": "Zebra ZT230",
        "ip": "192.168.1.81",
        "puerto": 9100,
    },
    "GODEX": {
        "nombre": "Godex G500",
        "ip": "192.168.1.87",
        "puerto": 9100,
    },
}
