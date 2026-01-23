<?php

namespace Bga\Games\Postcards\Travels;

use Bga\GameFramework\Components\Counters\OutOfRangeCounterException;
use Bga\Games\Postcards\Log\LogType;
use BgaSystemException;

/**
 * Travel deck/supply management and travel helper utilities.
 *
 * Responsibilities:
 * - Setup and refill travel deck/supply
 * - Provide travel color/action lookups
 * - Track used travels for discard/undo logic
 */
trait Travels
{
	/**
	 * Initialize travel deck, supply, and starting hands.
	 *
	 * @param array $players Player data keyed by player_id.
	 * @throws BgaSystemException
	 */
	private function setupTravels($players): void {
		$types = 12;
		$count = 6;
		$query_values = [];
		$card_locations = range(1, $types * $count);
		shuffle($card_locations);
		for ($i = 1; $i <= $types * $count; $i++) $query_values[$i] = vsprintf("('%s', '%s', '%s')", [$i, -2, array_shift($card_locations)]);
		$this->DbQuery(sprintf("INSERT INTO travel (type, location, location_arg) VALUES %s", implode(",", $query_values)));
		// Form supply from the top of the deck
		for ($i = 1; $i <= 5; $i++) {
			$top = intval($this->getUniqueValueFromDB("SELECT MIN(location_arg) FROM travel WHERE location = -2 GROUP BY location"));
			$this->dbQuery("UPDATE travel SET location = -1, location_arg = {$i} WHERE location = -2 AND location_arg = {$top}");
		}
		// Give cards to players from bottom of the deck
		foreach ($players as $player_id => $player) {
			$top = intval($this->getUniqueValueFromDB("SELECT MIN(location_arg) FROM travel WHERE location = -2 GROUP BY location")) + 4;
			$this->dbQuery("UPDATE travel SET location = {$player_id}, location_arg = NULL WHERE location = -2 AND location_arg <= {$top}");
		}
		$this->travelsCounter->initDb($types * $count - 5 - count($players) * 5);
		$this->travelsDiscardCounter->initDb();
	}

	/**
	 * Get all travels currently in supply (type and slot).
	 *
	 * @return array<int,array<string,int>>
	 */
	public function getTravelsFromSupply(): array {
		return array_map(fn($value): array => array_map('intval', $value), $this->getObjectListFromDB("SELECT type, location_arg location FROM travel WHERE location = -1"));
	}

	/**
	 * Refill travel supply slots (1-5) from deck, reshuffling if needed.
	 *
	 * @throws BgaSystemException
	 */
	public function refillTravelSupply(): void
	{
		$filled_spaces = array_map('intval', $this->getObjectListFromDB("SELECT location_arg FROM travel WHERE location = -1", true));
		$free_spaces = array_diff([1, 2, 3, 4, 5], $filled_spaces);
		if (!empty($free_spaces)) {
			foreach ($free_spaces as $space) {
				$top = intval($this->getUniqueValueFromDB("SELECT MIN(location_arg) FROM travel WHERE location = -2 GROUP BY location"));
				$travel = intval($this->getUniqueValueFromDB("SELECT type FROM travel WHERE location = -2 AND location_arg = $top"));
				$this->dbQuery("UPDATE travel SET location = -1, location_arg = {$space} WHERE type = $travel");
				if ($this->travelsCounter->get() === 1) $this->reshuffleTravels();
				else $this->travelsCounter->inc(-1);
				$this->notify->all("refillTravelSupply",'', [
					"travel" => $travel,
					"location" => $space,
				]);
			}
		}
	}
	
	/**
	 * Get all travel cards in a player's hand.
	 *
	 * @param int $player_id
	 * @return int[]
	 */
	public function getTravelsFromHand(int $player_id): array {
		return array_map('intval', $this->getObjectListFromDB("SELECT type FROM travel WHERE location = {$player_id}", true));
	}

