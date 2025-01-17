SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

DELIMITER ;;

DROP PROCEDURE IF EXISTS `add_regulator_element_all`;;
CREATE PROCEDURE `add_regulator_element_all`(IN `inl_id_regulator` int(11) unsigned, IN `inl_id_paramset` int(11) unsigned)
BEGIN

  DECLARE _nl_id_paramset INT;

  IF inl_id_paramset IS NULL THEN
    SELECT nl_id_paramset
    INTO _nl_id_paramset
    FROM regulator
    WHERE nl_id = inl_id_regulator
    ;
  ELSE
    SELECT inl_id_paramset INTO _nl_id_paramset;
  END IF;

  INSERT INTO regulator_element (nl_id_regulator, nl_id_element)
  SELECT inl_id_regulator, nl_id
  FROM element
  WHERE nl_id_paramset = _nl_id_paramset
  ;


END;;
