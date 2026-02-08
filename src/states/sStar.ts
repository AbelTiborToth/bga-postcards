import { Game } from "../game";

/**
 * Arguments passed to the Star state
 */
interface StarStateArgs {
	/** Number of undo steps available */
	undo: number;
}

/**
 * Handles the "Star" game state
 * 
 * This state occurs when a player activates a star effect from completing a postcard.
 * The player must choose one of three available star effects to activate.
 * 
 * Responsibilities:
 *  - Adding three selectable star effect buttons (Movement, Postcard, Stamp)
 *  - Adding undo buttons if available
 */
export class sStar {
	// ========== Properties ==========

	/** Reference to the main Game instance */
	private readonly game: Game;

	/** Reference to BGA framework instance */
	private readonly bga: Bga;

	// ========== Constructor ==========

	/**
	 * Initialize the Star state handler
	 * @param game - Main game instance
	 * @param bga - BGA framework instance
	 */
	public constructor(game: Game, bga: Bga) {
		this.game = game;
		this.bga = bga;
	}

	// ========== State Lifecycle Methods ==========

	/**
	 * Called when entering the Star state
	 * 
	 * Actions:
	 *  - Adds three action buttons for star effect selection:
	 *    - Movement: Allows player to move their biker
	 *    - Postcard: Allows player to take a postcard
	 *    - Stamp: Allows player to place a stamp
	 *  - Adds undo/reset buttons if available
	 * 
	 * @param args - State arguments containing undo level
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onEnteringState(args: StarStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		// Add three star effect options
		this.bga.statusBar.addActionButton(
			_("Movement"),
			() => this.bga.actions.performAction("actStar", { effect: 1 })
		);

		this.bga.statusBar.addActionButton(
			_("Postcard"),
			() => this.bga.actions.performAction("actStar", { effect: 2 })
		);

		this.bga.statusBar.addActionButton(
			_("Stamp"),
			() => this.bga.actions.performAction("actStar", { effect: 3 })
		);

		this.game.addUndoButtons(args.undo);
	}
}