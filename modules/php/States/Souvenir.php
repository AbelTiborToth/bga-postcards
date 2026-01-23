<?php

declare(strict_types=1);

namespace Bga\Games\Postcards\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\Games\Postcards\Game;

use Bga\Games\Postcards\Log\LogType;
use Bga\Games\Postcards\Log\Undo\Undo;

use Bga\Games\Postcards\Postcards\SouvenirBonusType;
use BgaSystemException;
use BgaUserException;
use BgaVisibleSystemException;

/**
 * Handles the "Souvenir" game state
 *
 * This state occurs after a player places a camp and can place a matching souvenir
 * on one of their postcards if an available space matches the camp type.
 * Souvenir placement is optional and grants immediate bonuses.
 * 
 * Responsibilities:
 *  - Providing available souvenir placement spaces based on camp type
 *  - Placing souvenir tokens on postcard spaces
 *  - Awarding souvenir bonus effects (actions, points, etc.)
 *  - Allowing players to skip souvenir placement
 */
class Souvenir extends GameState
{
	use Undo;
	
	function __construct(
		protected Game $game,
	) {
		parent::__construct($game,
			id: 25,
			type: StateType::ACTIVE_PLAYER,
			description: clienttranslate('${actplayer} can place a Souvenir on one of their Postcards'),
			descriptionMyTurn: clienttranslate('${you} can place a Souvenir on one of your Postcards'),
		);
	}

	/**
	 * Get game state arguments for the Souvenir state.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @return array<string,mixed> State arguments including available souvenir spaces and undo level.
	 * @throws BgaSystemException
	 */
	public function getArgs(int $active_player_id): array
	{
		// Get undo arg
		$args = $this->game->getCommonArgs();
		// Get available souvenir spaces
		$log = $this->game->getLastLog();
		if ($log["type"] === LogType::Star) $log = $this->game->getLastLog(1);
		$region = $log["args"]["region"];
		$campsite = $log["args"]["campsite"];
		$color = $this->game->getCampsiteColor($region, $campsite);
		$args["spaces"] = $this->game->getAvailableSouvenirSpaces($active_player_id, $color);
		return $args;
	}

	/**
	 * Handle automatic transitions when entering Souvenir state.
	 *
	 * If no souvenir spaces are available, automatically skip to Action state.
	 *
	 * @param array<string,mixed> $args State arguments with available spaces.
	 * @return string|null Next state class or null to wait for player action.
	 */
	function onEnteringState(array $args): ?string
	{
		if (empty($args["spaces"])) return Action::class;
		else return null;
	}

	/**
	 * Player places a souvenir on an available postcard space.
	 *
	 * Actions:
	 *  - Validates souvenir space is available and matches camp type
	 *  - Inserts souvenir token into database
	 *  - Awards souvenir bonus effect based on space type:
	 *    - Movement: +2 movement actions
	 *    - Postcard: +1 postcard action
	 *    - Camp: +1 camp action
	 *    - Stamp: +1 stamp token
	 *    - Travel: +1 travel card (max 2)
	 *    - Point: +2 immediate points
	 *  - Logs the souvenir placement
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments with available spaces.
	 * @param int $postcard Postcard ID to place souvenir on.
	 * @param int $space Souvenir space location on the postcard.
	 * @return string Next state class (Action).
	 * @throws BgaUserException
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actSouvenir(int $active_player_id, array $args, int $postcard, int $space): string
	{
		// Check action possibility
		if (!isset($args["spaces"][$postcard]) || !in_array($space, $args["spaces"][$postcard]))
			throw new BgaVisibleSystemException("Souvenir.php [actStamp] - Invalid postcard souvenir space color: $postcard $space");
		// Save database changes
		$this->game->DbQuery("INSERT INTO souvenir (postcard, location) VALUES ('$postcard', '$space')");
		$log_args = ["postcard" => $postcard, "space" => $space];
		// Notify client
		$this->notify->all("souvenir", clienttranslate('${player_name} places a Souvenir'), [
			"player_id" => $active_player_id,
			"postcard" => $postcard,
			"location" => $space,
		]);
		// Update stats
		$this->playerStats->inc("placed_souvenirs", 1, $active_player_id);
		// Save log
		$this->game->saveLog(LogType::Souvenir, $log_args);
		// Souvenir bonus
		$bonus = $this->game->getSouvenirBonusType($postcard, $space);
		switch ($bonus) {
			case SouvenirBonusType::Move: $this->game->moveBonusCounter->inc(2); break;
			case SouvenirBonusType::Postcard: $this->game->postcardBonusCounter->inc(1); break;
			case SouvenirBonusType::Camp: $this->game->campBonusCounter->inc(1); break;
			case SouvenirBonusType::Stamp: $this->game->stampBonusCounter->inc(1); break;
			case SouvenirBonusType::Travel: if ($this->game->travelBonusCounter->get() !== 2) $this->game->travelBonusCounter->inc(1); break;
			case SouvenirBonusType::Point: $this->playerScore->inc($active_player_id, 2); break;
		}
		// Move to the next state
		return Action::class;
	}

	/**
	 * Player skips souvenir placement (placement is optional).
	 *
	 * @return string Next state class (Action).
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actSkip(): string
	{
		// Save log
		$this->game->saveLog(LogType::SkipSouvenir);
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