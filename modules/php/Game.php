<?php
/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Postcards implementation : © Ábel Tibor Tóth toth.abel.tibor2@gmail.com
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * Game.php
 *
 * This is the main file for your game logic.
 *
 * In this PHP file, you are going to defines the rules of the game.
 */
declare(strict_types=1);

namespace Bga\Games\Postcards;

use Bga\GameFramework\Components\Counters\PlayerCounter;
use Bga\GameFramework\Components\Counters\TableCounter;
use Bga\GameFramework\Table;
use Bga\Games\Postcards\States\Action;
use BgaSystemException;

use Bga\Games\Postcards\Regions\Regions;
use Bga\Games\Postcards\Postcards\Postcards;
use Bga\Games\Postcards\Travels\Travels;
use Bga\Games\Postcards\Gifts\Gifts;

use Bga\Games\Postcards\Log\Log;
use Bga\Games\Postcards\Log\Undo\UndoMethods;

class Game extends Table
{
	use Regions;
	use Postcards;
	use Travels;
	use Gifts;

	use Log;
	use UndoMethods;

	public TableCounter $postcardsCounter;
	public TableCounter $postcardsDiscardCounter;
	public TableCounter $travelsCounter;
	public TableCounter $travelsDiscardCounter;
	public TableCounter $giftsCounter;
	public TableCounter $moveBonusCounter;
	public TableCounter $campBonusCounter;
	public TableCounter $postcardBonusCounter;
	public TableCounter $stampBonusCounter;
	public TableCounter $travelBonusCounter;
	
	public PlayerCounter $sentPostcardsCounter;

	/**
	 * Your global variables labels:
	 *
	 * Here, you can assign labels to global variables you are using for this game. You can use any number of global
	 * variables with IDs between 10 and 99. If you want to store any type instead of int, use $this->globals instead.
	 *
	 * NOTE: afterward, you can get/set the global variables with `getGameStateValue`, `setGameStateInitialValue` or
	 * `setGameStateValue` functions.
	 */
	public function __construct()
	{
		parent::__construct();
		$this->initGameStateLabels([]); // mandatory, even if the array is empty

		$this->postcardsCounter = $this->counterFactory->createTableCounter('postcards_counter', 0 , 52);
		$this->postcardsDiscardCounter = $this->counterFactory->createTableCounter('postcards_discard_counter', 0 , 36);

		$this->travelsCounter = $this->counterFactory->createTableCounter('travels_counter', 0 , 67);
		$this->travelsDiscardCounter = $this->counterFactory->createTableCounter('travels_discard_counter', 0 , 67);

		$this->giftsCounter = $this->counterFactory->createTableCounter('gifts_counter', 0 , 22);

		$this->moveBonusCounter = $this->counterFactory->createTableCounter('move_bonus_counter', 0 , 10);
		$this->postcardBonusCounter = $this->counterFactory->createTableCounter('postcard_bonus_counter', 0 , 4);
		$this->campBonusCounter = $this->counterFactory->createTableCounter('camp_bonus_counter', 0 , 3);
		$this->stampBonusCounter = $this->counterFactory->createTableCounter('stamp_bonus_counter', 0 , 2);
		$this->travelBonusCounter = $this->counterFactory->createTableCounter('travel_bonus_counter', 0 , 2);
		
		$this->sentPostcardsCounter = $this->counterFactory->createPlayerCounter('sent_postcards_counter', 0, 51);

		$this->notify->addDecorator(function(string $message, array $args) {
			if (isset($args['player_id']) && !isset($args['player_name']) && str_contains($message, '${player_name}')) {
				$args['player_name'] = $this->getPlayerNameById($args['player_id']);
			}
			return $args;
		});
	}

