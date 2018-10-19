
Get started
---
Install MySQL 
---
Create stored procedure get_core_parameters 
--
```
 SET NAMES utf8;
 SET time_zone = '+00:00';
 SET foreign_key_checks = 0;
 SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

 DELIMITER ;;

 DROP PROCEDURE IF EXISTS `get_core_parameters`;;
 CREATE PROCEDURE `get_core_parameters`(IN is_proc_name varchar(128), IN is_db_name varchar(64))
 BEGIN
 SELECT a.param_list, a.db
 FROM mysql.proc a
 WHERE a.name = is_proc_name COLLATE utf8_czech_ci
 AND a.db = is_db_name COLLATE utf8_czech_ci
 LIMIT 1;
 END;;
```
Install Redis 
---

