import { GameElement } from "../../gameElement";
import { PlayerArea } from "../player_area";
import { SouvenirSpace } from "../../cards/postcard/souvenir_selector/souvenir_space";
import { Postcard } from "../../cards/postcard/postcard";
import { StampSpace } from "../../cards/postcard/stamp_selector/stamp_space";

/**
 * Manages a player's postcard collection and placement spaces
 * 
 * Handles all postcards in a player's possession, including:
 * display, stamps, souvenirs, and activation/deactivation of placement spaces.
 * 
 * Responsibilities:
 *  - Storing and displaying player's postcard collection
 *  - Activating/deactivating souvenir placement spaces
 *  - Activating/deactivating stamp placement spaces
 *  - Managing postcard animations (adding, sending)
 *  - Managing undo operations for sent postcards
 */
export class PostcardPlayer extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize the postcard player area with initial postcards
	 * @param parent - Parent PlayerArea instance
	 * @param child_id - Element ID
	 * @param data - Array of postcard data objects
	 */
	public constructor(parent: PlayerArea, child_id: number, data: any) {
		super(parent, child_id, "postcard_player");

		// Create postcards from initial data
		for (const i in data) {
			new Postcard(this, data[i].type, true, data[i]);
		}
	}

	// ========== Souvenir Space Methods ==========

	/**
	 * Activate souvenir placement spaces on specific postcards
	 * 
	 * Enables souvenir spaces where players can place souvenirs on their postcards.
	 * 
	 * @param spaces - Object mapping postcard IDs to arrays of souvenir space indices
	 */
	public activateSouvenirSpaces(spaces: Record<number, number[]>): void {
		for (const p in spaces) {
			for (const s in spaces[p]) {
				(this.c.postcard[p].c.souvenir_space[spaces[p][s]] as SouvenirSpace).activate();
			}
		}
	}

	/**
	 * Deactivate all souvenir placement spaces across all postcards
	 */
	public inactivateAllSouvenirSpaces(): void {
		for (const p in this.c.postcard) {
			for (const s in this.c.postcard[p].c.souvenir_space) {
				const souvenir_space: SouvenirSpace = this.c.postcard[p].c.souvenir_space[s] as SouvenirSpace;
				souvenir_space.inactivate();
			}
		}
	}

	// ========== Stamp Space Methods ==========

	/**
	 * Activate stamp placement spaces on specific postcards
	 * 
	 * Enables stamp spaces where players can place stamps on their postcards.
	 * 
	 * @param spaces - Object mapping postcard IDs to arrays of stamp space indices
	 */
	public activateStampSpaces(spaces: Record<number, number[]>): void {
		for (const p in spaces) {
			for (const s in spaces[p]) {
				(this.c.postcard[p].c.stamp_space[spaces[p][s]] as StampSpace).activate();
			}
		}
	}

	/**
	 * Deactivate all stamp placement spaces across all postcards
	 */
	public inactivateAllStampSpaces(): void {
		for (const p in this.c.postcard) {
			for (const s in this.c.postcard[p].c.stamp_space) {
				const stamp_space: StampSpace = this.c.postcard[p].c.stamp_space[s] as StampSpace;
				stamp_space.inactivate();
			}
		}
	}

	// ========== Postcard Management Methods ==========

	/**
	 * Animate adding a postcard to the player's collection
	 * 
	 * Actions:
	 *  - Sets postcard to face-up
	 *  - Adds postcard as child of this player area
	 *  - Sets up postcard face display
	 *  - Animates postcard flip and positioning
	 * 
	 * @param postcard - Postcard to add
	 * @returns Promise resolving when animation completes
	 */
	public async addPostcard(postcard: Postcard): Promise<void> {
		postcard.setArg("face", true);
		postcard.addToParent(this);
		postcard.setupFace();

		return await this.game.animationManager.slideAndAttach(postcard.html, this.html, {
			duration: 800,
			parallelAnimations: [
				{
					keyframes: [
						{ transform: 'rotate(90deg) rotateX(180deg)' },
						{ transform: 'rotate(0deg) rotateX(0deg)' },
					],
				},
			],
		});
	}

	/**
	 * Activate or deactivate all postcards in the collection for interaction
	 * @param b - True to activate (default), false to deactivate
	 */
	public activatePostcards(b: boolean = true): void {
		for (const i in this.c.postcard) {
			(this.c.postcard[i] as Postcard).activate(b);
		}
    }

	/**
	 * Restore a postcard that was previously sent (undo operation)
	 * 
	 * Creates a new postcard with the given stamps and souvenirs that were
	 * on the postcard when it was sent.
	 * 
	 * @param postcard - Postcard ID to restore
	 * @param stamps - Stamps that were on the postcard
	 * @param souvenirs - Souvenirs that were on the postcard
	 */
	public undoSend(postcard: number, stamps: any, souvenirs: any): void {
		new Postcard(this, postcard, true, { stamps, souvenirs });
	}
}
