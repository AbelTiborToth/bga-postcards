<?php

namespace Bga\Games\Postcards\Postcards;

use Bga\GameFramework\Components\Counters\OutOfRangeCounterException;
use BgaSystemException;
use BgaVisibleSystemException;

/**
 * Postcard deck/supply management and postcard helpers.
 *
 * Responsibilities:
 * - Initialize and shuffle the postcard deck/supply
 * - Provide color/bonus lookup helpers
 * - Compute available placements (stamps/souvenirs) and sendable postcards
 * - Handle guide reveal and itinerary progress checks
 */
trait Postcards
{
	/**
	 * Setup postcard deck, initial supply, and player starting cards.
	 *
	 * @param array $players Player data keyed by player_id.
	 */
	private function setupPostcards($players): void {
		$count = 52;
		$query_values = [];
		$card_locations = range(1, $count);
		shuffle($card_locations);
		for ($i = 1; $i <= $count; $i++) $query_values[$i] = vsprintf("('%s', '%s', '%s')", [$i, -2, array_shift($card_locations)]);
		$this->DbQuery(sprintf("INSERT INTO postcard (type, location, location_arg) VALUES %s", implode(",", $query_values)));
		// Form supply from the top of the deck
		$this->dbQuery("UPDATE postcard SET location = -1, location_arg = null WHERE location = -2 AND location_arg <= 3");
		// Give cards to players from bottom of the deck
		foreach ($players as $player_id => $player) {
			$this->dbQuery("UPDATE postcard SET location = $player_id, location_arg = 1 WHERE location = -2 AND location_arg = $count");
			$count--;
		}
		$this->postcardsCounter->initDb(52 - 3 - count($players));
		$this->postcardsDiscardCounter->initDb();
	}
	
	/**
	 * Get postcard IDs currently in the supply row.
	 *
	 * @return int[]
	 */
	public function getPostcardsFromSupplyRow(): array {
		return array_map('intval', $this->getObjectListFromDB("SELECT type FROM postcard WHERE location = -1", true));
	}

	/**
	 * Get the current top postcard ID from the deck (or null if empty).
	 *
	 * @return int|null
	 * @throws BgaSystemException
	 */
	public function getPostcardFromSupplyDeck(): ?int {
		$top = $this->getUniqueValueFromDB("SELECT MIN(location_arg) FROM postcard WHERE location = -2 GROUP BY location");
		if ($top === null) return null;
		return intval($this->getUniqueValueFromDB("SELECT type FROM postcard WHERE location = -2 AND location_arg = $top"));
	}

	/**
	 * Get postcard IDs currently in the guide.
	 *
	 * @return int[]
	 */
	public function getPostcardsFromGuide(): array {
		return array_map('intval', $this->getObjectListFromDB("SELECT type FROM postcard WHERE location = -4", true));
	}

	/**
	 * Refill the supply row up to 3 cards, reshuffling if needed.
	 *
	 * @throws BgaSystemException
	 */
	public function refillPostcardSupply(): void
	{
		$count = $this->getUniqueValueFromDb("SELECT COUNT(type) FROM postcard WHERE location = -1");
		for ($i = $count; $i < 3; $i++) {
			$top = $this->getUniqueValueFromDB("SELECT MIN(location_arg) FROM postcard WHERE location = -2 GROUP BY location");
			if ($top !== null) {
				$this->dbQuery("UPDATE postcard SET location = -1, location_arg = null WHERE location = -2 AND location_arg = $top");
				$this->postcardsCounter->inc(-1);
				if ($this->postcardsCounter->get() === 0) $this->reshufflePostcards();
				if ($this->postcardsCounter->get() !== 0) {
					$new_top = $this->getUniqueValueFromDB("SELECT MIN(location_arg) FROM postcard WHERE location = -2 GROUP BY location");
					$this->notify->all("refillPostcardSupply",'', [
						"top" => intval($this->getUniqueValueFromDB("SELECT type FROM postcard WHERE location = -2 AND location_arg = $new_top"))
					]);
				} else {
					$this->notify->all("refillPostcardSupply",'');
				}
			} else {
				$this->notify->all("refillPostcardSupply",'');
			}
		}
	}

