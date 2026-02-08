<?php

declare(strict_types=1);

namespace Bga\Games\Postcards\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;

use Bga\Games\Postcards\Game;
use Bga\Games\Postcards\Log\LogType;

use Bga\Games\Postcards\Log\Undo\Undo;

use BgaUserException;
use BgaVisibleSystemException;

/**
 * Handles the "Move" game state
 *
 * This state occurs when a player activates a Movement action through a Travel card or bonus.
 * The player must move their biker to an adjacent region.
 */
class Move extends GameState
{
	use Undo;
	
	function __construct(
		protected Game $game,
	) {
		parent::__construct($game,
			id: 11,
			type: StateType::ACTIVE_PLAYER,
			description: clienttranslate('${actplayer} must move their Biker to a neighbouring region'),
			descriptionMyTurn: clienttranslate('${you} must move your Biker to a neighbouring region'),
		);
	}

	/**
	 * Get game state arguments for the Move state.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @return array<string,mixed> State arguments including current biker position and neighbouring regions.
	 * @throws \BgaSystemException
	 */
	public function getArgs(int $active_player_id): array
	{
		// Get undo arg
		$args = $this->game->getCommonArgs();
		// Get some values from the current game situation from the database.
		$biker = intval($this->game->getUniqueValueFromDb("SELECT biker FROM player WHERE player_id = {$active_player_id}"));
		$args["biker"] = $biker;
		$args["regions"] = $this->game->getNeighbouringRegions($biker);
		// Return the array
		return $args;
	}

	/**
	 * Player moves their biker to an adjacent region.
	 *
	 * Actions:
	 *  - Validates target region is adjacent to current position
	 *  - Updates biker position in database
	 *  - Checks if optional Camp action should follow (gift bonus)
	 *  - Logs the movement action
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments with valid regions.
	 * @param int $region Target region to move biker to.
	 * @return string Next state class (Camp or Action).
	 * @throws BgaUserException
	 * @throws BgaVisibleSystemException
	 * @throws \BgaSystemException
	 */
	#[PossibleAction]
	public function actMove(int $active_player_id, array $args, int $region): string
	{
		// Check action possibility
		if (!in_array($region, $args['regions']))
			throw new BgaVisibleSystemException("Move.php [actMove] - Invalid region: {$region}");
		// Save database changes
		$log_args = ["region" => $args["biker"]];
		$this->game->DbQuery("UPDATE player SET biker = {$region} WHERE player_id = {$active_player_id}");
		// Notify client
		$this->notify->all("move", clienttranslate('${player_name} moves to region ${region}'), [
			"player_id" => $active_player_id,
			"region" => $region,
		]);
		// Update stats
		$this->playerStats->inc("action_move", 1, $active_player_id);
		// Save log
		$this->game->saveLog(LogType::Move, $log_args);
		// Move to the next state
		if ($this->game->getLastLog(1)["type"] === LogType::ActionGift &&
			count($this->game->getAvailableCampsites($region)) !== 0 &&
			intval($this->game->getUniqueValueFromDb("SELECT count(*) FROM camp WHERE player_id = $active_player_id")) !== 13
		) return Camp::class;
		else return Action::class;
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