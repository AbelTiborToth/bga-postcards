import { GameElement } from "../../gameElement";
import { Board } from "../board";

/**
 * Represents the stamp supply on the board
 *
 * The stamp supply contains all available stamp tokens that players can take
 * during gameplay. Stamps are placed on postcard spaces to fulfill sending requirements.
 *
 * Responsibilities:
 *  - Displaying the stamp supply on the board
 *  - Serving as a visual reference for available stamps
 */
export class StampSupply extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize the stamp supply
	 * @param parent - Parent Board instance
	 * @param child_id - Element ID
	 */
	public constructor(parent: Board, child_id: number) {
		super(parent, child_id, "stamp_supply");
	}
}