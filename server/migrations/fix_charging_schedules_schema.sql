-- Versión mínima: Solo añade status para control de ejecución
-- Evita enviar comandos duplicados en el mismo minuto

ALTER TABLE charging_schedules
ADD COLUMN status ENUM('pending', 'active', 'completed', 'failed') DEFAULT 'pending' AFTER week_days;

-- Inicializar registros
UPDATE charging_schedules SET status = 'pending';
