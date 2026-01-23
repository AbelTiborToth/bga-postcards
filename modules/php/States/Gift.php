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
use BgaUserException;
use BgaVisibleSystemException;

/**
 * Handles the "Gift" game state
 *
 * This state occurs after a player sends a postcard and must choose a gift card
 * from the available supply. Gift cards provide end-game scoring or immediate actions.
 */
class Gift extends GameState
{
	use Undo;
	
	function __construct(
		protected Game $game,
	) {
		parent::__construct($game,
			id: 30,
			type: StateType::ACTIVE_PLAYER,
			description: clienttranslate('${actplayer} must choose a Gift card'),
			descriptionMyTurn: clienttranslate('${you} must choose a Gift card'),
		);
	}

	/**
	 * Get game state arguments for the Gift state.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @return array<string,mixed> State arguments including undo level.
	 * @throws BgaSystemException
	 */
	public function getArgs(int $active_player_id): array
	{
		// Get undo arg
		return $this->game->getCommonArgs();
	}
	
	/**
	 * Handle automatic transitions when entering Gift state.
	 *
	 * If no gifts are available in the supply, automatically skip to Action state.
	 *
	 * @return string|null Next state class or null to wait for player action.
	 */
	public function onEnteringState(): ?string
	{
		$gifts = array_column($this->game->getGiftsFromSupply(), 'type');
		if (empty($gifts)) return Action::class;
		else return null;
	}

	/**
	 * Player selects a gift card from the supply.
	 *
	 * Actions:
	 *  - Validates gift card is in supply
	 *  - Moves gift card to player's collection
	 *  - Reveals replacement gift card from deck at the same position
	 *  - Updates statistics (gift count, action vs. scoring gift)
	 *  - Logs action (non-undoable)
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param int $gift Gift card ID to take.
	 * @return string Next state class (Action).
	 * @throws BgaUserException
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actGift(int $active_player_id, int $gift): string
	{
		$gifts = array_column($this->game->getGiftsFromSupply(), 'type');
		// Check action possibility
		if (!in_array($gift, $gifts))
			throw new BgaUserException('Action.php [actGift] This gift is not in supply');
		// Save database changes
		$space = intval($this->game->getUniqueValueFromDB("SELECT location_arg FROM gift WHERE type = $gift"));
		$this->game->DbQuery("UPDATE gift SET location = $active_player_id, location_arg = null WHERE type = $gift");
		// Notify client
		$this->notify->all("gift",clienttranslate('${player_name} takes a ${type} Gift card'), [
			"player_id" => $active_player_id,
			"gift" => $gift,
			"type" => $this->game->getGiftName($gift),
			"i18n" => array('type')
		]);
		// Stats
		$this->playerStats->inc("gifts", 1, $active_player_id);
		if ($gift >= 18) $this->playerStats->inc("action_gifts", 1, $active_player_id);
		else $this->playerStats->inc("point_gifts", 1, $active_player_id);
		// Reveal new gift card
		$top = $this->game->getUniqueValueFromDB("SELECT MIN(location_arg) FROM gift WHERE location = -2 GROUP BY location");
		if ($top !== null) {
			$top = intval($top);
			$gift = intval($this->game->getUniqueValueFromDB("SELECT type FROM gift WHERE location = -2 AND location_arg = $top"));
			$this->game->dbQuery("UPDATE gift SET location = -1, location_arg = {$space} WHERE type = $gift");
			$this->game->giftsCounter->inc(-1);
			// Notify client
			$this->notify->all("refillGift",'', [
				"player_id" => $active_player_id,
				"gift" => $gift,
				"location" => $space,
			]);
		}
		// Save log
		$this->game->saveLog(LogType::Gift, null, 0);
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