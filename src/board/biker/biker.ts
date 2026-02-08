import { Board } from "../board";
import { GameElement } from "../../gameElement";

/**
 * Represents a player's biker token on the board
 * 
 * Each player has a biker that moves between regions during the game.
 * The biker's position determines which region the player can place camps in
 * and is used for various game mechanics.
 * 
 * Responsibilities:
 *  - Displaying biker token with player color
 *  - Managing biker position on the board
 *  - Tracking whether this is the current player's biker
 *  - Providing tooltip with player information
 */
export class Biker extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize a biker token
	 * @param parent - Parent Board instance
	 * @param child_id - Biker ID (player ID)
	 * @param color - Player color hex code
	 * @param location - Starting region location
	 * @param own - Whether this is the current player's biker
	 */
	public constructor(
		parent: Board,
		child_id: number,
		color: string,
		location: number,
		own: boolean
	) {
		super(parent, child_id, "biker", { color, location, own });

		// Setup tooltip
		this.setupTooltip();
	}

	// ========== Public Methods ==========

	/**
	 * Move biker to a new region
	 * @param region - Destination region number
	 */
	public move(region: number): void {
		this.setArg("location", region);
	}

	// ========== Private Helper Methods ==========

	/**
	 * Setup tooltip with biker player information
	 * 
	 * Displays:
	 *  - Player color name
	 *  - Indicator if this is the current player's biker
	 * 
	 * @private
	 */
	private setupTooltip(): void {
		this.game.bga.gameui.addTooltipHtml(
			`postcards_${this.id}`,
			`<tooltip>
				<h3>${this.game.bga.gameui.format_string(_("${color} Biker"), {
					color: this.getColor(),
				})}</h3>
				${
					this.args.own
						? `<p><span style="color: #FF39A5">⬤</span> ${_("This is your Biker")}</p>`
						: ''
				}
			</tooltip>`
		);
	}

	/**
	 * Get localized player color name from hex code
	 * 
	 * Maps color hex codes to localized color names.
	 * 
	 * @returns Localized color name
	 * @private
	 */
	private getColor(): string {
		switch (this.args.color) {
			case "174D62":
				return _("Blue");
			case "A4C877":
				return _("Green");
			case "EE7628":
				return _("Orange");
			case "FCC922":
				return _("Yellow");
		}
		return '';
	}
}