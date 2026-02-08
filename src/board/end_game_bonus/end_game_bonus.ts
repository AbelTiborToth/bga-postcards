import { GameElement } from "../../gameElement";
import { Board } from "../board";
import { PlayerArea } from "../../player_area/player_area";

/**
 * Represents the end game bonus token
 *
 * The end game bonus token is earned by the first player to send 4 postcards.
 * It grants 3 additional points at the end of the game and marks when the
 * final round of the game begins.
 *
 * Responsibilities:
 *  - Displaying the end game bonus token
 *  - Tracking which player has earned the bonus
 *  - Providing tooltip with bonus information
 */
export class EndGameBonus extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize the end game bonus token
	 * @param parent - Parent container (Board or PlayerArea)
	 * @param child_id - Element ID
	 */
	public constructor(parent: Board | PlayerArea, child_id: number) {
		super(parent, child_id, "end_game_bonus");

		// Setup tooltip
		this.setupTooltip();
	}

	// ========== Private Helper Methods ==========

	/**
	 * Setup tooltip with end game bonus information
	 *
	 * Displays:
	 *  - How to earn the end game bonus (first to send 4 postcards)
	 *  - Game flow when bonus is earned
	 *  - End-game scoring value (3 points)
	 *
	 * @private
	 */
	private setupTooltip(): void {
		this.game.bga.gameui.addTooltipHtml(
			`postcards_${this.id}`,
			`<tooltip>
				<h3>${_("End Game Bonus Token")}</h3>
				<p>${_("The player who first sends 4 postcards immediately receives the End Game Bonus token and the game continues until the last player has played their turn. When that round is complete, proceed to final scoring.")}</p>
				<p>${_("<b>At the end of the game:</b> the player who received the End Game Bonus token scores 3 additional points.")}</p>
			</tooltip>`
		);
	}
}