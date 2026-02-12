import { GameElement } from "../../gameElement";
import { Board } from "../../board/board";
import { GiftPlayer } from "../../player_area/gift_player/gift_player";

/**
 * Represents a single gift card in the game
 * 
 * Gift cards are earned when players send postcards and provide various end-game
 * scoring bonuses or immediate actions. Each gift has a specific type and effect.
 * 
 * Responsibilities:
 *  - Displaying gift card on board or in player area
 *  - Handling click interactions for gift selection and usage
 *  - Managing gift type and location tracking
 *  - Providing tooltip with gift effects and scoring rules
 */
export class Gift extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize a gift card
	 * @param parent - Parent container (Board or GiftPlayer)
	 * @param child_id - Gift card ID
	 * @param location - Optional location on board (null if in hand)
	 */
	public constructor(
		parent: Board | GiftPlayer,
		child_id: number,
		location: number | null = null
	) {
		if (location !== null) {
			super(parent, child_id, "gift", { location });
		} else {
			super(parent, child_id, "gift");
		}

		// Register click handler
		$(`postcards_${this.id}`).addEventListener('click', () => this.onClick());

		// Set gift type based on ID
		this.setArg("type", this.getGiftType());

		// Setup tooltip
		this.setupTooltip();
	}

	// ========== Public Methods ==========

	/**
	 * Activate or deactivate this gift card for interaction
	 * @param b - True to activate (default), false to deactivate
	 */
	public activate(b: boolean = true): void {
		this.setArg("active", b);
	}

	// ========== Private Helper Methods ==========

	/**
	 * Handle gift card click - manages interaction based on context
	 * 
	 * During Gift phase: Select gift card from board supply
	 * During Action phase: Use gift card action from player area
	 * 
	 * @private
	 */
	private async onClick(): Promise<void> {
		if (this.game.bga.players.isCurrentPlayerActive() && this.args.active === true) {
			switch (this.game.bga.gameui.gamedatas.gamestate.name) {
				case 'Gift':
					if (this.parent instanceof Board) {
						this.game.bga.actions.performAction('actGift', { gift: this.child_id });
					}
					break;
				case 'Action':
					if (this.parent instanceof GiftPlayer) {
						this.game.bga.actions.performAction('actActionGift', {
							gift: this.child_id,
						});
					}
			}
		}
	}

	/**
	 * Get the gift type based on card ID
	 * 
	 * Maps card IDs to gift types:
	 *  - 1-4, 5-8: Keychain types (Beach, Gastronomy, Shore, Sight, History, Culture, Mountain, Forest)
	 *  - 9-16: Snow Globe
	 *  - 17: Caravan
	 *  - 18-19: Road Map
	 *  - 20-21: Car
	 *  - 22-23: Hiking Guide
	 *  - 24-25: Stamp Collection
	 * 
	 * @returns Gift type number
	 * @private
	 */
	private getGiftType(): number {
		switch (this.child_id) {
			case 1:
				return 1;
			case 2:
				return 2;
			case 3:
				return 3;
			case 4:
				return 4;
			case 5:
				return 6;
			case 6:
				return 7;
			case 7:
				return 8;
			case 8:
				return 9;

			case 9:
			case 10:
			case 11:
			case 12:
			case 13:
			case 14:
			case 15:
			case 16:
				return 5;
			case 17:
				return 10;

			case 18:
			case 19:
				return 11;
			case 20:
			case 21:
				return 12;
			case 22:
			case 23:
				return 13;
			case 24:
			case 25:
				return 14;
		}
		return 0;
	}

	/**
	 * Setup tooltip with gift information and effects
	 * 
	 * Displays:
	 *  - General gift card rules
	 *  - Gift-specific type and effects
	 *  - Scoring information or action descriptions
	 * 
	 * @private
	 */
	private setupTooltip(): void {
		this.game.bga.gameui.addTooltipHtml(
			`postcards_${this.id}`,
			`<tooltip>
				<h3>${_("Gift Card")}</h3>
				<p>${_("When you send a postcard, choose a face‑up Gift card and place it in front of you. Then fill the empty space with a new card from the deck.")}</p>
				${this.getSpecificTooltip()}
			</tooltip>`
		);
	}

	/**
	 * Get gift-specific tooltip text based on gift type
	 * 
	 * Includes:
	 *  - Keychain: Camp-based end-game scoring
	 *  - Snow Globe: Collection-based end-game scoring
	 *  - Caravan: Regional camp-based end-game scoring
	 *  - Road Map: Movement + Camp action
	 *  - Car: Extra movement actions
	 *  - Hiking Guide: Postcard selection action
	 *  - Stamp Collection: Stamp placement action
	 * 
	 * @returns HTML string with gift-specific rules
	 * @private
	 */
	private getSpecificTooltip(): string {
		switch (this.args.type) {
			case 1:
			case 2:
			case 3:
			case 4:
			case 6:
			case 7:
			case 8:
			case 9:
				return `<h4>${_("Keychain")}</h4>
					<p>${this.game.bga.gameui.format_string(
						_("<b>At the end of the game:</b> if you have 1/2/3/4/5/6 camps on ${t} type of campsite, score 1/3/6/10/14/20 points."),
						{
							t: this.getKeyType(),
						}
					)}</p>
					<p>${_("<b>BGA tip:</b> you can see the number of Camps by clicking on the small Book icon in the bottom-left corner of the screen.")}</p>`;
			case 5:
				return `<h4>${_("Snow Globe")}</h4>
					<p>${_("<b>At the end of the game:</b> if you have 1/2/3/4 Snow Globe cards, score 3/6/12/18 points.")}</p>`;
			case 10:
				return `<h4>${_("Caravan")}</h4>
					<p>${_("<b>At the end of the game:</b> score 2 points for each region in which you have at least 2 camps.")}</p>`;
			case 11:
				return `<h4>${_("Road Map")}</h4>
					<p>${_("<b>When you use it:</b> move your Biker to a region adjacent to the one you are in. Then you may place a Camp token on an available campsite in the region you moved to.")}</p>`;
			case 12:
				return `<h4>${_("Car")}</h4>
					<p>${_("<b>When you use it:</b> perform up to 3 extra Movement actions during your turn.")}</p>`;
			case 13:
				return `<h4>${_("Hiking Guide")}</h4>
					<p>${_("<b>When you use it:</b> draw the top 5 postcards from the deck. Keep 2 and discard the other 3.")}</p>`;
			case 14:
				return `<h4>${_("Stamp Collection")}</h4>
					<p>${_("<b>When you use it:</b> immediately place up to 2 Stamp tokens from the supply on any available Stamp spaces on any of your postcards.")}</p>`;
		}
		return ``;
	}

	/**
	 * Get the keychain type name based on gift type
	 * 
	 * Used for Keychain gifts to display which campsite type grants scoring.
	 * 
	 * @returns Localized campsite type name
	 * @private
	 */
	private getKeyType(): string {
		switch (this.args.type) {
			case 1:
				return _("Beach");
			case 2:
				return _("Gastronomy");
			case 3:
				return _("Shore");
			case 4:
				return _("Sight");
			case 6:
				return _("History");
			case 7:
				return _("Culture");
			case 8:
				return _("Mountain");
			case 9:
				return _("Forest");
		}
		return '';
	}
}