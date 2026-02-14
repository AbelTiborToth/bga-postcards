import { Board } from "./board/board";
import { Game } from "./game";
import { Hand } from "./player_area/hand/hand";
import { PostcardPlayer } from "./player_area/postcard_player/postcard_player";
import { Postcard } from "./cards/postcard/postcard";
import { PostcardSupply } from "./postcard_supply/postcard_supply";
import { PlayerBoard } from "./player_area/player_board/player_board";
import { PlayerArea } from "./player_area/player_area";
import { Camp } from "./camp/camp";
import { BonusActions } from "./player_area/bonus_actions/bonus_actions";
import { Travel } from "./cards/travel/travel";
import { TravelDeck } from "./board/travel_deck/travel_deck";
import { EndGameBonus } from "./board/end_game_bonus/end_game_bonus";
import { Itinerary } from "./player_area/itinerary/itinerary";
import { Gift } from "./cards/gift/gift";
import { TravelOption } from "./cards/travel/travel_option/travel_option";
import { GiftPlayer } from "./player_area/gift_player/gift_player";
import { PostcardGuide } from "./postcard_guide/postcard_guide";
import { DeckStack } from "./board/deck_stack/deck_stack";
import { Circle } from "./player_area/itinerary/circle/circle";

/**
 * Handles all game notifications and animations
 *
 * Responsibilities:
 *  - Processing game notifications from the server
 *  - Animating game state changes (card movements, scoring, etc.)
 *  - Updating UI elements based on notification data
 *  - Managing undo operations and state rollbacks
 */
export class Notif {
	// ========== Properties ==========

	/** Reference to the main Game instance */
	readonly game: Game;

	// ========== Constructor ==========

	/**
	 * Initialize the Notification handler
	 * @param game - Main game instance
	 */
	public constructor(game: Game) {
		this.game = game;
	}

	// ========== Action Notifications ==========

	/**
	 * Handles movement notification - moves biker to new region
	 * @param args - Contains player_id and region
	 */
	public async notif_move(args: { player_id: number; region: number }): Promise<void> {
		if (this.game.bga.gameui.player_id === args.player_id) {
			(this.game.c.player_area[args.player_id].c.hand[0] as Hand).inactivateAllTravels(true);
			(this.game.c.board[0] as Board).inactivateAllRegions();
			(this.game.c.player_area[args.player_id].c.postcard_player[0] as PostcardPlayer).activatePostcards(false);
			(this.game.c.board[0] as Board).inactivateAllCampsites();
		}
		await (this.game.c.board[0] as Board).moveBiker(args.player_id, args.region);
	}

	/**
	 * Handles postcard taking notification - adds postcard to player area
	 * @param args - Contains player_id and postcard id
	 */
	public async notif_postcard(args: { player_id: number; postcard: number }): Promise<void> {
		const postcard: Postcard = this.game.c.postcard_supply[0].c.postcard[args.postcard] as Postcard;
		(this.game.c.postcard_supply[0] as PostcardSupply).rearrangeSupplyRow(postcard);
		await (this.game.c.player_area[args.player_id].c.postcard_player[0] as PostcardPlayer).addPostcard(postcard);
	}

	/**
	 * Handles postcard from deck notification - adds postcard from deck to player area
	 * @param args - Contains player_id, postcard id, and optional top card
	 */
	public async notif_postcardDeck(args: {
		player_id: number;
		postcard: number;
		top: number | undefined;
	}): Promise<void> {
		(this.game.c.postcard_supply[0] as PostcardSupply).activatePostcards(false);
		if (args.top !== undefined) (this.game.c.postcard_supply[0] as PostcardSupply).addPostcardToTop(args.top);
		const postcard: Postcard = this.game.c.postcard_supply[0].c.postcard[args.postcard] as Postcard;
		await (this.game.c.player_area[args.player_id].c.postcard_player[0] as PostcardPlayer).addPostcard(postcard);
	}

	/**
	 * Handles camp placement notification - places camp on board
	 * @param args - Contains player_id, camp id, region, and campsite location
	 */
	public async notif_camp(args: {
		player_id: number;
		camp: number;
		region: number;
		campsite: number;
	}): Promise<void> {
		(this.game.c.board[0] as Board).inactivateAllCampsites();
		const camp: Camp = this.game.c.player_area[args.player_id].c.player_board[0].c.camp[args.camp];
		await (this.game.c.board[0] as Board).addCamp(camp, args.player_id, args.region, args.campsite);
	}

