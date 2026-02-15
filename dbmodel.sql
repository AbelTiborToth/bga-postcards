
-- ------
-- BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
-- Postcards implementation : © Tóth Ábel Tibor toth.abel.tibor2@gmail.com
-- 
-- This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
-- See http://en.boardgamearena.com/#!doc/Studio for more information.
-- -----

-- dbmodel.sql

CREATE TABLE IF NOT EXISTS travel (
	type int(2) UNSIGNED NOT NULL,
	location int(10) NOT NULL,
	location_arg int(2) UNSIGNED DEFAULT NULL,
	PRIMARY KEY (type)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS gift (
	type int(2) UNSIGNED NOT NULL,
	location int(10) NOT NULL,
	location_arg int(2) UNSIGNED DEFAULT NULL,
	PRIMARY KEY (type)
	) ENGINE=InnoDB  DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS postcard (
	type int(2) UNSIGNED NOT NULL,
	location int(10) NOT NULL,
	location_arg int(2) UNSIGNED DEFAULT NULL,
	PRIMARY KEY (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS stamp (
	postcard int(2) UNSIGNED NOT NULL,
	location int(1) UNSIGNED NOT NULL,
	PRIMARY KEY (postcard, location)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS camp (
	player_id int(10) UNSIGNED NOT NULL,
	region int(2) UNSIGNED NOT NULL,
	location int(1) UNSIGNED NOT NULL,
	PRIMARY KEY (region, location)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS souvenir (
	postcard int(2) UNSIGNED NOT NULL,
	location int(1) UNSIGNED NOT NULL,
	PRIMARY KEY (postcard, location)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS log (
	id int(2) UNSIGNED NOT NULL,
	gamelog_move_id int(5) UNSIGNED NOT NULL,
	type int(2) NOT NULL,
	args JSON,
	undoable BOOLEAN NOT NULL,
	PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8;

ALTER TABLE player ADD itinerary INT UNSIGNED NOT NULL;
ALTER TABLE player ADD biker INT UNSIGNED NOT NULL;

ALTER TABLE gamelog ADD COLUMN cancel BOOLEAN NOT NULL DEFAULT FALSE;

