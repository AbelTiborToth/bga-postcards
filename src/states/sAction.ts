import { Gift } from "../cards/gift/gift";
import { Postcard } from "../cards/postcard/postcard";
import { Game } from "../game";
import { BonusActions } from "../player_area/bonus_actions/bonus_actions";
import { GiftPlayer } from "../player_area/gift_player/gift_player";
import { DoubleActions } from "../player_area/hand/double_actions/double_actions";
import { Hand } from "../player_area/hand/hand";
import { PostcardPlayer } from "../player_area/postcard_player/postcard_player";

export interface PossibleActions {
    postcard: boolean;
    camp: boolean;
    bonus: {
        move: boolean;
        postcard: boolean;
        camp: boolean;
    };
    stamp: Record<number | string, boolean>;
    double: boolean;
}

/**
 * Arguments passed to the Action state
 */
interface ActionStateArgs {
	/** Array of travel card indices that have been used */
	used_travels: number[];
	
	/** Maximum number of travel cards allowed to be played */
	max_travels: number;
	
	/** Indices of postcards that can be sent */
	send: number[];
	
	/** Indices of gift cards that can be played */
	gifts: number[];
	
	/** Available bonus actions (move, postcard, camp, stamp) */
	possible_actions: PossibleActions;
	
	/** Number of undo steps available */
	undo: number;
}

/**
 * Handles the "Action" game state
 * 
 * This is the main turn phase where players play Travel cards and take actions.
 * 
 * Responsibilities:
 *  - Activating playable cards and actions
 *  - Setting the dynamic status bar title based on available actions
 *  - Cleaning up UI when leaving the state
 *  - Managing bonus actions, travel cards, postcards, and gifts
 * 
 * Available actions during this phase:
 *  - Play a Travel card (Movement, Postcard, or Camp action)
 *  - Use a Bonus action (if available)
 *  - Send a Postcard (if conditions are met)
 *  - Play a Gift card (if available)
 *  - Skip (if 3 or more travel cards have been played)
 */
export class sAction {
	// ========== Properties ==========

	/** Reference to the main Game instance */
	private readonly game: Game;

	/** Reference to BGA framework instance */
	private readonly bga: Bga;

	// ========== Constructor ==========

	/**
	 * Initialize the Action state handler
	 * @param game - Main game instance
	 * @param bga - BGA framework instance
	 */
	public constructor(game: Game, bga: Bga) {
		this.game = game;
		this.bga = bga;
	}

	// ========== State Lifecycle Methods ==========