	/**
	 * Reshuffle discarded postcards back into the deck.
	 *
	 * @throws OutOfRangeCounterException
	 */
	public function reshufflePostcards(): void
	{
		$discards = array_map('intval', $this->getObjectListFromDB("SELECT type FROM postcard WHERE location = -3", true));
		$locations = range(1, count($discards));
		shuffle($locations);
		foreach ($discards as $discard) {
			$location = array_shift($locations);
			$this->dbQuery("UPDATE postcard SET location = -2, location_arg = $location WHERE type = $discard");
		}
		$this->postcardsCounter->set(count($discards));
		$this->postcardsDiscardCounter->set(0);
	}

	/**
	 * Get souvenir bonus type for a postcard space.
	 *
	 * @throws BgaVisibleSystemException
	 */
	public function getSouvenirBonusType(int $postcard, int $space): SouvenirBonusType {
		switch ($postcard) {
			case 1:
			case 20:
			case 33:
				switch ($space) {
					case 1: return SouvenirBonusType::Travel;
					case 2: return SouvenirBonusType::Move;
					case 3: return SouvenirBonusType::Camp;
				}
				break;
			case 2:
			case 15:
			case 17:
			case 29:
			case 34:
			case 45:
				switch ($space) {
					case 1: return SouvenirBonusType::Travel;
					case 2: return SouvenirBonusType::Camp;
					case 3: return SouvenirBonusType::Point;
				}
				break;
			case 3:
			case 18:
			case 35:
				switch ($space) {
					case 1: return SouvenirBonusType::Stamp;
					case 2: return SouvenirBonusType::Move;
					case 3: return SouvenirBonusType::Postcard;
				}
				break;
			case 4:
			case 19:
			case 36:
				switch ($space) {
					case 1: return SouvenirBonusType::Point;
					case 2: return SouvenirBonusType::Postcard;
					case 3: return SouvenirBonusType::Stamp;
				}
				break;
			case 5:
			case 21:
			case 38:
			case 51:
			case 52:
				switch ($space) {
					case 1: return SouvenirBonusType::Travel;
					case 2: return SouvenirBonusType::Stamp;
					case 3: return SouvenirBonusType::Move;
				}
				break;
			case 6:
			case 10:
			case 23:
			case 28:
			case 40:
			case 41:
				switch ($space) {
					case 1: return SouvenirBonusType::Camp;
					case 2: return SouvenirBonusType::Stamp;
					case 3: return SouvenirBonusType::Postcard;
				}
				break;
			case 7:
			case 24:
			case 37:
				switch ($space) {
					case 1: return SouvenirBonusType::Postcard;
					case 2: return SouvenirBonusType::Camp;
					case 3: return SouvenirBonusType::Point;
				}
				break;
			case 8:
			case 22:
			case 39:
				switch ($space) {
					case 1: return SouvenirBonusType::Travel;
					case 2: return SouvenirBonusType::Move;
					case 3: return SouvenirBonusType::Point;
				}
				break;
			case 9:
			case 27:
			case 44:
				switch ($space) {
					case 1: return SouvenirBonusType::Point;
					case 2: return SouvenirBonusType::Move;
					case 3: return SouvenirBonusType::Stamp;
				}
				break;
			case 11:
			case 26:
			case 43:
				switch ($space) {
					case 1: return SouvenirBonusType::Camp;
					case 2: return SouvenirBonusType::Postcard;
					case 3: return SouvenirBonusType::Travel;
				}
				break;
			case 12:
			case 25:
			case 42:
				switch ($space) {
					case 1: return SouvenirBonusType::Move;
					case 2: return SouvenirBonusType::Travel;
					case 3: return SouvenirBonusType::Point;
				}
				break;
			case 13:
			case 30:
			case 46:
				switch ($space) {
					case 1: return SouvenirBonusType::Postcard;
					case 2: return SouvenirBonusType::Move;
					case 3: return SouvenirBonusType::Stamp;
				}
				break;
			case 14:
			case 32:
			case 47:
				switch ($space) {
					case 1: return SouvenirBonusType::Move;
					case 2: return SouvenirBonusType::Travel;
					case 3: return SouvenirBonusType::Camp;
				}
				break;
			case 16:
			case 31:
			case 48:
				switch ($space) {
					case 1: return SouvenirBonusType::Postcard;
					case 2: return SouvenirBonusType::Point;
					case 3: return SouvenirBonusType::Stamp;
				}
				break;
			case 49:
			case 50:
				switch ($space) {
					case 1: return SouvenirBonusType::Camp;
					case 2: return SouvenirBonusType::Postcard;
					case 3: return SouvenirBonusType::Point;
				}
				break;
		}
		throw new BgaVisibleSystemException("Postcards.php [getStampSpaceColor] Invalid postcard or location $postcard $space");
	}

