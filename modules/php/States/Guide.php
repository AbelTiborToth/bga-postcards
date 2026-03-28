<?php

declare(strict_types=1);

namespace Bga\Games\Postcards\States;

use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\StateType;
use Bga\Games\Postcards\Game;
use BgaSystemException;
use BgaVisibleSystemException;

/**
 * Handles the "Guide" game state
 *
 * This state occurs during the guide phase where players select postcards from the deck.
 * Players must select 1 or 2 postcards depending on how many were revealed.
 * All remaining postcards are discarded back to the discard pile.
 */
class Guide extends GameState
{
	function __construct(
		protected Game $game,
	) {
		parent::__construct($game,
			id: 35,
			type: StateType::ACTIVE_PLAYER,
			description: clienttranslate('${actplayer} must take two Postcards and discard the rest'),
			descriptionMyTurn: clienttranslate('${you} must take two Postcards and discard the rest'),
		);
	}

	/**
	 * Get game state arguments for the Guide state.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @return array<string,mixed> State arguments including postcards available for selection.
	 * @throws BgaSystemException
	 */
	public function getArgs(int $active_player_id): array
	{
		// Get undo arg
		$args = $this->game->getCommonArgs();
		// Get postcards to choose
		$args["postcards"] = array_map('intval', $this->game->getObjectListFromDB("SELECT type FROM postcard WHERE location = -4", true));
		// Return the array
		return $args;
	}

	/**
	 * Handle automatic transitions when entering Guide state.
	 *
	 * If fewer than 2 postcards are available, automatically proceed with selection.
	 * If no postcards available, skip to Action state.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments.
	 * @return string|null Next state class or null to wait for player action.
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 */
	public function onEnteringState(int $active_player_id, array $args): ?string {
		if (count($args["postcards"]) === 2) return $this->actGuide($active_player_id, $args, $args["postcards"][0], $args["postcards"][1]);
		else if (count($args["postcards"]) === 1) return $this->actGuide($active_player_id, $args, $args["postcards"][0]);
		else if (count($args["postcards"]) === 0) return Action::class;
		else return null;
	}

	/**
	 * Player selects 1 or 2 postcards from the guide reveal.
	 *
	 * Actions:
	 *  - Validates selected postcards are available
	 *  - Moves selected postcards to player's collection
	 *  - Discards remaining guide postcards to the discard pile
	 *  - Updates discard counter
	 *  - Reshuffles postcards if deck is empty and discards exist
	 *  - Notifies clients of selection
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments with available postcards.
	 * @param int $postcard_1 First postcard ID to take.
	 * @param int|null $postcard_2 Optional second postcard ID to take.
	 * @return string Next state class (Action).
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actGuide(int $active_player_id, array $args, int $postcard_1, ?int $postcard_2 = null): string
	{
		// Check action possibility
		if ($postcard_2 === null && count($args["postcards"]) !== 1)
			throw new BgaVisibleSystemException("Move.php [actMove] - Must take two postcards");
		if (!in_array($postcard_1, $args['postcards']) || ($postcard_2 !== null && !in_array($postcard_2, $args['postcards'])))
			throw new BgaVisibleSystemException("Move.php [actMove] - Invalid postcards: $postcard_1 $postcard_2");
		// Save database changes
		$location_arg = intval($this->game->getUniqueValueFromDb("SELECT max(location_arg) FROM postcard WHERE location = $active_player_id")) + 1;
		$this->game->DbQuery("UPDATE postcard SET location = $active_player_id, location_arg = $location_arg WHERE type = $postcard_1");
		if ($postcard_2 !== null) {
			$location_arg++;
			$this->game->DbQuery("UPDATE postcard SET location = $active_player_id, location_arg = $location_arg WHERE type = $postcard_2");
		}
		$this->game->DbQuery("UPDATE postcard SET location = -3, location_arg = null WHERE location = -4");
		if (count($args['postcards']) > 2) $this->game->postcardsDiscardCounter->inc(count($args['postcards']) - 2);
		// Notify client
		if (count($args['postcards']) !== 1) {
			$this->notify->all("guide", clienttranslate('${player_name} takes two Postcards'), [
				"player_id" => $active_player_id,
				"postcard_1" => $postcard_1,
				"postcard_2" => $postcard_2,
			]);
		} else {
			$this->notify->all("guide1", clienttranslate('${player_name} takes a Postcard'), [
				"player_id" => $active_player_id,
				"postcard_1" => $postcard_1,
			]);
		}
		if ($this->game->postcardsCounter->get() === 0 && $this->game->postcardsDiscardCounter->get() !== 0) {
			$this->game->reshufflePostcards();
			$this->notify->all("revealTopPostcard", '', [
				"top" => $this->game->getPostcardFromSupplyDeck(),
			]);
		}
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