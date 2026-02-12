<?php

declare(strict_types=1);

namespace Bga\Games\Postcards\States;

use Bga\GameFramework\Components\Counters\OutOfRangeCounterException;
use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\Games\Postcards\Game;
use Bga\Games\Postcards\Gifts\GiftType;
use Bga\Games\Postcards\Log\LogType;
use Bga\Games\Postcards\Log\Undo\Undo;
use BgaSystemException;
use BgaUserException;
use BgaVisibleSystemException;

/**
 * Handles the "Action" game state.
 *
 * Player must perform a possible action.
 */
class Action extends GameState
{
	use Undo;
	
	function __construct(
		protected Game $game,
	) {
		parent::__construct($game,
			id: 10,
			type: StateType::ACTIVE_PLAYER,
		);
	}

	/**
	 * Get game state arguments for the Action state.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @return array<string,mixed> State arguments including undo level, travels, and possible actions.
	 * @throws BgaSystemException
	 */
	public function getArgs(int $active_player_id): array
	{
		// Get undo arg
		$args = $this->game->getCommonArgs();
		// Get used travels
		$args["max_travels"] = 3 + $this->game->travelBonusCounter->get();
		// Get possible actions
		$args["possible_actions"] = $this->getPossibleActions($active_player_id);
		// Get sendable postcards
		$args["send"] = $this->game->getSendablePostcards($active_player_id);
		// Get playable gift cards
		$args["gifts"] = $this->game->getPlayableGifts($active_player_id);
		// Return the array
		return $args;
	}
	
	/**
	 * Compute which actions are currently possible.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @return array<string,mixed> Possible actions: postcard, camp, stamp, bonus.
	 * @throws BgaSystemException
	 */
	public function getPossibleActions(int $active_player_id): array
	{
		$res = [];
		// Check if postcard action is possible
		$res["postcard"] = count($this->game->getPostcardsFromSupplyRow()) !== 0;
		// Check if camp action is possible
		$region = intval($this->game->getUniqueValueFromDb("SELECT biker FROM player WHERE player_id = {$active_player_id}"));
		$res["camp"] = count($this->game->getAvailableCampsites($region)) !== 0 && intval($this->game->getUniqueValueFromDb("SELECT count(*) FROM camp WHERE player_id = $active_player_id")) !== 13;
		// Check if stamp action is possible
		$spaces = $this->game->getAvailableStampSpaces($active_player_id);
		$res["stamp"] = [];
		if (!empty($spaces)) {
			$res["stamp"][1] = !empty($this->game->getAvailableStampSpaces($active_player_id, 1));
			$res["stamp"][2] = !empty($this->game->getAvailableStampSpaces($active_player_id, 2));
			$res["stamp"][3] = !empty($this->game->getAvailableStampSpaces($active_player_id, 3));
			$res["stamp"][4] = !empty($this->game->getAvailableStampSpaces($active_player_id, 4));
		}
		$res["stamp"]["all"] = !empty($spaces);
		// Check if bonus actions possible
		$res["bonus"] = [];
		$res["bonus"]["move"] = $this->game->moveBonusCounter->get() !== 0;
		$res["bonus"]["postcard"] = $res["postcard"] && $this->game->postcardBonusCounter->get() !== 0;
		$res["bonus"]["camp"] = $res["camp"] && $this->game->campBonusCounter->get() !== 0;
		
		return $res;
		// Note: Move is always possible
	}
	
	/**
	 * Handle automatic transitions when entering Action state.
	 *
	 * If player has used max travels and no other actions available, automatically discard and move to Travel.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments.
	 * @return string|null Next state class or null to stay in Action.
	 * @throws OutOfRangeCounterException
	 * @throws BgaSystemException
	 */
	function onEnteringState(int $active_player_id, array $args): ?string
	{
		if ($this->game->stampBonusCounter->get() !== 0) {
			return Stamp::class;
		}
		$travels = array_diff($this->game->getTravelsFromHand($active_player_id), $args["used_travels"]);
		if ((count($args["used_travels"]) === $args["max_travels"] ||
			(count($args["used_travels"]) === $args["max_travels"]-1 && 
				!$this->game->hasTravelAction($travels, 1) &&
				(!$this->game->hasTravelAction($travels, 2) || !$args["possible_actions"]["postcard"]) &&
				(!$this->game->hasTravelAction($travels, 3) || !$args["possible_actions"]["camp"]) &&
				(!$this->game->hasTravelColor($travels, 1) || !$args["possible_actions"]["stamp"][1]) &&
				(!$this->game->hasTravelColor($travels, 2) || !$args["possible_actions"]["stamp"][2]) && 
				(!$this->game->hasTravelColor($travels, 3) || !$args["possible_actions"]["stamp"][3]) &&
				(!$this->game->hasTravelColor($travels, 4) || !$args["possible_actions"]["stamp"][4])))
				&& !$args["possible_actions"]["bonus"]["move"] && !$args["possible_actions"]["bonus"]["postcard"] && !$args["possible_actions"]["bonus"]["camp"] && empty($args["send"]) && empty($args["gifts"])) {
			// Discard travels
			$this->game->discardTravels($active_player_id, $args["used_travels"]);
			// Move to the next state
			return Travel::class;
		}
		else return null;
	}

