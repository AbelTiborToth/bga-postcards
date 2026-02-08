<?php

namespace Bga\Games\Postcards\Log\Undo;

use Bga\GameFramework\Components\Counters\OutOfRangeCounterException;
use Bga\GameFramework\Components\Counters\UnknownPlayerException;
use Bga\Games\Postcards\Gifts\GiftType;
use Bga\Games\Postcards\Log\LogType;
use Bga\Games\Postcards\Postcards\SouvenirBonusType;
use Bga\Games\Postcards\States\Action;
use Bga\Games\Postcards\States\Camp;
use Bga\Games\Postcards\States\Move;
use Bga\Games\Postcards\States\Souvenir;
use Bga\Games\Postcards\States\Stamp;
use Bga\Games\Postcards\States\Star;
use Bga\Games\Postcards\States\Travel;
use BgaSystemException;
use BgaUserException;
use BgaVisibleSystemException;

trait UndoMethods
{
	/**
	 * Route an undo log entry to the proper handler.
	 *
	 * @param int   $active_player_id Current active player.
	 * @param array $log              Log entry with type/args.
	 * @return string|null Next state class or null to continue undo loop.
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 */
	function processUndoMethod(int $active_player_id, array $log): ?string
	{
		switch ($log["type"]) {
			case LogType::Help:
				if (isset($log["args"]["discard"])) $this->undoDiscardTravels($active_player_id);
				break;
			case LogType::ActionDouble:
				$this->playerStats->inc("travel_cards", -2, $active_player_id);
				return Action::class;
			case LogType::ActionTravel:
				$this->playerStats->inc("travel_cards", -1, $active_player_id);
				return Action::class;
			case LogType::SkipAction: return Action::class;
			case LogType::ActionBonus: return $this->undoActionBonus($active_player_id, $log);
			case LogType::ActionGift: return $this->undoActionGift($active_player_id, $log);
			case LogType::Move: return $this->undoMove($active_player_id, $log);
			case LogType::Camp: return $this->undoCamp($active_player_id, $log);
			case LogType::Star: return $this->undoStar($active_player_id, $log);
			case LogType::Souvenir: return $this->undoSouvenir($active_player_id, $log);
			case LogType::SkipSouvenir: return Souvenir::class;
			case LogType::SkipCamp: return Camp::class;
			case LogType::Stamp: return $this->undoStamp($active_player_id, $log);
			case LogType::Send: return $this->undoSend($active_player_id, $log);
			case LogType::Travel: return $this->undoTravel($active_player_id, $log);
			default: throw new BgaVisibleSystemException("UndoMethods.php [processUndoMethod] - Something went terribly wrong");
		}
		return null;
	}

	/**
	 * Undo a bonus action and restore counters.
	 *
	 * @param int   $active_player_id Current active player.
	 * @param array $log              Log entry containing 'type'.
	 * @return string Next state class.
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 * @throws OutOfRangeCounterException
	 */
	function undoActionBonus(int $active_player_id, array $log): string {
		// Check action possibility
		if (!isset($log["args"]) || !isset($log["args"]['type']))
			throw new BgaVisibleSystemException("UndoMethods.php [undoActionBonus] - Something went terribly wrong");
		// Get args
		$type = $log["args"]['type'];
		// Save database changes
		switch ($type) {
			case 1: $this->moveBonusCounter->inc(1); break;
			case 2: $this->postcardBonusCounter->inc(1); break;
			case 3: $this->campBonusCounter->inc(1); break;
		}
		// Move to the next state
		return Action::class;
	}

