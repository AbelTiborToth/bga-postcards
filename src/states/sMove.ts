import { Game } from "../game";
import { Board } from "../board/board";

/**
 * Arguments passed to the Move state
 */
interface MoveStateArgs {
	/** The current biker region to display */
	biker: number;
	
	/** Array of region IDs that can be moved to */
	regions: number[];
	
	/** Whether the discard postcards button should be shown */
	discard: boolean;
	
	/** Number of undo steps available */
	undo: number;
}

/**
 * Handles the "Move" game state
 * 
 * This state occurs when a player activates a Movement action through a Travel card.
 * The player's biker moves to a new region and they can place camps there.
 * 
 * Responsibilities:
 *  - Updating the biker position on the board
 *  - Activating selectable regions for movement
 *  - Adding optional discard postcards button
 *  - Adding undo buttons if available
 *  - Cleaning up region UI on exit
 */
export class sMove {
	// ========== Properties ==========

	/** Reference to the main Game instance */
	private readonly game: Game;

	/** Reference to BGA framework instance */
	private readonly bga: Bga;

	// ========== Constructor ==========

	/**
	 * Initialize the Move state handler
	 * @param game - Main game instance
	 * @param bga - BGA framework instance
	 */
	public constructor(game: Game, bga: Bga) {
		this.game = game;
		this.bga = bga;
	}

	// ========== State Lifecycle Methods ==========

	/**
	 * Called when entering the Move state
	 * 
	 * Actions:
	 *  - Updates the biker position to the current region
	 *  - Activates all selectable regions for movement
	 *  - Adds optional "Discard Postcards from supply" button
	 *  - Adds undo/reset buttons if available
	 * 
	 * @param args - State arguments containing biker region, selectable regions, and options
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onEnteringState(args: MoveStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		const board: Board = this.game.c.board?.[0] as Board;

		// Update biker position
		board.setBikerRegion(args.biker);

		// Activate selectable regions
		board.activateRegions(args.regions);

		// Add optional discard button
		if (args.discard) {
			this.bga.statusBar.addActionButton(
				_("Discard Postcards from supply"),
				() => this.bga.actions.performAction("actDiscardPostcards")
			);
		}

		this.game.addUndoButtons(args.undo);
	}

	/**
	 * Called when leaving the Move state
	 * 
	 * Cleans up:
	 *  - Deactivates all regions on the board
	 * 
	 * @param args - State arguments (unused)
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onLeavingState(args: MoveStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		const board: Board = this.game.c.board?.[0] as Board;

		board.inactivateAllRegions();
	}
}