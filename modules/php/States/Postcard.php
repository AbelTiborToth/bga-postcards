<?php

declare(strict_types=1);

namespace Bga\Games\Postcards\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;

use Bga\Games\Postcards\Game;
use Bga\Games\Postcards\Log\LogType;

use Bga\Games\Postcards\Log\Undo\Undo;

use Bga\Games\Postcards\States\NextPlayer;
use BgaUserException;
use BgaVisibleSystemException;

/**
 * Handles the "Postcard" game state
 *
 * This state occurs when a player activates a Postcard action through a Travel card.
 * The player must take a postcard from the supply row or the top of the deck.
 * Optionally, they can discard the supply row to reveal new postcards.
 */
class Postcard extends GameState
{
	use Undo;
	
	function __construct(
		protected Game $game,
	) {
		parent::__construct($game,
			id: 13,
			type: StateType::ACTIVE_PLAYER,
			description: clienttranslate('${actplayer} must take a Postcard from the supply'),
			descriptionMyTurn: clienttranslate('${you} must take a Postcard from the supply'),
		);
	}

	/**
	 * Get game state arguments for the Postcard state.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @return array<string,mixed> State arguments including supply row, deck top, and discard availability.
	 * @throws \BgaSystemException
	 */
	public function getArgs(int $active_player_id): array
	{
		// Get undo arg
		$args = $this->game->getCommonArgs();
		// Get some values from the current game situation from the database.
		$args["row"] = $this->game->getPostcardsFromSupplyRow();
		$args["deck"] = $this->game->getPostcardFromSupplyDeck();
		$args["discard"] = $this->game->getLastLog()["type"] !== LogType::DiscardPostcards && !($this->game->postcardsDiscardCounter->get() === 0 && $this->game->postcardsCounter->get() <= 1);
		// Return the array
		return $args;
	}

	/**
	 * Player takes a postcard from the supply row or deck.
	 *
	 * Actions:
	 *  - Validates postcard is in supply or is the deck top
	 *  - Moves postcard to player's collection
	 *  - Updates deck counter if taking from deck
	 *  - Reshuffles postcards if deck becomes empty
	 *  - Refills supply row
	 *  - Logs action (non-undoable)
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments with available postcards.
	 * @param int $postcard Postcard ID to take.
	 * @return string Next state class (Action).
	 * @throws BgaUserException
	 * @throws \BgaVisibleSystemException
	 * @throws \BgaSystemException
	 */
	#[PossibleAction]
	public function actPostcard(int $active_player_id, array $args, int $postcard): string
	{
		// Check action possibility
		if (!in_array($postcard, $args['row']) && $postcard !== $args['deck'])
			throw new BgaVisibleSystemException("Postcard.php [actMove] - Invalid postcard: $postcard");
		// Save database changes
		$location_arg = intval($this->game->getUniqueValueFromDb("SELECT max(location_arg) FROM postcard WHERE location = $active_player_id")) + 1;
		$this->game->DbQuery("UPDATE postcard SET location = $active_player_id, location_arg = $location_arg WHERE type = $postcard");
		// Notify client
		if ($postcard !== $args['deck']) {
			$this->notify->all("postcard", clienttranslate('${player_name} takes a Postcard'), [
				"player_id" => $active_player_id,
				"postcard" => $postcard,
			]);
		} else {
			$this->game->postcardsCounter->inc(-1);
			if ($this->game->postcardsCounter->get() === 0) $this->game->reshufflePostcards();
			if ($this->game->postcardsCounter->get() === 0) {
				$this->notify->all("postcardDeck", clienttranslate('${player_name} takes the top Postcard from the deck'), [
					"player_id" => $active_player_id,
					"postcard" => $postcard
				]);
			} else {
				$new_top = $this->game->getUniqueValueFromDB("SELECT MIN(location_arg) FROM postcard WHERE location = -2 GROUP BY location");
				$this->notify->all("postcardDeck", clienttranslate('${player_name} takes the top Postcard from the deck'), [
					"player_id" => $active_player_id,
					"postcard" => $postcard,
					"top" => intval($this->game->getUniqueValueFromDB("SELECT type FROM postcard WHERE location = -2 AND location_arg = $new_top"))
				]);
			}
		}
		// Save log
		$this->game->saveLog(LogType::Postcard, null, 0);
		$this->game->refillPostcardSupply();
		// Move to the next state
		return Action::class;
	}

	/**
	 * Player discards the entire supply row to reveal new postcards.
	 *
	 * Actions:
	 *  - Validates discard is allowed (not done this turn, deck not nearly empty)
	 *  - Moves all supply row postcards to discard pile
	 *  - Updates discard counter
	 *  - Refills supply with new postcards
	 *  - Logs action (non-undoable)
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments with discard availability flag.
	 * @return string Next state class (Postcard - stays in same state for new take).
	 * @throws BgaUserException
	 * @throws \BgaVisibleSystemException
	 * @throws \BgaSystemException
	 */
	#[PossibleAction]
	public function actDiscardPostcards(int $active_player_id, array $args): string
	{
		// Check action possibility
		if (!$args["discard"])
			throw new BgaVisibleSystemException("Postcard.php [actDiscardPostcards] - Can't perform discard action as it was performed before");
		// Save database changes
		$row = $this->game->getPostcardsFromSupplyRow();
		foreach ($row as $postcard) $this->game->dbQuery("UPDATE postcard SET location = -3, location_arg = null WHERE type = $postcard");
		$this->game->postcardsDiscardCounter->inc(3);
		// Notify client
		$this->notify->all("discardPostcards", clienttranslate('${player_name} discarded the Postcard supply row and revealed 3 new Postcards'), [
			"player_id" => $active_player_id,
		]);
		$this->game->refillPostcardSupply();
		// Save log
		$this->game->saveLog(LogType::DiscardPostcards, null, 0);
		// Move to the next state
		return Postcard::class;
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