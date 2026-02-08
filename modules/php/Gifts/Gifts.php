<?php

namespace Bga\Games\Postcards\Gifts;

use Bga\GameFramework\Components\Counters\OutOfRangeCounterException;
use Bga\GameFramework\Components\Counters\UnknownPlayerException;
use BgaSystemException;

/**
 * Trait for managing gift card functionality
 * 
 * Handles all gift card operations including:
 *  - Gift supply setup and management
 *  - Gift type determination
 *  - Playable gift filtering
 *  - End-game scoring for different gift types
 *  - Gift name localization
 */
trait Gifts
{
	// ========== Setup Methods ==========

	/**
	 * Initialize the gift supply at game start
	 * 
	 * Actions:
	 *  - Shuffles all 25 gift cards
	 *  - Places shuffled cards in the deck (location -2)
	 *  - Forms initial supply of 3 cards from deck top (location -1)
	 *  - Initializes gift counter
	 * 
	 * @throws BgaSystemException
	 */
	private function setupGifts(): void {
		$types = 25;
		$query_values = [];
		$card_locations = range(1, $types);
		shuffle($card_locations);
		for ($i = 1; $i <= $types; $i++) $query_values[$i] = vsprintf("('%s', '%s', '%s')", [$i, -2, array_shift($card_locations)]);
		$this->DbQuery(sprintf("INSERT INTO gift (type, location, location_arg) VALUES %s", implode(",", $query_values)));
		
		// Form supply from the top of the deck
		for ($i = 1; $i <= 3; $i++) {
			$top = intval($this->getUniqueValueFromDB("SELECT MIN(location_arg) FROM gift WHERE location = -2 GROUP BY location"));
			$this->dbQuery("UPDATE gift SET location = -1, location_arg = {$i} WHERE location = -2 AND location_arg = {$top}");
		}
		$this->giftsCounter->initDb($types - 3);
	}

	// ========== Supply Retrieval Methods ==========

	/**
	 * Get all gift cards currently in the supply
	 * 
	 * @return array Array of gift objects with type and location (1-3)
	 */
	public function getGiftsFromSupply(): array {
		return array_map(fn($value): array => array_map('intval', $value), $this->getObjectListFromDB("SELECT type, location_arg location FROM gift WHERE location = -1"));
	}

	// ========== Gift Type Methods ==========

	/**
	 * Map gift card ID to its GiftType enum
	 * 
	 * Maps card IDs (1-25) to their corresponding gift types:
	 *  - 1-8: Keychains (Beach, Gastronomy, Shore, Sight, History, Culture, Mountain, Forest)
	 *  - 9-16: Snow Globes
	 *  - 17: Caravan
	 *  - 18-19: Road Maps
	 *  - 20-21: Cars
	 *  - 22-23: Hiking Guides
	 *  - 24-25: Stamp Collections
	 * 
	 * @param int $gift - Gift card ID
	 * @return GiftType - The corresponding gift type enum
	 */
	public function getGiftType(int $gift): GiftType
	{
		return match ($gift) {
			1 => GiftType::KeyBeach,
			2 => GiftType::KeyCook,
			3 => GiftType::KeyWave,
			4 => GiftType::KeyBuilding,
			5 => GiftType::KeyVase,
			6 => GiftType::KeyBook,
			7 => GiftType::KeyMountain,
			8 => GiftType::KeyForest,
			
			9, 10, 11, 12, 13, 14, 15, 16 => GiftType::Snowball,
			17 => GiftType::Caravan,
			
			18, 19 => GiftType::Map,
			20, 21 => GiftType::Car,
			22, 23 => GiftType::Guide,
			24, 25 => GiftType::Stamp,
		};
	}

	// ========== Playable Gift Methods ==========

	/**
	 * Get all playable gift cards for a player
	 * 
	 * Only immediate action gifts (18-25) can be played from the player's collection.
	 * End-game scoring gifts (1-17) are scored automatically at game end.
	 * 
	 * @param int $player_id - Player ID to get playable gifts for
	 * @return array Array of playable gift card IDs
	 */
	public function getPlayableGifts(int $player_id): array
	{
		$res = [];
		$gifts = array_map('intval', $this->getObjectListFromDb("SELECT type FROM gift WHERE location = $player_id", true));
		foreach ($gifts as $gift) if ($gift >= 18) $res[] = $gift;
		return $res;
	}

	// ========== Scoring Methods ==========

