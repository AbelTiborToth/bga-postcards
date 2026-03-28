import { GameElement } from "../../../gameElement";
import { Travel } from "../travel";
import { DoubleActions } from "../../../player_area/hand/double_actions/double_actions";
import { BonusActions } from "../../../player_area/bonus_actions/bonus_actions";
import { Hand } from "../../../player_area/hand/hand";

/**
 * Represents an action option button for Travel cards
 *
 * Displayed when a Travel card is selected, showing available actions:
 * - Specific action type (Movement, Postcard, Camp) or stamp color
 * - Used for bonus actions, double actions, and action selection
 *
 * Responsibilities:
 *  - Displaying action option buttons
 *  - Handling click interactions for action selection
 *  - Managing optional counter display
 *  - Tracking action availability
 */
export class TravelOption extends GameElement {
	// ========== Properties ==========

	/** Optional counter for tracking remaining uses (bonus actions, etc.) */
	counter: Counter | null = null;

	// ========== Constructor ==========

	/**
	 * Initialize a travel option button
	 * @param parent - Parent element (Travel, DoubleActions, or BonusActions)
	 * @param child_id - Element ID
	 * @param type - Option type (1-4 for actions, 5-8 for colors)
	 * @param counter - Optional counter name for tracking
	 * @param n - Optional initial counter value
	 */
	public constructor(
		parent: Travel | DoubleActions | BonusActions,
		child_id: number,
		type: number,
		counter: string | null = null,
		n: number | null = 0
	) {
		super(parent, child_id, "travel_option", { type });

		// Register click handler
		$(`postcards_${this.id}`).addEventListener("click", () => this.onClick());

		// Setup counter if provided
		if (counter !== null) {
			this.setupCounter(counter, n ?? 0);
		}
	}

	// ========== Public Methods ==========

	/**
	 * Setup counter display for this option
	 *
	 * Creates a counter element showing remaining uses of this action.
	 * Automatically sets count display based on counter value.
	 *
	 * @param counter - Counter table name to track
	 * @param n - Initial counter value
	 */
	public setupCounter(counter: string, n: number): void {
		const c = document.createElement("counter");
		this.html.appendChild(c);
		this.counter = new ebg.counter();
		this.counter.create(c, {
			value: n,
			tableCounter: counter,
		});

		// Set count display based on counter value
		if (this.game.bga.players.isCurrentPlayerActive()) {
			if (n >= 2) {
				this.setArg("count", 2);
			} else if (n === 1) {
				this.setArg("count", 1);
			} else {
				this.setArg("count", 0);
			}
		} else {
			this.setArg("count", 0);
		}
	}

	/**
	 * Activate or deactivate this option for interaction
	 * @param b - True to activate (default), false to deactivate
	 */
	public activate(b: boolean = true): void {
		this.setArg("active", b);
	}

	// ========== Private Helper Methods ==========

	/**
	 * Handle option click - performs appropriate action based on parent context
	 *
	 * Actions vary by parent type:
	 *  - Travel: Perform action using travel card (by type or color)
	 *  - BonusActions: Perform bonus action
	 *  - DoubleActions: Perform double action with two travel cards
	 *
	 * @private
	 */
	private async onClick(): Promise<void> {
		switch (this.game.bga.gameui.gamedatas.gamestate.name) {
			case "Action":
				if (this.parent instanceof Travel) {
					// Travel card action: check if specific action (1-3) or stamp color (4+)
					if ((this.args.type as number) <= 3) {
						this.game.bga.actions.performAction("actActionTravel", {
							travel: this.parent.child_id,
						});
					} else {
						this.game.bga.actions.performAction("actActionTravelColor", {
							travel: this.parent.child_id,
						});
					}
					break;
				} else if (this.parent instanceof BonusActions && this.args.active) {
					// Bonus action
					this.game.bga.actions.performAction("actActionBonus", {
						type: this.args.type,
					});
					break;
				} else if (this.parent instanceof DoubleActions) {
					// Double action: two travel cards
					this.game.bga.actions.performAction("actActionDouble", {
						travel_1: (this.parent.parent as Hand).selected_1?.child_id,
						travel_2: (this.parent.parent as Hand).selected_2?.child_id,
						type: this.args.type,
					});
					break;
				}
		}
	}
}