	/**
	 * Called when entering the Action state
	 * 
	 * Actions:
	 *  - Updates the status bar with current action options
	 *  - Activates playable Travel cards and Bonus actions
	 *  - Activates sendable Postcards and playable Gift cards
	 *  - Adds Skip button if 3 cards have been played
	 *  - Adds undo/reset buttons if available
	 * 
	 * @param args - State arguments containing possible actions and playable cards
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onEnteringState(args: ActionStateArgs, isCurrentPlayerActive: boolean): void {
		this.setTitle(args, isCurrentPlayerActive);
		if (!isCurrentPlayerActive) return;

		this.game.possible_actions = args.possible_actions;
        this.game.possible_actions.double = args.used_travels.length < args.max_travels - 1;

		const playerId = this.bga.gameui.player_id;
		const playerArea = this.game.c.player_area?.[playerId];
        
		const bonusActions: BonusActions = playerArea.c.bonus_actions?.[0] as BonusActions;
		const doubleActions: DoubleActions = playerArea.c.hand?.[0].c.double_actions?.[0] as DoubleActions;
		const hand: Hand = playerArea.c.hand?.[0] as Hand;
		const postcardPlayer: PostcardPlayer = playerArea.c.postcard_player?.[0] as PostcardPlayer;
		const giftPlayer: GiftPlayer = playerArea.c.gift_player?.[0] as GiftPlayer;

		// Activate bonus actions
		bonusActions.activateBonusActions();
        
        doubleActions.activate(
            args.possible_actions.postcard,
            args.possible_actions.camp,
            args.possible_actions.stamp.all
        );
		
		if (args.used_travels.length !== args.max_travels) {
			hand?.activateTravelsExcept(args.used_travels);
		}
		
		for (const index of args.send) {
			(postcardPlayer.c.postcard?.[index] as Postcard).activate();
		}
		
		for (const index of args.gifts) {
			(giftPlayer.c.gift?.[index] as Gift).activate();
		}

		// Add Skip button if all travel cards have been played
		if (args.used_travels.length >= 3) {
			this.bga.statusBar.addActionButton(_("Skip"), () => this.bga.actions.performAction("actSkip"));
		}

		this.game.addUndoButtons(args.undo);
	}

	/**
	 * Called when leaving the Action state
	 * 
	 * Cleans up:
	 *  - Deactivates all Travel cards
	 *  - Resets used Travel cards
	 *  - Deactivates Bonus actions
	 *  - Deactivates Postcards and Gift cards
	 *  - Removes undo warning bar if present
	 * 
	 * @param args - State arguments (unused)
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 */
	public onLeavingState(args: ActionStateArgs, isCurrentPlayerActive: boolean): void {
		if (!isCurrentPlayerActive) return;

		const playerId = this.bga.gameui.player_id;
		const playerArea = this.game.c.player_area?.[playerId];

		if (!playerArea) return;

		const hand: Hand = playerArea.c.hand?.[0] as Hand;
		const bonusActions: BonusActions = playerArea.c.bonus_actions?.[0] as BonusActions;
		const postcardPlayer: PostcardPlayer = playerArea.c.postcard_player?.[0] as PostcardPlayer;
		const giftPlayer: GiftPlayer = playerArea.c.gift_player?.[0] as GiftPlayer;

		hand?.unusedAllTravels();
		delete this.game.possible_actions;
		bonusActions?.inactivateBonusActions();
		hand?.inactivateAllTravels();
		postcardPlayer?.activatePostcards(false);
		giftPlayer?.activateGifts(false);

		if (this.game.undo_bar !== undefined) {
			this.game.undo_bar.remove();
			delete this.game.undo_bar;
		}
	}

	// ========== Private Helper Methods ==========