	/**
	 * Undo a gift action and restore gift state/counters.
	 *
	 * @param int   $active_player_id Current active player.
	 * @param array $log              Log entry containing 'gift'.
	 * @return string Next state class.
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 * @throws OutOfRangeCounterException
	 */
	function undoActionGift(int $active_player_id, array $log): string {
		// Check action possibility
		if (!isset($log["args"]) || !isset($log["args"]['gift']))
			throw new BgaVisibleSystemException("UndoMethods.php [undoActionGift] - Something went terribly wrong");
		// Get args
		$gift = $log["args"]['gift'];
		// Save database changes
		$this->DbQuery("UPDATE gift SET location = $active_player_id, location_arg = null WHERE type = $gift");
		$gift_type = $this->getGiftType($gift);
		switch ($gift_type) {
			case GiftType::Map: break;
			case GiftType::Car: $this->moveBonusCounter->inc(-3); break;
			case GiftType::Stamp: if ($this->stampBonusCounter->get() !== 0) $this->stampBonusCounter->set(0); break;
			default: throw new BgaUserException('Action.php [actActionGift] Not valid gift type');
		}
		// Notify client
		$this->notify->all("undoActionGift", '', [
			"player_id" => $active_player_id,
			"gift" => $gift,
		]);
		// Update stats
		$this->playerStats->inc("gift_actions", -1, $active_player_id);
		// Move to the next state
		return Action::class;
	}
	
	/**
	 * Undo a move action and revert biker position.
	 *
	 * @param int   $active_player_id Current active player.
	 * @param array $log              Log entry containing 'region'.
	 * @return string Next state class.
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 */
	function undoMove(int $active_player_id, array $log): string {
		// Check action possibility
		if (!isset($log["args"]) || !isset($log["args"]['region']))
			throw new BgaVisibleSystemException("UndoMethods.php [undoMove] - Something went terribly wrong");
		// Get args
		$region = $log["args"]['region'];
		// Save database changes
		$this->DbQuery("UPDATE player SET biker = {$region} WHERE player_id = $active_player_id");
		// Notify client
		$this->notify->all("move",'', [
			"player_id" => $active_player_id,
			"region" => $region,
		]);
		// Update stats
		$this->playerStats->inc("action_move", -1, $active_player_id);
		// Move to the next state
		return Move::class;
	}

	/**
	 * Undo a camp placement and revert bonuses/scoring.
	 *
	 * @param int   $active_player_id Current active player.
	 * @param array $log              Log entry with camp/region/campsite.
	 * @return string Next state class.
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 * @throws OutOfRangeCounterException
	 * @throws UnknownPlayerException
	 */
	function undoCamp(int $active_player_id, array $log): string {
		// Check action possibility
		if (!isset($log["args"]) || !isset($log["args"]['camp']) || !isset($log["args"]['region']) || !isset($log["args"]['campsite']) || !isset($log["args"]['best_traveller']))
			throw new BgaVisibleSystemException("UndoMethods.php [undoMove] - Something went terribly wrong");
		// Get args
		$camp = $log["args"]['camp'];
		$region = $log["args"]['region'];
		$campsite = $log["args"]['campsite'];
		$best_traveller = $log["args"]['best_traveller'];
		// Save database changes
		$this->DbQuery("DELETE FROM camp WHERE region = $region AND location = $campsite");
		switch ($camp) {
			case 5: if ($this->tableOptions->get(100) === 1) $this->postcardBonusCounter->inc(-1); break;
			case 7: if ($this->tableOptions->get(100) === 1) $this->moveBonusCounter->inc(-1); break;
			case 9: if ($this->tableOptions->get(100) === 1 && $this->stampBonusCounter->get() !== 0) $this->stampBonusCounter->inc(-1); break;
			case 11: $this->playerScore->inc($active_player_id, -1); break;
			case 12: $this->playerScore->inc($active_player_id, -3); break;
			case 13: $this->playerScore->inc($active_player_id, -7); break;
		}
		// Notify client
		if ($best_traveller !== 0) {
			$this->playerScore->inc($active_player_id, -$best_traveller);
			// Update stats
			$this->playerStats->inc("best_traveller", -1, $active_player_id);
			$this->playerStats->inc("best_traveller_points", -$best_traveller, $active_player_id);
		}
		$this->notify->all("undoCamp",'', [
			"player_id" => $active_player_id,
			"camp" => $camp,
			"region" => $region,
			"campsite" => $campsite,
		]);
		// Update stats
		$this->playerStats->inc("placed_camps", -1, $active_player_id);
		// Move to the next state
		return Camp::class;
	}

