-- CreateTable
CREATE TABLE `unit_types` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `unit_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `unit_types` (`id`, `code`, `name`, `description`, `is_active`, `sort_order`, `created_at`, `updated_at`)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'UND', 'Unidad', 'Unidad base de inventario', true, 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000002', 'PZA', 'Pieza', 'Pieza individual', true, 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000003', 'CAJA', 'Caja', 'Caja / empaque. Configure el factor de stock por producto', true, 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000004', 'PK', 'Paquete', 'Paquete. Configure el factor de stock por producto', true, 4, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000005', 'KG', 'Kilogramo', 'Peso en kilogramos', true, 5, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

CREATE TABLE `product_units` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `unit_type_id` CHAR(36) NOT NULL,
    `stock_factor` DECIMAL(12, 4) NOT NULL DEFAULT 1,
    `is_base` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_units_product_id_unit_type_id_key`(`product_id`, `unit_type_id`),
    INDEX `product_units_unit_type_id_idx`(`unit_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `product_units`
  ADD CONSTRAINT `product_units_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `product_units`
  ADD CONSTRAINT `product_units_unit_type_id_fkey`
  FOREIGN KEY (`unit_type_id`) REFERENCES `unit_types`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed base unit for existing products (match product.unit code when possible)
INSERT INTO `product_units` (`id`, `product_id`, `unit_type_id`, `stock_factor`, `is_base`, `is_active`, `created_at`, `updated_at`)
SELECT
  UUID(),
  p.`id`,
  COALESCE(
    (SELECT ut.`id` FROM `unit_types` ut WHERE ut.`code` = p.`unit` LIMIT 1),
    '10000000-0000-4000-8000-000000000001'
  ),
  1,
  true,
  true,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `products` p
WHERE NOT EXISTS (
  SELECT 1 FROM `product_units` pu WHERE pu.`product_id` = p.`id` AND pu.`is_base` = true
);

ALTER TABLE `sale_items`
  ADD COLUMN `unit_type_id` CHAR(36) NULL,
  ADD COLUMN `stock_factor` DECIMAL(12, 4) NOT NULL DEFAULT 1;

ALTER TABLE `sale_items`
  ADD CONSTRAINT `sale_items_unit_type_id_fkey`
  FOREIGN KEY (`unit_type_id`) REFERENCES `unit_types`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `purchase_items`
  ADD COLUMN `unit_type_id` CHAR(36) NULL,
  ADD COLUMN `stock_factor` DECIMAL(12, 4) NOT NULL DEFAULT 1;

ALTER TABLE `purchase_items`
  ADD CONSTRAINT `purchase_items_unit_type_id_fkey`
  FOREIGN KEY (`unit_type_id`) REFERENCES `unit_types`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
