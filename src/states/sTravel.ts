import { Game } from "../game";
import { Board } from "../board/board";

/**
 * Arguments passed to the Travel state
 */
interface TravelStateArgs {
	/** Number of undo steps available */
	undo: number;
}

/**
 * Handles the "Travel" game state
 * 
 * This state occurs when a player needs to select a Travel card to play.
 * Players can choose from the travel deck or any travel cards currently in the supply.
 * 
 * Responsibilities:
 *  - Activating the travel deck for card selection
 *  - Activating all travel cards in the supply for selection
 *  - Adding undo buttons if available
 *  - Cleaning up travel UI on exit
 *  - Deactivating travel deck and cards
 */
export class sTravel {
	// ========== Properties ==========

	/** Reference to the main Game instance */
	private readonly game: Game;

	/** Reference to BGA framework instance */
	private readonly bga: Bga;

	// ========== Constructor ==========

	/**
	 * Initialize the Travel state handler
	 * @param game - Main game instance
	 * @param bga - BGA framework instance
	 */
	public constructor(game: Game, bga: Bga) {
		this.game = game;
		this.bga = bga;
	}

	// ========== State Lifecycle Methods ==========

	/**
	 * Called when entering the Travel state
	 * 
	 * Actions:
	 *  - Activates the travel deck for card selection
	 *  - Activates all travel cards in the supply for selection
	 *  - Adds undo/reset buttons if available
	 * 
	 * @param args - State arguments containing undo level
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onEnteringState(args: TravelStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		const board: Board = this.game.c.board?.[0] as Board;

		// Activate travel deck and all travel cards
		board.activateTravelDeck();
		board.activateAllTravels();

		this.game.addUndoButtons(args.undo);
	}

	/**
	 * Called when leaving the Travel state
	 * 
	 * Cleans up:
	 *  - Deactivates the travel deck
	 *  - Deactivates all travel cards
	 * 
	 * @param args - State arguments (unused)
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onLeavingState(args: TravelStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		const board: Board = this.game.c.board?.[0] as Board;

		// Deactivate travel deck and all travel cards
		board.activateTravelDeck(false);
		board.activateAllTravels(false);
	}
}