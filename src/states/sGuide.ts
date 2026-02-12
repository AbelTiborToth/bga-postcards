import { Game } from "../game";
import { PostcardGuide } from "../postcard_guide/postcard_guide";

/**
 * Arguments passed to the Guide state
 */
interface GuideStateArgs {
	/** Number of undo steps available */
	undo: number;
}

/**
 * Handles the "Guide" game state
 * 
 * This state occurs during the guide phase where players select postcards from the deck.
 * Players must select exactly 2 postcards before they can confirm their selection.
 * 
 * Responsibilities:
 *  - Activating postcard selection UI in the guide display
 *  - Adding the "Take selected Postcards" button with initial disabled state
 *  - Managing button state based on selection count
 *  - Adding undo buttons if available
 *  - Cleaning up button reference on exit
 */
export class sGuide {
	// ========== Properties ==========

	/** Reference to the main Game instance */
	private readonly game: Game;

	/** Reference to BGA framework instance */
	private readonly bga: Bga;

	// ========== Constructor ==========

	/**
	 * Initialize the Guide state handler
	 * @param game - Main game instance
	 * @param bga - BGA framework instance
	 */
	public constructor(game: Game, bga: Bga) {
		this.game = game;
		this.bga = bga;
	}

	// ========== State Lifecycle Methods ==========

	/**
	 * Called when entering the Guide state
	 * 
	 * Actions:
	 *  - Activates all postcards in the guide for selection
	 *  - Adds the "Take selected Postcards" button to the status bar (initially disabled)
	 *  - The button becomes enabled once player selects 2 postcards
	 *  - Adds undo/reset buttons if available
	 * 
	 * @param args - State arguments containing undo level
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onEnteringState(args: GuideStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		const guide: PostcardGuide = this.game.c.postcard_guide?.[0] as PostcardGuide;

		// Activate all postcards for selection
		guide.activatePostcards();

		// Add the "Take selected Postcards" button with initial disabled state
		this.game.takeButton = this.bga.statusBar.addActionButton(
			_("Take selected Postcards"),
			() => {
				this.bga.actions.performAction("actGuide", {
					postcard_1: guide.selected_1?.child_id,
					postcard_2: guide.selected_2?.child_id
				});
			},
			{ classes: "disabled" }
		);

		// Add undo buttons
		this.game.addUndoButtons(args.undo);
	}

	/**
	 * Called when leaving the Guide state
	 * 
	 * Cleans up:
	 *  - Removes reference to the Take button
	 * 
	 * @param args - State arguments (unused)
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onLeavingState(args: GuideStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		delete this.game.takeButton;
	}
}