	/**
	 * Handles undo camp notification - removes camp from board and returns to player
	 * @param args - Contains player_id, camp id, region, and campsite location
	 */
	public async notif_undoCamp(args: {
		player_id: number;
		camp: number;
		region: number;
		campsite: number;
	}): Promise<void> {
		(this.game.c.board[0] as Board).camp_counters[args.player_id][(this.game.c.board[0] as Board).campsites[args.region - 1][args.campsite - 1]].innerHTML = String(
			Number((this.game.c.board[0] as Board).camp_counters[args.player_id][(this.game.c.board[0] as Board).campsites[args.region - 1][args.campsite - 1]].innerHTML) - 1
		);
		if (this.game.bga.gameui.player_id === args.player_id) {
			(this.game.c.player_area[args.player_id] as PlayerArea).inactivateAllSouvenirSpaces();
			(this.game.c.player_area[args.player_id].c.hand[0] as Hand).inactivateAllTravels(true);
			(this.game.c.player_area[args.player_id].c.postcard_player[0] as PostcardPlayer).activatePostcards(false);
		}
		const camp: Camp = this.game.c.board[0].c.camp[args.region * 10 + args.campsite];
		await (this.game.c.player_area[args.player_id].c.player_board[0] as PlayerBoard).addCamp(camp, args.camp);
	}

	/**
	 * Handles souvenir placement notification - adds souvenir to postcard
	 * @param args - Contains player_id, postcard id, and souvenir location
	 */
	public async notif_souvenir(args: {
		player_id: number;
		postcard: number;
		location: number;
	}): Promise<void> {
		(this.game.c.player_area[args.player_id] as PlayerArea).inactivateAllSouvenirSpaces();
		await (this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard[args.postcard] as Postcard).addSouvenir(args.location);
	}

	/**
	 * Handles undo souvenir notification - removes souvenir from postcard
	 * @param args - Contains player_id, postcard id, and souvenir space
	 */
	public async notif_undoSouvenir(args: {
		player_id: number;
		postcard: number;
		space: number;
	}): Promise<void> {
		if (this.game.bga.gameui.player_id === args.player_id) {
			(this.game.c.player_area[args.player_id].c.bonus_actions[0] as BonusActions).inactivateBonusActions();
			(this.game.c.player_area[args.player_id] as PlayerArea).inactivateAllStampSpaces();
			(this.game.c.player_area[args.player_id].c.hand[0] as Hand).inactivateAllTravels(true);
			(this.game.c.player_area[args.player_id].c.postcard_player[0] as PostcardPlayer).activatePostcards(false);
		}
		await (this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard[args.postcard] as Postcard).removeSouvenir(args.space);
	}

	/**
	 * Handles stamp placement notification - adds stamp to postcard
	 * @param args - Contains player_id, postcard id, and stamp location
	 */
	public async notif_stamp(args: { player_id: number; postcard: number; location: number }): Promise<void> {
		(this.game.c.player_area[args.player_id] as PlayerArea).inactivateAllStampSpaces();
		await (this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard[args.postcard] as Postcard).addStamp(args.location);
	}

	/**
	 * Handles undo stamp notification - removes stamp from postcard
	 * @param args - Contains player_id, postcard id, and stamp space
	 */
	public async notif_undoStamp(args: {
		player_id: number;
		postcard: number;
		space: number;
	}): Promise<void> {
		if (this.game.bga.gameui.player_id === args.player_id) {
			(this.game.c.player_area[args.player_id].c.hand[0] as Hand).inactivateAllTravels(true);
			(this.game.c.player_area[args.player_id].c.postcard_player[0] as PostcardPlayer).activatePostcards(false);
		}
		await (this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard[args.postcard] as Postcard).removeStamp(args.space);
	}

	// ========== Postcard Supply Notifications ==========

