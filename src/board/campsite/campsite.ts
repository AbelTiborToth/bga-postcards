import { GameElement } from "../../gameElement";
import { Board } from "../board";

/**
 * Represents a single campsite on the game board
 * 
 * Campsites are locations where players place camp tokens. Each campsite has a type
 * matching souvenir types, and only one camp token can be placed per site.
 * Completing all campsites in a region grants bonus points.
 * 
 * Responsibilities:
 *  - Displaying campsite with type information
 *  - Handling click interactions for camp placement
 *  - Tracking campsite location and region
 *  - Providing tooltip with campsite rules and scoring
 */
export class Campsite extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize a campsite on the board
	 * @param parent - Parent Board instance
	 * @param child_id - Element ID
	 * @param type - Campsite type (1-8, matching souvenir types)
	 * @param region - Region number containing this campsite
	 * @param location - Campsite location within the region
	 */
	public constructor(
		parent: Board,
		child_id: number,
		type: number,
		region: number,
		location: number
	) {
		super(parent, child_id, "campsite", { type, region, location, active: false });

		// Register click handler
		this.html.addEventListener('click', (): Promise<void> => this.onClick());

		// Setup tooltip
		this.setupTooltip();
	}

	// ========== Public Methods ==========

	/**
	 * Activate or deactivate this campsite for camp placement
	 * @param b - True to activate (default), false to deactivate
	 */
	public activate(b: boolean = true): void {
		this.setArg("active", b);
	}

	// ========== Private Helper Methods ==========

	/**
	 * Handle campsite click - places camp when clicked
	 * 
	 * During Camp phase:
	 *  - Click: Place camp on this campsite
	 * 
	 * @private
	 */
	private async onClick(): Promise<void> {
		if (this.args.active === true) {
			switch (this.game.bga.gameui.gamedatas.gamestate.name) {
				case 'Camp':
					this.game.bga.actions.performAction('actCamp', {
						campsite: this.args.location,
					});
					break;
			}
		}
	}

	/**
	 * Setup tooltip with campsite information and rules
	 * 
	 * Displays:
	 *  - Campsite type
	 *  - Rules about camp placement
	 *  - Best traveler bonus scoring
	 * 
	 * @private
	 */
	private setupTooltip(): void {
		this.game.bga.gameui.addTooltipHtml(
			`postcards_${this.id}`,
			`<tooltip>
				<h3>${_("Campsite")}</h3>
				<p>${this.game.bga.gameui.format_string(_("<b>Type:</b> ${t}"), {
					t: this.getCampsiteTypeName(),
				})}</p>
				<p>${_("There can only be 1 Camp token per campsite.")}</p>
				<p>${_("You can place a Camp token on a campsite even if you don't have an available Souvenir space that matches it. However, when doing so, you don't place a Souvenir token.")}</p>
				<h4>${_("Best Traveler In The Region")}</h4>
				<p>${_("If a player manages to place their Camp tokens on ALL the campsites in a region, they become known as the best traveler in that region! That player immediately scores 1 point per Camp token they have placed there.")}</p>
			</tooltip>`
		);
	}

	/**
	 * Get the campsite type name based on type number
	 * 
	 * Maps type numbers to localized souvenir/campsite type names.
	 * 
	 * @returns Localized campsite type name
	 * @private
	 */
	private getCampsiteTypeName(): string {
		switch (this.args.type) {
			case 1:
				return _("Sight");
			case 2:
				return _("History");
			case 3:
				return _("Culture");
			case 4:
				return _("Gastronomy");
			case 5:
				return _("Forest");
			case 6:
				return _("Mountain");
			case 7:
				return _("Shore");
			case 8:
				return _("Beach");
		}
		return '';
	}
}