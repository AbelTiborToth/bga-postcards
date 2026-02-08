import { GameElement } from "../../gameElement";
import { PlayerArea } from "../player_area";
import { Circle } from "./circle/circle";

/**
 * Manages a player's itinerary card and progress tracking
 *
 * The itinerary card shows which regions a player should send postcards from
 * to earn bonus end-game points. Tracks progress through numbered circles.
 *
 * Responsibilities:
 *  - Displaying the player's itinerary card with region objectives
 *  - Managing circle progress indicators (1/2/3/4 regions completed)
 *  - Providing information about scoring bonuses
 *  - Displaying tooltip with rules and scoring information
 */
export class Itinerary extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize the itinerary card with circles for progress tracking
	 * @param parent - Parent PlayerArea instance
	 * @param child_id - Element ID
	 * @param type - Itinerary card type/variant
	 * @param circles - Data for circles representing region progress (1-4)
	 */
	public constructor(parent: PlayerArea, child_id: number, type: number, circles: any) {
		super(parent, child_id, "itinerary", { type });

		// Create circles for each region (0-3 representing 1-4 regions completed)
		for (const c in circles) {
			new Circle(this, Number(c), circles[c]);
		}

		// Setup tooltip with rules and scoring information
		this.setupTooltip();
	}

	// ========== Private Helper Methods ==========

	/**
	 * Setup tooltip for the itinerary card
	 *
	 * Displays:
	 *  - Itinerary card setup rules
	 *  - Biker starting position
	 *  - End-game scoring for region matches
	 *  - Scoring progression (2/4/7/11 points)
	 *  - Rules about multiple postcards from same region
	 *  - Explanation of maximum score requirement
	 *
	 * @private
	 */
	private setupTooltip(): void {
		this.game.bga.gameui.addTooltipHtml(
			`postcards_${this.id}`,
			`<tooltip>
				<h3>${_("Itinerary Card")}</h3>
				<p>${_("During setup give an Itinerary cards to each player randomly. Each player places their Biker on the region indicated in the top-left corner of their Itinerary card. The remaining Itinerary cards are removed from the game.")}</p>
				<p>${_("At the end of the game, if you have sent 1/2/3/4 Postcards that match the regions shown at the bottom of the card, you score 2/4/7/11 points.")}</p>
				<p>${_("It is not mandatory to complete your Itinerary card, but it can give you valuable extra points!")}</p>
				<p>${_("You may send multiple Postcards from the same region, but each region on your Itinerary card only counts once towards the objective. To score the maximum amount of points, you must send Postcards from all 4 different regions!")}</p>
			</tooltip>`
		);
	}
}