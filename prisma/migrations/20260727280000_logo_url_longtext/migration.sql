-- Logo en base64 supera TEXT (65KB); LONGTEXT permite hasta ~4GB
ALTER TABLE `business_config` MODIFY COLUMN `logo_url` LONGTEXT NULL;
