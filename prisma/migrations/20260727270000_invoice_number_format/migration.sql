-- Numeración configurable de facturas de venta (ej. FEV001, FEV002)
ALTER TABLE `business_config`
  ADD COLUMN `invoice_prefix` VARCHAR(20) NOT NULL DEFAULT 'FEV' AFTER `ticket_footer`,
  ADD COLUMN `invoice_number_padding` INT NOT NULL DEFAULT 3 AFTER `invoice_prefix`,
  ADD COLUMN `invoice_next_number` INT NOT NULL DEFAULT 1 AFTER `invoice_number_padding`;
