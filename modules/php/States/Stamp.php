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
use BgaVisibleSystemException;

/**
 * Handles the "Stamp" game state
 *
 * This state occurs when a player plays a Travel card by color to place a stamp,
 * or when a bonus stamp action is available.
 * The player must place a stamp on an available stamp space matching the card color.
 * 
 * Responsibilities:
 *  - Computing available stamp spaces for the card color
 *  - Validating stamp placement choices
 *  - Placing stamps on postcards
 *  - Handling bonus stamp counters from souvenir effects
 */
class Stamp extends GameState
{
	use Undo;
	
	function __construct(
		protected Game $game,
	) {
		parent::__construct($game,
			id: 14,
			type: StateType::ACTIVE_PLAYER,
			description: clienttranslate('${actplayer} must stick a Stamp on one of their Postcards'),
			descriptionMyTurn: clienttranslate('${you} must stick a Stamp on one of your Postcards'),
		);
	}

	/**
	 * Get game state arguments for the Stamp state.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @return array<string,mixed> State arguments including available stamp spaces and undo level.
	 * @throws BgaSystemException
	 */
	public function getArgs(int $active_player_id): array
	{
		// Get undo arg
		$args = $this->game->getCommonArgs();
		// Get some values from the current game situation from the database.
		$log = $this->game->getLastLog();
		if (isset($log["args"]["travel"])) {
			$color = $this->game->getTravelColor($log["args"]["travel"]);
			$args["spaces"] = $this->game->getAvailableStampSpaces($active_player_id, $color);
		} else {
			$args["spaces"] = $this->game->getAvailableStampSpaces($active_player_id);
		}
		// Return the array
		return $args;
	}

	/**
	 * Handle automatic transitions when entering Stamp state.
	 *
	 * If no stamp spaces are available, automatically skip to Action state
	 * and reset the stamp bonus counter.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments with available spaces.
	 * @return string|null Next state class or null to wait for player action.
	 * @throws OutOfRangeCounterException
	 */
	function onEnteringState(int $active_player_id, array $args): ?string
	{
		if (empty($args["spaces"])) {
			$this->game->stampBonusCounter->set(0);
			return Action::class;
		}
		else return null;
	}

	/**
	 * Player places a stamp on an available stamp space.
	 *
	 * Actions:
	 *  - Validates stamp space is available and matches card color
	 *  - Inserts stamp token into database
	 *  - Decrements stamp bonus counter if this is a bonus action
	 *  - Updates statistics (stamp count, bonus action count if applicable)
	 *  - Logs the stamp placement
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments with available spaces.
	 * @param int $postcard Postcard ID to place stamp on.
	 * @param int $space Stamp space location on the postcard.
	 * @return string Next state class (Action).
	 * @throws BgaSystemException
	 * @throws BgaVisibleSystemException
	 */
	#[PossibleAction]
	public function actStamp(int $active_player_id, array $args, int $postcard, int $space): string
	{
		// Check action possibility
		if (!isset($args["spaces"][$postcard]) || !in_array($space, $args["spaces"][$postcard]))
			throw new BgaVisibleSystemException("Stamp.php [actStamp] - Invalid postcard stamp space color: $postcard $space");
		// Save database changes
		$this->game->DbQuery("INSERT INTO stamp (postcard, location) VALUES ('$postcard', '$space')");
		$log_args = ["postcard" => $postcard, "space" => $space];
		if ($this->game->stampBonusCounter->get() !== 0) {
			$log_args["bonus"] = true;
			$this->game->stampBonusCounter->inc(-1);
		}
		// Notify client
		$this->notify->all("stamp", clienttranslate('${player_name} sticks a Stamp'), [
			"player_id" => $active_player_id,
			"postcard" => $postcard,
			"location" => $space,
		]);
		// Update stats
		$this->playerStats->inc("placed_stamps", 1, $active_player_id);
		if (isset($log_args["bonus"])) $this->playerStats->inc("bonus_actions", 1, $active_player_id);
		// Save log
		$this->game->saveLog(LogType::Stamp, $log_args);
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
		return NextPlayer::class;
	}
}