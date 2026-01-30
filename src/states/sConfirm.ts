import { Game } from "../game";

/**
 * Handles the "Confirm" game state
 * 
 * Responsibilities:
 *  - Displaying confirmation UI to the player
 *  - Adding the Confirm action button
 *  - Managing undo buttons
 * 
 * The Confirm state is typically used after a player completes an action sequence
 * and needs to confirm before the action is committed to the server.
 */
export class sConfirm {
	// ========== Properties ==========

	/** Reference to the main Game instance */
	private readonly game: Game;

	/** Reference to BGA framework instance */
	private readonly bga: Bga;

	// ========== Constructor ==========

	/**
	 * Initialize the Confirm state handler
	 * @param game - Main game instance
	 * @param bga - BGA framework instance
	 */
	public constructor(game: Game, bga: Bga) {
		this.game = game;
		this.bga = bga;
	}

	// ========== State Lifecycle Methods ==========

	/**
	 * Called when entering the Confirm state
	 * 
	 * Actions:
	 *  - Adds a Confirm button to the status bar
	 *  - Respects user preference for auto-clicking confirmation
	 *  - Adds undo buttons if available
	 * 
	 * @param args - State arguments containing undo level
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onEnteringState(args: any, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) {
			return;
		}

		// Check user preference for auto-confirming actions
		const autoClickPreference = this.bga.userPreferences.get(100) === 1;

		// Add confirm button with optional auto-click
		if (autoClickPreference) {
			const abortController = new AbortController();
			this.bga.statusBar.addActionButton(
				_("Confirm"),
				() => this.bga.actions.performAction("actConfirm"),
				{ autoclick: {abortSignal: abortController.signal} }
			);
			const abortButton = this.bga.statusBar.addActionButton(
				_("Let me think!"),
				() => {
					abortButton.remove();
					abortController.abort();
				},
				{ color: 'secondary' }
			);
		} else {
			this.bga.statusBar.addActionButton(
				_("Confirm"),
				() => this.bga.actions.performAction("actConfirm")
			);
		}

		// Add undo/reset buttons if available
		this.game.addUndoButtons(args.undo);
	}
}