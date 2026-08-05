-- CreateTable
CREATE TABLE `bank_accounts` (
    `id` CHAR(36) NOT NULL,
    `branch_id` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `bank_name` VARCHAR(150) NULL,
    `account_number` VARCHAR(50) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_accounts_branch_id_code_key`(`branch_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `purchases`
    ADD COLUMN `payment_term` ENUM('CASH', 'CREDIT') NOT NULL DEFAULT 'CASH',
    ADD COLUMN `fund_source` ENUM('REGISTER', 'BANK_ACCOUNT') NULL,
    ADD COLUMN `bank_account_id` CHAR(36) NULL,
    ADD COLUMN `register_id` CHAR(36) NULL,
    ADD COLUMN `reduce_cash` BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_register_id_fkey` FOREIGN KEY (`register_id`) REFERENCES `registers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