	/**
	 * Score a Keychain gift card
	 * 
	 * Scores based on number of camps placed on campsites of the matching color:
	 *  - 0 camps: 0 points
	 *  - 1 camp: 1 point
	 *  - 2 camps: 3 points
	 *  - 3 camps: 6 points
	 *  - 4 camps: 10 points
	 *  - 5 camps: 14 points
	 *  - 6+ camps: 20 points
	 * 
	 * @param int $player_id - Player receiving the score
	 * @param int $gift - Gift card ID
	 * @param array $camps - Array of player's camps indexed by region and campsite
	 * @param string $color - Keychain color to score (hex code)
	 * @throws OutOfRangeCounterException
	 * @throws UnknownPlayerException
	 */
	public function scoreKeyGift(int $player_id, int $gift, array $camps, $color): void
	{
		$count = 0;
		foreach ($camps as $region => $campsites)
			foreach ($campsites as $campsite => $camp)
				if ($this->getCampsiteColor($region, $campsite) === $color) $count++;
		$score = match ($count) {
			0 => 0,
			1 => 1,
			2 => 3,
			3 => 6,
			4 => 10,
			5 => 14,
			default => 20,
		};
		$this->playerScore->inc($player_id, $score);
		$this->playerStats->inc("gift_points", $score, $player_id);
		$this->notify->all("scoreGift", clienttranslate('${player_name} scores ${n} points for a Keychain Gift card'), [
			"player_id" => $player_id,
			"player_color" => $this->getPlayerColorById($player_id),
			"n" => $score,
			"gift" => $gift,
		]);
	}

	/**
	 * Score Snow Globe gift cards
	 * 
	 * Scores based on number of Snow Globe cards collected:
	 *  - 1 card: 3 points
	 *  - 2 cards: 6 points
	 *  - 3 cards: 12 points
	 *  - 4 cards: 18 points
	 * 
	 * @param int $player_id - Player receiving the score
	 * @param int $gift - Gift card ID (one of the Snow Globe cards)
	 * @param array $gifts - Array of all player's gift card IDs
	 * @throws OutOfRangeCounterException
	 * @throws UnknownPlayerException
	 */
	public function scoreSnowGlobes(int $player_id, int $gift, array $gifts): void
	{
		$count = count(array_filter($gifts, fn($gift) => in_array($gift, [9, 10, 11, 12, 13, 14, 15, 16])));
		$score = match ($count) {
			1 => 3,
			2 => 6,
			3 => 12,
			default => 18,
		};
		$this->playerScore->inc($player_id, $score);
		$this->playerStats->inc("gift_points", $score, $player_id);
		$this->notify->all("scoreGift", clienttranslate('${player_name} scores ${n} points for ${count} Snow Globe Gift cards'), [
			"player_id" => $player_id,
			"player_color" => $this->getPlayerColorById($player_id),
			"n" => $score,
			"gift" => $gift,
			"count" => $count,
		]);
	}

	/**
	 * Score Caravan gift card
	 * 
	 * Scores 2 points for each region where the player has at least 2 camps.
	 * 
	 * @param int $player_id - Player receiving the score
	 * @param int $gift - Gift card ID (Caravan)
	 * @param array $camps - Array of player's camps indexed by region
	 * @throws OutOfRangeCounterException
	 * @throws UnknownPlayerException
	 */
	public function scoreCaravanGift(int $player_id, int $gift, array $camps): void
	{
		$score = count(array_filter($camps, fn($camp_region) =>  count($camp_region) >= 2)) * 2;
		$this->playerScore->inc($player_id, $score);
		$this->playerStats->inc("gift_points", $score, $player_id);
		$this->notify->all("scoreGift", clienttranslate('${player_name} scores ${n} points for a Caravan Gift card'), [
			"player_id" => $player_id,
			"player_color" => $this->getPlayerColorById($player_id),
			"n" => $score,
			"gift" => $gift,
		]);
	}

	// ========== Localization Methods ==========

	/**
	 * Get localized gift card name
	 * 
	 * Maps gift card IDs to their localized display names.
	 * 
	 * @param int $gift - Gift card ID (1-25)
	 * @return string - Localized gift card name
	 */
	public function getGiftName(int $gift) {
		return match ($gift) {
			1 => clienttranslate("Beach Keychain"),
			2 => clienttranslate("Gastronomy Keychain"),
			3 => clienttranslate("Shore Keychain"),
			4 => clienttranslate("Sight Keychain"),
			5 => clienttranslate("History Keychain"),
			6 => clienttranslate("Culture Keychain"),
			7 => clienttranslate("Mountain Keychain"),
			8 => clienttranslate("Forest Keychain"),
			
			9, 10, 11, 12, 13, 14, 15, 16 => clienttranslate("Snow Globe"),
			17 => clienttranslate("Caravan"),
			
			18, 19 => clienttranslate("Road Map"),
			20, 21 => clienttranslate("Car"),
			22, 23 => clienttranslate("Hiking Guide"),
			24, 25 => clienttranslate("Stamp Collection"),
		};
	}
}