	/**
	 * Handles discard postcards notification - discards supply row
	 */
	public async notif_discardPostcards(): Promise<void> {
		await (this.game.c.postcard_supply[0] as PostcardSupply).discardPostcardSupply();
	}

	/**
	 * Handles discard travels notification - discards travels from player hand
	 * @param args - Contains player_id and array of travel ids to discard
	 */
	public async notif_discardTravels_(args: {
		player_id: number;
		travels: number[];
	}): Promise<void> {
		(this.game.c.player_area[args.player_id].c.hand[0] as Hand).inactivateAllTravels(true);
		(this.game.c.player_area[args.player_id].c.postcard_player[0] as PostcardPlayer).activatePostcards(false);
		await (this.game.c.player_area[args.player_id].c.hand[0] as Hand).discardTravels(args.travels);
	}

	/**
	 * Handles refill travel supply notification - refills travel card from deck
	 * @param args - Contains travel id and supply location
	 */
	public async notif_refillTravelSupply(args: { travel: number; location: number }): Promise<void> {
		await (this.game.c.board[0] as Board).refillTravel(args.travel, args.location);
	}

	/**
	 * Handles undo discard travels notification - restores discarded travels to hand
	 * @param args - Contains player_id and array of travel ids
	 */
	public async notif_undoDiscardTravels(args: {
		player_id: number;
		travels: number[];
	}): Promise<void> {
		await (this.game.c.player_area[args.player_id].c.hand[0] as Hand).undoDiscardTravels(args.travels);
	}

	/**
	 * Handles refill postcard supply notification - refills postcard supply
	 * @param args - Contains optional top card id
	 */
	public async notif_refillPostcardSupply(args: { top: number | undefined }): Promise<void> {
		await (this.game.c.postcard_supply[0] as PostcardSupply).refillPostcardSupply(args.top);
	}

	/**
	 * Handles travel card selection notification - adds travel to player hand or animates away
	 * @param args - Contains player_id and travel id
	 */
	public async notif_travel(args: { player_id: number; travel: number }): Promise<void> {
		(this.game.c.board[0] as Board).activateTravelDeck(false);
		(this.game.c.board[0] as Board).activateAllTravels(false);
		const travel: Travel = this.game.c.board[0].c.travel[args.travel] as Travel;
		if (this.game.bga.gameui.player_id === args.player_id) {
			await (this.game.c.player_area[args.player_id].c.hand[0] as Hand).addTravel(travel);
		} else {
			await this.game.animationManager.fadeOutAndDestroy(travel.html, this.game.bga.playerPanels.getElement(args.player_id), {
				duration: 800,
			});
			delete this.game.c.board[0].c.travel[args.travel];
		}
		
	}

	/**
	 * Handles gift card selection notification - adds gift to player area
	 * @param args - Contains player_id and gift id
	 */
	public async notif_gift(args: { player_id: number; gift: number }): Promise<void> {
		(this.game.c.board[0] as Board).activateAllGifts(false);
		const gift: Gift = this.game.c.board[0].c.gift[args.gift] as Gift;
		delete this.game.c.board[0].c.gift[args.gift];
		await (this.game.c.player_area[args.player_id].c.gift_player[0] as GiftPlayer).addGift(gift);
	}

	/**
	 * Handles undo travel notification - returns travel card to board supply
	 * @param args - Contains player_id, travel id, and location
	 */
	public async notif_undoTravel(args: {
		player_id: number;
		travel: number;
		location: number;
	}): Promise<void> {
		if (this.game.bga.gameui.player_id === args.player_id) {
			const travel: Travel = this.game.c.player_area[args.player_id].c.hand[0].c.travel[args.travel] as Travel;
			await (this.game.c.board[0] as Board).addTravel(travel, args.location);
		} else {
			await (this.game.c.board[0] as Board).refillTravel(args.travel, args.location);
		}

	}

	/**
	 * Handles travel deck draw notification - animates travel taken from deck
	 * @param args - Contains player_id
	 */
	public async notif_travelDeck(args: { player_id: number }): Promise<void> {
		(this.game.c.board[0] as Board).activateTravelDeck(false);
		(this.game.c.board[0] as Board).activateAllTravels(false);
		if (this.game.bga.gameui.player_id !== args.player_id) {
			const element = document.createElement('travel_deck');
			await this.game.animationManager.slideFloatingElement(
				element,
				(this.game.c.board[0].c.travel_deck[0] as TravelDeck).html,
				this.game.bga.playerPanels.getElement(args.player_id),
				{ duration: 800, parallelAnimations: [{ keyframes: [{ opacity: '1' }, { opacity: '0' }] }] }
			);
		}
	}