	/**
	 * Undo a star effect and restore counters.
	 *
	 * @param int   $active_player_id Current active player.
	 * @param array $log              Log entry containing 'effect'.
	 * @return string Next state class.
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 */
	function undoStar(int $active_player_id, array $log): string {
		// Check action possibility
		if (!isset($log["args"]) || !isset($log["args"]['effect']))
			throw new BgaVisibleSystemException("UndoMethods.php [undoMove] - Something went terribly wrong");
		// Get args
		$effect = $log["args"]['effect'];
		// Save database changes
		switch ($effect) {
			case 1: $this->moveBonusCounter->inc(-1); break;
			case 2: $this->postcardBonusCounter->inc(-1); break;
			case 3: if ($this->stampBonusCounter->get() !== 0) $this->stampBonusCounter->inc(-1); break;
		}
		// Move to the next state
		return Star::class;
	}

	/**
	 * Undo a souvenir placement and revert bonuses/scoring.
	 *
	 * @param int   $active_player_id Current active player.
	 * @param array $log              Log entry containing postcard/space.
	 * @return string Next state class.
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 * @throws OutOfRangeCounterException
	 * @throws UnknownPlayerException
	 */
	function undoSouvenir(int $active_player_id, array $log): string {
		// Check action possibility
		if (!isset($log["args"]) || !isset($log["args"]['postcard']) || !isset($log["args"]['space']))
			throw new BgaVisibleSystemException("UndoMethods.php [undoSouvenir] - Something went terribly wrong");
		// Get args
		$postcard = $log["args"]['postcard'];
		$space = $log["args"]['space'];
		// Save database changes
		$this->DbQuery("DELETE FROM souvenir WHERE postcard = $postcard AND location = $space");
		// Undo souvenir bonus
		$bonus = $this->getSouvenirBonusType($postcard, $space);
		switch ($bonus) {
			case SouvenirBonusType::Move: $this->moveBonusCounter->inc(-2); break;
			case SouvenirBonusType::Postcard: $this->postcardBonusCounter->inc(-1); break;
			case SouvenirBonusType::Camp: $this->campBonusCounter->inc(-1); break;
			case SouvenirBonusType::Stamp: if ($this->stampBonusCounter->get() !== 0) $this->stampBonusCounter->inc(-1); break;
			case SouvenirBonusType::Travel: $this->travelBonusCounter->inc(-1); break;
			case SouvenirBonusType::Point: $this->playerScore->inc($active_player_id, -2); break;
		}
		// Notify client
		$this->notify->all("undoSouvenir",'', [
			"player_id" => $active_player_id,
			"postcard" => $postcard,
			"space" => $space,
		]);
		// Update stats
		$this->playerStats->inc("placed_souvenirs", -1, $active_player_id);
		// Move to the next state
		return Souvenir::class;
	}

	/**
	 * Undo a stamp placement and restore counters.
	 *
	 * @param int   $active_player_id Current active player.
	 * @param array $log              Log entry containing postcard/space.
	 * @return string Next state class.
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 * @throws OutOfRangeCounterException
	 */
	function undoStamp(int $active_player_id, array $log): string {
		// Check action possibility
		if (!isset($log["args"]) || !isset($log["args"]['postcard']) || !isset($log["args"]['space']))
			throw new BgaVisibleSystemException("UndoMethods.php [undoStamp] - Something went terribly wrong");
		// Get args
		$postcard = $log["args"]['postcard'];
		$space = $log["args"]['space'];
		// Save database changes
		$this->DbQuery("DELETE FROM stamp WHERE postcard = $postcard AND location = $space");
		if (isset($log["args"]['bonus'])) $this->stampBonusCounter->inc(1);
		// Notify client
		$this->notify->all("undoStamp",'', [
			"player_id" => $active_player_id,
			"postcard" => $postcard,
			"space" => $space,
		]);
		// Stats
		$this->playerStats->inc("placed_stamps", -1, $active_player_id);
		// Move to the next state
		return Stamp::class;
	}