	/**
	 * Helper to handle travel card action (by action type or by color).
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments.
	 * @param int $travel Travel card ID.
	 * @param bool $color Whether action is color-based (true) or action-based (false).
	 * @throws BgaSystemException
	 */
	public function travelAction(int $active_player_id, array $args, int $travel, bool $color): void
	{
		// Check action possibility
		if (count($args["used_travels"]) === $args["max_travels"])
			throw new BgaUserException('Action.php [travelAction] Cant do more travel card action');
		// Save database changes
		$log_args = ["travel" => $travel];
		// Notify client
		$this->notify->all("actionTravel", ($color ? clienttranslate('${player_name} plays a ${color}-${action} Travel card as color') : clienttranslate('${player_name} plays a ${color}-${action} Travel card as action')), [
			"player_id" => $active_player_id,
			"travel" => $travel,
			"color" => $this->game->getTravelColorName($travel),
			"action" => $this->game->getTravelActionName($travel),
			"i18n" => array('color', 'action')
		]);
		// Update stats
		$this->playerStats->inc("travel_cards", 1, $active_player_id);
		// Save log
		$this->game->saveLog(LogType::ActionTravel, $log_args);
	}
	
	/**
	 * Player plays a single Travel card by its action type.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments.
	 * @param int $travel Travel card ID.
	 * @return string Next state class.
	 * @throws BgaUserException
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actActionTravel(int $active_player_id, array $args, int $travel): string
	{
		// Check action possibility
		if (!in_array($travel, $this->game->getTravelsFromHand($active_player_id)) || in_array($travel, $args['used_travels']))
			throw new BgaUserException('Action.php [actActionTravel] Invalid card choice');
		// Save changes and notify
		$this->travelAction($active_player_id, $args, $travel, false);
		// Move to the next state
		$action = $this->game->getTravelAction($travel);
		if ($action === 1) {
			return Move::class;
		} else if ($action === 2 && $args["possible_actions"]["postcard"]) {
			return Postcard::class;
		} else if ($action === 3 && $args["possible_actions"]["camp"]) {
			return Camp::class;
		}
		else throw new BgaVisibleSystemException("Action.php [actActionTravel] - This action is not possible: $action");
	}

	/**
	 * Player plays a single Travel card by its color (for stamp placement).
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments.
	 * @param int $travel Travel card ID.
	 * @return string Next state class.
	 * @throws BgaUserException
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actActionTravelColor(int $active_player_id, array $args, int $travel): string
	{
		// Check action possibility
		if (!in_array($travel, $this->game->getTravelsFromHand($active_player_id)) || in_array($travel, $args['used_travels']))
			throw new BgaUserException('Action.php [actActionTravelColor] Invalid card choice');
		$color = $this->game->getTravelColor($travel);
		if (!$args["possible_actions"]["stamp"][$color])
			throw new BgaUserException("Action.php [actActionTravelColor] No stamp space available $color");
		// Save changes and notify
		$this->travelAction($active_player_id, $args, $travel, true);
		// Move to the next state
		return Stamp::class;
	}

	/**
	 * Player plays two Travel cards as a double action.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments.
	 * @param int $travel_1 First travel card ID.
	 * @param int $travel_2 Second travel card ID.
	 * @param int $type Action type (1-4).
	 * @return string Next state class.
	 * @throws BgaUserException
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actActionDouble(int $active_player_id, array $args, int $travel_1, int $travel_2, int $type): string
	{
		// Check action possibility
		if (!in_array($travel_1, $this->game->getTravelsFromHand($active_player_id)) || in_array($travel_1, $args['used_travels']) || !in_array($travel_2, $this->game->getTravelsFromHand($active_player_id)) || in_array($travel_2, $args['used_travels']))
			throw new BgaUserException('Action.php [actActionTravel] Invalid card choice');
		if (count($args["used_travels"]) === $args["max_travels"] - 1)
			throw new BgaUserException('Action.php [travelAction] Cant do double travel card action');
		// Save database changes
		$log_args = ["travel_1" => $travel_1, "travel_2" => $travel_2];
		// Notify client
		$this->notify->all("actionTravel", clienttranslate('${player_name} plays a ${color_1}-${action_1} and a ${color_2}-${action_2} Travel card as a ${type} action'), [
			"player_id" => $active_player_id,
			"color_1" => $this->game->getTravelColorName($travel_1),
			"action_1" => $this->game->getTravelActionName($travel_1),
			"color_2" => $this->game->getTravelColorName($travel_2),
			"action_2" => $this->game->getTravelActionName($travel_2),
			"type" => $this->game->getActionTypeName($type),
			"i18n" => array('color_1', 'action_1', 'color_2', 'action_2', 'type')
		]);
		// Update stats
		$this->playerStats->inc("travel_cards", 2, $active_player_id);
		$this->playerStats->inc("travel_cards_double", 1, $active_player_id);
		// Save log
		$this->game->saveLog(LogType::ActionDouble, $log_args);
		// Move to the next state
		if ($type === 1) {
			return Move::class;
		} else if ($type === 2 && $args["possible_actions"]["postcard"]) {
			return Postcard::class;
		} else if ($type === 3 && $args["possible_actions"]["camp"]) {
			return Camp::class;
		} else if ($type === 4 && $args["possible_actions"]["stamp"]["all"]) {
			return Stamp::class;
		}
		else throw new BgaVisibleSystemException("Action.php [actActionDouble] - This action is not possible: $type");
	}

	/**
	 * Player uses a bonus action (Movement, Postcard, or Camp).
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments.
	 * @param int $type Bonus type (1=Move, 2=Postcard, 3=Camp).
	 * @return string Next state class.
	 * @throws OutOfRangeCounterException
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actActionBonus(int $active_player_id, array $args, int $type): string
	{
		// Check action possibility
		// Save database changes
		switch ($type) {
			case 1:
				if ($this->game->moveBonusCounter->get() === 0)
					throw new BgaUserException('Action.php [actActionBonus] Invalid bonus action choice');
				$this->game->moveBonusCounter->inc(-1);
				break;
			case 2:
				if ($this->game->postcardBonusCounter->get() === 0)
					throw new BgaUserException('Action.php [actActionBonus] Invalid bonus action choice');
				$this->game->postcardBonusCounter->inc(-1);
				break;
			case 3:
				if ($this->game->campBonusCounter->get() === 0)
					throw new BgaUserException('Action.php [actActionBonus] Invalid bonus action choice');
				$this->game->campBonusCounter->inc(-1);
				break;
		}
		$log_args = ["type" => $type];
		// Notify client
		$this->notify->all("actionTravel", clienttranslate('${player_name} uses a ${type} bonus action'), [
			"player_id" => $active_player_id,
			"type" => $this->game->getActionTypeName($type),
		]);
		// Update stats
		$this->playerStats->inc("bonus_actions", 1, $active_player_id);
		// Save log
		$this->game->saveLog(LogType::ActionBonus, $log_args);
		// Move to the next state
		if ($type === 1) {
			return Move::class;
		} else if ($type === 2 && $args["possible_actions"]["postcard"]) {
			return Postcard::class;
		} else if ($type === 3 && $args["possible_actions"]["camp"]) {
			return Camp::class;
		}
		else throw new BgaVisibleSystemException("Action.php [actActionBonus] - This action is not possible: $type");
	}

	/**
	 * Player sends a postcard home for points.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments.
	 * @param int $postcard Postcard ID to send.
	 * @return string Next state class (Gift).
	 * @throws BgaUserException
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actSend(int $active_player_id, array $args, int $postcard): string
	{
		// Check action possibility
		if (!in_array($postcard, $args['send']))
			throw new BgaUserException('Action.php [actSend] Cant send this postcard');
		// Save database changes
		$log_args = ["postcard" => $postcard];
		$this->game->DbQuery("UPDATE postcard SET location = $active_player_id, location_arg = null WHERE type = $postcard");
		$point = $this->game->getPostcardPoint($postcard);
		$log_args["point"] = $point;
		$this->playerScore->inc($active_player_id, $point);
		$this->game->sentPostcardsCounter->inc($active_player_id, 1);
		//$this->game->DbQuery("DELETE FROM souvenir WHERE postcard = $postcard");
		//$this->game->DbQuery("DELETE FROM stamp WHERE postcard = $postcard");
		// Notify client
		$this->notify->all("send", clienttranslate('${player_name} sends home a Postcard'), [
			"player_id" => $active_player_id,
			"postcard" => $postcard,
		]);
		// Update stats
		$this->playerStats->inc("sent_postcards", 1, $active_player_id);
		$this->playerStats->inc("sent_postcards_points", $point, $active_player_id);
		// Check itinerary
		$this->game->checkPostcardOnItinerary($active_player_id, $postcard);
		// Check if this was the 4th postcard
		if ($this->game->globals->get("end_bonus") === null && $this->game->sentPostcardsCounter->get($active_player_id) === 4) {
			$this->game->globals->set("end_bonus", $active_player_id);
			$log_args["end_bonus"] = true;
			// Notify client
			$this->notify->all("endBonus", clienttranslate('${player_name} sends their 4th Postcard and gets the End Game Bonus token'), [
				"player_id" => $active_player_id,
			]);
		}
		// Save log
		$this->game->saveLog(LogType::Send, $log_args);
		// Move to the next state
		return Gift::class;
	}

	/**
	 * Player uses an action gift card (Map, Car, Stamp, or Guide).
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments.
	 * @param int $gift Gift card ID to use.
	 * @return string Next state class.
	 * @throws OutOfRangeCounterException
	 * @throws BgaUserException
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actActionGift(int $active_player_id, array $args, int $gift): string
	{
		// Check action possibility
		if (!in_array($gift, $args['gifts']))
			throw new BgaUserException('Action.php [actActionGift] Cant use this gift');
		// Save database changes
		$log_args = ["gift" => $gift];
		$this->game->DbQuery("UPDATE gift SET location = -3, location_arg = null WHERE type = $gift");
		$gift_type = $this->game->getGiftType($gift);
		switch ($gift_type) {
			case GiftType::Map:
			case GiftType::Guide: break;
			case GiftType::Car: $this->game->moveBonusCounter->inc(3); break;
			case GiftType::Stamp: $this->game->stampBonusCounter->inc(2); break;
			default: throw new BgaUserException('Action.php [actActionGift] Not valid gift type');
		}
		// Notify client
		$this->notify->all("actionGift", clienttranslate('${player_name} plays a ${type} Gift card'), [
			"player_id" => $active_player_id,
			"gift" => $gift,
			"type" => $this->game->getGiftName($gift),
			"i18n" => array('type')
		]);
		// Update stats
		$this->playerStats->inc("gift_actions", 1, $active_player_id);
		// Save log
		$this->game->saveLog(LogType::ActionGift, $log_args);
		// Move to the next state
		switch ($gift_type) {
			case GiftType::Map:
				return Move::class;
			case GiftType::Car:
			case GiftType::Stamp:
				return Action::class;
			case GiftType::Guide:
				$this->game->saveLog(LogType::Help, null, 0);
				$this->game->revealGuidePostcards();
				return Guide::class;
			default: throw new BgaUserException('Action.php [actActionGift] Not valid gift type');
		}
	}
	
	/**
	 * Player skips remaining actions and ends turn.
	 *
	 * @param int $active_player_id Current active player ID.
	 * @param array<string,mixed> $args State arguments.
	 * @return string Next state class (Travel).
	 * @throws BgaSystemException
	 */
	#[PossibleAction]
	public function actSkip(int $active_player_id, array $args): string
	{
		// Check action possibility
		if (count($args["used_travels"]) < 3)
			throw new BgaUserException('Action.php [actSkip] Must use at least 3 travel cards');
		// Save log
		$this->game->saveLog(LogType::SkipAction);
		// Discard travels
		$this->game->discardTravels($active_player_id, $args["used_travels"]);
		// Move to the next state
		return Travel::class;
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