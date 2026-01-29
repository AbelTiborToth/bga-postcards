import { GameElement } from "../../gameElement";
import { PlayerArea } from "../player_area";
import { DoubleActions } from "./double_actions/double_actions";
import { Travel } from "../../cards/travel/travel";

/**
 * Manages the current player's hand of Travel cards
 * 
 * The hand contains Travel cards that can be played during the Action phase.
 * Handles activation, discard, and selection of travel cards.
 * 
 * Responsibilities:
 *  - Storing and displaying player's Travel cards
 *  - Managing card activation/deactivation for selection
 *  - Tracking selected cards (selected_1 and selected_2 for double actions)
 *  - Handling card discard animations
 *  - Managing used/unused card states
 *  - Managing double action selection
 */
export class Hand extends GameElement {
	// ========== Properties ==========

	/** First selected travel card */
	public selected_1!: Travel | undefined;

	/** Second selected travel card (for double actions) */
	public selected_2!: Travel | undefined;

	// ========== Constructor ==========

	/**
	 * Initialize the hand with initial Travel cards
	 * @param parent - Parent PlayerArea instance
	 * @param child_id - Element ID
	 * @param data - Array of travel card data objects
	 */
	public constructor(parent: PlayerArea, child_id: number, data: any) {
		super(parent, child_id, "hand", { double: false });

		// Create travel cards from initial data
		for (const d in data) {
			new Travel(this, data[d].type);
		}

		// Create double actions interface
		new DoubleActions(this, 0);
	}

	// ========== Card Activation Methods ==========

	/**
	 * Activate Travel cards except those specified
	 * 
	 * Allows player to select from available cards, excluding those already played.
	 * 
	 * @param except - Array of travel card IDs to exclude from activation (default: empty)
	 */
	public activateTravelsExcept(except: any = []): void {
		for (const i in this.c.travel) {
			if (!except.includes(Number(i))) {
				(this.c.travel[i] as Travel).activate();
			}
		}
	}

	/**
	 * Deactivate all Travel cards
	 * 
	 * Disables all cards and clears selection state.
	 * Optionally preserves "used" cards from deactivation.
	 * 
	 * @param not_used - If true, only deactivate cards not marked as "used"
	 */
	public inactivateAllTravels(not_used: boolean = false): void {
		for (const i in this.c.travel) {
			if (!not_used || this.c.travel[i].args.active !== "used") {
				(this.c.travel[i] as Travel).activate(false);
			}
		}

		// Clear selected cards
		if (this.selected_1 !== undefined) {
			(this.selected_1 as Travel).removeButtons();
			this.selected_1 = undefined;
		}
		if (this.selected_2 !== undefined) {
			(this.selected_2 as Travel).removeButtons();
			this.selected_2 = undefined;
		}

		// Clear double action flag
		this.setArg("double", false);
	}

	// ========== Card State Methods ==========

	/**
	 * Mark Travel cards as "used" (played this turn)
	 * 
	 * Updates visual state to show cards that have been played.
	 * 
	 * @param data - Array of travel card IDs to mark as used
	 */
	public usedTravels(data: any): void {
		for (const i in data) {
			(this.c.travel[data[i]] as Travel).used();
		}
	}

	/**
	 * Mark all Travel cards as "unused"
	 * 
	 * Resets the used state of all cards.
	 */
	public unusedAllTravels(): void {
		for (const i in this.c.travel) {
			(this.c.travel[i] as Travel).used(false);
		}
	}

	// ========== Card Discard/Management Methods ==========

	/**
	 * Animate discarding Travel cards
	 * 
	 * Actions:
	 *  - Animates cards fading out and scaling to zero
	 *  - Removes cards from hand registry
	 *  - Animates to stamp supply destination
	 * 
	 * @param travels - Array of travel card IDs to discard
	 * @returns Promise resolving when discard animation completes
	 */
	public discardTravels(travels: number[]): Promise<void> {
		for (const i in travels) {
			const travel: Travel = this.c.travel[travels[i]] as Travel;
			this.game.animationManager.fadeOutAndDestroy(travel.html, this.game.c.board[0].c.stamp_supply[0].html, {
				duration: 800,
				parallelAnimations: [
					{
						keyframes: [{ scale: '1' }, { scale: '0' }],
					},
				],
			});
			delete this.c.travel[travels[i]];
		}
		return new Promise((resolve) => setTimeout(resolve, 800));
	}

	/**
	 * Restore discarded Travel cards (undo operation)
	 * 
	 * Recreates travel cards that were previously discarded.
	 * 
	 * @param travels - Array of travel card IDs to restore
	 * @returns Promise resolving when restoration completes
	 */
	public undoDiscardTravels(travels: number[]): Promise<void> {
		for (const i in travels) {
			new Travel(this, travels[i]);
		}
		return new Promise((resolve) => setTimeout(resolve, 800));
	}

	/**
	 * Animate adding a Travel card to the hand
	 * 
	 * Actions:
	 *  - Adds card as child of hand
	 *  - Animates card sliding and attaching with slight rotation
	 * 
	 * @param travel - Travel card to add
	 * @returns Promise resolving when animation completes
	 */
	public addTravel(travel: Travel): Promise<void> {
		travel.addToParent(this);
		return this.game.animationManager.slideAndAttach(travel.html, this.html, {
			duration: 800,
			fromPlaceholder: "off",
			parallelAnimations: [
				{
					keyframes: [{ transform: 'rotate(0.5deg)' }, { transform: 'rotate(0deg)' }],
				},
			],
		});
	}

	/**
	 * Animate adding a Travel card from the deck
	 * 
	 * Similar to addTravel but with a flip animation indicating card came from deck.
	 * 
	 * Actions:
	 *  - Adds card as child of hand
	 *  - Animates card flipping (rotateY) and attaching with rotation
	 * 
	 * @param travel - Travel card from deck to add
	 * @returns Promise resolving when animation completes
	 */
	public addTravelFromDeck(travel: Travel): Promise<void> {
		travel.addToParent(this);
		return this.game.animationManager.slideAndAttach(travel.html, this.html, {
			duration: 800,
			fromPlaceholder: "off",
			parallelAnimations: [
				{
					keyframes: [
						{ transform: 'rotateY(180deg) rotate(1deg)' },
						{ transform: 'rotateY(0deg) rotate(0deg)' },
					],
				},
			],
		});
	}
}