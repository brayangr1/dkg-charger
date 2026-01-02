
import { connectionPool } from './config/db.config';

async function migrate() {
    console.log('Iniciando migración de base de datos...');
    try {
        // Add ip_address column
        try {
            await connectionPool.query("ALTER TABLE chargers ADD COLUMN ip_address VARCHAR(45) NULL");
            console.log('✅ Columna ip_address agregada.');
        } catch (e: any) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ Columna ip_address ya existe.');
            } else {
                console.error('❌ Error agregando ip_address:', e.message);
            }
        }

        // Add connection_type column
        try {
            await connectionPool.query("ALTER TABLE chargers ADD COLUMN connection_type VARCHAR(50) NULL");
            console.log('✅ Columna connection_type agregada.');
        } catch (e: any) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ Columna connection_type ya existe.');
            } else {
                console.error('❌ Error agregando connection_type:', e.message);
            }
        }

        // Add error_code column
        try {
            await connectionPool.query("ALTER TABLE chargers ADD COLUMN error_code VARCHAR(50) NULL DEFAULT 'NoError'");
            console.log('✅ Columna error_code agregada.');
        } catch (e: any) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ Columna error_code ya existe.');
            } else {
                console.error('❌ Error agregando error_code:', e.message);
            }
        }

        console.log('🏁 Migración completada.');
        process.exit(0);
    } catch (error) {
        console.error('💥 Error fatal en migración:', error);
        process.exit(1);
    }
}

migrate();
