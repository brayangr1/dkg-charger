-- Crear tabla de usuarios administradores
CREATE TABLE `admin_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insertar un usuario administrador de ejemplo (usuario: admin, contraseña: admin123)
-- La contraseña está hasheada usando bcrypt
INSERT INTO `admin_users` (`username`, `password_hash`, `email`) VALUES 
('admin', '$2b$10$rVHFrJ8y34VJxJ9I4A5rUuNnH4QwZ8vB0xP6yK9zR3tN1uM2vO3pO', 'admin@example.com');