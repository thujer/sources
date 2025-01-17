DROP PROCEDURE IF EXISTS `get_regulator`;;
CREATE PROCEDURE `get_regulator`(IN `is_name` varchar(200), IN `inl_id` int(11) unsigned)
BEGIN

  IF(is_name IS NOT NULL) THEN
    SELECT
      r.*,
      s.s_name AS s_paramset,
      c.s_id AS s_id_connection

    FROM regulator r

    LEFT JOIN paramset s
    ON s.nl_id = r.nl_id_paramset

    LEFT JOIN connection c
    ON c.nl_id = r.nl_id_connection

    WHERE
      r.b_allowed = 1 AND
      r.s_name = is_name
    ;
  ELSE
    IF(inl_id IS NOT NULL) THEN
      SELECT
        r.*,
        s.s_name AS s_paramset,
        c.s_id AS s_id_connection

      FROM regulator r

      LEFT JOIN paramset s
      ON s.nl_id = r.nl_id_paramset

      LEFT JOIN connection c
      ON c.nl_id = r.nl_id_connection

      WHERE r.nl_id = inl_id;
    ELSE
      SELECT
        r.*,
        s.s_name AS s_paramset,
        c.s_id AS s_id_connection

      FROM regulator r

      LEFT JOIN paramset s
      ON s.nl_id = r.nl_id_paramset

      LEFT JOIN connection c
      ON c.nl_id = r.nl_id_connection

      WHERE
        r.b_allowed = 1
      ;

    END IF;
  END IF;

END;;