	/**
	 * Compute and return the current game progression.
	 * The number returned must be an integer between 0 and 100.
	 * This method is called each time we are in a game state with the "updateGameProgression" property set to true.
	 *
	 * @return int
	 * @throws \Bga\GameFramework\Components\Counters\UnknownPlayerException
	 * @throws BgaSystemException
	 * @see ./states.inc.php
	 */
	public function getGameProgression(): int
	{
		$max = 0;
		$players = array_keys($this->loadPlayersBasicInfos());
		foreach ($players as $player_id) {
			$postcards = $this->sentPostcardsCounter->get($player_id);
			if ($postcards === 4) return 100;
			$stamps = intval($this->getUniqueValueFromDb("SELECT COUNT(*) FROM stamp JOIN postcard ON postcard.type = stamp.postcard WHERE postcard.location = $player_id AND postcard.location_arg IS NOT null"));
			if ($stamps > 12) $stamps = 12;
			$current = $postcards * 25 + $stamps * 2;
			if ($current > $max) $max = $current;
		}
		return $max;
	}

	/**
	 * This method is called only once, when a new game is launched. In this method, you must setup the game
	 *  according to the game rules, so that the game is ready to be played.
	 * @throws BgaSystemException
	 */
	protected function setupNewGame($players, $options = []): string
	{
		$gameinfos = $this->getGameinfos();
		// Setup players
		$default_colors = $gameinfos['player_colors'];
		shuffle($default_colors);
		$itineraries = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
		shuffle($itineraries);
		foreach ($players as $player_id => $player) {
			$itinerary = array_shift($itineraries);
			// Now you can access both $player_id and $player array
			$query_values[] = vsprintf("('%s', '%s', '%s', '%s', '%s', '%s', '%s')", [
				$player_id,
				array_shift($default_colors),
				$player["player_canal"],
				addslashes($player["player_name"]),
				addslashes($player["player_avatar"]),
				$itinerary,
				$itinerary
			]);
		}
		$this->DbQuery(sprintf(
				"INSERT INTO player (player_id, player_color, player_canal, player_name, player_avatar, itinerary, biker) VALUES %s", 
				implode(",", $query_values)
			)
		);
		$this->reattributeColorsBasedOnPreferences($players, $gameinfos["player_colors"]);
		$this->reloadPlayersBasicInfos();
		// Setup cards
		$this->setupPostcards($players);
		$this->setupTravels($players);
		$this->setupGifts();
		// Setup table counters
		$this->moveBonusCounter->initDb();
		$this->campBonusCounter->initDb();
		$this->postcardBonusCounter->initDb();
		$this->stampBonusCounter->initDb();
		$this->travelBonusCounter->initDb();
		// Setup player counters
		$this->sentPostcardsCounter->initDb(array_keys($players));
		// Setup table stats
		$this->tableStats->init("turns_number", 0);
		// Setup player stats
		$this->playerStats->init("turns_number", 0);
		$this->playerStats->init("travel_cards", 0);
		$this->playerStats->init("travel_cards_double", 0);
		$this->playerStats->init("action_move", 0);
		$this->playerStats->init("placed_camps", 0);
		$this->playerStats->init("best_traveller", 0);
		$this->playerStats->init("best_traveller_points", 0);
		$this->playerStats->init("placed_souvenirs", 0);
		$this->playerStats->init("bonus_actions", 0);
		$this->playerStats->init("placed_stamps", 0);
		$this->playerStats->init("sent_postcards", 0);
		$this->playerStats->init("sent_postcards_points", 0);
		$this->playerStats->init("gifts", 0);
		$this->playerStats->init("action_gifts", 0);
		$this->playerStats->init("gift_actions", 0);
		$this->playerStats->init("point_gifts", 0);
		$this->playerStats->init("gift_points", 0);
		$this->playerStats->init("itinerary_points", 0);
		$this->playerStats->init("end_bonus_points", 0);
		$this->playerStats->init("unsent_postcards_points", 0);
		// Activate first player
		$this->activeNextPlayer();

		return Action::class;
	}

