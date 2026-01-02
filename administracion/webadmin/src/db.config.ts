// Definir el tipo para process.env
declare const process: {
  env: {
    [key: string]: string | undefined;
  };
};

// Configuración de la base de datos para la aplicación administrativa
// Esta configuración es solo para el entorno de desarrollo local
// En producción, estas variables deberían estar en variables de entorno

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'devices_db',
  port: parseInt(process.env.DB_PORT || '3306'),
};

export default dbConfig;