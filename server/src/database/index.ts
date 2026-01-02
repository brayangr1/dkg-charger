import mysql, { RowDataPacket, OkPacket, ResultSetHeader } from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'appdkg', // Ajusta según tu configuración
  password: 'Dkg010203', // Ajusta según tu configuración
  database: 'charger_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

type QueryResult<T> = T extends RowDataPacket ? T[] : OkPacket | ResultSetHeader;

export const db = {
  async query<T extends RowDataPacket | OkPacket | ResultSetHeader>(
    sql: string, 
    params?: any[]
  ): Promise<[QueryResult<T>, any]> {
    try {
      const [results, fields] = await pool.execute<QueryResult<T>>(sql, params);
      return [results, fields];
    } catch (error) {
      console.error('Error en la consulta SQL:', error);
      throw error;
    }
  }
};
