-- Migración: Agregar campos de usuario a charging_schedules
-- Fecha: 2026-01-02
-- Descripción: Agrega user_id, user_name, user_email a la tabla charging_schedules para rastrear quién creó cada programación

ALTER TABLE charging_schedules
ADD COLUMN user_id INT AFTER charger_id,
ADD COLUMN user_name VARCHAR(255) AFTER user_id,
ADD COLUMN user_email VARCHAR(255) AFTER user_name;

-- Agregar clave foránea si la tabla users existe
ALTER TABLE charging_schedules
ADD CONSTRAINT fk_charging_schedules_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Crear índice para consultas frecuentes
ALTER TABLE charging_schedules
ADD INDEX idx_user_id (user_id),
ADD INDEX idx_user_email (user_email);

-- Actualizar registros existentes con user_id = NULL para que queden sin asignar
UPDATE charging_schedules 
SET user_id = NULL, user_name = 'Sin asignar', user_email = NULL 
WHERE user_id IS NULL OR user_id = 0;
