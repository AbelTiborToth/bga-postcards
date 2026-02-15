import { Board } from "../../board/board";
import { GameElement } from "../../gameElement";
import { Hand } from "../../player_area/hand/hand";
import { TravelOption } from "./travel_option/travel_option";

/**
 * Represents a single Travel card
 * 
 * Travel cards are played during the Action phase to perform one of three actions:
 * Movement, Postcard taking, or Camp placement. Can also be used to place stamps.
 * Two cards can be played together to act as any other card.
 * 
 * Responsibilities:
 *  - Managing card activation and selection state
 *  - Handling click interactions for card selection
 *  - Managing action buttons for double actions and stamp placement
 *  - Displaying card type and color information
 *  - Providing tooltip with detailed rules
 */
export class Travel extends GameElement {
	// ========== Constructor ==========

	/**
	 * Initialize a Travel card
	 * @param parent - Parent GameElement (Board or Hand)
	 * @param child_id - Card ID
	 * @param location - Optional location on board (null if in hand)
	 */
	public constructor(parent: Board | Hand, child_id: number, location: number | null = null) {
		if (location !== null) super(parent, child_id, "travel", { location: location, active: false });
        else super(parent, child_id, "travel", { active: false });

		// Calculate card type from child_id (determines action: Movement, Postcard, or Camp)
		this.setArg("type", (this.getOptionType() - 1) * 4 + this.getColorType());

		// Register click handler
		$(`postcards_${this.id}`).addEventListener('click', () => this.onClick());

		// Setup tooltip
		this.setupTooltip();
	}

	// ========== Public Methods ==========

	/**
	 * Activate or deactivate this travel card for selection
	 * @param b - True to activate (default), false to deactivate
	 */
	public activate(b: boolean = true): void {
		this.setArg("active", b);
	}

	/**
	 * Mark card as used/unused during current turn
	 * @param b - True to mark as used (default), false to mark as unused
	 */
	public used(b: boolean = true): void {
		const s = b ? "used" : false;
		this.setArg("active", s);
	}

	/**
	 * Remove action buttons (called when deselecting)
	 */
	public removeButtons(): void {
		if (this.c.travel_option !== undefined) {
			if (this.c.travel_option[0] !== undefined) this.c.travel_option[0].html.remove();
			if (this.c.travel_option[1] !== undefined) this.c.travel_option[1].html.remove();
			delete this.c.travel_option;
		}
	}

	// ========== Private Helper Methods ==========

	/**
	 * Handle card click - manages selection and double action logic
	 * 
	 * During Action phase:
	 *  - First click: Select as primary action
	 *  - Second click on same: Deselect
	 *  - Second click on different: Select as double action
	 * 
	 * During Travel phase:
	 *  - Click: Play card from supply
	 * 
	 * @private
	 */
	private async onClick(): Promise<void> {
		if (
			this.game.bga.players.isCurrentPlayerActive() &&
			(this.args.active === true || this.args.active === "selected")
		) {
			switch (this.game.bga.gameui.gamedatas.gamestate.name) {
				case 'Action':
					if (this.parent instanceof Hand) {
                        if (this.game.possible_actions?.double) {
                            if ((this.parent as Hand).selected_1 === undefined) {
                                    this.addButtons();
                                    this.setArg("active", "selected");
						    	(this.parent as Hand).selected_1 = this;
						    } else if (
						    	(this.parent as Hand).selected_1 === this &&
						    	(this.parent as Hand).selected_2 === undefined
						    ) {
                                this.setArg("active", true);
						    	this.removeButtons();
						    	(this.parent as Hand).selected_1 = undefined;
						    } else if ((this.parent as Hand).selected_1 === this) {
                                (this.parent as Hand).setArg("double", false);
						    	this.setArg("active", true);
						    	(this.parent as Hand).selected_1 = (this.parent as Hand).selected_2;
						    	(this.parent as Hand).selected_2 = undefined;
						    	(this.parent as Hand).selected_1!.addButtons();
						    } else if ((this.parent as Hand).selected_2 === this) {
                                (this.parent as Hand).setArg("double", false);
						    	this.setArg("active", true);
						    	(this.parent as Hand).selected_2 = undefined;
						    	(this.parent as Hand).selected_1!.addButtons();
						    } else if ((this.parent as Hand).selected_2 === undefined) {
                                (this.parent as Hand).setArg("double", true);
						    	this.setArg("active", "selected");
						    	(this.parent as Hand).selected_2 = this;
						    	(this.parent as Hand).selected_1!.removeButtons();
						    } else {
                                (this.parent as Hand).selected_1!.setArg("active", true);
						    	(this.parent as Hand).selected_1 = (this.parent as Hand).selected_2;
						    	this.setArg("active", "selected");
						    	(this.parent as Hand).selected_2 = this;
						    }
                        } else {
                            if ((this.parent as Hand).selected_1 === undefined) {
                                this.addButtons();
                                this.setArg("active", "selected");
						    	(this.parent as Hand).selected_1 = this;
						    } else if ((this.parent as Hand).selected_1 === this) {
						    	(this.parent as Hand).selected_1!.setArg("active", true);
						    	(this.parent as Hand).selected_1!.removeButtons();
						    	(this.parent as Hand).selected_1 = undefined;
						    } else {
						    	(this.parent as Hand).selected_1!.setArg("active", true);
						    	(this.parent as Hand).selected_1!.removeButtons();
						    	(this.parent as Hand).selected_1 = undefined;
                                this.addButtons();
                                this.setArg("active", "selected");
						    	(this.parent as Hand).selected_1 = this;
                            }
                        }
					}
					break;
				case 'Travel':
					this.game.bga.actions.performAction('actTravel', { travel: this.child_id });
					break;
			}
		}
	}

