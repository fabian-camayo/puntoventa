-- CreateTable
CREATE TABLE `payment_types` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `affects_cash` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed default payment types
INSERT INTO `payment_types` (`id`, `code`, `name`, `affects_cash`, `is_active`, `sort_order`, `created_at`, `updated_at`)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'CASH', 'Efectivo', true, true, 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('00000000-0000-4000-8000-000000000002', 'CARD', 'Tarjeta', false, true, 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('00000000-0000-4000-8000-000000000003', 'TRANSFER', 'Transferencia', false, true, 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- AlterTable sale_payments: add payment_type_id
ALTER TABLE `sale_payments` ADD COLUMN `payment_type_id` CHAR(36) NULL;

-- Migrate existing payments by method enum
UPDATE `sale_payments` sp
SET `payment_type_id` = CASE sp.`method`
  WHEN 'CASH' THEN '00000000-0000-4000-8000-000000000001'
  WHEN 'CARD' THEN '00000000-0000-4000-8000-000000000002'
  WHEN 'TRANSFER' THEN '00000000-0000-4000-8000-000000000003'
  ELSE '00000000-0000-4000-8000-000000000001'
END;

-- Ensure no nulls remain
UPDATE `sale_payments`
SET `payment_type_id` = '00000000-0000-4000-8000-000000000001'
WHERE `payment_type_id` IS NULL;

ALTER TABLE `sale_payments` MODIFY COLUMN `payment_type_id` CHAR(36) NOT NULL;

-- Drop legacy method column
ALTER TABLE `sale_payments` DROP COLUMN `method`;

-- AddForeignKey
ALTER TABLE `sale_payments`
  ADD CONSTRAINT `sale_payments_payment_type_id_fkey`
  FOREIGN KEY (`payment_type_id`) REFERENCES `payment_types`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX `sale_payments_payment_type_id_idx` ON `sale_payments`(`payment_type_id`);
