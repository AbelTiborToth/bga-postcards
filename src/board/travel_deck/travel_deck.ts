import { GameElement } from "../../gameElement";
import { Board } from "../board";

/**
 * Represents the travel card deck on the board
 *
 * Players can draw from the travel deck as an alternative to selecting
 * from the travel supply. Drawing from the deck provides a random card.
 *
 * Responsibilities:
 *  - Displaying the travel deck on the board
 *  - Handling click interactions for deck drawing
 *  - Tracking activation state for player interaction
 */
export class TravelDeck extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize the travel deck
	 * @param parent - Parent Board instance
	 * @param child_id - Element ID
	 */
	public constructor(parent: Board, child_id: number) {
		super(parent, child_id, "travel_deck");

		// Register click handler
		$(`postcards_${this.id}`).addEventListener('click', () => this.onClick());
	}

	// ========== Public Methods ==========

	/**
	 * Activate or deactivate the travel deck for interaction
	 * @param b - True to activate (default), false to deactivate
	 */
	public activate(b: boolean = true): void {
		this.setArg("active", b);
	}

	// ========== Private Helper Methods ==========

	/**
	 * Handle travel deck click - draws card from deck when clicked
	 *
	 * During Travel phase:
	 *  - Click: Draw card from travel deck
	 *
	 * @private
	 */
	private async onClick(): Promise<void> {
		if (this.game.bga.players.isCurrentPlayerActive() && this.args.active === true) {
			switch (this.game.bga.gameui.gamedatas.gamestate.name) {
				case 'Travel':
					this.game.bga.actions.performAction('actTravelDeck');
					break;
			}
		}
	}
}