import { Game } from "../game";
import { GameElement } from "../gameElement";
import { EndGameBonus } from "../board/end_game_bonus/end_game_bonus";
import { Itinerary } from "./itinerary/itinerary";
import { PlayerBoard } from "./player_board/player_board";
import { GiftPlayer } from "./gift_player/gift_player";
import { PostcardPlayer } from "./postcard_player/postcard_player";
import { BonusActions } from "./bonus_actions/bonus_actions";
import { Hand } from "./hand/hand";

/**
 * Manages a player's personal game area
 *
 * Contains all player-specific UI elements including:
 * postcards, gifts, hand, itinerary, player board, and bonus actions.
 *
 * Responsibilities:
 *  - Managing player's postcard collection
 *  - Managing player's gift cards
 *  - Managing player's travel hand (if current player)
 *  - Managing player's itinerary progress
 *  - Managing player's camp placement board
 *  - Managing player's bonus actions (if current player)
 *  - Activating/deactivating stamp and souvenir placement spaces
 */
export class PlayerArea extends GameElement {
	// ========== Properties ==========

	/** The player ID this area belongs to */
	public readonly player_id: number;

	// ========== Constructor ==========

	/**
	 * Initialize the player area with all child elements
	 * @param parent - Parent Game instance
	 * @param child_id - Element ID
	 * @param data - Player data containing all card and game state information
	 */
	public constructor(parent: Game, child_id: number, data: any) {
		super(parent, child_id, "player_area");
		this.player_id = data.id;

		// Create itinerary track
		new Itinerary(this, 0, data.itinerary, data.itinerary_postcards);

		// Create player board (camps and personal board display)
		new PlayerBoard(this, 0, data.color, data.name, data.player_board_side, data.camps);

		// Create end game bonus if this player has it
		if (data.end_bonus === data.id) {
			new EndGameBonus(this, 0);
		}

		// Create gift player area
		new GiftPlayer(this, 0, data.gifts);

		// Create postcard player area
		new PostcardPlayer(this, 0, data.postcards);

		// Create bonus actions and hand only for current player
		if (this.game.bga.gameui.player_id === data.id) {
			if (this.game.bga.players.isCurrentPlayerActive()) {
				new BonusActions(this, 0, data.bonus_actions);
			} else {
				new BonusActions(this, 0);
			}
			new Hand(this, 0, data.hand);
		}
	}

	// ========== Public Methods ==========

	/**
	 * Activate stamp placement spaces on postcards
	 *
	 * Allows the player to select where to place stamps on their postcards.
	 *
	 * @param spaces - Object mapping postcard IDs to arrays of available stamp space indices
	 */
	public activateStampSpaces(spaces: { number: number[] }): void {
		(this.c.postcard_player[0] as PostcardPlayer).activateStampSpaces(spaces);
	}

	/**
	 * Activate souvenir placement spaces on postcards
	 *
	 * Allows the player to select where to place souvenirs on their postcards.
	 *
	 * @param spaces - Object mapping postcard IDs to arrays of available souvenir space indices
	 */
	public activateSouvenirSpaces(spaces: { number: number[] }): void {
		(this.c.postcard_player[0] as PostcardPlayer).activateSouvenirSpaces(spaces);
	}

	/**
	 * Deactivate all souvenir placement spaces
	 *
	 * Disables all souvenir spaces across all postcards.
	 */
	public inactivateAllSouvenirSpaces(): void {
		(this.c.postcard_player[0] as PostcardPlayer).inactivateAllSouvenirSpaces();
	}

	/**
	 * Deactivate all stamp placement spaces
	 *
	 * Disables all stamp spaces across all postcards.
	 */
	public inactivateAllStampSpaces(): void {
		(this.c.postcard_player[0] as PostcardPlayer).inactivateAllStampSpaces();
	}
}