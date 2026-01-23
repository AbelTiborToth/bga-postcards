import { GameElement } from "../../../gameElement";
import { Hand } from "../hand";
import { TravelOption } from "../../../cards/travel/travel_option/travel_option";

/**
 * Manages the double action selection interface
 * 
 * Provides four travel option buttons that allow the player to select
 * two travel cards to play as a double action combination.
 * 
 * Responsibilities:
 *  - Creating and displaying travel option buttons
 *  - Allowing selection of dual actions from hand
 */
export class DoubleActions extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize the double actions interface with four travel options
	 * @param parent - Parent Hand instance
	 * @param child_id - Element ID
	 */
	public constructor(parent: Hand, child_id: number) {
		super(parent, child_id, "double_actions");

		// Create four travel option buttons (1-4)
		new TravelOption(this, 1, 1);
		new TravelOption(this, 2, 2);
		new TravelOption(this, 3, 3);
		new TravelOption(this, 4, 4);
	}

    // ========== Methods ==========

    public activate(postcard: boolean, camp: boolean, stamp: boolean): void {
        (this.c.travel_option?.[2] as TravelOption).activate(postcard);
        (this.c.travel_option?.[3] as TravelOption).activate(camp);
        (this.c.travel_option?.[4] as TravelOption).activate(stamp);
    }
}