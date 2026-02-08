<?php

declare(strict_types=1);

namespace Bga\Games\Postcards\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\Games\Postcards\Game;

use Bga\Games\Postcards\Log\Undo\Undo;

use BgaSystemException;
use BgaUserException;
use BgaVisibleSystemException;

/**
 * Handles the "Confirm" game state
 *
 * This state occurs at the end of a player's turn and allows them to confirm their actions.
 * If no undo is available, automatically confirms the turn.
 * 
 * Responsibilities:
 *  - Providing turn confirmation UI
 *  - Resetting bonus action counters
 *  - Clearing the action log
 *  - Refilling the travel supply
 */
class Confirm extends GameState
{
	use Undo;
	
	function __construct(
		protected Game $game,
	) {
		parent::__construct($game,
			id: 89,
			type: StateType::ACTIVE_PLAYER,
			description: clienttranslate('${actplayer} must confirm their turn'),
			descriptionMyTurn: clienttranslate('${you} must confirm your turn'),
		);
	}

	/**
	 * Get game state arguments for the Confirm state.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @return array<string,mixed> State arguments including undo level.
	 * @throws BgaSystemException
	 */
	public function getArgs(int $active_player_id): array
	{
		// Get undo arg
		return $this->game->getCommonArgs(false);
	}

	/**
	 * Handle automatic confirmation when entering state.
	 *
	 * If no undo steps are available, immediately confirm the turn.
	 *
	 * @param array<string,mixed> $args State arguments.
	 * @return string|null Next state class or null to wait for player action.
	 * @throws BgaSystemException
	 */
	function onEnteringState(array $args): ?string
	{
		if ($args["undo"] === 0) return $this->actConfirm();
		return null;
	}

	/**
	 * Player confirms their turn and ends it.
	 *
	 * Actions:
	 *  - Clears the action log
	 *  - Resets all bonus action counters to 0
	 *  - Refills the travel card supply
	 *  - Moves to the next player
	 *
	 * @return string Next state class (NextPlayer).
	 * @throws BgaUserException
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actConfirm(): string
	{
		$this->game->clearFullLog();
		$this->game->moveBonusCounter->set(0);
		$this->game->postcardBonusCounter->set(0);
		$this->game->campBonusCounter->set(0);
		$this->game->stampBonusCounter->set(0);
		$this->game->travelBonusCounter->set(0);
		$this->game->refillTravelSupply();
		return NextPlayer::class;
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