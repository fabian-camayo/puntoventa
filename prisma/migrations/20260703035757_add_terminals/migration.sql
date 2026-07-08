-- CreateTable
CREATE TABLE `terminals` (
    `id` CHAR(36) NOT NULL,
    `branch_id` CHAR(36) NOT NULL,
    `register_id` CHAR(36) NULL,
    `device_id` VARCHAR(100) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `ip_address` VARCHAR(64) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_seen_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `terminals_device_id_key`(`device_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `terminals` ADD CONSTRAINT `terminals_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `terminals` ADD CONSTRAINT `terminals_register_id_fkey` FOREIGN KEY (`register_id`) REFERENCES `registers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