	/**
	 * Gather all information about current game situation (visible by the current player).
	 *
	 * The method is called each time the game interface is displayed to a player, i.e.:
	 *
	 * - when the game starts
	 * - when a player refreshes the game page (F5)
	 * 
	 * @throws BgaSystemException
	 */
	protected function getAllDatas(): array
	{
		$result = [];
		$current_player_id = (int) $this->getCurrentPlayerId();
		// Getting table option infos
		$result["player_board_side"] = $this->tableOptions->get(100) === 1;
		// Getting player infos
		$players = $this->getCollectionFromDb("SELECT player_id id, player_no, player_score score, itinerary, biker FROM player");
		$result["players"] = array_map(function ($player) {return array_map('intval', $player);}, $players); 
		$end_bonus = $this->globals->get("end_bonus");
		if ($end_bonus !== null) $result["end_bonus"] = $end_bonus;
		foreach ($players as $player_id => $player) {
			$result["players"][$player_id]["postcards"] = [];
			$result["players"][$player_id]["itinerary_postcards"] = $this->getItineraryCorrectPostcards($player_id, intval($player["itinerary"]));
			$postcards = $this->getObjectListFromDb("SELECT location_arg FROM postcard WHERE location = $player_id AND location_arg IS NOT null", true);
			foreach ($postcards as $postcard) {
				$type = intval($this->getUniqueValueFromDb("SELECT type FROM postcard WHERE location = $player_id AND location_arg = $postcard"));
				$result["players"][$player_id]["postcards"][$postcard]["type"] = $type;
				$result["players"][$player_id]["postcards"][$postcard]["stamps"] = array_map('intval', $this->getObjectListFromDb("SELECT location FROM stamp WHERE postcard = $type", true));
				$result["players"][$player_id]["postcards"][$postcard]["souvenirs"] = array_map('intval', $this->getObjectListFromDb("SELECT location FROM souvenir WHERE postcard = $type", true));
			}
			$result["players"][$player_id]["camps"] = array_map(function ($value) {return array_map('intval', $value);}, $this->getObjectListFromDb("SELECT region, location FROM camp WHERE player_id = $player_id"));
			$result["players"][$player_id]["gifts"] = array_map('intval', $this->getObjectListFromDb("SELECT type FROM gift WHERE location = $player_id", true));
		}
		$this->sentPostcardsCounter->fillResult($result);
		
		// Getting supply infos
		$result["postcard_supply"] = ["row" => $this->getPostcardsFromSupplyRow(), "deck" => $this->getPostcardFromSupplyDeck()];
		$result["postcard_guide"] = $this->getPostcardsFromGuide();
		$this->postcardsCounter->fillResult($result["postcard_supply"]);
		$this->postcardsDiscardCounter->fillResult($result["postcard_supply"]);
		
		$result["travel_supply"] = ["travels" => $this->getTravelsFromSupply()];
		$this->travelsCounter->fillResult($result["travel_supply"]);
		$this->travelsDiscardCounter->fillResult($result["travel_supply"]);

		$result["gift_supply"] = ["gifts" => $this->getGiftsFromSupply()];
		$this->giftsCounter->fillResult($result["gift_supply"]);
		
		$result["bonus_actions"] = [];
		$this->moveBonusCounter->fillResult($result["bonus_actions"]);
		$this->postcardBonusCounter->fillResult($result["bonus_actions"]);
		$this->campBonusCounter->fillResult($result["bonus_actions"]);
		$this->stampBonusCounter->fillResult($result["bonus_actions"]);
		
		$result["hand"] = array_map(fn($value): array => array_map('intval', $value), $this->getObjectListFromDb("SELECT type FROM travel WHERE location = {$current_player_id}"));
		
		return $result;
	}

	/**
	 * Build common arguments sent to client states.
	 *
	 * @param bool $used_travels Whether to include used travel cards.
	 * @return array<string,mixed>
	 * @throws BgaSystemException
	 */
	function getCommonArgs(bool $used_travels = true): array {
		$res = [];
		$res["undo"] = $this->getLogLength(false, false);
		$res["last_round"] = $this->isLastRound();
		if ($used_travels) $res["used_travels"] = $this->getUsedTravels();
		return $res;
	}

	/**
	 * Determine if the game is in the last round (any player sent 4 postcards).
	 *
	 * @return bool
	 */
	function isLastRound(): bool
	{
		$sent_postcards = $this->sentPostcardsCounter->getAll();
		if (array_any($sent_postcards, fn($c) => $c >= 4)) return true;
		else return false;
	}

	/**
	 * Migrate database schema between versions.
	 *
	 * @param int $from_version
	 * @return void
	 */
	public function upgradeTableDb($from_version): void {}
}