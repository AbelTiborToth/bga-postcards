import { GameElement } from "../../../gameElement";
import { Itinerary } from "../itinerary";

/**
 * Represents a single region circle on the itinerary card
 * 
 * Each circle corresponds to one of the four regions on the itinerary.
 * Circles can be activated to indicate that the player has sent a postcard
 * from that region, tracking progress toward the itinerary bonus.
 * 
 * Responsibilities:
 *  - Displaying the circle for a specific region
 *  - Tracking activation state (whether region objective is met)
 *  - Updating visual state when activated
 */
export class Circle extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize a circle for the itinerary
	 * @param parent - Parent Itinerary instance
	 * @param child_id - Circle index (0-3 representing regions 1-4)
	 * @param active - Whether this circle is initially active
	 */
	public constructor(parent: Itinerary, child_id: number, active: boolean) {
		super(parent, child_id, "circle", { type: child_id, active });
	}

	// ========== Public Methods ==========

	/**
	 * Activate this circle to indicate region objective is met
	 * 
	 * Sets the active state to true, triggering visual updates to show
	 * that the player has sent a postcard from this region.
	 */
	public activate(): void {
		this.setArg("active", true);
	}
}