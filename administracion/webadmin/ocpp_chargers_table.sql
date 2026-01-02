-- Tabla para almacenar información de los cargadores para la administración OCPP
-- Esta tabla se puede crear en la base de datos devices_db

CREATE TABLE `ocpp_chargers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `device_id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `serial_number` varchar(50) NOT NULL,
  `model` varchar(50) DEFAULT NULL,
  `vendor` varchar(100) DEFAULT NULL,
  `firmware_version` varchar(50) DEFAULT NULL,
  `ocpp_protocol` varchar(20) DEFAULT '1.6',
  `endpoint_url` varchar(255) DEFAULT NULL,
  `status` enum('Available','Preparing','Charging','SuspendedEV','SuspendedEVSE','Finishing','Reserved','Unavailable','Faulted') DEFAULT 'Unavailable',
  `last_heartbeat` datetime DEFAULT NULL,
  `online_status` enum('Online','Offline','Unknown') DEFAULT 'Unknown',
  `connector_count` int(11) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `serial_number` (`serial_number`),
  KEY `device_id` (`device_id`),
  CONSTRAINT `ocpp_chargers_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insertar datos de ejemplo (basados en la estructura de la tabla devices)
-- Estos datos se poblarían automáticamente desde la tabla devices cuando se registra un cargador
INSERT INTO `ocpp_chargers` (`device_id`, `name`, `serial_number`, `model`, `vendor`, `firmware_version`, `endpoint_url`, `status`, `online_status`) VALUES
(1, 'Cargador ABC0001', 'SN001ABC0001', 'Modelo ABC', 'Fabricante XYZ', 'v1.6.2', 'http://cargador001.local:8887', 'Available', 'Online'),
(2, 'Cargador ABC0002', 'SN002ABC0002', 'Modelo ABC', 'Fabricante XYZ', 'v1.6.1', 'http://cargador002.local:8887', 'Charging', 'Online');