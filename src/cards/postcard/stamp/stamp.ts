import { GameElement } from "../../../gameElement";
import { Postcard } from "../postcard";

/**
 * Represents a single stamp token placed on a postcard
 *
 * Stamps are required to send postcards. Each stamp has a color matching
 * the Travel card used to place it. Postcards need all stamp spaces filled
 * before they can be sent.
 *
 * Responsibilities:
 *  - Displaying stamp token on postcard space
 *  - Tracking stamp location on the postcard
 */
export class Stamp extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize a stamp token on a postcard
	 * @param parent - Parent Postcard instance
	 * @param child_id - Stamp ID
	 * @param location - Stamp space location on the postcard
	 */
	public constructor(parent: Postcard, child_id: number, location: number) {
		super(parent, child_id, "stamp", { location });
	}
}