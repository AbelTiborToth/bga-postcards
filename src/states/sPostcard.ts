import { Game } from "../game";
import { PostcardSupply } from "../postcard_supply/postcard_supply";

/**
 * Arguments passed to the Postcard state
 */
interface PostcardStateArgs {
	/** Whether the discard postcards button should be shown */
	discard: boolean;
	
	/** Number of undo steps available */
	undo: number;
}

/**
 * Handles the "Postcard" game state
 * 
 * This state occurs when a player activates a Postcard action through a Travel card.
 * The player must take a postcard from the supply or optionally discard postcards.
 * 
 * Responsibilities:
 *  - Activating postcards in the supply for selection
 *  - Displaying a warning that this action cannot be undone
 *  - Adding optional discard postcards button
 *  - Setting the dynamic status bar title
 *  - Adding undo buttons if available
 *  - Cleaning up postcard UI on exit
 */
export class sPostcard {
	// ========== Properties ==========

	/** Reference to the main Game instance */
	private readonly game: Game;

	/** Reference to BGA framework instance */
	private readonly bga: Bga;

	// ========== Constructor ==========

	/**
	 * Initialize the Postcard state handler
	 * @param game - Main game instance
	 * @param bga - BGA framework instance
	 */
	public constructor(game: Game, bga: Bga) {
		this.game = game;
		this.bga = bga;
	}

	// ========== State Lifecycle Methods ==========

	/**
	 * Called when entering the Postcard state
	 * 
	 * Actions:
	 *  - Sets the status bar title based on available actions
	 *  - Activates all postcards in the supply for selection
	 *  - Displays a warning that this action cannot be undone
	 *  - Adds optional "Discard Postcards from supply" button
	 *  - Adds undo/reset buttons if available
	 * 
	 * @param args - State arguments containing action availability and undo level
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onEnteringState(args: PostcardStateArgs, isCurrentPlayerActive: boolean): void {
		this.setTitle(args, isCurrentPlayerActive);

		if (!isCurrentPlayerActive) return;

		const supply: PostcardSupply = this.game.c.postcard_supply?.[0] as PostcardSupply;

		// Activate all postcards for selection
		supply.activatePostcards();

		// Show warning that this action cannot be undone
		this.game.undo_bar = this.game.createBar(
			"warning",
			_("You won't be able to undo this action!")
		);

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
	 * Called when leaving the Postcard state
	 * 
	 * Cleans up:
	 *  - Deactivates all postcards in the supply
	 *  - Removes the undo warning bar
	 * 
	 * @param args - State arguments (unused)
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onLeavingState(args: PostcardStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		const supply: PostcardSupply = this.game.c.postcard_supply?.[0] as PostcardSupply;

		// Deactivate all postcards
		supply.activatePostcards(false);

		// Remove the undo warning bar
		if (this.game.undo_bar) {
			this.game.undo_bar.remove();
			delete this.game.undo_bar;
		}
	}

	// ========== Private Helper Methods ==========

	/**
	 * Sets the dynamic title shown in the status bar
	 * 
	 * Only displays a custom title if the discard option is available.
	 * Otherwise uses the default state description from the game state definition.
	 * 
	 * The title informs the player that they can either take a postcard from the supply
	 * or discard postcards if that option is available.
	 * 
	 * @param args - State arguments containing discard availability
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 * @private
	 */
	private setTitle(args: PostcardStateArgs, isCurrentPlayerActive: boolean): void {
		if (!args.discard) return;

		const title = isCurrentPlayerActive
			? _("${you} must take a Postcard from the supply or discard them")
			: _("${actplayer} must take a Postcard from the supply or discard them");

		this.bga.statusBar.setTitle(title, args);
	}
}