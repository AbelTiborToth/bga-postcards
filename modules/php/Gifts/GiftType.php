<?php

namespace Bga\Games\Postcards\Gifts;

/**
 * Gift card types in the Postcards game
 * 
 * Represents all possible gift card types that players can earn when sending postcards.
 * Each gift type provides different end-game scoring or immediate actions.
 * 
 * Gift Categories:
 *  - Keychains (0-3, 5-8): Camp-based end-game scoring by region type
 *  - Snow Globe (4): Collection-based end-game scoring
 *  - Caravan (9): Regional camp count bonus
 *  - Immediate Action Cards (10-13): Movement, postcard, or stamp bonuses
 */
enum GiftType: int
{
	// ========== Keychain Cards ==========
	
	case KeyBeach = 0;
	case KeyCook = 1;
	case KeyWave = 2;
	case KeyBuilding = 3;
	
	// ========== Collection Cards ==========
	
	case Snowball = 4;
	
	// ========== Keychain Cards (continued) ==========
	
	case KeyVase = 5;
	case KeyBook = 6;
	case KeyMountain = 7;
	case KeyForest = 8;
	
	// ========== Regional Bonus Cards ==========

	case Caravan = 9;
	
	// ========== Immediate Action Cards ==========
	
	case Map = 10;
	case Car = 11;
	case Guide = 12;
	case Stamp = 13;
}