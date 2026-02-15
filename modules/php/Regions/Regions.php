<?php

namespace Bga\Games\Postcards\Regions;

use BgaSystemException;

/**
 * Region utilities for adjacency, campsite colors, counts, and best-traveller scoring.
 */
trait Regions
{
	/**
	 * Get adjacent regions for movement.
	 *
	 * @param int $region_id Region ID.
	 * @return array<int,int> Neighbouring region IDs.
	 */
	public function getNeighbouringRegions(int $region_id): array
	{
		return match ($region_id) {
			1 => [2, 3, 4, 10, 13],
			2 => [1, 3, 13],
			3 => [1, 2, 4],
			4 => [1, 3, 5, 10],
			5 => [4, 6, 8, 9, 10],
			6 => [5, 7, 8],
			7 => [6, 8],
			8 => [5, 6, 7, 9],
			9 => [5, 8, 10, 11],
			10 => [1, 4, 5, 9, 11, 13],
			11 => [9, 10, 12, 13],
			12 => [11, 13],
			13 => [1, 2, 10, 11, 12],
		};
	}

	/**
	 * Check and score Best Traveller for a region when all campsites are occupied by the player.
	 *
	 * @param int $player_id Player ID.
	 * @param int $region    Region ID.
	 * @return int Points awarded (0 if not all campsites are filled).
	 * @throws BgaSystemException
	 */
	public function checkBestTraveller(int $player_id, int $region): int
	{
		$count = intval($this->getUniqueValueFromDb("SELECT count(*) FROM camp WHERE player_id = $player_id AND region = $region"));
		$n = $this->getCampsiteCount($region);
		if ($count === $n) {
			$this->playerScore->inc($player_id, $count);
			$this->notify->all("best_traveller", clienttranslate('${player_name} becomes the Best Traveler in region ${region} and scores ${n} points'), [
				"player_id" => $player_id,
				"player_color" => $this->getPlayerColorById($player_id),
				"region" => $region,
				"n" => $n
			]);
			// Update stats
			$this->playerStats->inc("best_traveller", 1, $player_id);
			$this->playerStats->inc("best_traveller_points", $count, $player_id);
			return $count;
		}
		else return 0;
	}

	/**
	 * Get available campsite indices in a region.
	 *
	 * @param int $region Region ID.
	 * @return array<int,int> List of free campsite locations.
	 */
	public function getAvailableCampsites(int $region): array
	{
		$count = match ($region) {
			1, 10 => 3,
			3, 4, 6, 7, 12, 13 => 4,
			2, 5, 9, 11 => 5,
			8 => 6
		};
		$res = [];
		$camps = array_map('intval', $this->getObjectListFromDb("SELECT location FROM camp WHERE region = $region", true));
		for ($i = 1; $i <= $count; $i++) if (!in_array($i, $camps)) $res[] = $i;
		return $res;
	}

	/**
	 * Get campsite color/type for a given region/location.
	 *
	 * @param int $region   Region ID.
	 * @param int $campsite Campsite index within the region.
	 * @return int Color/type ID.
	 */
	public function getCampsiteColor(int $region, int $campsite): int
	{
		$types = [
			[1, 3, 3],
			[8, 4, 7, 2, 5],
			[2, 1, 4, 6],
			[5, 6, 4, 3],
			[2, 6, 6, 4, 3],
			[5, 3, 7, 8],
			[8, 4, 6, 7],
			[2, 1, 8, 6, 3, 6],
			[2, 4, 5, 7, 8],
			[1, 1, 5],
			[4, 1, 2, 3, 7],
			[7, 1, 8, 5],
			[8, 7, 5, 2],
		];
		return $types[$region - 1][$campsite - 1];
	}

	/**
	 * Get the number of campsites in a region.
	 *
	 * @param int $region Region ID.
	 * @return int Campsite count.
	 */
	public function getCampsiteCount(int $region): int
	{
		return match ($region) {
			1, 10 => 3,
			3, 4, 6, 7, 12, 13 => 4,
			2, 5, 9, 11 => 5,
			8 => 6
		};
	}
}