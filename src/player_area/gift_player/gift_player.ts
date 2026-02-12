import { GameElement } from "../../gameElement";
import { PlayerArea } from "../player_area";
import { Gift } from "../../cards/gift/gift";

/**
 * Manages a player's gift card collection
 * 
 * Stores and displays the gift cards a player has received during the game.
 * Handles gift card animations and activation/deactivation for interaction.
 * 
 * Responsibilities:
 *  - Storing and displaying player's gift card collection
 *  - Animating gift card addition to collection
 *  - Managing gift card activation/deactivation for selection
 *  - Handling undo operations for gift cards
 */
export class GiftPlayer extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize the gift player area with initial gift cards
	 * @param parent - Parent PlayerArea instance
	 * @param child_id - Element ID
	 * @param data - Array of gift card IDs
	 */
	public constructor(parent: PlayerArea, child_id: number, data: any) {
		super(parent, child_id, "gift_player");

		// Create initial gift cards
		for (const d in data) {
			new Gift(this, data[d]);
		}
	}

	// ========== Public Methods ==========

	/**
	 * Animate adding a gift card to the player's collection
	 * 
	 * Actions:
	 *  - Adds gift as child of this player area
	 *  - Animates gift sliding and attaching with slight rotation
	 * 
	 * @param gift - Gift card to add
	 * @returns Promise resolving when animation completes
	 */
	public addGift(gift: Gift): Promise<void> {
		gift.addToParent(this);
		return this.game.animationManager.slideAndAttach(gift.html, this.html, {
			duration: 800,
			//fromPlaceholder: "off",
			parallelAnimations: [
				{
					keyframes: [{ rotate: '-5deg' }, { rotate: '0deg' }],
				},
			],
		});
	}

	/**
	 * Restore a gift card that was previously used (undo operation)
	 * 
	 * Creates a new gift card with the given ID.
	 * 
	 * @param gift - Gift card ID to restore
	 */
	public addGiftFromUndo(gift: number): void {
		new Gift(this, gift);
	}

	/**
	 * Activate or deactivate all gift cards in the collection for interaction
	 * @param b - True to activate (default), false to deactivate
	 */
	public activateGifts(b: boolean = true): void {
		for (const i in this.c.gift) {
			(this.c.gift[i] as Gift).activate(b);
		}
	}
}