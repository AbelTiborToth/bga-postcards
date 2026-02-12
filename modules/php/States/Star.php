<?php

declare(strict_types=1);

namespace Bga\Games\Postcards\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;

use Bga\Games\Postcards\Game;
use Bga\Games\Postcards\Log\LogType;

use Bga\Games\Postcards\Log\Undo\Undo;

use BgaSystemException;
use BgaVisibleSystemException;

/**
 * Handles the "Star" game state
 *
 * This state occurs when a player completes a postcard with a star souvenir effect.
 * The player must choose one of three bonus actions to activate immediately.
 * 
 * Responsibilities:
 *  - Validating star effect selection
 *  - Awarding the chosen bonus action
 *  - Logging the star effect usage
 *  - Notifying clients of the selection
 */
class Star extends GameState
{
	use Undo;
	
	function __construct(
		protected Game $game,
	) {
		parent::__construct($game,
			id: 21,
			type: StateType::ACTIVE_PLAYER,
			description: clienttranslate('${actplayer} must choose an effect for the Star effect'),
			descriptionMyTurn: clienttranslate('${you} must choose an effect for the Star effect'),
		);
	}

	/**
	 * Get game state arguments for the Star state.
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
	 * Player selects a star effect to activate.
	 *
	 * Actions:
	 *  - Validates effect is one of three valid options (1=Move, 2=Postcard, 3=Stamp)
	 *  - Increments appropriate bonus counter based on effect choice:
	 *    - Effect 1: +1 movement action
	 *    - Effect 2: +1 postcard action
	 *    - Effect 3: +1 stamp token
	 *  - Notifies clients of the selected effect
	 *  - Logs the star effect usage
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments (currently unused).
	 * @param int $effect Star effect choice (1=Movement, 2=Postcard, 3=Stamp).
	 * @return string Next state class (Souvenir).
	 * @throws BgaSystemException
	 * @throws BgaVisibleSystemException
	 */
	#[PossibleAction]
	public function actStar(int $active_player_id, array $args, int $effect): string
	{
		// Check action possibility
		if ($effect !== 1 && $effect !== 2 && $effect !== 3)
			throw new BgaVisibleSystemException("Star.php [actStar] - Invalid star effect $effect");
		// Save database changes
		$e = "";
		switch ($effect) {
			case 1: {
				$this->game->moveBonusCounter->inc(1); break;
				$e = clienttranslate('Movement');
			}
			case 2: {
				$this->game->postcardBonusCounter->inc(1); break;
				$e = clienttranslate('Postcard');
			}
			case 3: {
				$this->game->stampBonusCounter->inc(1); break;
				$e = clienttranslate('Stamp');
			}
		}
		// Notify client
		$this->notify->all("star", clienttranslate('${player_name} chooses a ${e} effect for the Star effect'), [
			"player_id" => $active_player_id,
			"e" => $e,
		]);
		// Save log
		$this->game->saveLog(LogType::Star, ["effect" => $effect]);
		// Move to the next state
		return Souvenir::class;
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