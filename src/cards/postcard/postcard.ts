import { PostcardSupply } from "../../postcard_supply/postcard_supply";
import { PostcardGuide } from "../../postcard_guide/postcard_guide";
import { PostcardPlayer } from "../../player_area/postcard_player/postcard_player";
import { GameElement } from "../../gameElement";
import { Game } from "../../game";
import { Souvenir } from "./souvenir/souvenir";
import { SouvenirSpace } from "./souvenir_selector/souvenir_space";
import { Stamp } from "./stamp/stamp";
import { StampSpace } from "./stamp_selector/stamp_space";

/**
 * Represents a single postcard in the game
 * 
 * Postcards are collected during the game and sent for points. Each postcard
 * shows a region, stamp requirement, and scoring value. Players can add stamps
 * and souvenirs to postcards.
 * 
 * Responsibilities:
 *  - Displaying postcard with region and stamp information
 *  - Managing stamp and souvenir placement spaces
 *  - Handling postcard selection and interaction
 *  - Managing postcard animations (adding stamps, souvenirs)
 *  - Providing tooltip with detailed card information
 */
export class Postcard extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize a postcard
	 * @param parent - Parent container (PostcardSupply, PostcardGuide, or PostcardPlayer)
	 * @param child_id - Postcard ID
	 * @param face - Whether postcard is face-up (true) or face-down (false)
	 * @param data - Optional postcard data (stamps and souvenirs)
	 * @param supply - Optional supply position for layout (1 = top/deck, 2+ = row)
	 */
	public constructor(
		parent: PostcardSupply | PostcardGuide | PostcardPlayer,
		child_id: number,
		face: boolean,
		data: any = null,
		supply: number | null = null
	) {
		if (supply === null) {
			super(parent, child_id, "postcard", { type: child_id, face });
		} else {
			super(parent, child_id, "postcard", { type: child_id, face, supply });
		}

		// Register click handler
		this.html.addEventListener('click', () => this.onClick());

		// Setup face-up display or tooltip for face-down
		if (face) {
			this.setupFace(data?.stamps, data?.souvenirs);
		} else {
			this.setupTooltip();
		}
	}

	// ========== Public Methods ==========

	/**
	 * Activate or deactivate this postcard for interaction
	 * @param b - True to activate (default), false to deactivate
	 */
	public activate(b: boolean = true): void {
		this.setArg("active", b);
	}

	/**
	 * Setup face-up display with stamps, souvenirs, and spaces
	 * 
	 * Actions:
	 *  - Creates souvenir tokens from initial data
	 *  - Creates souvenir space indicators
	 *  - Creates stamp tokens from initial data
	 *  - Creates stamp space indicators based on postcard type
	 *  - Sets up tooltip
	 * 
	 * @param stamps - Array of initial stamp locations
	 * @param souvenirs - Array of initial souvenir locations
	 */
	public setupFace(stamps: any = [], souvenirs: any = []): void {
		// Create initial souvenirs
		for (const i in souvenirs) {
			new Souvenir(this, souvenirs[i], souvenirs[i]);
		}

		// Create souvenir spaces (always 3)
		for (let i: number = 1; i <= 3; i++) {
			new SouvenirSpace(this, i, i);
		}

		// Create initial stamps
		for (const i in stamps) {
			new Stamp(this, stamps[i], stamps[i]);
		}

		// Create stamp spaces based on postcard type
		this.setupStampSpaces();

		// Setup tooltip
		this.setupTooltip();
	}

	/**
	 * Animate adding a souvenir to the postcard
	 * 
	 * Creates souvenir token and animates it spinning in from the supply.
	 * 
	 * @param location - Souvenir space location to add to
	 * @returns Promise resolving when animation completes
	 */
	public async addSouvenir(location: number): Promise<void> {
		new Souvenir(this, location, location);
		return await this.game.animationManager.slideIn(
			this.c.souvenir[location].html,
			this.game.c.board[0].c.stamp_supply[0].html,
			{
				duration: 800,
				fromPlaceholder: "off",
				toPlaceholder: "off",
				ignoreRotation: false,
				parallelAnimations: [
					{
						keyframes: [
							{ transform: 'rotate(630deg)', opacity: 0 },
							{ transform: 'rotate(270deg)', opacity: 1 },
							{ transform: 'rotate(-90deg)', opacity: 1 },
						],
					},
				],
			}
		);
	}

	/**
	 * Animate removing a souvenir from the postcard
	 * 
	 * Animates souvenir spinning out to the supply and removes it.
	 * 
	 * @param space - Souvenir space location to remove from
	 * @returns Promise resolving when animation completes
	 */
	public async removeSouvenir(space: number): Promise<void> {
		return await this.game.animationManager
			.fadeOutAndDestroy(this.c.souvenir[space].html, this.game.c.board[0].c.stamp_supply[0].html, {
				duration: 800,
				ignoreRotation: false,
				parallelAnimations: [
					{
						keyframes: [
							{ transform: 'rotate(-90deg)' },
							{ transform: 'rotate(270deg)' },
							{ transform: 'rotate(630deg)' },
						],
					},
				],
			})
			.then(() => {
				delete this.c.souvenir[space];
			});
	}

	/**
	 * Animate adding a stamp to the postcard
	 * 
	 * Creates stamp token and animates it spinning in from the supply.
	 * 
	 * @param location - Stamp space location to add to
	 * @returns Promise resolving when animation completes
	 */
	public async addStamp(location: number): Promise<void> {
		new Stamp(this, location, location);
		return await this.game.animationManager.slideIn(this.c.stamp[location].html, this.game.c.board[0].c.stamp_supply[0].html, {
			duration: 800,
			ignoreRotation: false,
			parallelAnimations: [
				{
					keyframes: [
						{ transform: 'rotate(720deg)', opacity: 0 },
						{ transform: 'rotate(360deg)', opacity: 1 },
						{ transform: 'rotate(0deg)', opacity: 1 },
					],
				},
			],
		});
	}

	/**
	 * Animate removing a stamp from the postcard
	 * 
	 * Animates stamp spinning out to the supply and removes it.
	 * 
	 * @param space - Stamp space location to remove from
	 * @returns Promise resolving when animation completes
	 */
	public async removeStamp(space: number): Promise<void> {
		return await this.game.animationManager
			.fadeOutAndDestroy(this.c.stamp[space].html, this.game.c.board[0].c.stamp_supply[0].html, {
				duration: 800,
				ignoreRotation: false,
				parallelAnimations: [
					{
						keyframes: [
							{ transform: 'rotate(0deg)' },
							{ transform: 'rotate(360deg)' },
							{ transform: 'rotate(720deg)' },
						],
					},
				],
			})
			.then(() => {
				delete this.c.stamp[space];
			});
	}

	// ========== Private Helper Methods ==========

	/**
	 * Handle postcard click - manages interaction based on context
	 * 
	 * During Action phase: Send postcard from player area
	 * During Postcard phase: Take postcard from supply
	 * During Guide phase: Select postcard with guide selection logic
	 * 
	 * @private
	 */
	private onClick(): void {
		if (
			this.game.bga.players.isCurrentPlayerActive() &&
			(this.args.active === true || this.args.active === "selected")
		) {
			switch (this.game.bga.gameui.gamedatas.gamestate.name) {
				case 'Action':
					if (this.parent instanceof PostcardPlayer) {
						this.game.bga.actions.performAction('actSend', {
							postcard: this.args.type,
						});
					}
					break;
				case 'Postcard':
					if (this.parent instanceof PostcardSupply) {
						this.game.bga.actions.performAction('actPostcard', {
							postcard: this.args.type,
						});
					}
					break;
				case 'Guide':
					if (this.parent instanceof PostcardGuide) {
						if ((this.parent as PostcardGuide).selected_1 === undefined) {
							this.setArg("active", "selected");
							(this.parent as PostcardGuide).selected_1 = this;
						} else if (
							(this.parent as PostcardGuide).selected_1 === this &&
							(this.parent as PostcardGuide).selected_2 === undefined
						) {
							this.setArg("active", true);
							(this.parent as PostcardGuide).selected_1 = undefined;
						} else if ((this.parent as PostcardGuide).selected_1 === this) {
							(this.game as Game).takeButton!.classList.add("disabled");
							this.setArg("active", true);
							(this.parent as PostcardGuide).selected_1 = (this.parent as PostcardGuide).selected_2;
							(this.parent as PostcardGuide).selected_2 = undefined;
						} else if ((this.parent as PostcardGuide).selected_2 === this) {
							(this.game as Game).takeButton!.classList.add("disabled");
							this.setArg("active", true);
							(this.parent as PostcardGuide).selected_2 = undefined;
						} else if ((this.parent as PostcardGuide).selected_2 === undefined) {
							(this.game as Game).takeButton!.classList.remove("disabled");
							this.setArg("active", "selected");
							(this.parent as PostcardGuide).selected_2 = this;
						} else {
							(this.parent as PostcardGuide).selected_1!.setArg("active", true);
							(this.parent as PostcardGuide).selected_1 = (this.parent as PostcardGuide).selected_2;
							this.setArg("active", "selected");
							(this.parent as PostcardGuide).selected_2 = this;
						}
					}
					break;
			}
		}
	}

	/**
	 * Create stamp spaces based on postcard type
	 * 
	 * Different postcard types have different numbers of stamp spaces:
	 *  - Type 0 (mod 4): 3 spaces
	 *  - Type 1 (mod 4): 4 spaces
	 *  - Type 2 (mod 4): 5 spaces
	 *  - Type 3 (mod 4): 6 spaces
	 * 
	 * @private
	 */
	private setupStampSpaces(): void {
		let stamp_space: number[] = [];
		const n = ((this.args.type as number) - 1) % 4;
		switch (n) {
			case 0:
				stamp_space = [1, 2, 3];
				break;
			case 1:
				stamp_space = [2, 3, 5, 6];
				break;
			case 2:
				stamp_space = [1, 2, 3, 5, 6];
				break;
			case 3:
				stamp_space = [1, 2, 3, 4, 5, 6];
				break;
		}

		for (const i in stamp_space) {
			new StampSpace(this, stamp_space[i], stamp_space[i]);
		}
	}

	/**
	 * Setup tooltip with postcard information
	 * 
	 * Displays:
	 *  - Face-down: Region indicator and stamp requirement information
	 *  - Face-up: Sending rules, points, and gift selection
	 * 
	 * @private
	 */
	private setupTooltip(): void {
		this.game.bga.gameui.addTooltipHtml(
			`postcards_${this.id}`,
			`<tooltip>
				<h3>${_("Postcard")}</h3>
				${
					!this.args.face
						? `<p>${_("The number in the upper-left corner of a Postcard indicates its region. The one in the upper-right corner indicates the amount of Stamps required to send that Postcard.")}</p>`
						: `<p>${_("In addition to playing your 3 Travel cards, you can send a Postcard at any time during your turn if: all the Stamp spaces on that Postcard are filled AND you are in the region indicated on that Postcard.")}</p>
						<p>${_("When sending a Postcard, return all tokens on it to the supply, then immediately score the points indicated in its bottom-right corner and choose 1 Gift card.")}</p>
						<p><i>${_("<b>Note:</b> You can send multiple Postcards during your turn.")}</i></p>`
				}
			</tooltip>`
		);
	}
}