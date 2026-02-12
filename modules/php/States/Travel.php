<?php

namespace Bga\Games\Postcards\States;

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
 * Handles the "Travel" game state
 *
 * This state occurs at the end of a player's turn when they need to draw 5 travel cards.
 * Players can select cards from the travel supply or draw from the travel deck.
 * Once 5 cards are collected, the player moves to the Confirm state.
 * 
 * Responsibilities:
 *  - Validating travel card selections from supply
 *  - Handling travel deck draws
 *  - Managing deck reshuffling when empty
 *  - Tracking hand count and transitioning to Confirm when appropriate
 */
class Travel extends GameState
{
	use Undo;
	
	function __construct(
		protected Game $game,
	) {
		parent::__construct($game,
			id: 20,
			type: StateType::ACTIVE_PLAYER,
			description: clienttranslate('${actplayer} must take Travel cards from the supply'),
			descriptionMyTurn: clienttranslate('${you} must take Travel cards from the supply'),
		);
	}

	/**
	 * Get game state arguments for the Travel state.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @return array<string,mixed> State arguments including hand count and undo level.
	 * @throws BgaSystemException
	 */
	public function getArgs(int $active_player_id): array
	{
		// Get undo arg
		$args = $this->game->getCommonArgs(false);
		// Get used travels
		$args['hand_count'] = $this->game->getTravelsFromHand($active_player_id);
		// Return the array
		return $args;
	}

	function onEnteringState(int $active_player_id, array $args): ?string
	{
		if ($this->game->isLastRound()) {
			return Confirm::class;
		}
		return null;
	}

	/**
	 * Player takes a travel card from the supply row.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments with hand count.
	 * @param int $travel Travel card ID to take from supply.
	 * @return string Next state class (Confirm or Travel).
	 * @throws BgaUserException
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actTravel(int $active_player_id, array $args, int $travel): string
	{
		// Check action possibility
		$travels = $this->game->getTravelsFromSupply();
		if (!in_array($travel, array_column($travels, 'type')))
			throw new BgaUserException('Travel.php [actTravel] Invalid card choice');
		// Save database changes
		$location = 0;
		foreach ($travels as $t) {
			if ($t['type'] == $travel) {
				$location = $t['location'];
				break;
			}
		}
		$log_args = ["travel" => $travel, "location" => $location];
		$this->game->dbQuery("UPDATE travel SET location = $active_player_id, location_arg = null WHERE type = $travel");
		// Notify client
		$this->notify->all("travel",clienttranslate('${player_name} takes a ${color}-${action} Travel card'), [
			"player_id" => $active_player_id,
			"travel" => $travel,
			"color" => $this->game->getTravelColorName($travel),
			"action" => $this->game->getTravelActionName($travel),
			"i18n" => array('color', 'action')
		]);
		// Save log
		$this->game->saveLog(LogType::Travel, $log_args);
		// Move to the next state
		if (count($args["hand_count"]) + 1 === 5) return Confirm::class;
		else return Travel::class;
	}

	/**
	 * Player draws a travel card from the deck.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments with hand count.
	 * @return string Next state class (Confirm or Travel).
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actTravelDeck(int $active_player_id, array $args): string
	{
		// Save database changes
		$top = intval($this->game->getUniqueValueFromDB("SELECT MIN(location_arg) FROM travel WHERE location = -2 GROUP BY location"));
		$travel = intval($this->game->getUniqueValueFromDB("SELECT type FROM travel WHERE location = -2 AND location_arg = $top"));
		$this->game->dbQuery("UPDATE travel SET location = $active_player_id, location_arg = null WHERE type = $travel");
		if ($this->game->travelsCounter->get() === 1) $this->game->reshuffleTravels();
		else $this->game->travelsCounter->inc(-1);
		// Notify client
		$this->notify->all("travelDeck", clienttranslate('${player_name} takes a Travel card from the deck'), [
			"player_id" => $active_player_id,
		]);
		$this->notify->player($active_player_id, "travelDeck_", '', [
			"player_id" => $active_player_id,
			"travel" => $travel,
		]);
		// Save log
		$this->game->saveLog(LogType::Travel, null, 0);
		// Move to the next state
		if (count($args["hand_count"]) + 1 === 5) return Confirm::class;
		else return Travel::class;
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