	/**
	 * Handles refill gift notification - refills gift card from deck
	 * @param args - Contains player_id, gift id, and location
	 */
	public async notif_refillGift(args: {
		player_id: number;
		gift: number;
		location: number;
	}): Promise<void> {
		await (this.game.c.board[0] as Board).refillGift(args.gift, args.location);
		this.game.c.board[0].c.gift[args.gift].setArg("deck", false);
	}

	/**
	 * Handles travel from deck notification - adds travel from deck to player hand
	 * @param args - Contains player_id and travel id
	 */
	public async notif_travelDeck_(args: { player_id: number; travel: number }): Promise<void> {
		const travel: Travel = (this.game.c.board[0] as Board).createTravelToDeck(args.travel);
		travel.setArg("deck", true);
		await (this.game.c.player_area[args.player_id].c.hand[0] as Hand).addTravelFromDeck(travel);
		travel.setArg("deck", false);
	}

	/**
	 * Handles send postcard notification - removes postcard from player area
	 * @param args - Contains player_id and postcard id
	 */
	public async notif_send(args: { player_id: number; postcard: number }): Promise<void> {
		const postcard: Postcard = this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard[args.postcard] as Postcard;
		delete this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard[args.postcard];
		await this.game.animationManager.fadeOutAndDestroy(postcard.html, this.game.bga.playerPanels.getElement(args.player_id), {
			duration: 800,
			ignoreRotation: false,
			parallelAnimations: [
				{
					keyframes: [{ transform: 'scale(1)' }, { transform: 'scale(0)' }],
				},
			],
		});
	}

	/**
	 * Handles undo send postcard notification - restores postcard to player area
	 * @param args - Contains player_id, postcard id, stamps, and souvenirs
	 */
	public notif_undoSend(args: {
		player_id: number;
		postcard: number;
		stamps: any;
		souvenirs: any;
	}): void {
		(this.game.c.player_area[args.player_id].c.postcard_player[0] as PostcardPlayer).undoSend(
			args.postcard,
			args.stamps,
			args.souvenirs
		);
	}

