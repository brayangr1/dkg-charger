-- Add usage_type column to chargers table
ALTER TABLE `chargers` 
ADD COLUMN `usage_type` enum('payment','home') DEFAULT 'payment' AFTER `network_status`;