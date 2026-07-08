-- CreateTable
CREATE TABLE `user_registers` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `register_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_registers_user_id_register_id_key`(`user_id`, `register_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_registers` ADD CONSTRAINT `user_registers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_registers` ADD CONSTRAINT `user_registers_register_id_fkey` FOREIGN KEY (`register_id`) REFERENCES `registers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
