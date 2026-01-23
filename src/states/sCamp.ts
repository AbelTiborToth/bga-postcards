import { Board } from "../board/board";
import { Game } from "../game";

/**
 * Handles the "Camp" game state
 * 
 * This state is triggered when a player activates a Camp action through a Travel card
 * or when receiving a camp bonus from a souvenir placement.
 * 
 * Responsibilities:
 *  - Activating available campsites in the player's current region
 *  - Setting the dynamic status bar title
 *  - Adding skip button if this is a bonus camp action
 *  - Cleaning up campsite UI on exit
 *  - Managing undo buttons
 */
export class sCamp {
	// ========== Properties ==========

	/** Reference to the main Game instance */
	private readonly game: Game;

	/** Reference to BGA framework instance */
	private readonly bga: Bga;

	// ========== Constructor ==========

	/**
	 * Initialize the Camp state handler
	 * @param game - Main game instance
	 * @param bga - BGA framework instance
	 */
	public constructor(game: Game, bga: Bga) {
		this.game = game;
		this.bga = bga;
	}

	// ========== State Lifecycle Methods ==========

	/**
	 * Called when entering the Camp state
	 * 
	 * Actions:
	 *  - Sets the status bar title based on context
	 *  - Activates available campsites in the player's region
	 *  - Adds Skip button if this is a bonus camp action
	 *  - Adds undo/reset buttons if available
	 * 
	 * @param args - State arguments containing region, available campsites, and undo level
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onEnteringState(args: any, isCurrentPlayerActive: boolean): void {
		this.setTitle(args, isCurrentPlayerActive);
		if (!isCurrentPlayerActive) return;

		const board: Board = this.game.c.board?.[0] as Board;

		// Activate campsites available in the current region
		board.activateCampsites(args.region, args.campsites);

		// Add Skip button if this is a bonus camp action (gift-related)
		if (args.gift_bonus) {
			this.bga.statusBar.addActionButton(
				_("Skip"),
				() => this.bga.actions.performAction("actSkip")
			);
		}

		// Add undo buttons
		this.game.addUndoButtons(args.undo);
	}

	/**
	 * Called when leaving the Camp state
	 * 
	 * Cleans up:
	 *  - Deactivates all campsites on the board
	 * 
	 * @param args - State arguments (unused)
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onLeavingState(args: any, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		const board: Board = this.game.c.board?.[0] as Board;

		board.inactivateAllCampsites();
	}

	// ========== Private Helper Methods ==========

	/**
	 * Sets the dynamic title shown in the status bar
	 * 
	 * Only displays a title if this is a bonus camp action from a gift.
	 * Otherwise uses the default state description from the game state definition.
	 * 
	 * The title informs the player that they can place a Camp token on an available
	 * campsite in their current region as part of the gift bonus action.
	 * 
	 * @param args - State arguments containing gift_bonus flag
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 * @private
	 */
	private setTitle(args: any, isCurrentPlayerActive: boolean): void {
		if (!args.gift_bonus) return;

		const title = isCurrentPlayerActive
			? _("${you} can place a Camp on a campsite in your region")
			: _("${actplayer} can place a Camp on a campsite in their region");

		this.bga.statusBar.setTitle(title, args);
	}
}