	/**
	 * Count travel cards in a player's hand.
	 *
	 * @param int $player_id
	 * @return int
	 * @throws BgaSystemException
	 */
	public function getTravelsFromHandCount(int $player_id): int {
		return intval($this->getUniqueValueFromDb("SELECT count(*) FROM travel WHERE location = {$player_id}"));
	}
	
	public function getTravelColor(int $travel): int {return floor(($travel - 1) / 6) % 4 + 1;}

	public function getTravelColorName(int $travel): string {
		$action = $this->getTravelColor($travel);
		return match ($action) {
			1 => clienttranslate("Blue"),
			2 => clienttranslate("Red"),
			3 => clienttranslate("Green"),
			4 => clienttranslate("Yellow")
		};
	}

	/**
	 * Check if a travel list contains a given color.
	 *
	 * @param int[] $travels
	 * @param int   $action
	 * @return bool
	 */
	public function hasTravelColor(array $travels, int $action): bool {
		foreach ($travels as $travel) {
    		if ($this->getTravelColor($travel) === $action) {
        		return true;
    		}
		}
		return false;
	}
	
	public function getTravelAction(int $travel): int {return floor(($travel - 1) / 24) + 1;}

	public function getTravelActionName(int $travel): string {
		$action = $this->getTravelAction($travel);
		return match ($action) {
			1 => clienttranslate("Move"),
			2 => clienttranslate("Postcard"),
			3 => clienttranslate("Camp")
		};
	}

	public function getActionTypeName(int $type) : string {
		return match ($type) {
			1 => clienttranslate("Move"),
			2 => clienttranslate("Postcard"),
			3 => clienttranslate("Camp"),
			4 => clienttranslate("Stamp")
		};
	}

	/**
	 * Check if a travel list contains a given action.
	 *
	 * @param int[] $travels
	 * @param int   $action
	 * @return bool
	 */
	public function hasTravelAction(array $travels, int $action): bool {
		foreach ($travels as $travel) {
    		if ($this->getTravelAction($travel) === $action) {
        		return true;
    		}
		}
		return false;
	}

	/**
	 * Collect all travel cards used this turn from the log.
	 *
	 * @return int[]
	 * @throws BgaSystemException
	 */
	public function getUsedTravels(): array
	{
		$res = [];
		$log_length = $this->getLogLength();
		for ($i = 0; $i < $log_length; $i++) {
			$log = $this->getLastLog($i);
			if ($log["type"] === LogType::ActionTravel) $res[] = $log["args"]["travel"];
			if ($log["type"] === LogType::ActionDouble) {
				$res[] = $log["args"]["travel_1"];
				$res[] = $log["args"]["travel_2"];
			}
		}
		return $res;
	}

	/**
	 * Discard used travels to the discard pile and notify player.
	 *
	 * @param int   $player_id
	 * @param int[] $used_travels
	 * @throws OutOfRangeCounterException
	 * @throws BgaSystemException
	 */
	public function discardTravels(int $player_id, $used_travels): void
	{
		$this->dbQuery("UPDATE travel SET location = -3, location_arg = null WHERE type IN (".implode(",", $used_travels).")");
		$this->travelsDiscardCounter->inc(count($used_travels));
		$this->notify->player($player_id,"discardTravels_", clienttranslate('${player_name} discards their used Travel cards'), [
			"player_id" => $player_id,
			"travels" => $used_travels,
		]);
		$this->saveLog(LogType::Help, ["discard" => true]);
	}

	/**
	 * Reshuffle discarded travels back into the deck.
	 *
	 * @throws OutOfRangeCounterException
	 */
	public function reshuffleTravels(): void
	{
		$discards = array_map('intval', $this->getObjectListFromDB("SELECT type FROM travel WHERE location = -3", true));
		$locations = range(1, count($discards));
		shuffle($locations);
		foreach ($discards as $discard) {
			$location = array_shift($locations);
			$this->dbQuery("UPDATE travel SET location = -2, location_arg = $location WHERE type = $discard");
		}
		$this->travelsCounter->set(count($discards));
		$this->travelsDiscardCounter->set(0);
	}
}