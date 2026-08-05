-- AlterTable
ALTER TABLE `purchases` ADD COLUMN `purchase_date` DATE NULL;

UPDATE `purchases` SET `purchase_date` = DATE(`created_at`) WHERE `purchase_date` IS NULL;

ALTER TABLE `purchases` MODIFY COLUMN `purchase_date` DATE NOT NULL;
