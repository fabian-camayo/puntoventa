-- Moneda predeterminada: peso colombiano (COP)
ALTER TABLE `business_config`
  MODIFY `currency` VARCHAR(3) NOT NULL DEFAULT 'COP';

UPDATE `business_config`
SET `currency` = 'COP'
WHERE `currency` = 'MXN';