	/**
	 * Computes and sets the dynamic title shown in the status bar
	 * 
	 * The title indicates:
	 *  - Whether the player must or can play a Travel card
	 *  - Available bonus actions
	 *  - Available postcard sending
	 *  - Available gift cards
	 * 
	 * Generates appropriate text based on:
	 *  - Number of travel cards played (0-2 = must, 3+ = can)
	 *  - Bonus action availability (move, postcard, or camp)
	 *  - Postcard send availability (any sendable postcards)
	 *  - Gift card availability (any playable gifts)
	 * 
	 * @param args - State arguments containing action availability and travel progress
	 * @param isCurrentPlayerActive - Whether this is the current active player
	 * @private
	 */
	private setTitle(args: ActionStateArgs, isCurrentPlayerActive: boolean): void {
		const travel = args.used_travels.length !== args.max_travels;
		const bonus =
			args.possible_actions.bonus.move ||
			args.possible_actions.bonus.postcard ||
			args.possible_actions.bonus.camp;
		const send = args.send.length > 0;
		const gift = args.gifts.length > 0;
		let title = isCurrentPlayerActive
			? _("${you} must play a Travel card")
			: _("${actplayer} must play a Travel card");

		// Build title based on available options
		if (travel) {
			if (args.used_travels.length >= 3) {
				if (bonus && send && gift)
					title = isCurrentPlayerActive
						? _("${you} can play a Travel card, use a Bonus action, send a Postcard or play a Gift card")
						: _("${actplayer} can play a Travel card, use a Bonus action, send a Postcard or play a Gift card");
				else if (bonus && send)
					title = isCurrentPlayerActive
						? _("${you} can play a Travel card, use a Bonus action or send a Postcard")
						: _("${actplayer} can play a Travel card, use a Bonus action or send a Postcard");
				else if (bonus && gift)
					title = isCurrentPlayerActive
						? _("${you} can play a Travel card, use a Bonus action or play a Gift card")
						: _("${actplayer} can play a Travel card, use a Bonus action or play a Gift card");
				else if (send && gift)
					title = isCurrentPlayerActive
						? _("${you} can play a Travel card, send a Postcard or play a Gift card")
						: _("${actplayer} can play a Travel card, send a Postcard or play a Gift card");
				else if (bonus)
					title = isCurrentPlayerActive
						? _("${you} can play a Travel card or use a Bonus action")
						: _("${actplayer} can play a Travel card or use a Bonus action");
				else if (send)
					title = isCurrentPlayerActive
						? _("${you} can play a Travel card or send a Postcard")
						: _("${actplayer} can play a Travel card or send a Postcard");
				else if (gift)
					title = isCurrentPlayerActive
						? _("${you} can play a Travel card or play a Gift card")
						: _("${actplayer} can play a Travel card or play a Gift card");
			} else {
				if (bonus && send && gift)
					title = isCurrentPlayerActive
						? _("${you} must play a Travel card, use a Bonus action, send a Postcard or play a Gift card")
						: _("${actplayer} must play a Travel card, use a Bonus action, send a Postcard or play a Gift card");
				else if (bonus && send)
					title = isCurrentPlayerActive
						? _("${you} must play a Travel card, use a Bonus action or send a Postcard")
						: _("${actplayer} must play a Travel card, use a Bonus action or send a Postcard");
				else if (bonus && gift)
					title = isCurrentPlayerActive
						? _("${you} must play a Travel card, use a Bonus action or play a Gift card")
						: _("${actplayer} must play a Travel card, use a Bonus action or play a Gift card");
				else if (send && gift)
					title = isCurrentPlayerActive
						? _("${you} must play a Travel card, send a Postcard or play a Gift card")
						: _("${actplayer} must play a Travel card, send a Postcard or play a Gift card");
				else if (bonus)
					title = isCurrentPlayerActive
						? _("${you} must play a Travel card or use a Bonus action")
						: _("${actplayer} must play a Travel card or use a Bonus action");
				else if (send)
					title = isCurrentPlayerActive
						? _("${you} must play a Travel card or send a Postcard")
						: _("${actplayer} must play a Travel card or send a Postcard");
				else if (gift)
					title = isCurrentPlayerActive
						? _("${you} must play a Travel card or play a Gift card")
						: _("${actplayer} must play a Travel card or play a Gift card");
			}
		} else {
			if (bonus && send && gift)
				title = isCurrentPlayerActive
					? _("${you} can use a Bonus action, send a Postcard or play a Gift card")
					: _("${actplayer} can use a Bonus action, send a Postcard or play a Gift card");
			else if (bonus && send)
				title = isCurrentPlayerActive
					? _("${you} can use a Bonus action or send a Postcard")
					: _("${actplayer} can use a Bonus action or send a Postcard");
			else if (bonus && gift)
				title = isCurrentPlayerActive
					? _("${you} can use a Bonus action or play a Gift card")
					: _("${actplayer} can use a Bonus action or play a Gift card");
			else if (send && gift)
				title = isCurrentPlayerActive
					? _("${you} can send a Postcard or play a Gift card")
					: _("${actplayer} can send a Postcard or play a Gift card");
			else if (bonus)
				title = isCurrentPlayerActive
					? _("${you} can use a Bonus action")
					: _("${actplayer} can use a Bonus action");
			else if (send)
				title = isCurrentPlayerActive
					? _("${you} can send a Postcard")
					: _("${actplayer} can send a Postcard");
			else if (gift)
				title = isCurrentPlayerActive
					? _("${you} can play a Gift card")
					: _("${actplayer} can play a Gift card");
		}

		const formattedTitle = this.bga.gameui.format_string("${title} ${used_travels}", {
			title,
			used_travels: `(${args.used_travels.length}/${args.max_travels})`,
		});
		this.bga.statusBar.setTitle(formattedTitle, args);
	}
}