	/**
	 * Get souvenir space color for a postcard.
	 *
	 * @throws BgaVisibleSystemException
	 */
	public function getSouvenirSpaceColor(int $postcard, int $space): int {
		switch ($postcard) {
			case 1:
			case 50:
				switch ($space) {
					case 1: return 4;
					case 2: return 7;
					case 3: return 3;
				}
				break;
			case 2:
			case 17:
				switch ($space) {
					case 1: return 5;
					case 2: return 2;
					case 3: return 1;
				}
				break;
			case 3:
				switch ($space) {
					case 1: return 6;
					case 2: return 4;
					case 3: return 8;
				}
				break;
			case 4:
			case 20:
			case 33:
				switch ($space) {
					case 1: return 7;
					case 2: return 1;
					case 3: return 2;
				}
				break;
			case 5:
			case 38:
			case 52:
				switch ($space) {
					case 1: return 8;
					case 2: return 1;
					case 3: return 6;
				}
				break;
			case 6:
			case 23:
				switch ($space) {
					case 1: return 5;
					case 2: return 3;
					case 3: return 4;
				}
				break;
			case 7:
				switch ($space) {
					case 1: return 7;
					case 2: return 4;
					case 3: return 3;
				}
				break;
			case 8:
				switch ($space) {
					case 1: return 6;
					case 2: return 4;
					case 3: return 5;
				}
				break;
			case 9:
				switch ($space) {
					case 1: return 6;
					case 2: return 3;
					case 3: return 8;
				}
				break;
			case 10:
				switch ($space) {
					case 1: return 8;
					case 2: return 4;
					case 3: return 3;
				}
				break;
			case 11:
				switch ($space) {
					case 1: return 7;
					case 2: return 2;
					case 3: return 3;
				}
				break;
			case 12:
				switch ($space) {
					case 1: return 5;
					case 2: return 1;
					case 3: return 6;
				}
				break;
			case 13:
				switch ($space) {
					case 1: return 6;
					case 2: return 1;
					case 3: return 4;
				}
				break;
			case 14:
				switch ($space) {
					case 1: return 8;
					case 2: return 2;
					case 3: return 1;
				}
				break;
			case 15:
				switch ($space) {
					case 1: return 7;
					case 2: return 3;
					case 3: return 8;
				}
				break;
			case 16:
				switch ($space) {
					case 1: return 5;
					case 2: return 4;
					case 3: return 7;
				}
				break;
			case 18:
			case 35:
				switch ($space) {
					case 1: return 6;
					case 2: return 4;
					case 3: return 7;
				}
				break;
			case 19:
				switch ($space) {
					case 1: return 8;
					case 2: return 3;
					case 3: return 6;
				}
				break;
			case 21:
				switch ($space) {
					case 1: return 8;
					case 2: return 1;
					case 3: return 7;
				}
				break;
			case 22:
				switch ($space) {
					case 1: return 6;
					case 2: return 2;
					case 3: return 5;
				}
				break;
			case 24:
			case 37:
				switch ($space) {
					case 1: return 7;
					case 2: return 4;
					case 3: return 2;
				}
				break;
			case 25:
				switch ($space) {
					case 1: return 6;
					case 2: return 3;
					case 3: return 5;
				}
				break;
			case 26:
			case 43:
				switch ($space) {
					case 1: return 7;
					case 2: return 2;
					case 3: return 4;
				}
				break;
			case 27:
				switch ($space) {
					case 1: return 8;
					case 2: return 4;
					case 3: return 6;
				}
				break;
			case 28:
			case 41:
				switch ($space) {
					case 1: return 5;
					case 2: return 1;
					case 3: return 3;
				}
				break;
			case 29:
				switch ($space) {
					case 1: return 8;
					case 2: return 2;
					case 3: return 5;
				}
				break;
			case 30:
				switch ($space) {
					case 1: return 7;
					case 2: return 3;
					case 3: return 2;
				}
				break;
			case 31:
				switch ($space) {
					case 1: return 6;
					case 2: return 1;
					case 3: return 8;
				}
				break;
			case 32:
			case 47:
				switch ($space) {
					case 1: return 5;
					case 2: return 4;
					case 3: return 1;
				}
				break;
			case 34:
				switch ($space) {
					case 1: return 5;
					case 2: return 2;
					case 3: return 3;
				}
				break;
			case 36:
				switch ($space) {
					case 1: return 8;
					case 2: return 3;
					case 3: return 5;
				}
				break;
			case 39:
				switch ($space) {
					case 1: return 6;
					case 2: return 2;
					case 3: return 8;
				}
				break;
			case 40:
				switch ($space) {
					case 1: return 5;
					case 2: return 3;
					case 3: return 1;
				}
				break;
			case 42:
				switch ($space) {
					case 1: return 6;
					case 2: return 3;
					case 3: return 7;
				}
				break;
			case 44:
				switch ($space) {
					case 1: return 8;
					case 2: return 4;
					case 3: return 5;
				}
				break;
			case 45:
				switch ($space) {
					case 1: return 8;
					case 2: return 2;
					case 3: return 6;
				}
				break;
			case 46:
				switch ($space) {
					case 1: return 7;
					case 2: return 3;
					case 3: return 4;
				}
				break;
			case 48:
				switch ($space) {
					case 1: return 6;
					case 2: return 1;
					case 3: return 5;
				}
				break;
			case 49:
				switch ($space) {
					case 1: return 2;
					case 2: return 8;
					case 3: return 1;
				}
				break;
			case 51:
				switch ($space) {
					case 1: return 5;
					case 2: return 3;
					case 3: return 8;
				}
				break;
		}
		throw new BgaVisibleSystemException("Postcards.php [getStampSpaceColor] Invalid postcard or location $postcard $space");
	}
	
