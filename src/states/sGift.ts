import { Board } from "../board/board";
import { Game } from "../game";

/**
 * Arguments passed to the Gift state
 */
interface GiftStateArgs {
	/** Number of undo steps available */
	undo: number;
}

/**
 * Handles the "Gift" game state
 * 
 * This state occurs after a player sends a postcard and must choose a gift card.
 * 
 * Responsibilities:
 *  - Activating all available gift cards on the board
 *  - Displaying a warning that this action cannot be undone
 *  - Adding undo buttons if available
 *  - Cleaning up gift UI when exiting the state
 *  - Deactivating all gift cards
 */
export class sGift {
	// ========== Properties ==========

	/** Reference to the main Game instance */
	private readonly game: Game;

	/** Reference to BGA framework instance */
	private readonly bga: Bga;

	// ========== Constructor ==========

	/**
	 * Initialize the Gift state handler
	 * @param game - Main game instance
	 * @param bga - BGA framework instance
	 */
	public constructor(game: Game, bga: Bga) {
		this.game = game;
		this.bga = bga;
	}

	// ========== State Lifecycle Methods ==========

	/**
	 * Called when entering the Gift state
	 * 
	 * Actions:
	 *  - Activates all gift cards on the board for selection
	 *  - Displays a warning bar that this action cannot be undone
	 *  - Adds undo/reset buttons if available
	 * 
	 * @param args - State arguments containing undo level
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onEnteringState(args: GiftStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		const board: Board = this.game.c.board?.[0] as Board;

		// Activate all gift cards for selection
		board.activateAllGifts();

		// Show warning that this action cannot be undone
		this.game.undo_bar = this.game.createBar(
			"warning",
			_("You won't be able to undo this action!")
		);

		this.game.addUndoButtons(args.undo);
	}

	/**
	 * Called when leaving the Gift state
	 * 
	 * Cleans up:
	 *  - Removes the undo warning bar
	 *  - Deactivates all gift cards
	 * 
	 * @param args - State arguments (unused)
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onLeavingState(args: GiftStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		const board: Board = this.game.c.board?.[0] as Board;

		// Remove the undo warning bar
		if (this.game.undo_bar) {
			this.game.undo_bar.remove();
			delete this.game.undo_bar;
		}

		// Deactivate all gift cards
		board.activateAllGifts(false);
	}
}