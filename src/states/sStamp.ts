import { Game } from "../game";
import { PlayerArea } from "../player_area/player_area";

/**
 * Arguments passed to the Stamp state
 */
interface StampStateArgs {
	/** Object mapping postcard IDs to arrays of available stamp space indices */
	spaces: { number: number[] };
	
	/** Number of undo steps available */
	undo: number;
}

/**
 * Handles the "Stamp" game state
 * 
 * This state occurs when a player places a postcard and needs to place stamps on it.
 * Players must place stamps on available spaces to complete the postcard action.
 * 
 * Responsibilities:
 *  - Activating available stamp placement spaces
 *  - Adding undo buttons if available
 *  - Cleaning up stamp UI on exit
 *  - Deactivating all stamp spaces
 */
export class sStamp {
	// ========== Properties ==========

	/** Reference to the main Game instance */
	private readonly game: Game;

	/** Reference to BGA framework instance */
	private readonly bga: Bga;

	// ========== Constructor ==========

	/**
	 * Initialize the Stamp state handler
	 * @param game - Main game instance
	 * @param bga - BGA framework instance
	 */
	public constructor(game: Game, bga: Bga) {
		this.game = game;
		this.bga = bga;
	}

	// ========== State Lifecycle Methods ==========

	/**
	 * Called when entering the Stamp state
	 * 
	 * Actions:
	 *  - Activates available stamp placement spaces on postcards
	 *  - Adds undo/reset buttons if available
	 * 
	 * @param args - State arguments containing available stamp spaces and undo level
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onEnteringState(args: StampStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		const area: PlayerArea = this.game.c.player_area?.[this.bga.gameui.player_id] as PlayerArea;

		// Activate stamp spaces available for placement
		area.activateStampSpaces(args.spaces);

		// Add undo buttons for the current action
		this.game.addUndoButtons(args.undo);
	}

	/**
	 * Called when leaving the Stamp state
	 * 
	 * Cleans up:
	 *  - Deactivates all stamp spaces on the postcards
	 * 
	 * @param args - State arguments (unused)
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onLeavingState(args: StampStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		const area: PlayerArea = this.game.c.player_area?.[this.bga.gameui.player_id] as PlayerArea;

		// Deactivate all stamp spaces
		area.inactivateAllStampSpaces();
	}
}