	/**
	 * Get stamp space color for a postcard.
	 * 
	 * @throws BgaVisibleSystemException
	 */
	public function getStampSpaceColor(int $postcard, int $space): int {
		switch ($postcard) {
			case 1:
			case 13:
				switch ($space) {
					case 1: return 2;
					case 2: return 4;
					case 3: return 3;
				}
				break;
			case 2:
				switch ($space) {
					case 2: return 2;
					case 3: return 1;
					case 5:
					case 6: return 3;
				}
				break;
			case 3:
				switch ($space) {
					case 1: return 4;
					case 2: return 1;
					case 3: return 3;
					case 5:
					case 6: return 2;
				}
				break;
			case 4:
				switch ($space) {
					case 1:
					case 4: return 4;
					case 2:
					case 3: return 2;
					case 5:
					case 6: return 3;
				}
				break;
			case 5:
				switch ($space) {
					case 1:
					case 2: return 1;
					case 3: return 3;
				}
				break;
			case 6:
			case 22:
				switch ($space) {
					case 2: return 2;
					case 3: return 1;
					case 5:
					case 6: return 4;
				}
				break;
			case 7:
				switch ($space) {
					case 1: return 2;
					case 2: return 1;
					case 3: return 3;
					case 5:
					case 6: return 4;
				}
				break;
			case 8:
				switch ($space) {
					case 1:
					case 4: return 3;
					case 2: return 2;
					case 3: return 4;
					case 5:
					case 6: return 1;
				}
				break;
			case 9:
				switch ($space) {
					case 1:
					case 2: return 1;
					case 3: return 2;
				}
				break;
			case 10:
			case 34:
				switch ($space) {
					case 2:
					case 3: return 4;
					case 5:
					case 6: return 3;
				}
				break;
			case 11:
				switch ($space) {
					case 1:
					case 2: return 2;
					case 3:
					case 6: return 1;
					case 5: return 4;
				}
				break;
			case 12:
			case 28:
			case 32:
				switch ($space) {
					case 1:
					case 4: return 2;
					case 2: return 4;
					case 3: return 1;
					case 5:
					case 6: return 3;
				}
				break;
			case 14:
				switch ($space) {
					case 2:
					case 3: return 4;
					case 5:
					case 6: return 1;
				}
				break;
			case 15:
				switch ($space) {
					case 1:
					case 2: return 1;
					case 3:
					case 6: return 3;
					case 5: return 4;
				}
				break;
			case 16:
				switch ($space) {
					case 1:
					case 4: return 3;
					case 2: return 4;
					case 3: return 1;
					case 5:
					case 6: return 2;
				}
				break;
			case 17:
			case 41:
				switch ($space) {
					case 1: return 4;
					case 2:
					case 3: return 1;
				}
				break;
			case 18:
				switch ($space) {
					case 2: return 4;
					case 3: return 3;
					case 5:
					case 6: return 2;
				}
				break;
			case 19:
			case 23:
			case 51:
				switch ($space) {
					case 1: return 1;
					case 2: return 4;
					case 3: return 3;
					case 5:
					case 6: return 2;
				}
				break;
			case 20:
				switch ($space) {
					case 1:
					case 4: return 4;
					case 2:
					case 3: return 1;
					case 5:
					case 6: return 3;
				}
				break;
			case 21:
			case 29:
			case 37:
				switch ($space) {
					case 1: return 1;
					case 2:
					case 3: return 2;
				}
				break;
			case 24:
				switch ($space) {
					case 1:
					case 4: return 4;
					case 2: return 2;
					case 3: return 1;
					case 5:
					case 6: return 3;
				}
				break;
			case 25:
				switch ($space) {
					case 1: return 3;
					case 2:
					case 3: return 4;
				}
				break;
			case 26:
				switch ($space) {
					case 2: return 1;
					case 3: return 3;
					case 5:
					case 6: return 2;
				}
				break;
			case 27:
			case 47:
				switch ($space) {
					case 1: return 3;
					case 2:
					case 3: return 4;
					case 5:
					case 6: return 1;
				}
				break;
			case 30:
				switch ($space) {
					case 2: return 2;
					case 3: return 4;
					case 5:
					case 6: return 1;
				}
				break;
			case 31:
				switch ($space) {
					case 1: return 1;
					case 2:
					case 3: return 4;
					case 5:
					case 6: return 3;
				}
				break;
			case 33:
				switch ($space) {
					case 1: return 1;
					case 2:
					case 3: return 4;
				}
				break;
			case 35:
				switch ($space) {
					case 1: return 4;
					case 2: return 2;
					case 3: return 3;
					case 5:
					case 6: return 1;
				}
				break;
			case 36:
			case 44:
				switch ($space) {
					case 1:
					case 4: return 4;
					case 2: return 1;
					case 3: return 3;
					case 5:
					case 6: return 2;
				}
				break;
			case 38:
			case 46:
				switch ($space) {
					case 2: return 4;
					case 3: return 1;
					case 5:
					case 6: return 3;
				}
				break;
			case 39:
				switch ($space) {
					case 1: return 2;
					case 2: return 4;
					case 3: return 1;
					case 5:
					case 6: return 3;
				}
				break;
			case 40:
			case 52:
				switch ($space) {
					case 1:
					case 4: return 2;
					case 2: return 4;
					case 3: return 3;
					case 5:
					case 6: return 1;
				}
				break;
			case 42:
				switch ($space) {
					case 2: return 2;
					case 3: return 4;
					case 5: return 1;
					case 6: return 3;
				}
				break;
			case 43:
				switch ($space) {
					case 1: return 1;
					case 2:
					case 3: return 2;
					case 5:
					case 6: return 3;
				}
				break;
			case 45:
				switch ($space) {
					case 1: return 3;
					case 2:
					case 3: return 2;
				}
				break;
			case 48:
				switch ($space) {
					case 1: return 4;
					case 2:
					case 3: return 2;
					case 4: return 1;
					case 5:
					case 6: return 3;
				}
				break;
			case 49:
				switch ($space) {
					case 1: return 1;
					case 2: return 4;
					case 3: return 3;
				}
				break;
			case 50:
				switch ($space) {
					case 2:
					case 3: return 2;
					case 5:
					case 6: return 3;
				}
				break;
		}
		throw new BgaVisibleSystemException("Postcards.php [getStampSpaceColor] Invalid postcard or location $postcard $space");
	}
	

