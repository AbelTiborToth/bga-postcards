import { GameElement } from "../gameElement";
import { Game } from "../game";
import { Postcard } from "../cards/postcard/postcard";

/**
 * Manages the postcard guide display and selection interface
 * 
 * The guide appears during the guide phase and allows players to select
 * exactly 2 postcards from a revealed set. Used in the early game round.
 * 
 * Responsibilities:
 *  - Displaying postcards available for selection
 *  - Managing postcard selection state (selected_1 and selected_2)
 *  - Activating/deactivating postcards for player interaction
 *  - Animating postcard reveal and slide-in effects
 */
export class PostcardGuide extends GameElement {
	// ========== Properties ==========

	/** First selected postcard */
	public selected_1!: Postcard | undefined;

	/** Second selected postcard */
	public selected_2!: Postcard | undefined;

	// ========== Constructor ==========

	/**
	 * Initialize the postcard guide with initial postcard data
	 * @param parent - Parent Game instance
	 * @param child_id - Element ID
	 * @param data - Initial array of postcard IDs to display (empty if none yet)
	 */
	public constructor(parent: Game, child_id: number, data: any = []) {
		super(parent, child_id, "postcard_guide");

		let supply = 1;

		// Add initial postcards if provided
		for (let i in data) {
			new Postcard(this, data[i], false, null, supply++);
		}
	}

	// ========== Public Methods ==========

	/**
	 * Activate or deactivate all postcards in the guide for selection
	 * @param b - True to activate (default), false to deactivate
	 */
	public activatePostcards(b: boolean = true): void {
		for (const i in this.c.postcard) {
			(this.c.postcard[i] as Postcard).activate(b);
		}
	}

	/**
	 * Animate sliding in postcards from the deck reveal
	 * 
	 * Creates new postcard elements and animates them sliding in from the deck.
	 * The top card is positioned last. Properly assigns supply positions for layout.
	 * 
	 * Actions:
	 *  - Creates new Postcard elements for each revealed card
	 *  - Animates each card sliding in with 1000ms duration
	 *  - Handles top card positioning separately
	 *  - Waits for animations to complete
	 * 
	 * @param postcards - Array of postcard IDs to slide in
	 * @param top - ID of the top card from deck
	 * @param d - Optional reference postcard to animate from
	 * @returns Promise resolving when all animations complete
	 */
	public async slideInPostcards(
		postcards: number[],
		top: number,
		d: Postcard | null
	): Promise<void> {
		let supply = 1;
		let supply_save: number | null = null;

		// Slide in all postcards except the top card
		for (const i in postcards) {
			if (postcards[i] !== top) {
				const e = new Postcard(this, postcards[i], false, null, supply++);
				this.game.animationManager.slideIn(e.html, d === null ? null : d.html, {
					duration: 800,
				});
			} else {
				supply_save = supply++;
			}
		}

		// Slide in the top card last
		const e = new Postcard(this, top, false, null, Number(supply_save));
		this.game.animationManager.slideIn(e.html, d === null ? null : d.html, {
			duration: 800,
		});

		await new Promise((resolve) => setTimeout(resolve, 800));
	}
}