	/**
	 * Get the color type of this card (determines stamp color)
	 * @returns Color type 1-4
	 * @private
	 */
	private getColorType(): number {
		return (Math.floor((this.child_id - 1) / 6) % 4) + 1;
	}

	/**
	 * Get the option type of this card (determines action type)
	 * @returns Option type 1-3 (Movement, Postcard, Camp)
	 * @private
	 */
	private getOptionType(): number {
		return Math.floor((this.child_id - 1) / 24) + 1;
	}

	/**
	 * Add action buttons when card is selected
	 * 
	 * Creates buttons for:
	 *  - Action button (if available based on card type)
	 *  - Stamp button (if stamp is available in card color)
	 * 
	 * @private
	 */
	private addButtons(): void {
		const type: number = this.getOptionType();
		if (
			type === 1 ||
			(type === 2 && this.game.possible_actions?.postcard) ||
			(type === 3 && this.game.possible_actions?.camp)
		) {
			new TravelOption(this, 0, this.getOptionType());
		}
		const color: number = this.getColorType();
		if (this.game.possible_actions?.stamp[color]) {
			new TravelOption(this, 1, this.getColorType() + 4);
		}
	}

	/**
	 * Setup tooltip with detailed card rules and actions
	 * 
	 * Displays:
	 *  - General travel card rules
	 *  - Action-specific information (Movement, Postcard, Camp)
	 *  - Stamp placement rules
	 *  - Double action rules
	 * 
	 * @private
	 */
	private setupTooltip(): void {
		this.game.bga.gameui.addTooltipHtml(
			`postcards_${this.id}`,
			`<tooltip>
				<h3>${_("Travel Card")}</h3>
				<p>${_("During your turn, you must play 3 Travel cards from your hand. For each card played, you must choose between Taking an Action or Sticking a Stamp. Play each card one at a time in front of you to keep track of how many you have played. At the end of your turn, discard all your played Travel cards.")}</p>
				<h4>${_("Taking An Action")}</h4>
				<p>${_("The action of a Travel card is defined by its symbol. There are 3 types: Movement, Postcard, and Camp. When taking an action, the color of the card is ignored.")}</p>
				${this.getSpecificTooltip()}
				<h4>${_("Sticking A Stamp")}</h4>
				<p>${_("Any Travel card can be used to place a stamp. When sticking a stamp, the symbol on the card is ignored.")}</p>
				<p>${_("Take a Stamp token from the supply and place it on an available Stamp space, on any of your postcards, that matches the color of the Travel card you played.")}</p>
				<h4>${_("Play Two Travel Cards")}</h4>
				<p>${_("You can play 2 Travel cards of your choice to act as any other Travel card. This counts as 2 Travel cards towards your total of 3 Travel cards played.")}</p>
			</tooltip>`
		);
	}

	/**
	 * Get action-specific tooltip text based on card type
	 * 
	 * @returns HTML string with action-specific rules
	 * @private
	 */
	private getSpecificTooltip(): string {
		switch (this.getOptionType()) {
			case 1:
				return `<h4>${_("Movement Action")}</h4>
					<p>${_("Move your Biker to a region adjacent to the one you are in.")}</p>`;
			case 2:
				return `<h4>${_("Postcard Action")}</h4>
					<p>${_("Take an available postcard. You may choose the top postcard from the deck or 1 of the 3 postcards next to it. Before taking a postcard, you may discard the 3 next to the deck and draw 3 new ones to replace them. When you take a postcard next to the deck, immediately fill the empty space with the top postcard from the deck.")}</p>`;
			case 3:
				return `<h4>${_("Camp action")}</h4>
					<p>${_("Take the leftmost available Camp token from your player board and place it on an available campsite in the region you are in. If its type matches an available Souvenir space on one of your postcards, you may take a Souvenir token from the supply and place it on that Souvenir space. This immediately grants you an effect.")}</p>`;
		}
		return ``;
	}
}