	/**
	 * @throws BgaSystemException
	 */
	public function getAvailableStampSpaces($player_id, $color = null): array
	{
		$res = [];
		$postcards = $this->getObjectListFromDb("SELECT location_arg FROM postcard WHERE location = $player_id AND location_arg IS NOT null", true);
		foreach ($postcards as $postcard) {
			$type = intval($this->getUniqueValueFromDb("SELECT type FROM postcard WHERE location = $player_id AND location_arg = $postcard"));
			$stamps = array_map('intval', $this->getObjectListFromDb("SELECT location FROM stamp WHERE postcard = {$type}", true));
			$n = ($type - 1) % 4;
			$spaces = match ($n) {
				0 => [1, 2, 3],
				1 => [2, 3, 5, 6],
				2 => [1, 2, 3, 5, 6],
				3 => [1, 2, 3, 4, 5, 6]
			};
			foreach ($spaces as $space) {
				if (!in_array($space, $stamps)) {
					if ($color === null || $color === $this->getStampSpaceColor($type, $space)) {
						if (!isset($res[$type])) $res[$type] = [];
						$res[$type][] = $space;
					}
				}
			}
		}
		return $res;
	}

	/**
	 * @throws BgaSystemException
	 */
	public function getAvailableSouvenirSpaces(int $player_id, int $color): array
	{
		$res = [];
		$postcards = $this->getObjectListFromDb("SELECT location_arg FROM postcard WHERE location = $player_id AND location_arg IS NOT null", true);
		foreach ($postcards as $postcard) {
			$type = intval($this->getUniqueValueFromDb("SELECT type FROM postcard WHERE location = $player_id AND location_arg = $postcard"));
			$souvenirs = array_map('intval', $this->getObjectListFromDb("SELECT location FROM souvenir WHERE postcard = {$type}", true));
			$spaces = [1, 2, 3];
			foreach ($spaces as $space) {
				if (!in_array($space, $souvenirs)) {
					if ($color === $this->getSouvenirSpaceColor($type, $space)) {
						if (!isset($res[$type])) $res[$type] = [];
						$res[$type][] = $space;
					}
				}
			}
		}
		return $res;
	}

