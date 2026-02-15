<?php

declare(strict_types=1);

namespace Bga\Games\Postcards\States;

use Bga\GameFramework\Components\Counters\OutOfRangeCounterException;
use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;

use Bga\Games\Postcards\Game;
use Bga\Games\Postcards\Log\LogType;

use Bga\Games\Postcards\Log\Undo\Undo;

use BgaSystemException;
use BgaUserException;
use BgaVisibleSystemException;

/**
 * Handles the "Camp" game state.
 *
 * Occurs when a player activates a Camp action through a Travel card or bonus.
 * Player must place an available camp on a campsite in their current region.
 */
class Camp extends GameState
{
	use Undo;
	
	function __construct(
		protected Game $game,
	) {
		parent::__construct($game,
			id: 12,
			type: StateType::ACTIVE_PLAYER,
			description: clienttranslate('${actplayer} must place a Camp on a campsite in their region'),
			descriptionMyTurn: clienttranslate('${you} must place a Camp on a campsite in your region'),
		);
	}

	/**
	 * Get game state arguments for the Camp state.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @return array<string,mixed> State arguments including region, available campsites, and undo level.
	 * @throws BgaSystemException
	 */
	public function getArgs(int $active_player_id): array
	{
		// Get undo arg
		$args = $this->game->getCommonArgs();
		// Get some values from the current game situation from the database.
		$region = intval($this->game->getUniqueValueFromDb("SELECT biker FROM player WHERE player_id = {$active_player_id}"));
		$args["region"] = $region;
		$args["campsites"] = $this->game->getAvailableCampsites($region);
		$last_log = $this->game->getLastLog(1);
		$args["gift_bonus"] = ($last_log !== null && $last_log["type"] === LogType::ActionGift);
		// Return the array
		return $args;
	}

	/**
	 * Player places a camp on an available campsite.
	 *
	 * Actions:
	 *  - Validates campsite availability
	 *  - Inserts camp into database
	 *  - Awards immediate bonus or scoring based on camp number
	 *  - Checks for "Best Traveller in the Region" achievement
	 *  - Determines next state (Star or Souvenir)
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments.
	 * @param int $campsite Campsite location within the region.
	 * @return string Next state class.
	 * @throws BgaUserException
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actCamp(int $active_player_id, array $args, int $campsite): string
	{
		// Check action possibility
		if (!in_array($campsite, $args['campsites']))
			throw new BgaVisibleSystemException("Camp.php [actCamp] - Invalid campsite: {$campsite}");
		// Save database changes
		$camp = intval($this->game->getUniqueValueFromDb("SELECT count(*) FROM camp WHERE player_id = $active_player_id")) + 1;
		$region = $args["region"];
		$log_args = ["camp" => $camp, "region" => $region, "campsite" => $campsite];
		$this->game->DbQuery("INSERT INTO camp (player_id, region, location) VALUES ($active_player_id, $region, $campsite)");
		switch ($camp) {
			case 5: if ($this->tableOptions->get(100) === 1) $this->game->postcardBonusCounter->inc(1); break;
			case 7: if ($this->tableOptions->get(100) === 1) $this->game->moveBonusCounter->inc(1); break;
			case 9: if ($this->tableOptions->get(100) === 1) $this->game->stampBonusCounter->inc(1); break;
			case 11: $this->playerScore->inc($active_player_id, 1); break;
			case 12: $this->playerScore->inc($active_player_id, 3); break;
			case 13: $this->playerScore->inc($active_player_id, 7); break;
		}
		// Notify client
		if ($this->tableOptions->get(100) === 1 && ($camp === 5 || $camp === 7 || $camp === 9)) {
			$e = ($camp === 5 ? clienttranslate('Postcard') : ($camp === 7 ? clienttranslate('Movement') : clienttranslate('Stamp')));
			$this->notify->all("camp", clienttranslate('${player_name} places a Camp and gains a ${e} effect'), [
				"player_id" => $active_player_id,
				"camp" => $camp,
				"region" => $region,
				"campsite" => $campsite,
				"e" => $e,
				"i18n" => array('e')
			]);
		}
		else if ($camp === 11 || $camp === 12 || $camp === 13) {
			$points = ($camp === 11 ? 1 : ($camp === 12 ? 3 : 7));
			if ($points === 1) $msg = clienttranslate('${player_name} places a Camp and scores 1 point');
			else $msg = clienttranslate('${player_name} places a Camp and scores ${points} points');
			$this->notify->all("camp", $msg, [
				"player_id" => $active_player_id,
				"camp" => $camp,
				"region" => $region,
				"campsite" => $campsite,
				"points" => $points,
			]);
			$this->playerStats->inc("placed_camps_points", $points, $active_player_id);
		}
		else {
			$this->notify->all("camp", clienttranslate('${player_name} places a Camp'), [
				"player_id" => $active_player_id,
				"camp" => $camp,
				"region" => $region,
				"campsite" => $campsite,
			]);
		}
		// Update stats
		$this->playerStats->inc("placed_camps", 1, $active_player_id);
		// Check "Best Traveller in the Region"
		$log_args["best_traveller"] = $this->game->checkBestTraveller($active_player_id, $region);
		// Save log
		$this->game->saveLog(LogType::Camp, $log_args);
		// Move to the next state
		if ($this->tableOptions->get(100) === 2 && ($camp === 5 || $camp === 7 || $camp === 9)) return Star::class;
		else return Souvenir::class;
	}

	/**
	 * Player skips camp placement (only available if bonus from gift action).
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments.
	 * @return string Next state class (Action).
	 * @throws OutOfRangeCounterException
	 * @throws BgaUserException
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actSkip(int $active_player_id, array $args): string
	{
		// Check action possibility
		if (!$args["gift_bonus"])
			throw new BgaUserException('Camp.php [actSkip] Cant skip this action');
		// Save log
		$this->game->saveLog(LogType::SkipCamp);
		// Move to the next state
		return Action::class;
	}

	/**
	 * Zombie mode: automatically handle turn for disconnected player.
	 *
	 * @param int $playerId Disconnected player ID.
	 * @return string Next state class.
	 */
	function zombie(int $playerId): string
	{
		// Example of zombie level 0:
		return NextPlayer::class;
	}
}