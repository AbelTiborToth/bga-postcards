import { GameElement } from "../../gameElement";
import { PlayerArea } from "../player_area";
import { Camp } from "../../camp/camp";

/**
 * Manages a player's personal board display
 * 
 * Displays the player's camp token placement board and manages their available camps.
 * Handles camp placement animations and rotations based on position.
 * 
 * Responsibilities:
 *  - Creating and displaying camp tokens
 *  - Managing camp placement on the board
 *  - Animating camp placement with appropriate rotations
 *  - Displaying player name and board information
 *  - Providing tooltips explaining board mechanics
 */
export class PlayerBoard extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize the player board with camps and player information
	 * @param parent - Parent PlayerArea instance
	 * @param child_id - Element ID
	 * @param color - Player color for camp styling
	 * @param name - Player name to display
	 * @param side - Whether using side A (true) or side B (false) of the board
	 * @param camps - Array of already placed camps
	 */
	public constructor(
		parent: PlayerArea,
		child_id: number,
		color: string,
		name: string,
		side: boolean,
		camps: any
	) {
		super(parent, child_id, "player_board", { color, side });

		// Create available camps (starting from camps.length + 1 up to 13)
		for (let i = camps.length + 1; i <= 13; i++) {
			new Camp(this, i, color, i);
		}

		// Setup tooltips for the board
		this.setupTooltip();

		// Add player name label
		this.html.innerHTML += `<name_label>${name}<name_label>`;
	}

	// ========== Public Methods ==========

	/**
	 * Animate adding a camp to the player board
	 * 
	 * Actions:
	 *  - Sets camp location on the board
	 *  - Calculates appropriate rotation based on position
	 *  - Adds camp as child of this board at specified location
	 *  - Animates camp sliding and attaching with rotation
	 * 
	 * Rotation angles by position:
	 *  - Positions 1, 2: 90 degrees
	 *  - Position 3: 45 degrees
	 *  - Position 10: -45 degrees
	 *  - Positions 11, 12, 13: -90 degrees
	 *  - Other positions: 0 degrees
	 * 
	 * @param camp - Camp token to place
	 * @param location - Board location (1-13) where camp should be placed
	 * @returns Promise resolving when animation completes
	 */
	public async addCamp(camp: Camp, location: number): Promise<void> {
		camp.setArg("location", location);

		// Determine rotation based on location
		let rotate: number = 0;
		switch (camp.args.location) {
			case 1:
			case 2:
				rotate = 90;
				break;
			case 3:
				rotate = 45;
				break;
			case 10:
				rotate = -45;
				break;
			case 11:
			case 12:
			case 13:
				rotate = -90;
				break;
		}

		// Add camp to board and animate
		camp.addToParent(this, location);
		return this.game.animationManager.slideAndAttach(camp.html, this.html, {
			duration: 800,
			parallelAnimations: [
				{
					keyframes: [{ transform: 'rotate(0deg)' }, { transform: `rotate(${rotate}deg)` }],
				},
			],
		});
	}

	// ========== Private Helper Methods ==========

	/**
	 * Setup tooltips for the player board
	 * 
	 * Displays information about:
	 *  - When camps grant immediate effects (5th, 7th, 9th)
	 *  - When camps grant immediate scoring (11th, 12th, 13th)
	 *  - Side B special rules (if applicable)
	 * 
	 * @private
	 */
	private setupTooltip(): void {
		this.game.bga.gameui.addTooltipHtml(
			`postcards_${this.id}`,
			`<tooltip>
				<h3>${_("Player Board")}</h3>
				<p>${_("The 5th, 7th and 9th Camp tokens on your player board will grant you an immediate effect when you place them.")}</p>
				<p>${_("The 11th, 12th and 13th Camp tokens on your player board will immediately score points when you place them.")}</p>
				${
					(this.args.side as boolean)
						? ""
						: `<h4>${_("Side B")}</h4>
					<p>${_("When using side B of the player board, each time you benefit from a Star effect, you can choose between: a Movement effect, a Postcard effect, or placing 1 Stamp.")}</p>`
				}
			</tooltip>`
		);
	}
}