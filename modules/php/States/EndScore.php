<?php

declare(strict_types=1);

namespace Bga\Games\Postcards\States;

use Bga\GameFramework\Components\Counters\OutOfRangeCounterException;
use Bga\GameFramework\Components\Counters\UnknownPlayerException;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\StateType;
use Bga\Games\Postcards\Game;
use BgaSystemException;

/**
 * Handles the "EndScore" game state
 *
 * This is the final game state where end-game scoring is calculated.
 * All players' scores are finalized including:
 *  - Itinerary card bonuses
 *  - End game bonus token (if earned)
 *  - Gift card scoring
 *  - Unsent postcard penalties
 *  - Tiebreaker calculation
 */
class EndScore extends GameState
{

	function __construct(
		protected Game $game,
	) {
		parent::__construct($game,
			id: 98,
			type: StateType::GAME,
			description: clienttranslate('End game scoring...'),
		);
	}

	/**
	 * Calculate final end-game scores for all players.
	 *
	 * Actions:
	 *  - Scores itinerary card completion for each player
	 *  - Awards end game bonus if earned
	 *  - Scores all collected gift cards
	 *  - Applies penalty for unsent postcards
	 *  - Calculates tiebreaker values
	 *
	 * @return int Next state ID (99 for game end).
	 * @throws OutOfRangeCounterException
	 * @throws UnknownPlayerException
	 * @throws BgaSystemException
	 */
	public function onEnteringState(): int
	{
		$players = array_map('intval', $this->game->getObjectListFromDB("SELECT player_id id FROM player ORDER BY player_no", true));
		$end_bonus = $this->globals->get("end_bonus");
		foreach ($players as $player_id) {
			$this->scoreItineraryCard($player_id);
			if ($end_bonus === $player_id) $this->scoreEndBonus($player_id);
			$this->scoreGifts($player_id);
			$this->scoreUnsentPostcards($player_id);
			$this->calculateTiebreaker($player_id);
		}
		// Clear log
		$notifs = $this->game->getCollectionFromDb("SELECT gamelog_move_id, gamelog_notification FROM gamelog");
		foreach ($notifs as $notif) {
			$logs = json_decode($notif["gamelog_notification"], true);
			foreach ($logs as $log) {
				if ($log["type"] === "cancelNotifs") {
					$this->game->dbQuery("DELETE FROM gamelog WHERE gamelog_move_id = {$notif['gamelog_move_id']}");
					break;
				}
			}
		}
		// Move to the next state (game end)
		return 99;
	}

	/**
	 * Score itinerary card completion bonus.
	 *
	 * Checks how many of the 4 required regions have sent postcards:
	 *  - 0 regions: 0 points
	 *  - 1 region: 2 points
	 *  - 2 regions: 4 points
	 *  - 3 regions: 7 points
	 *  - 4 regions: 11 points
	 *
	 * @param int $player_id Player ID.
	 * @throws BgaSystemException
	 */
	public function scoreItineraryCard(int $player_id): void
	{
		$postcards = array_unique(array_map(fn($postcard) => $this->game->getPostcardRegion(intval($postcard)), $this->game->getObjectListFromDb("SELECT type FROM postcard WHERE location = $player_id AND location_arg IS null", true)));
		$itinerary = intval($this->game->getUniqueValueFromDB("SELECT itinerary FROM player WHERE player_id = {$player_id}"));
		$itinerary_postcards = $this->game->getItineraryPostcards($itinerary);
		$count = 0;
		foreach ($itinerary_postcards as $postcard) if (in_array($postcard, $postcards)) $count++;
		$score = match ($count) {
			0 => 0,
			1 => 2,
			2 => 4,
			3 => 7,
			default => 11,
		};
		$this->playerScore->inc($player_id, $score);
		$this->game->playerStats->inc("itinerary_points", $score, $player_id);
		$this->notify->all("scoreItinerary", clienttranslate('${player_name} scores ${n} points for their Itinerary card'), [
			"player_id" => $player_id,
			"player_color" => $this->game->getPlayerColorById($player_id),
			"n" => $score,
		]);
	}