	/**
	 * Undo sending a postcard and restore scoring/end-bonus.
	 *
	 * @param int   $active_player_id Current active player.
	 * @param array $log              Log entry containing postcard/point.
	 * @return string Next state class.
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 * @throws OutOfRangeCounterException
	 */
	function undoSend(int $active_player_id, array $log): string {
		// Check action possibility
		if (!isset($log["args"]) || !isset($log["args"]['postcard']) || !isset($log["args"]['point']))
			throw new BgaVisibleSystemException("UndoMethods.php [undoSend] - Something went terribly wrong");
		// Get args
		$postcard = $log["args"]['postcard'];
		$point = $log["args"]['point'];
		$point = $log["args"]['point'];
		// Save database changes
		$location_arg = intval($this->getUniqueValueFromDb("SELECT max(location_arg) FROM postcard WHERE location = $active_player_id")) + 1;
		$this->DbQuery("UPDATE postcard SET location_arg = $location_arg WHERE type = $postcard");
		$this->playerScore->inc($active_player_id, -$point);
		$this->sentPostcardsCounter->inc($active_player_id, -1);
		// Notify client
		$this->notify->all("undoSend",'', [
			"player_id" => $active_player_id,
			"postcard" => $postcard,
			"stamps" => array_map('intval', $this->getObjectListFromDb("SELECT location FROM stamp WHERE postcard = $postcard", true)),
			"souvenirs" => array_map('intval', $this->getObjectListFromDb("SELECT location FROM souvenir WHERE postcard = $postcard", true)),
		]);
		// Check the end bonus
		if (isset($log["args"]["end_bonus"])) {
			// Save database changes
			$this->globals->set("end_bonus", null);
			// Notify client
			$this->notify->all("undoEndBonus", '', [
				"player_id" => $active_player_id,
			]);
		}
		// Stats
		$this->playerStats->inc("sent_postcards", -1, $active_player_id);
		$this->playerStats->inc("sent_postcards_points", -$point, $active_player_id);
		// Move to the next state
		return Action::class;
	}

	/**
	 * Undo discarding travels (helper for Help undo).
	 *
	 * @param int $active_player_id Current active player.
	 * @throws BgaSystemException
	 */
	function undoDiscardTravels(int $active_player_id): void
	{
		// Get args
		$used_travels = $this->getUsedTravels();
		// Save database changes
		$this->dbQuery("UPDATE travel SET location = $active_player_id, location_arg = null WHERE type IN (".implode(",", $used_travels).")");
		$this->travelsDiscardCounter->inc(-count($used_travels));
		// Notify client
		$this->notify->player($active_player_id,"undoDiscardTravels",'', [
			"player_id" => $active_player_id,
			"travels" => $used_travels
		]);
	}

	/**
	 * Undo taking a travel from supply/deck.
	 *
	 * @param int   $active_player_id Current active player.
	 * @param array $log              Log entry containing travel/location.
	 * @return string Next state class.
	 * @throws BgaVisibleSystemException
	 * @throws BgaSystemException
	 */
	function undoTravel(int $active_player_id, array $log): string {
		// Check action possibility
		if (!isset($log["args"]) || !isset($log["args"]['travel']) || !isset($log["args"]['location']))
			throw new BgaVisibleSystemException("UndoMethods.php [undoTravel] - Something went terribly wrong");
		// Get args
		$travel = $log["args"]['travel'];
		$location = $log["args"]['location'];
		// Save database changes
		$this->DbQuery("UPDATE travel SET location = -1, location_arg = $location WHERE type = $travel");
		// Notify client
		$this->notify->all("undoTravel",'', [
			"player_id" => $active_player_id,
			"travel" => $travel,
			"location" => $location,
		]);
		// Move to the next state
		return Travel::class;
	}
}