	/**
	 * Get postcard IDs the player can send right now.
	 *
	 * @param int $player_id Player ID.
	 * @return int[]
	 * @throws BgaSystemException
	 */
	public function getSendablePostcards($player_id): array
	{
		$res = [];
		$postcards = array_map('intval', $this->getObjectListFromDb("SELECT type FROM postcard WHERE location = $player_id AND location_arg IS NOT null", true));
		$biker = intval($this->getUniqueValueFromDb("SELECT biker FROM player WHERE player_id = {$player_id}"));
		foreach ($postcards as $postcard) {
			if ($biker === $this->getPostcardRegion($postcard)) {
				$stamp_count = intval($this->getUniqueValueFromDb("SELECT COUNT(*) FROM stamp WHERE postcard = {$postcard}"));
				if ($stamp_count === $this->getStampSpaceCount($postcard)) $res[] = $postcard;
			}
		}
		return $res;
	}
	
	public function getPostcardRegion(int $postcard): int
	{
		return floor(($postcard - 1) / 4) + 1;
	}
	
	public function getStampSpaceCount(int $postcard): int {
		return ($postcard - 1) % 4 + 3;
	}
	
	public function getPostcardPoint(int $postcard): int {
		return match (($postcard - 1) % 4) {0 => 3, 1 => 6, 2 => 10, 3 => 15};
	}

