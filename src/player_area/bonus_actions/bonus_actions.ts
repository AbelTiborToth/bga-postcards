import { GameElement } from "../../gameElement";
import { PlayerArea } from "../player_area";
import { TravelOption } from "../../cards/travel/travel_option/travel_option";

/**
 * Manages the bonus actions interface for the current player
 * 
 * Displays four travel option buttons representing bonus actions that can be
 * performed during the game: Movement, Postcard, Camp, and Stamp.
 * 
 * Responsibilities:
 *  - Creating and displaying bonus action travel option buttons
 *  - Activating/deactivating available bonus actions
 *  - Managing bonus action counter display
 */
export class BonusActions extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize the bonus actions interface with four travel options
	 * @param parent - Parent PlayerArea instance
	 * @param child_id - Element ID
	 * @param bonus_actions - Optional bonus actions data containing counter values
	 */
	public constructor(parent: PlayerArea, child_id: number, bonus_actions: any = null) {
		super(parent, child_id, "bonus_actions");

		if (bonus_actions !== null) {
			// Create travel options with counter data
			new TravelOption(this, 1, 1, 'move_bonus_counter', bonus_actions.move_bonus_counter);
			new TravelOption(this, 2, 2, 'postcard_bonus_counter', bonus_actions.postcard_bonus_counter);
			new TravelOption(this, 3, 3, 'camp_bonus_counter', bonus_actions.camp_bonus_counter);
			new TravelOption(this, 4, 4, 'stamp_bonus_counter', bonus_actions.stamp_bonus_counter);
		} else {
			// Create travel options without counter data
			new TravelOption(this, 1, 1, 'move_bonus_counter');
			new TravelOption(this, 2, 2, 'postcard_bonus_counter');
			new TravelOption(this, 3, 3, 'camp_bonus_counter');
			new TravelOption(this, 4, 4, 'stamp_bonus_counter');
		}
	}

	// ========== Public Methods ==========

	/**
	 * Activate available bonus actions based on game state
	 * 
	 * Only activates bonus actions that are currently available:
	 *  - Position 1: Movement bonus (if available)
	 *  - Position 2: Postcard bonus (if available)
	 *  - Position 3: Camp bonus (if available)
	 *  - Position 4: Stamp bonus (not checked, always available if conditions met)
	 */
	public activateBonusActions(): void {
		if (this.game.possible_actions?.bonus.move) {
			(this.c.travel_option[1] as TravelOption).activate();
		}
		if (this.game.possible_actions?.bonus.postcard) {
			(this.c.travel_option[2] as TravelOption).activate();
		}
		if (this.game.possible_actions?.bonus.camp) {
			(this.c.travel_option[3] as TravelOption).activate();
		}
	}

	/**
	 * Deactivate all bonus actions
	 * 
	 * Disables all three bonus action buttons (Move, Postcard, Camp).
	 * Note: Stamp bonus (position 4) is not deactivated here.
	 */
	public inactivateBonusActions(): void {
		(this.c.travel_option[1] as TravelOption).activate(false);
		(this.c.travel_option[2] as TravelOption).activate(false);
		(this.c.travel_option[3] as TravelOption).activate(false);
	}
}