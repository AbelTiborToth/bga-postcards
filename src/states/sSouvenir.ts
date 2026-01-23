import { Game } from "../game";
import { PlayerArea } from "../player_area/player_area";

/**
 * Arguments passed to the Souvenir state
 */
interface SouvenirStateArgs {
	/** Object mapping postcard IDs to arrays of available souvenir space indices */
	spaces: { number: number[] };
	
	/** Number of undo steps available */
	undo: number;
}

/**
 * Handles the "Souvenir" game state
 * 
 * This state occurs when a player places a postcard and needs to place souvenirs on it.
 * Players can choose to place souvenirs on available spaces or skip if they prefer.
 * 
 * Responsibilities:
 *  - Activating available souvenir placement spaces
 *  - Adding the Skip button for optional souvenir placement
 *  - Adding undo buttons if available
 *  - Cleaning up souvenir UI on exit
 *  - Deactivating all souvenir spaces
 */
export class sSouvenir {
	// ========== Properties ==========

	/** Reference to the main Game instance */
	private readonly game: Game;

	/** Reference to BGA framework instance */
	private readonly bga: Bga;

	// ========== Constructor ==========

	/**
	 * Initialize the Souvenir state handler
	 * @param game - Main game instance
	 * @param bga - BGA framework instance
	 */
	public constructor(game: Game, bga: Bga) {
		this.game = game;
		this.bga = bga;
	}

	// ========== State Lifecycle Methods ==========

	/**
	 * Called when entering the Souvenir state
	 * 
	 * Actions:
	 *  - Activates available souvenir placement spaces on postcards
	 *  - Adds Skip button to allow players to skip souvenir placement
	 *  - Adds undo/reset buttons if available
	 * 
	 * @param args - State arguments containing available souvenir spaces and undo level
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onEnteringState(args: SouvenirStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		const area: PlayerArea = this.game.c.player_area?.[this.bga.gameui.player_id] as PlayerArea;
		if (!area) {
			console.warn(`Player area not found for player ${this.bga.gameui.player_id}`);
			return;
		}

		// Activate souvenir spaces available for placement
		area.activateSouvenirSpaces(args.spaces);

		// Add Skip button (placement is optional)
		this.bga.statusBar.addActionButton(
			_("Skip"),
			() => this.bga.actions.performAction("actSkip")
		);

		this.game.addUndoButtons(args.undo);
	}

	/**
	 * Called when leaving the Souvenir state
	 * 
	 * Cleans up:
	 *  - Deactivates all souvenir spaces on the postcards
	 * 
	 * @param args - State arguments (unused)
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onLeavingState(args: SouvenirStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		const area: PlayerArea = this.game.c.player_area?.[this.bga.gameui.player_id] as PlayerArea;
		if (!area) return;

		// Deactivate all souvenir spaces
		area.inactivateAllSouvenirSpaces();
	}
}