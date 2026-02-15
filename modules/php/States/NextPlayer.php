<?php

declare(strict_types=1);

namespace Bga\Games\Postcards\States;

use Bga\GameFramework\States\GameState;
use Bga\GameFramework\StateType;
use Bga\Games\Postcards\Game;
use BgaSystemException;

/**
 * Handles the "NextPlayer" game state
 *
 * This state occurs between player turns to determine the next active player
 * or end the game if the last round is complete.
 *
 * Responsibilities:
 *  - Tracking turn statistics for players
 *  - Checking end-game conditions
 *  - Transitioning to EndScore or next player's turn
 */
class NextPlayer extends GameState
{
	function __construct(
		protected Game $game,
	) {
		parent::__construct($game,
			id: 90,
			type: StateType::GAME,
			updateGameProgression: true,
		);
	}

	/**
	 * Handle transition to the next player or end of game.
	 *
	 * Actions:
	 *  - Increments turn statistics for the current player
	 *  - Checks if the game has reached end conditions
	 *    (last round completed and last player has finished their turn)
	 *  - Either transitions to EndScore state or activates the next player
	 *
	 * @param int $active_player_id Current active player ID.
	 * @return string Next state class (EndScore or Action).
	 * @throws BgaSystemException
	 */
	function onEnteringState(int $active_player_id): string
	{
		// Inc turn number statistics
		$this->playerStats->inc("turns_number", 1, $active_player_id, true);
		// Check the end game condition
		$is_last_round = $this->game->isLastRound();
		$is_last_player = $active_player_id === intval($this->game->getUniqueValueFromDb("SELECT player_id FROM player ORDER BY player_no DESC LIMIT 1"));
		$gameEnd = ($is_last_round && $is_last_player);
		// Move to the next state
		if ($gameEnd) {
			return EndScore::class;
		} else {
			// Give some extra time to the active player when he completed an action
			$this->game->giveExtraTime($active_player_id);
			$this->game->activeNextPlayer();
			return Action::class;
		}
	}
}