	/**
	 * Handles best traveller scoring notification - displays scoring for region camps
	 * @param args - Contains player_color and region
	 */
	public async notif_best_traveller(args: { player_color: string; region: number }): Promise<void> {
		for (const c in this.game.c.board[0].c.camp) {
			if ((this.game.c.board[0].c.camp[c] as Camp).args.region as Number === args.region) {
				this.game.animationManager.displayScoring(
					(this.game.c.board[0].c.camp[c] as Camp).html,
					1,
					args.player_color
				);
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}

	// ========== Bonus and End Game Notifications ==========

	
	/**
	 * Handles end bonus notification - moves end game bonus to player area
	 * @param args - Contains player_id
	*/
	public async notif_endBonus(args: { player_id: number }): Promise<void> {
		this.game.c.board[0].c.end_game_bonus[0].addToParent(this.game.c.player_area[args.player_id]);
		await this.game.animationManager.slideAndAttach(
			(this.game.c.player_area[args.player_id].c.end_game_bonus[0] as EndGameBonus).html,
			(this.game.c.player_area[args.player_id] as PlayerArea).html,
			{ duration: 800 }
		);
	}
	
	/**
	 * Handles undo end bonus notification - returns end game bonus to board
	 * @param args - Contains player_id
	 */
	public async notif_undoEndBonus(args: { player_id: number }): Promise<void> {
		this.game.c.player_area[args.player_id].c.end_game_bonus[0].addToParent(this.game.c.board[0]);
		await this.game.animationManager.slideAndAttach(
			(this.game.c.board[0].c.end_game_bonus[0] as EndGameBonus).html,
			(this.game.c.board[0] as PlayerArea).html,
			{ duration: 800 }
		);
	}

	/**
	 * Handles end bonus scoring notification - displays scoring animation for bonus
	 * @param args - Contains player_id, player_color, amount, and gift
	 */
	public async notif_scoreEndBonus(args: {
		player_id: number;
		player_color: string;
		n: number;
		gift: number;
	}): Promise<void> {
		await this.game.animationManager.displayScoring(
			(this.game.c.player_area[args.player_id].c.end_game_bonus[0] as EndGameBonus).html,
			3,
			args.player_color
		);
	}

	/**
	 * Handles unsent postcards scoring notification - displays scoring for unsent cards
	 * @param args - Contains player_id and player_color
	 */
	public async notif_scoreUnsentPostcards(args: {
		player_id: number;
		player_color: string;
	}): Promise<void> {
		for (const p in this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard) {
			this.game.animationManager.displayScoring(
				(this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard[p] as Postcard).html,
				1,
				args.player_color
			);
		}
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}

	/**
	 * Handles gift scoring notification - displays scoring for gift card
	 * @param args - Contains player_id, player_color, amount, and gift id
	 */
	public async notif_scoreGift(args: {
		player_id: number;
		player_color: string;
		n: number;
		gift: number;
	}): Promise<void> {
		await this.game.animationManager.displayScoring(
			(this.game.c.player_area[args.player_id].c.gift_player[0].c.gift[args.gift] as Gift).html,
			args.n,
			args.player_color
		);
	}

	/**
	 * Handles itinerary scoring notification - displays scoring for itinerary completion
	 * @param args - Contains player_id, player_color, and amount
	 */
	public async notif_scoreItinerary(args: {
		player_id: number;
		player_color: string;
		n: number;
	}): Promise<void> {
		this.game.c.player_area[args.player_id].html?.scrollIntoView({
  			behavior: "smooth",
			block: "center"
		});
		await this.game.bga.gameui.wait(1000);
		await this.game.animationManager.displayScoring(
			(this.game.c.player_area[args.player_id].c.itinerary[0] as Itinerary).html,
			args.n,
			args.player_color
		);
	}

	/**
	 * Handles action gift notification - removes gift card after use
	 * @param args - Contains player_id and gift id
	 */
	public async notif_actionGift(args: { player_id: number; gift: number }): Promise<void> {
		const gift = this.game.c.player_area[args.player_id].c.gift_player[0].c.gift[args.gift] as Gift;
		gift.html.remove();
		delete this.game.c.player_area[args.player_id].c.gift_player[0].c.gift[args.gift];
	}

	/**
	 * Handles undo action gift notification - restores gift card
	 * @param args - Contains player_id and gift id
	 */
	public async notif_undoActionGift(args: { player_id: number; gift: number }): Promise<void> {
		(this.game.c.player_area[args.player_id].c.gift_player[0] as GiftPlayer).addGiftFromUndo(args.gift);
	}

	// ========== Guide Phase Notifications ==========

	/**
	 * Handles reveal guide postcards notification - displays postcard selection guide
	 * @param args - Contains optional deck card and array of postcards
	 */
	public async notif_revealGuidePostcards(args: {
		deck: number | null;
		postcards: any;
	}): Promise<void> {
		await (this.game as Game).revealGuidePostcards(args.deck, args.postcards);
	}

	/**
	 * Handles guide notification - adds two postcards to player from guide
	 * @param args - Contains player_id and two postcard ids
	 */
	public async notif_guide(args: {
		player_id: number;
		postcard_1: number;
		postcard_2: number;
	}): Promise<void> {
		(this.game.c.postcard_guide[0] as PostcardGuide).activatePostcards(false);
		const postcard_1: Postcard = this.game.c.postcard_guide[0].c.postcard[args.postcard_1] as Postcard;
		await (this.game.c.player_area[args.player_id].c.postcard_player[0] as PostcardPlayer).addPostcard(postcard_1);
		const postcard_2: Postcard = this.game.c.postcard_guide[0].c.postcard[args.postcard_2] as Postcard;
		await (this.game.c.player_area[args.player_id].c.postcard_player[0] as PostcardPlayer).addPostcard(postcard_2);
		(this.game.c.postcard_guide[0] as PostcardGuide).html.remove();
		delete this.game.c.postcard_guide[0];
	}

	/**
	 * Handles guide1 notification - adds one postcard to player from guide
	 * @param args - Contains player_id and postcard id
	 */
	public async notif_guide1(args: { player_id: number; postcard_1: number }): Promise<void> {
		(this.game.c.postcard_guide[0] as PostcardGuide).activatePostcards(false);
		const postcard_1: Postcard = this.game.c.postcard_guide[0].c.postcard[args.postcard_1] as Postcard;
		await (this.game.c.player_area[args.player_id].c.postcard_player[0] as PostcardPlayer).addPostcard(postcard_1);
	}

	/**
	 * Handles reveal top postcard notification - reveals top card of postcard deck
	 * @param args - Contains player_id and top card id
	 */
	public async notif_revealTopPostcard(args: { player_id: number; top: number }): Promise<void> {
		(this.game.c.postcard_supply[0] as PostcardSupply).addPostcardToTop(args.top);
	}

	/**
	 * Handles itinerary notification - activates circle on itinerary
	 * @param args - Contains player_id and circle number
	 */
	public async notif_itinerary(args: { player_id: number; n: number }): Promise<void> {
		(this.game.c.player_area[args.player_id].c.itinerary[0].c.circle[args.n] as Circle).activate();
	}

	// ========== Counter Notifications ==========

	/**
	 * Handles table counter update notification - updates various game counters
	 * @param args - Contains counter name, value, oldValue, inc, absInc, and playerId
	 */
	public notif_setTableCounter(args: {
		name: string;
		value: number;
		oldValue: number;
		inc: number;
		absInc: number;
		playerId: number;
	}): void {
		if (args.name === 'postcards_counter') {
			if (args.value === 2) (this.game.c.postcard_supply[0] as PostcardSupply).setArg("count", 2);
			else if (args.value === 1 || args.value === 0) (this.game.c.postcard_supply[0] as PostcardSupply).setArg("count", 1);
			else (this.game.c.postcard_supply[0] as PostcardSupply).setArg("count", 3);
		} else if (args.name === 'travels_counter') {
			if (args.value === 2) (this.game.c.board[0].c.deck_stack[0] as DeckStack).setArg("count", 2);
			else if (args.value === 1) (this.game.c.board[0].c.deck_stack[0] as DeckStack).setArg("count", 1);
			else (this.game.c.board[0].c.deck_stack[0] as DeckStack).setArg("count", 3);
		} else if (args.name === 'move_bonus_counter') {
			if (this.game.bga.players.isCurrentPlayerActive()) {
				if (args.value === 0) (this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[1] as TravelOption).setArg("count", 0);
				else if (args.value === 1) (this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[1] as TravelOption).setArg("count", 1);
				else (this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[1] as TravelOption).setArg("count", 2);
			}
		} else if (args.name === 'postcard_bonus_counter') {
			if (this.game.bga.players.isCurrentPlayerActive()) {
				if (args.value === 0) (this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[2] as TravelOption).setArg("count", 0);
				else if (args.value === 1) (this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[2] as TravelOption).setArg("count", 1);
				else (this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[2] as TravelOption).setArg("count", 2);
			}
		} else if (args.name === 'camp_bonus_counter') {
			if (this.game.bga.players.isCurrentPlayerActive()) {
				if (args.value === 0) (this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[3] as TravelOption).setArg("count", 0);
				else if (args.value === 1) (this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[3] as TravelOption).setArg("count", 1);
				else (this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[3] as TravelOption).setArg("count", 2);
			}
		} else if (args.name === 'stamp_bonus_counter') {
			if (this.game.bga.players.isCurrentPlayerActive()) {
				if (args.value === 0) (this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[4] as TravelOption).setArg("count", 0);
				else if (args.value === 1) (this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[4] as TravelOption).setArg("count", 1);
				else (this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[4] as TravelOption).setArg("count", 2);
			}
		}
	}

	// ========== Undo Management ==========

	/**
	 * Handles cancel notifs notification - marks logs for undo operations
	 * @param args - Contains array of notification IDs to cancel
	 */
	public async notif_cancelNotifs(args: { notifIds: any }): Promise<void> {
		this.game.cancelLogs(args.notifIds);
	}
}
