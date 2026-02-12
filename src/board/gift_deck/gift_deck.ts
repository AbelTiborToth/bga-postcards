import { GameElement } from "../../gameElement";
import { Board } from "../board";

/**
 * Represents the gift card deck on the board
 *
 * The gift deck contains gift cards that are drawn to refill the gift supply.
 * When a player sends a postcard, they choose a gift card from the supply,
 * and the empty space is refilled from the deck.
 *
 * Responsibilities:
 *  - Displaying the gift deck on the board
 *  - Serving as a visual reference for available gift cards
 */
export class GiftDeck extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize the gift deck
	 * @param parent - Parent Board instance
	 * @param child_id - Element ID
	 */
	public constructor(parent: Board, child_id: number) {
		super(parent, child_id, "gift_deck");
	}
}