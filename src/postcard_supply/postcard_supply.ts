import { Game } from "../game";
import { GameElement } from "../gameElement";
import { Postcard } from "../cards/postcard/postcard";

/**
 * Manages the postcard supply display and interactions
 * 
 * Responsibilities:
 *  - Displaying postcards available for taking from the supply
 *  - Activating/deactivating postcards for player selection
 *  - Rearranging supply row when postcards are taken
 *  - Handling supply discard operations
 *  - Managing postcard counters (optional based on user preferences)
 *  - Managing top card of the postcard deck
 */
export class PostcardSupply extends GameElement {
	// ========== Properties ==========

	/** Counter for remaining postcards in supply (optional) */
	private postcards_counter?: Counter;

	/** Counter for discarded postcards (optional) */
	private postcards_discard_counter?: Counter;

	// ========== Constructor ==========

	/**
	 * Initialize the postcard supply with initial data
	 * @param parent - Parent Game instance
	 * @param child_id - Element ID
	 * @param data - Initial supply data containing deck card and row postcards
	 */
	public constructor(parent: Game, child_id: number, data: any) {
		super(parent, child_id, "postcard_supply", { count: 3 });

		let supply = 1;

		// Add deck card if present
		if (data.deck !== null) {
			new Postcard(this, data.deck, false, null, supply++);
		} else {
			supply++;
		}

		// Add supply row postcards
		for (let i in data.row) {
			new Postcard(this, data.row[i], false, null, supply++);
		}

		// Create optional counters if user preference is enabled
		if (this.game.bga.userPreferences.get(101) === 1) {
			const postcards_counter_html = document.createElement("postcards_counter");
			this.html.appendChild(postcards_counter_html);
			this.postcards_counter = new ebg.counter();
			this.postcards_counter.create(postcards_counter_html, {
				value: data.postcards_counter,
				tableCounter: 'postcards_counter'
			});

			const postcards_discard_counter_html = document.createElement("postcards_discard_counter");
			this.html.appendChild(postcards_discard_counter_html);
			this.postcards_discard_counter = new ebg.counter();
			this.postcards_discard_counter.create(postcards_discard_counter_html, {
				value: data.postcards_discard_counter,
				tableCounter: 'postcards_discard_counter'
			});
		}

		// Set initial count display
		if (data.postcards_counter === 2) {
			this.setArg("count", 2);
		} else if (data.postcards_counter === 1 || data.postcards_counter === 0) {
			this.setArg("count", 1);
		}
	}

	// ========== Public Methods ==========

	/**
	 * Animate adding a postcard to the supply
	 * 
	 * Actions:
	 *  - Sets postcard to face-down
	 *  - Adds postcard as child of supply
	 *  - Rearranges supply row to accommodate new card
	 *  - Animates postcard flip and positioning
	 * 
	 * @param postcard - Postcard to add
	 * @returns Promise resolving when animation completes
	 */
	public async addPostcard(postcard: Postcard): Promise<void> {
		postcard.setArg("face", false);
		postcard.addToParent(this);
		this.rearrangeSupplyRow();

		return await this.game.animationManager.slideAndAttach(postcard.html, this.html, {
			duration: 800,
			parallelAnimations: [
				{
					keyframes: [
						{ transform: 'rotate(-90deg) rotateX(0deg)' },
						{ transform: 'rotate(0deg) rotateX(180deg)' },
					],
				},
			],
		});
	}

	/**
	 * Activate or deactivate all postcards in the supply for selection
	 * @param b - True to activate (default), false to deactivate
	 */
	public activatePostcards(b: boolean = true): void {
		for (const i in this.c.postcard) {
			(this.c.postcard[i] as Postcard).activate(b);
		}
	}

	/**
	 * Rearrange supply row after a postcard is taken
	 * 
	 * Reorders postcards in the supply to fill gaps and maintain spacing.
	 * Optionally excludes a specific postcard from rearrangement.
	 * 
	 * @param except - Optional postcard to exclude from rearrangement
	 */
	public rearrangeSupplyRow(except: Postcard | null = null): void {
		this.activatePostcards(false);

		let keys: number[] = Object.keys(this.c.postcard)
			.map(Number)
			.sort((a: number, b: number): number => a - b);

		let supply = 2;

		for (const key of keys) {
			if (this.c.postcard[key] !== undefined) {
				const postcard: Postcard = this.c.postcard[key] as Postcard;
				if (
					postcard.args.supply !== 1 &&
					(except === null || except.args.type !== postcard.args.type)
				) {
					postcard.setArg("supply", supply++);
				}
			}
		}
	}

	/**
	 * Discard all non-top postcards from the supply
	 * 
	 * Removes all postcards except the one at supply position 1 (top card).
	 * Animates cards fading out and scaling to zero.
	 * 
	 * @returns Promise resolving when all discard animations complete
	 */
	public discardPostcardSupply(): Promise<void> {
		this.activatePostcards(false);

		for (const i in this.c.postcard) {
			const postcard: Postcard = this.c.postcard[i] as Postcard;
			if (postcard.args.supply !== 1) {
				this.game.animationManager.fadeOutAndDestroy(postcard.html, null, {
					duration: 800,
					parallelAnimations: [
						{
							keyframes: [{ transform: 'rotateX(-180deg) rotate(-90deg) scale(1)' }, { transform: 'rotateX(-180deg) rotate(-90deg) scale(0)' }],
						},
					],
				});
				delete this.c.postcard[i];
			}
		}

		return new Promise((resolve) => setTimeout(resolve, 800));
	}

	/**
	 * Refill the postcard supply with new card
	 * 
	 * Actions:
	 *  - Removes top card indicator from current top card
	 *  - Adds new top card if provided
	 *  - Rearranges supply row
	 * 
	 * @param top - Optional new top card ID
	 * @returns Promise resolving when refill animation completes
	 */
	public async refillPostcardSupply(top: number | undefined): Promise<void> {
		for (const i in this.c.postcard) {
			const postcard: Postcard = this.c.postcard[i] as Postcard;
			if (postcard.args.supply === 1) {
				postcard.setArg("supply", 0);
			}
		}

		if (top !== undefined) {
			this.addPostcardToTop(top);
		}

		this.rearrangeSupplyRow();
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	/**
	 * Add a postcard to the top position of the supply
	 * 
	 * Creates a new postcard at supply position 1 (top/deck position).
	 * 
	 * @param top - Postcard ID to place at top
	 * @returns The created Postcard element
	 */
	public addPostcardToTop(top: number): Postcard {
		return new Postcard(this, top, false, null, 1);
	}

	/**
	 * Remove and return the top postcard ID
	 * 
	 * Finds the postcard at supply position 1, removes it from DOM and registry,
	 * and returns its ID.
	 * 
	 * @returns The ID of the removed top postcard
	 */
	public removePostcardFromTop(): number {
		for (const i in this.c.postcard) {
			if ((this.c.postcard[i].args.supply as number) === 1) {
				this.c.postcard[i].html.remove();
				delete this.c.postcard[i];
				return Number(i);
			}
		}
		throw new Error('No postcard found at top position');
	}
}