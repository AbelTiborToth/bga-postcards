import { GameElement } from "../../gameElement";
import { Board } from "../board";

/**
 * Represents a single region on the game board
 * 
 * Regions are locations where players move their bikers and place camps.
 * Each region can be activated for selection during movement or camp placement.
 * 
 * Responsibilities:
 *  - Displaying region on the board
 *  - Managing biker presence indicator
 *  - Handling click interactions for region selection
 *  - Tracking region activation state
 */
export class Region extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize a region on the board
	 * @param parent - Parent Board instance
	 * @param child_id - Element ID
	 * @param type - Region type/number (1-13)
	 */
	public constructor(parent: Board, child_id: number, type: number) {
		super(parent, child_id, "region", { type, active: false });

		// Register click handler
		this.html.addEventListener('click', () => this.onClick());
	}

	// ========== Public Methods ==========

	/**
	 * Mark this region as containing the biker
	 */
	public setBiker(): void {
		this.setArg("active", "biker");
	}

	/**
	 * Activate or deactivate this region for selection
	 * @param b - True to activate (default), false to deactivate
	 */
	public activate(b: boolean = true): void {
		this.setArg("active", b);
	}

	// ========== Private Helper Methods ==========

	/**
	 * Handle region click - moves biker to region when clicked
	 * 
	 * During Move phase:
	 *  - Click: Move biker to this region
	 * 
	 * @private
	 */
	private async onClick(): Promise<void> {
		if (this.args.active === true) {
			switch (this.game.bga.gameui.gamedatas.gamestate.name) {
				case 'Move':
					this.game.bga.actions.performAction('actMove', { region: this.args.type });
					break;
			}
		}
	}
}