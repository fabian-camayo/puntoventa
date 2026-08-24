-- Permite crear terminales manualmente (por IP) antes de que un navegador
-- se conecte desde ese equipo y reporte su device_id (token de localStorage).
ALTER TABLE `terminals` MODIFY `device_id` VARCHAR(100) NULL;
