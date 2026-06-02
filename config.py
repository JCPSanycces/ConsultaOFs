# config.py - Datos de conexion a SQL Server
SQL_SERVER = '172.17.0.10' # IP del servidor SQL Server 
SQL_INSTANCE = 'SAGEX3' # Nombre de la instancia 
SQL_DATABASE = 'x3prd' # Nombre de la base de datos 
SQL_USER = 'sa' # Usuario de SQL Server 
SQL_PASSWORD = 'X3_Polif.2021' # Contraseña 
# Puerto donde escuchara la app Flask 
# 0.0.0.0 significa que acepta conexiones de CUALQUIER dispositivo de la red
FLASK_HOST = '0.0.0.0' 
FLASK_PORT = 5000 
FLASK_DEBUG = False # Cambia a True si necesitas ver errores detallados