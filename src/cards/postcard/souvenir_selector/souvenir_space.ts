import { Postcard } from "../postcard";
import { GameElement } from "../../../gameElement";

/**
 * Represents a single souvenir placement space on a postcard
 * 
 * Each postcard has three souvenir spaces where players can place souvenir tokens.
 * Souvenirs are earned by placing matching camp tokens and grant immediate effects.
 * 
 * Responsibilities:
 *  - Displaying souvenir placement space on postcard
 *  - Handling click interactions for souvenir placement
 *  - Tracking space location for souvenir placement
 *  - Managing activation state for player selection
 *  - Providing tooltip with souvenir type and effect information
 */
export class SouvenirSpace extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize a souvenir space on a postcard
	 * @param parent - Parent Postcard instance
	 * @param child_id - Element ID
	 * @param space - Space location number on the postcard (1-3)
	 */
	public constructor(parent: Postcard, child_id: number, space: number) {
		super(parent, child_id, "souvenir_space", { space });

		// Register click handler
		$(`postcards_${this.id}`).addEventListener('click', () => this.onClick());

		// Setup tooltip
		this.setupTooltip();
	}

	// ========== Public Methods ==========

	/**
	 * Activate this souvenir space for souvenir placement
	 */
	public activate(): void {
		this.setArg("active", true);
	}

	/**
	 * Deactivate this souvenir space
	 */
	public inactivate(): void {
		this.setArg("active", false);
	}

	// ========== Private Helper Methods ==========

	/**
	 * Handle souvenir space click - places souvenir when clicked
	 * 
	 * During Souvenir phase:
	 *  - Click: Place souvenir on this space
	 * 
	 * @private
	 */
	private async onClick(): Promise<void> {
		if (this.game.bga.players.isCurrentPlayerActive() && this.args.active === true) {
			switch (this.game.bga.gameui.gamedatas.gamestate.name) {
				case 'Souvenir':
					this.game.bga.actions.performAction('actSouvenir', {
						postcard: (this.parent as Postcard).child_id,
						space: this.args.space,
					});
					break;
			}
		}
	}

	/**
	 * Setup tooltip with souvenir type and effect information
	 * 
	 * Displays:
	 *  - General souvenir placement rules
	 *  - Postcard-specific souvenir type
	 *  - Effect granted by this souvenir
	 * 
	 * @private
	 */
	private setupTooltip(): void {
		this.game.bga.gameui.addTooltipHtml(
			`postcards_${this.id}`,
			`<tooltip>
				<h3>${_("Souvenir Space")}</h3>
				<p>${_("After placing a Camp on a campsite, if it's type matches an available Souvenir space on one of your Postcards, you may take a Souvenir token from the supply and place it on that Souvenir space. This immediately grants you an effect.")}</p>
				<p>${this.game.bga.gameui.format_string(_("<b>Type:</b> ${t}"), {
					t: this.getSpaceTypeName(),
				})}</p>
				<p>${this.game.bga.gameui.format_string(_("<b>Effect:</b> ${e}"), {
					e: this.getEffectTooltip(),
				})}</p>
			</tooltip>`
		);
	}

	/**
	 * Get the souvenir type name for this space based on postcard and space location
	 * 
	 * @returns Localized type name (e.g., "Gastronomy", "Shore", "Culture")
	 * @private
	 */
	private getSpaceTypeName(): string {
		switch ((this.parent as Postcard).child_id) {
			case 1:
			case 50:
				switch (this.args.space) {
					case 1:
						return _("Gastronomy");
					case 2:
						return _("Shore");
					case 3:
						return _("Culture");
				}
				break;

			case 2:
			case 17:
				switch (this.args.space) {
					case 1:
						return _("Forest");
					case 2:
						return _("History");
					case 3:
						return _("Sight");
				}
				break;

			case 3:
				switch (this.args.space) {
					case 1:
						return _("Mountain");
					case 2:
						return _("Gastronomy");
					case 3:
						return _("Beach");
				}
				break;
			case 4:
			case 20:
			case 33:
				switch (this.args.space) {
					case 1:
						return _("Shore");
					case 2:
						return _("Sight");
					case 3:
						return _("History");
				}
				break;
			case 5:
			case 38:
			case 52:
				switch (this.args.space) {
					case 1:
						return _("Beach");
					case 2:
						return _("Sight");
					case 3:
						return _("Mountain");
				}
				break;
			case 6:
			case 23:
				switch (this.args.space) {
					case 1:
						return _("Forest");
					case 2:
						return _("Culture");
					case 3:
						return _("Gastronomy");
				}
				break;
			case 7:
				switch (this.args.space) {
					case 1:
						return _("Shore");
					case 2:
						return _("Gastronomy");
					case 3:
						return _("Culture");
				}
				break;
			case 8:
				switch (this.args.space) {
					case 1:
						return _("Mountain");
					case 2:
						return _("Gastronomy");
					case 3:
						return _("Forest");
				}
				break;
			case 9:
				switch (this.args.space) {
					case 1:
						return _("Mountain");
					case 2:
						return _("Culture");
					case 3:
						return _("Beach");
				}
				break;
			case 10:
				switch (this.args.space) {
					case 1:
						return _("Beach");
					case 2:
						return _("Gastronomy");
					case 3:
						return _("Culture");
				}
				break;
			case 11:
			case 26:
			case 43:
				switch (this.args.space) {
					case 1:
						return _("Shore");
					case 2:
						return _("History");
					case 3:
						return _("Culture");
				}
				break;
			case 12:
			case 25:
			case 42:
				switch (this.args.space) {
					case 1:
						return _("Forest");
					case 2:
						return _("Sight");
					case 3:
						return _("Mountain");
				}
				break;
			case 13:
			case 30:
			case 46:
				switch (this.args.space) {
					case 1:
						return _("Mountain");
					case 2:
						return _("Culture");
					case 3:
						return _("Beach");
				}
				break;
			case 14:
			case 32:
			case 47:
				switch (this.args.space) {
					case 1:
						return _("Beach");
					case 2:
						return _("History");
					case 3:
						return _("Sight");
				}
				break;
			case 15:
			case 29:
			case 34:
			case 45:
				switch (this.args.space) {
					case 1:
						return _("Shore");
					case 2:
						return _("Culture");
					case 3:
						return _("Beach");
				}
				break;
			case 16:
			case 31:
			case 48:
				switch (this.args.space) {
					case 1:
						return _("Forest");
					case 2:
						return _("Gastronomy");
					case 3:
						return _("Shore");
				}
				break;
			case 18:
			case 35:
				switch (this.args.space) {
					case 1:
						return _("Mountain");
					case 2:
						return _("Gastronomy");
					case 3:
						return _("Shore");
				}
				break;
			case 19:
			case 36:
				switch (this.args.space) {
					case 1:
						return _("Beach");
					case 2:
						return _("Culture");
					case 3:
						return _("Mountain");
				}
				break;
			case 21:
			case 38:
			case 51:
			case 52:
				switch (this.args.space) {
					case 1:
						return _("Beach");
					case 2:
						return _("Sight");
					case 3:
						return _("Shore");
				}
				break;
			case 22:
			case 39:
				switch (this.args.space) {
					case 1:
						return _("Mountain");
					case 2:
						return _("History");
					case 3:
						return _("Forest");
				}
				break;
			case 24:
			case 37:
				switch (this.args.space) {
					case 1:
						return _("Shore");
					case 2:
						return _("Gastronomy");
					case 3:
						return _("History");
				}
				break;
			case 27:
			case 44:
				switch (this.args.space) {
					case 1:
						return _("Beach");
					case 2:
						return _("Gastronomy");
					case 3:
						return _("Mountain");
				}
				break;
			case 28:
			case 40:
			case 41:
				switch (this.args.space) {
					case 1:
						return _("Forest");
					case 2:
						return _("Sight");
					case 3:
						return _("Culture");
				}
				break;
			case 49:
			case 50:
				switch (this.args.space) {
					case 1:
						return _("Gastronomy");
					case 2:
						return _("Shore");
					case 3:
						return _("Culture");
				}
				break;
		}
		return '';
	}

	/**
	 * Get the effect tooltip text for this souvenir based on postcard and space location
	 * 
	 * Effects include:
	 *  - Extra travel card usage
	 *  - Movement actions
	 *  - Camp actions
	 *  - Postcard actions
	 *  - Stamp placement
	 *  - Immediate scoring
	 * 
	 * @returns Localized effect description
	 * @private
	 */
	private getEffectTooltip(): string {
		// ...existing code...
		switch ((this.parent as Postcard).child_id) {
			case 1:
			case 20:
			case 33:
				switch (this.args.space) {
					case 1:
						return _("You can play an additional Travel card during your turn.");
					case 2:
						return _("Perform two Movement actions.");
					case 3:
						return _("Perform a Camp action.");
				}
				break;

			case 2:
			case 15:
			case 17:
			case 29:
			case 34:
			case 45:
				switch (this.args.space) {
					case 1:
						return _("You can play an additional Travel card during your turn.");
					case 2:
						return _("Perform a Camp action.");
					case 3:
						return _("Immediately score 2 points.");
				}
				break;

			case 3:
			case 18:
			case 35:
				switch (this.args.space) {
					case 1:
						return _("Immediately place a Stamp token from the supply on any available Stamp space on one of your postcards.");
					case 2:
						return _("Perform two Movement actions.");
					case 3:
						return _("Perform a Postcard action.");
				}
				break;

			case 4:
			case 19:
			case 36:
				switch (this.args.space) {
					case 1:
						return _("Immediately score 2 points.");
					case 2:
						return _("Perform a Postcard action.");
					case 3:
						return _("Immediately place a Stamp token from the supply on any available Stamp space on one of your postcards.");
				}
				break;

			case 5:
			case 21:
			case 38:
			case 51:
			case 52:
				switch (this.args.space) {
					case 1:
						return _("You can play an additional Travel card during your turn.");
					case 2:
						return _("Immediately place a Stamp token from the supply on any available Stamp space on one of your postcards.");
					case 3:
						return _("Perform two Movement actions.");
				}
				break;

			case 6:
			case 10:
			case 23:
			case 28:
			case 40:
			case 41:
				switch (this.args.space) {
					case 1:
						return _("Perform a Camp action.");
					case 2:
						return _("Immediately place a Stamp token from the supply on any available Stamp space on one of your postcards.");
					case 3:
						return _("Perform a Postcard action.");
				}
				break;

			case 7:
			case 24:
			case 37:
				switch (this.args.space) {
					case 1:
						return _("Perform a Postcard action.");
					case 2:
						return _("Perform a Camp action.");
					case 3:
						return _("Immediately score 2 points.");
				}
				break;

			case 8:
			case 22:
			case 39:
				switch (this.args.space) {
					case 1:
						return _("You can play an additional Travel card during your turn.");
					case 2:
						return _("Perform two Movement actions.");
					case 3:
						return _("Immediately score 2 points.");
				}
				break;

			case 9:
			case 27:
			case 44:
				switch (this.args.space) {
					case 1:
						return _("Immediately score 2 points.");
					case 2:
						return _("Perform two Movement actions.");
					case 3:
						return _("Immediately place a Stamp token from the supply on any available Stamp space on one of your postcards.");
				}
				break;

			case 11:
			case 26:
			case 43:
				switch (this.args.space) {
					case 1:
						return _("Perform a Camp action.");
					case 2:
						return _("Perform a Postcard action.");
					case 3:
						return _("You can play an additional Travel card during your turn.");
				}
				break;

			case 12:
			case 25:
			case 42:
				switch (this.args.space) {
					case 1:
						return _("Perform two Movement actions.");
					case 2:
						return _("You can play an additional Travel card during your turn.");
					case 3:
						return _("Immediately score 2 points.");
				}
				break;

			case 13:
			case 30:
			case 46:
				switch (this.args.space) {
					case 1:
						return _("Perform a Postcard action.");
					case 2:
						return _("Perform two Movement actions.");
					case 3:
						return _("Immediately place a Stamp token from the supply on any available Stamp space on one of your postcards.");
				}
				break;

			case 14:
			case 32:
			case 47:
				switch (this.args.space) {
					case 1:
						return _("Perform two Movement actions.");
					case 2:
						return _("You can play an additional Travel card during your turn.");
					case 3:
						return _("Perform a Camp action.");
				}
				break;

			case 16:
			case 31:
			case 48:
				switch (this.args.space) {
					case 1:
						return _("Perform a Postcard action.");
					case 2:
						return _("Immediately score 2 points.");
					case 3:
						return _("Immediately place a Stamp token from the supply on any available Stamp space on one of your postcards.");
				}
				break;

			case 49:
			case 50:
				switch (this.args.space) {
					case 1:
						return _("Perform a Camp action.");
					case 2:
						return _("Perform a Postcard action.");
					case 3:
						return _("Immediately score 2 points.");
				}
				break;
		}
		return '';
	}
}