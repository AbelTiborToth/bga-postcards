import { GameElement } from "../../gameElement";
import { Board } from "../board";

/**
 * Represents a deck stack indicator on the board
 * 
 * Displays remaining cards in either the travel deck or gift deck.
 * Shows visual count indicator (1-3 cards) based on deck fullness.
 * 
 * Responsibilities:
 *  - Displaying deck stack with type indicator
 *  - Tracking remaining cards in the deck
 *  - Providing visual feedback on deck status
 */
export class DeckStack extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize a deck stack indicator
	 * @param parent - Parent Board instance
	 * @param child_id - Element ID
	 * @param type - Deck type (0 = Travel, 1 = Gift)
	 */
	public constructor(parent: Board, child_id: number, type: number) {
		super(parent, child_id, "deck_stack", { type, count: 3 });
	}
}