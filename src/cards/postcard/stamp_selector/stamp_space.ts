import { GameElement } from "../../../gameElement";
import { Postcard } from "../postcard";

/**
 * Represents a single stamp placement space on a postcard
 *
 * Each postcard has multiple stamp spaces where players can place stamp tokens.
 * Stamps are required to send postcards and have colors matching travel cards.
 *
 * Responsibilities:
 *  - Displaying stamp placement space on postcard
 *  - Handling click interactions for stamp placement
 *  - Tracking space location for stamp placement
 *  - Managing activation state for player selection
 */
export class StampSpace extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize a stamp space on a postcard
	 * @param parent - Parent Postcard instance
	 * @param child_id - Element ID
	 * @param space - Space location number on the postcard
	 */
	public constructor(parent: Postcard, child_id: number, space: number) {
		super(parent, child_id, "stamp_space", { space });

		// Register click handler
		$(`postcards_${this.id}`).addEventListener('click', () => this.onClick());
	}

	// ========== Public Methods ==========

	/**
	 * Activate this stamp space for stamp placement
	 */
	public activate(): void {
		this.setArg("active", true);
	}

	/**
	 * Deactivate this stamp space
	 */
	public inactivate(): void {
		this.setArg("active", false);
	}

	// ========== Private Helper Methods ==========

	/**
	 * Handle stamp space click - places stamp when clicked
	 *
	 * During Stamp phase:
	 *  - Click: Place stamp on this space
	 *
	 * @private
	 */
	private async onClick(): Promise<void> {
		if (this.game.bga.players.isCurrentPlayerActive() && this.args.active === true) {
			switch (this.game.bga.gameui.gamedatas.gamestate.name) {
				case 'Stamp':
					this.game.bga.actions.performAction('actStamp', {
						postcard: (this.parent as Postcard).child_id,
						space: this.args.space,
					});
					break;
			}
		}
	}
}