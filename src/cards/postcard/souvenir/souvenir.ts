import { GameElement } from "../../../gameElement";
import { Postcard } from "../postcard";

/**
 * Represents a single souvenir token placed on a postcard
 *
 * Souvenirs are earned by placing matching camp tokens and provide immediate effects.
 * Each souvenir has a type matching a specific camp type and is placed on a
 * corresponding souvenir space on the postcard.
 *
 * Responsibilities:
 *  - Displaying souvenir token on postcard space
 *  - Tracking souvenir location on the postcard
 */
export class Souvenir extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize a souvenir token on a postcard
	 * @param parent - Parent Postcard instance
	 * @param child_id - Souvenir ID
	 * @param location - Souvenir space location on the postcard
	 */
	public constructor(parent: Postcard, child_id: number, location: number) {
		super(parent, child_id, "souvenir", { location });
	}
}