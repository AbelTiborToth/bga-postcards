<?php

namespace Bga\Games\Postcards\Log;

use BgaVisibleSystemException;

/**
 * Log entry types for game action tracking
 * 
 * Represents all possible log entry types that track player actions throughout the game.
 * Used for logging, undo/redo functionality, and game history.
 * 
 * Log Categories:
 *  - Help (0): Tutorial/help interactions
 *  - Travel Selection (1-3): Travel card action and double action selection
 *  - Bonus (3): Bonus action usage
 *  - Gift (4, 14): Gift card selection and usage
 *  - Movement (5): Biker movement
 *  - Postcard (6-7): Postcard taking and supply discard
 *  - Camp (8-9): Camp placement and skipping
 *  - Souvenir (10-11): Souvenir placement and skipping
 *  - Stamp (12): Stamp placement
 *  - Sending (13): Postcard sending
 *  - Skip (15): General skip action
 *  - Travel Deck (16): Travel deck drawing
 *  - Star (17): Star effect activation
 */
enum LogType: int
{
	/** Help interaction */
	case Help = 0;
	
	/** Travel card action selection */
	case ActionTravel = 1;
	
	/** Double travel card action selection */
	case ActionDouble = 2;
	
	/** Bonus action activation */
	case ActionBonus = 3;
	
	/** Gift card selection after sending postcard */
	case ActionGift = 4;
	
	/** Biker movement to new region */
	case Move = 5;
	
	/** Postcard taking from supply */
	case Postcard = 6;
	
	/** Postcard supply discard */
	case DiscardPostcards = 7;
	
	/** Camp placement on campsite */
	case Camp = 8;
	
	/** Camp placement skipped */
	case SkipCamp = 9;
	
	/** Souvenir placement on postcard */
	case Souvenir = 10;
	
	/** Souvenir placement skipped */
	case SkipSouvenir = 11;
	
	/** Stamp placement on postcard */
	case Stamp = 12;
	
	/** Postcard sending */
	case Send = 13;

	/** Gift card usage */
	case Gift = 14;
	
	/** General skip action */
	case SkipAction = 15;
	
	/** Travel card drawn from deck */
	case Travel = 16;
	
	/** Star effect activation */
	case Star = 17;

	/**
	 * Get LogType enum case from integer value
	 * 
	 * Maps integer values to their corresponding LogType enum cases.
	 * Throws exception if value doesn't correspond to any log type.
	 * 
	 * @param int $type - Integer value to convert
	 * @return LogType - The corresponding LogType enum case
	 * @throws BgaVisibleSystemException If type value is invalid
	 */
	public static function getLogType(int $type): LogType {
		foreach (LogType::cases() as $case) if ($case->value === $type) return $case;
		throw new BgaVisibleSystemException("LogType.enum.php - Undefined log type {$type}");
	}
}