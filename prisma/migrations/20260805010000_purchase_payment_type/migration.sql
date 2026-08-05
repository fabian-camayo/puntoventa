-- AlterTable: add payment_type_id
ALTER TABLE `purchases` ADD COLUMN `payment_type_id` CHAR(36) NULL;

-- Backfill REGISTER -> CASH payment type
UPDATE `purchases` p
SET p.`payment_type_id` = (
  SELECT pt.`id` FROM `payment_types` pt WHERE pt.`code` = 'CASH' LIMIT 1
)
WHERE p.`fund_source` = 'REGISTER';

-- Backfill BANK_ACCOUNT -> TRANSFER (fallback CARD)
UPDATE `purchases` p
SET p.`payment_type_id` = COALESCE(
  (SELECT pt.`id` FROM `payment_types` pt WHERE pt.`code` = 'TRANSFER' LIMIT 1),
  (SELECT pt.`id` FROM `payment_types` pt WHERE pt.`code` = 'CARD' LIMIT 1)
)
WHERE p.`fund_source` = 'BANK_ACCOUNT';

-- Credit purchases have no payment type
UPDATE `purchases`
SET `payment_type_id` = NULL
WHERE `payment_term` = 'CREDIT';

-- AddForeignKey
ALTER TABLE `purchases`
  ADD CONSTRAINT `purchases_payment_type_id_fkey`
  FOREIGN KEY (`payment_type_id`) REFERENCES `payment_types`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop fund_source column (MySQL enum is column-scoped)
ALTER TABLE `purchases` DROP COLUMN `fund_source`;
