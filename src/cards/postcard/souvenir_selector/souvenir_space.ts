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
		const p = (this.parent as Postcard).child_id;
		const i = (this.args.space as number) - 1;

		const GASTRONOMY = _('Gastronomy');
		const SHORE = _('Shore');
		const CULTURE = _('Culture');
		const FOREST = _('Forest');
		const HISTORY = _('History');
		const SIGHT = _('Sight');
		const MOUNTAIN = _('Mountain');
		const BEACH = _('Beach');

		const spaceTypeMap: Record<number, string[]> = {
			1: [GASTRONOMY, SHORE, CULTURE],
			2: [FOREST, HISTORY, SIGHT],
			3: [MOUNTAIN, GASTRONOMY, BEACH],
			4: [SHORE, SIGHT, HISTORY],
			5: [BEACH, SIGHT, MOUNTAIN],
			6: [FOREST, CULTURE, GASTRONOMY],
			7: [SHORE, GASTRONOMY, CULTURE],
			8: [MOUNTAIN, GASTRONOMY, FOREST],
			9: [MOUNTAIN, CULTURE, BEACH],
			10: [BEACH, GASTRONOMY, CULTURE],
			11: [SHORE, HISTORY, CULTURE],
			12: [FOREST, SIGHT, MOUNTAIN],
			13: [MOUNTAIN, SIGHT, GASTRONOMY],
			14: [BEACH, HISTORY, SIGHT],
			15: [SHORE, CULTURE, BEACH],
			16: [FOREST, GASTRONOMY, SHORE],
			17: [FOREST, HISTORY, SIGHT],
			18: [MOUNTAIN, GASTRONOMY, SHORE],
			19: [BEACH, CULTURE, MOUNTAIN],
			20: [SHORE, SIGHT, HISTORY],
			21: [BEACH, SIGHT, SHORE],
			22: [MOUNTAIN, HISTORY, FOREST],
			23: [FOREST, CULTURE, GASTRONOMY],
			24: [SHORE, GASTRONOMY, HISTORY],
			25: [MOUNTAIN, CULTURE, FOREST],
			26: [SHORE, HISTORY, GASTRONOMY],
			27: [BEACH, GASTRONOMY, MOUNTAIN],
			28: [FOREST, SIGHT, CULTURE],
			29: [BEACH, HISTORY, FOREST],
			30: [SHORE, CULTURE, HISTORY],
			31: [MOUNTAIN, SIGHT, BEACH],
			32: [FOREST, GASTRONOMY, SIGHT],
			33: [SHORE, SIGHT, HISTORY],
			34: [FOREST, HISTORY, CULTURE],
			35: [MOUNTAIN, GASTRONOMY, SHORE],
			36: [BEACH, CULTURE, FOREST],
			37: [SHORE, GASTRONOMY, HISTORY],
			38: [BEACH, SIGHT, MOUNTAIN],
			39: [MOUNTAIN, HISTORY, BEACH],
			40: [FOREST, CULTURE, SIGHT],
			41: [FOREST, SIGHT, CULTURE],
			42: [MOUNTAIN, CULTURE, SHORE],
			43: [SHORE, HISTORY, GASTRONOMY],
			44: [BEACH, GASTRONOMY, FOREST],
			45: [BEACH, HISTORY, MOUNTAIN],
			46: [SHORE, CULTURE, GASTRONOMY],
			47: [FOREST, GASTRONOMY, SIGHT],
			48: [MOUNTAIN, SIGHT, FOREST],
			49: [HISTORY, BEACH, SIGHT],
			50: [GASTRONOMY, SHORE, CULTURE],
			51: [FOREST, CULTURE, BEACH],
			52: [BEACH, SIGHT, MOUNTAIN],
		};

		const types = spaceTypeMap[p];
		if (!types || i < 0 || i >= types.length) return '';
		else return types[i];
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
		const p = (this.parent as Postcard).child_id;
		const i = (this.args.space as number) - 1;

		const EFFECT_TRAVEL = _('You can play an additional Travel card during your turn.');
		const EFFECT_MOVEMENT = _('Perform two Movement actions.');
		const EFFECT_CAMP = _('Perform a Camp action.');
		const EFFECT_POSTCARD = _('Perform a Postcard action.');
		const EFFECT_STAMP = _('Immediately place a Stamp token from the supply on any available Stamp space on one of your postcards.');
		const EFFECT_SCORE = _('Immediately score 2 points.');

		const effectMap: Record<number, string[]> = {
			1: [EFFECT_TRAVEL, EFFECT_MOVEMENT, EFFECT_CAMP],
			2: [EFFECT_TRAVEL, EFFECT_CAMP, EFFECT_SCORE],
			3: [EFFECT_STAMP, EFFECT_MOVEMENT, EFFECT_POSTCARD],
			4: [EFFECT_SCORE, EFFECT_POSTCARD, EFFECT_STAMP],
			5: [EFFECT_TRAVEL, EFFECT_STAMP, EFFECT_MOVEMENT],
			6: [EFFECT_CAMP, EFFECT_STAMP, EFFECT_POSTCARD],
			7: [EFFECT_POSTCARD, EFFECT_CAMP, EFFECT_SCORE],
			8: [EFFECT_TRAVEL, EFFECT_MOVEMENT, EFFECT_SCORE],
			9: [EFFECT_SCORE, EFFECT_MOVEMENT, EFFECT_STAMP],
			10: [EFFECT_CAMP, EFFECT_STAMP, EFFECT_POSTCARD],
			11: [EFFECT_CAMP, EFFECT_POSTCARD, EFFECT_TRAVEL],
			12: [EFFECT_MOVEMENT, EFFECT_TRAVEL, EFFECT_SCORE],
			13: [EFFECT_POSTCARD, EFFECT_MOVEMENT, EFFECT_STAMP],
			14: [EFFECT_MOVEMENT, EFFECT_TRAVEL, EFFECT_CAMP],
			15: [EFFECT_TRAVEL, EFFECT_CAMP, EFFECT_SCORE],
			16: [EFFECT_POSTCARD, EFFECT_MOVEMENT, EFFECT_STAMP],
			17: [EFFECT_TRAVEL, EFFECT_MOVEMENT, EFFECT_CAMP],
			18: [EFFECT_STAMP, EFFECT_MOVEMENT, EFFECT_POSTCARD],
			19: [EFFECT_SCORE, EFFECT_POSTCARD, EFFECT_STAMP],
			20: [EFFECT_TRAVEL, EFFECT_MOVEMENT, EFFECT_CAMP],
			21: [EFFECT_TRAVEL, EFFECT_STAMP, EFFECT_MOVEMENT],
			22: [EFFECT_TRAVEL, EFFECT_MOVEMENT, EFFECT_SCORE],
			23: [EFFECT_CAMP, EFFECT_STAMP, EFFECT_POSTCARD],
			24: [EFFECT_POSTCARD, EFFECT_CAMP, EFFECT_SCORE],
			25: [EFFECT_MOVEMENT, EFFECT_TRAVEL, EFFECT_SCORE],
			26: [EFFECT_CAMP, EFFECT_POSTCARD, EFFECT_TRAVEL],
			27: [EFFECT_SCORE, EFFECT_MOVEMENT, EFFECT_STAMP],
			28: [EFFECT_CAMP, EFFECT_STAMP, EFFECT_POSTCARD],
			29: [EFFECT_TRAVEL, EFFECT_CAMP, EFFECT_SCORE],
			30: [EFFECT_POSTCARD, EFFECT_MOVEMENT, EFFECT_STAMP],
			31: [EFFECT_POSTCARD, EFFECT_SCORE, EFFECT_STAMP],
			32: [EFFECT_MOVEMENT, EFFECT_TRAVEL, EFFECT_CAMP],
			33: [EFFECT_TRAVEL, EFFECT_MOVEMENT, EFFECT_CAMP],
			34: [EFFECT_TRAVEL, EFFECT_CAMP, EFFECT_SCORE],
			35: [EFFECT_STAMP, EFFECT_MOVEMENT, EFFECT_POSTCARD],
			36: [EFFECT_SCORE, EFFECT_POSTCARD, EFFECT_STAMP],
			37: [EFFECT_POSTCARD, EFFECT_CAMP, EFFECT_SCORE],
			38: [EFFECT_TRAVEL, EFFECT_STAMP, EFFECT_MOVEMENT],
			39: [EFFECT_TRAVEL, EFFECT_MOVEMENT, EFFECT_SCORE],
			40: [EFFECT_CAMP, EFFECT_STAMP, EFFECT_POSTCARD],
			41: [EFFECT_CAMP, EFFECT_STAMP, EFFECT_POSTCARD],
			42: [EFFECT_MOVEMENT, EFFECT_TRAVEL, EFFECT_SCORE],
			43: [EFFECT_CAMP, EFFECT_POSTCARD, EFFECT_TRAVEL],
			44: [EFFECT_SCORE, EFFECT_MOVEMENT, EFFECT_STAMP],
			45: [EFFECT_TRAVEL, EFFECT_CAMP, EFFECT_SCORE],
			46: [EFFECT_POSTCARD, EFFECT_MOVEMENT, EFFECT_STAMP],
			47: [EFFECT_MOVEMENT, EFFECT_TRAVEL, EFFECT_CAMP],
			48: [EFFECT_POSTCARD, EFFECT_SCORE, EFFECT_STAMP],
			49: [EFFECT_CAMP, EFFECT_POSTCARD, EFFECT_SCORE],
			50: [EFFECT_CAMP, EFFECT_POSTCARD, EFFECT_SCORE],
			51: [EFFECT_TRAVEL, EFFECT_STAMP, EFFECT_MOVEMENT],
			52: [EFFECT_TRAVEL, EFFECT_STAMP, EFFECT_MOVEMENT],
		};

		const effects = effectMap[p];
		if (!effects || i < 0 || i >= effects.length) return '';
		return effects[i];
	}
}