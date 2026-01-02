-- Tabla mejorada para almacenar información de cargadores OCPP
CREATE TABLE `ocpp_chargers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `device_id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `serial_number` varchar(50) NOT NULL,
  `model` varchar(50) DEFAULT NULL,
  `vendor` varchar(100) DEFAULT NULL,
  `firmware_version` varchar(50) DEFAULT NULL,
  `ocpp_protocol` varchar(20) DEFAULT '1.6',
  `central_system_url` varchar(255) DEFAULT 'wss://app.es:8887',
  `endpoint_url` varchar(255) DEFAULT NULL,
  `status` enum('Available','Preparing','Charging','SuspendedEV','SuspendedEVSE','Finishing','Reserved','Unavailable','Faulted') DEFAULT 'Unavailable',
  `online_status` enum('Online','Offline','Unknown') DEFAULT 'Unknown',
  `last_heartbeat` datetime DEFAULT NULL,
  `last_boot_notification` datetime DEFAULT NULL,
  `error_code` varchar(50) DEFAULT NULL,
  `error_info` text DEFAULT NULL,
  `heartbeat_interval` int(11) DEFAULT 300,
  `meter_value_sample_interval` int(11) DEFAULT 60,
  `connector_count` int(11) DEFAULT 1,
  `auth_key` varchar(255) DEFAULT NULL,
  `certificate_status` varchar(50) DEFAULT NULL,
  `security_profile` int(11) DEFAULT NULL,
  `connection_timeout` int(11) DEFAULT 30,
  `vendor_error_code` varchar(50) DEFAULT NULL,
  `usage_type` enum('payment','home') DEFAULT 'payment',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `serial_number` (`serial_number`),
  KEY `device_id` (`device_id`),
  CONSTRAINT `ocpp_chargers_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla para almacenar las transacciones OCPP
CREATE TABLE `ocpp_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `charger_id` int(11) NOT NULL,
  `connector_id` int(11) DEFAULT 1,
  `transaction_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `start_time` datetime DEFAULT NULL,
  `start_value` int(11) DEFAULT NULL,
  `stop_time` datetime DEFAULT NULL,
  `stop_value` int(11) DEFAULT NULL,
  `reservation_id` int(11) DEFAULT NULL,
  `reason` varchar(50) DEFAULT NULL,
  `status` enum('Running','Completed','Aborted') DEFAULT 'Running',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `charger_id` (`charger_id`),
  CONSTRAINT `ocpp_transactions_ibfk_1` FOREIGN KEY (`charger_id`) REFERENCES `ocpp_chargers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla para almacenar el estado de los conectores
CREATE TABLE `ocpp_connector_status` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `charger_id` int(11) NOT NULL,
  `connector_id` int(11) NOT NULL,
  `status` enum('Available','Preparing','Charging','SuspendedEV','SuspendedEVSE','Finishing','Reserved','Unavailable','Faulted') DEFAULT 'Unavailable',
  `error_code` varchar(50) DEFAULT NULL,
  `info` varchar(50) DEFAULT NULL,
  `vendor_id` varchar(255) DEFAULT NULL,
  `vendor_error_code` varchar(50) DEFAULT NULL,
  `timestamp` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `charger_id` (`charger_id`),
  CONSTRAINT `ocpp_connector_status_ibfk_1` FOREIGN KEY (`charger_id`) REFERENCES `ocpp_chargers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Datos de ejemplo para pruebas
INSERT INTO `ocpp_chargers` (`device_id`, `name`, `serial_number`, `model`, `vendor`, `firmware_version`, `status`, `online_status`) VALUES
(1, 'Cargador ABC0001', 'SN001ABC0001', 'Modelo ABC', 'Fabricante XYZ', 'v1.6.2', 'Available', 'Online'),
(2, 'Cargador ABC0002', 'SN002ABC0002', 'Modelo ABC', 'Fabricante XYZ', 'v1.6.1', 'Charging', 'Online');






 1. Tabla ocpp_chargers
Esta tabla almacena la información principal de los cargadores OCPP:

Identificación única del cargador
Relación con la tabla devices
Información del modelo, fabricante y firmware
Estado actual del cargador
Información de conectividad
Parámetros de configuración OCPP

2. Tabla ocpp_transactions
Esta tabla registra las transacciones de carga:

Información de cada sesión de carga
Datos de inicio y finalización
Asociación con usuarios cuando corresponda
Estado de la transacción

3. Tabla ocpp_connector_status
Esta tabla almacena el estado de los conectores:

Estado individual de cada conector
Información de errores específicos
Datos del fabricante