	/**
	 * Reveal 5 postcards for the guide, reshuffling if needed, and notify clients.
	 *
	 * @throws BgaSystemException
	 */
	public function revealGuidePostcards(): void
	{
		$postcards = array_map('intval', $this->getObjectListFromDB("SELECT type FROM postcard WHERE location = -2 ORDER BY location_arg LIMIT 5", true));
		$this->dbQuery("UPDATE postcard SET location = -4, location_arg = null WHERE type IN (" . join(', ', $postcards) . ")");
		if ($this->postcardsCounter->get() < 5) {
			$this->reshufflePostcards();
			$left = 5 - count($postcards);
			$ps = array_map('intval', $this->getObjectListFromDB("SELECT type FROM postcard WHERE location = -2 ORDER BY location_arg LIMIT $left", true));
			$postcards = array_merge($postcards, $ps);
			$this->postcardsCounter->inc(-count($ps));
		} else {
			$this->postcardsCounter->inc(-5);
		}
		$this->dbQuery("UPDATE postcard SET location = -4, location_arg = null WHERE type IN (" . join(', ', $postcards) . ")");

		$this->notify->all("revealGuidePostcards", clienttranslate(''), [
			"deck" => $this->getPostcardFromSupplyDeck(),
			"postcards" => $this->getPostcardsFromGuide(),
		]);
	}

	/**
	 * Get the 4 postcard IDs required by an itinerary card.
	 *
	 * @param int $itinerary Itinerary ID.
	 * @return int[]
	 */
	public function getItineraryPostcards(int $itinerary): array
	{
		return match ($itinerary) {
			1 => [3, 5, 8, 11],
			2 => [4, 6, 9, 12],
			3 => [5, 7, 9, 13],
			4 => [2, 8, 10, 12],
			5 => [1, 7, 8, 13],
			6 => [2, 4, 8, 10],
			7 => [2, 4, 9, 11],
			8 => [1, 3, 10, 12],
			9 => [1, 3, 6, 13],
			10 => [2, 4, 6, 11],
			11 => [3, 5, 7, 8],
			12 => [2, 4, 6, 9],
			13 => [1, 3, 7, 11],
		};
	}

	/**
	 * Return which itinerary regions are already satisfied by sent postcards.
	 *
	 * @param int $player_id  Player ID.
	 * @param int $itinerary  Itinerary ID.
	 * @return array<int,bool> Map of slot => satisfied.
	 */
	public function getItineraryCorrectPostcards(int $player_id, int $itinerary): array
	{
		$res = [];
		$postcards = array_unique(array_map(fn($postcard) => $this->getPostcardRegion(intval($postcard)), $this->getObjectListFromDb("SELECT type FROM postcard WHERE location = $player_id AND location_arg IS NULL", true)));
		$itinerary_postcards = $this->getItineraryPostcards($itinerary);
		foreach ($itinerary_postcards as $n => $postcard) {
			if (in_array($postcard, $postcards)) $res[$n + 1] = true;
			else $res[$n + 1] = false;
		}
		return $res;
	}

	/**
	 * Notify when a newly sent postcard satisfies an itinerary slot.
	 *
	 * @param int $player_id Player ID.
	 * @param int $postcard  Postcard ID just sent.
	 * @throws BgaSystemException
	 */
	public function checkPostcardOnItinerary(int $player_id, int $postcard): void
	{
		$itinerary = intval($this->getUniqueValueFromDB("SELECT itinerary FROM player WHERE player_id = {$player_id}"));
		$itinerary_postcards = $this->getItineraryPostcards($itinerary);
		$region = $this->getPostcardRegion($postcard);
		foreach ($itinerary_postcards as $n => $postcard) {
			if ($region === $postcard) {
				$this->notify->all("itinerary",'', [
					"player_id" => $player_id,
					"n" => $n + 1,
				]);
				break;
			}
		}
	}
}