	/**
	 * Award end game bonus points (3 points).
	 *
	 * @param int $player_id Player ID who earned the bonus.
	 * @throws OutOfRangeCounterException
	 * @throws UnknownPlayerException
	 */
	public function scoreEndBonus(int $player_id): void {
		$this->game->playerScore->inc($player_id, 3);
		$this->game->playerStats->inc("end_bonus_points", 3, $player_id);
		$this->notify->all("scoreEndBonus", clienttranslate('${player_name} scores 3 points for the End Bonus token'), [
			"player_id" => $player_id,
			"player_color" => $this->game->getPlayerColorById($player_id),
		]);
	}

	/**
	 * Score all collected gift cards.
	 *
	 * Evaluates each gift type:
	 *  - Keychains (1-8): Score based on camps on matching color
	 *  - Snow Globes (9-16): Score based on total collected (once)
	 *  - Caravan (17): Score based on regions with 2+ camps
	 *
	 * @param int $player_id Player ID.
	 * @throws OutOfRangeCounterException
	 * @throws UnknownPlayerException
	 */
	public function scoreGifts(int $player_id): void {
		$gifts = array_map('intval', $this->game->getObjectListFromDb("SELECT type FROM gift WHERE location = $player_id", true));
		if (!empty($gifts)) {
			$camps = array_map(function ($value) {return array_map('intval', $value);}, $this->game->getDoubleKeyCollectionFromDB("SELECT region, location FROM camp WHERE player_id = $player_id"));
			$snow_globe = false;
			foreach ($gifts as $gift) {
				if ($gift === 1) $this->game->scoreKeyGift($player_id, $gift, $camps, 8);
				else if ($gift === 2) $this->game->scoreKeyGift($player_id, $gift, $camps, 4);
				else if ($gift === 3) $this->game->scoreKeyGift($player_id, $gift, $camps, 7);
				else if ($gift === 4) $this->game->scoreKeyGift($player_id, $gift, $camps, 1);
				else if ($gift === 5) $this->game->scoreKeyGift($player_id, $gift, $camps, 2);
				else if ($gift === 6) $this->game->scoreKeyGift($player_id, $gift, $camps, 3);
				else if ($gift === 7) $this->game->scoreKeyGift($player_id, $gift, $camps, 6);
				else if ($gift === 8) $this->game->scoreKeyGift($player_id, $gift, $camps, 5);
				else if (in_array($gift, [9, 10, 11, 12, 13, 14, 15, 16])) {
					if (!$snow_globe) {
						$this->game->scoreSnowGlobes($player_id, $gift, $gifts);
						$snow_globe = true;
					}
				}
				else if ($gift === 17) $this->game->scoreCaravanGift($player_id, $gift, $camps);
			}
		}
	}

	/**
	 * Apply penalty for unsent postcards (1 point each).
	 *
	 * @param int $player_id Player ID.
	 * @throws OutOfRangeCounterException
	 * @throws UnknownPlayerException
	 * @throws BgaSystemException
	 */
	public function scoreUnsentPostcards(int $player_id): void {
		$score = intval($this->game->getUniqueValueFromDb("SELECT count(*) FROM postcard WHERE location = $player_id AND location_arg IS NOT null"));
		if ($score > 0) {
			$this->game->playerScore->inc($player_id, $score);
			$this->game->playerStats->inc("unsent_postcards_points", $score, $player_id);
			$this->notify->all("scoreUnsentPostcards", clienttranslate('${player_name} scores ${n} points for their unsent Postcards'), [
				"player_id" => $player_id,
				"player_color" => $this->game->getPlayerColorById($player_id),
				"n" => $score,
			]);
		}
	}

	/**
	 * Calculate tiebreaker value: (sent_postcards * 100) + placed_camps.
	 *
	 * Used to break ties in final scoring.
	 *
	 * @param int $player_id Player ID.
	 * @throws OutOfRangeCounterException
	 * @throws UnknownPlayerException
	 */
	public function calculateTiebreaker(int $player_id): void {
		$postcards = $this->game->playerStats->get("sent_postcards", $player_id);
		$camps = $this->game->playerStats->get("placed_camps", $player_id);
		$aux = ($postcards * 100) + $camps;
		$this->game->playerScoreAux->set($player_id, $aux);
	}
}