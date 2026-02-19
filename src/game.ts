/**
 *------
 * BGA framework:  Gregory Isabelli <gisabelli@boardgamearena.com> & Emmanuel Colin <ecolin@boardgamearena.com>
 * Postcards implementation : © Tóth Ábel Tibor toth.abel.tibor2@gmail.com
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * postcards.ts
 *
 * Main game controller responsible for:
 *  - Initializing the game UI and state handlers
 *  - Managing game lifecycle (setup, state transitions)
 *  - Handling animations and notifications
 *  - Managing undo/reset functionality
 */

// @ts-ignore
import type { BgaAnimations as BgaAnimationsType } from "../bga-animations";
// @ts-ignore
const BgaAnimations: typeof BgaAnimationsType = await globalThis.importEsmLib('bga-animations', '1.x');
import { ZoomManager } from './framework/thoun/bga-zoom';
import { HelpManager } from "./framework/thoun/bga-help";

import { PossibleActions, sAction } from './states/sAction';
import { sCamp } from './states/sCamp';
import { sConfirm } from './states/sConfirm';
import { sGift } from './states/sGift';
import { sMove } from './states/sMove';
import { sGuide } from './states/sGuide';
import { sPostcard } from './states/sPostcard';
import { sSouvenir } from './states/sSouvenir';
import { sStamp } from './states/sStamp';
import { sStar } from './states/sStar';
import { sTravel } from './states/sTravel';

import { GameElement } from "./gameElement";
import { PostcardSupply } from "./postcard_supply/postcard_supply";
import { PlayerArea } from "./player_area/player_area";
import { PostcardGuide } from "./postcard_guide/postcard_guide";
import { Board } from "./board/board";
import { Hand } from "./player_area/hand/hand";
import { Postcard } from "./cards/postcard/postcard";
import { Notif } from "./notif";

/**
 * Main Game class - orchestrates all game logic and UI
 * 
 * Responsibilities:
 *  - Game initialization and setup
 *  - State registration and lifecycle management
 *  - UI element creation and management
 *  - Notification handling
 *  - Animation orchestration
 */
export class Game {
	// ========== Properties ==========
	
	/** Reference to BGA framework instance */
	public readonly bga: Bga;
	
	/** Current game state data */
	public gamedatas: Gamedatas | null = null;

	/** Mapping of notification UIDs to log element IDs for undo/cancel */
	private readonly _notif_uid_to_log_id: Record<number, number> = {};
	
	/** Mapping of notification UIDs to mobile log element IDs */
	private readonly _notif_uid_to_mobile_log_id: Record<number, number> = {};

	/** Current player ID */
	public player_id: number | null = null;
	
	/** Animation manager for handling game animations */
	public animationManager!: InstanceType<typeof BgaAnimations.Manager>;
	
	/** Root HTML element for game UI */
	public html: HTMLElement | null = null;
	
	/** Registry of game elements by type and ID */
	public readonly c: Record<string, Record<number, GameElement>> = {};
	
	/** Sent postcards counters for each player */
	public sentPostcardsCounters: Counter[] = [];

	// ========== State Handlers ==========
	
	/** State handler for Action phase */
	public sAction!: sAction;
	
	/** State handler for Camp placement */
	public sCamp!: sCamp;
	
	/** State handler for Confirm action */
	public sConfirm!: sConfirm;
	
	/** State handler for Gift selection */
	public sGift!: sGift;
	
	/** State handler for Movement */
	public sMove!: sMove;
	
	/** State handler for Guide postcard selection */
	public sGuide!: sGuide;
	
	/** State handler for Postcard taking */
	public sPostcard!: sPostcard;
	
	/** State handler for Souvenir placement */
	public sSouvenir!: sSouvenir;
	
	/** State handler for Stamp placement */
	public sStamp!: sStamp;
	
	/** State handler for Star effect selection */
	public sStar!: sStar;
	
	/** State handler for Travel card selection */
	public sTravel!: sTravel;

	// ========== Optional UI Elements ==========
	
	/** Last round warning bar */
	public last_round_bar?: HTMLElement;
	
	/** Undo warning bar */
	public undo_bar?: HTMLElement;
	
	/** Take button for guide postcard selection */
	public takeButton?: HTMLButtonElement;
	
	/** Help manager instance */
	public helpManager?: HelpManager;

	/** Zoom manager instance */
	public zoom?: ZoomManager;
	
	/** Title element reference */
	public title?: HTMLElement | null;

	/** Notification handler (for undo/action tracking) */
	private notif: Notif | null = null;
	
	/** Possible actions tracking */
	public possible_actions?: PossibleActions;

	// ========== Constructor ==========
	
	/**
	 * Initialize game with BGA framework
	 * @param bga - BGA framework instance
	 */
	public constructor(bga: Bga<Gamedatas>) {
		this.bga = bga;
		this.setupStates();
		this.setupUndoLogging();
	}

	// ========== Initialization Methods ==========

	/**
	 * Register all game state handlers
	 * @private
	 */
	private setupStates(): void {
		this.sAction = new sAction(this, this.bga);
		this.bga.states.register('Action', this.sAction);
		
		this.sCamp = new sCamp(this, this.bga);
		this.bga.states.register('Camp', this.sCamp);
		
		this.sConfirm = new sConfirm(this, this.bga);
		this.bga.states.register('Confirm', this.sConfirm);
		
		this.sGift = new sGift(this, this.bga);
		this.bga.states.register('Gift', this.sGift);
		
		this.sGuide = new sGuide(this, this.bga);
		this.bga.states.register('Guide', this.sGuide);
		
		this.sMove = new sMove(this, this.bga);
		this.bga.states.register('Move', this.sMove);
		
		this.sPostcard = new sPostcard(this, this.bga);
		this.bga.states.register('Postcard', this.sPostcard);
		
		this.sSouvenir = new sSouvenir(this, this.bga);
		this.bga.states.register('Souvenir', this.sSouvenir);
		
		this.sStamp = new sStamp(this, this.bga);
		this.bga.states.register('Stamp', this.sStamp);
		
		this.sStar = new sStar(this, this.bga);
		this.bga.states.register('Star', this.sStar);
		
		this.sTravel = new sTravel(this, this.bga);
		this.bga.states.register('Travel', this.sTravel);
	}

	/**
	 * Setup undo/cancel log tracking for notifications
	 * Intercepts log placement to map notification UIDs to log IDs
	 * @private
	 */
	private setupUndoLogging(): void {
		const originalOnPlaceLogOnChannel = this.bga.gameui.onPlaceLogOnChannel.bind(this.bga.gameui);
		this.bga.gameui.onPlaceLogOnChannel = (msg: any) => {
			const currentLogId = this.bga.gameui.notifqueue.next_log_id;
			const currentMobileLogId = this.bga.gameui.next_log_id;
			const res = originalOnPlaceLogOnChannel(msg);
			
			this._notif_uid_to_log_id[msg.uid] = currentLogId;
			this._notif_uid_to_mobile_log_id[msg.uid] = currentMobileLogId;
			
			return res;
		};
	}

	/**
	 * Setup game UI - called once at game start
	 * Creates all game elements and initializes managers
	 * @param game_data - Initial game state data
	 */
	public setup(game_data: Gamedatas): void {
		this.preloadImages(game_data);
		this.initializeManagers();
		this.setupPlayerPanels(game_data);
		this.createGameElements(game_data);
		this.setupNotifications();
	}

	/**
	 * Preload required images based on game settings
	 * @param game_data - Game data containing player board configuration
	 * @private
	 */
	private preloadImages(game_data: Gamedatas): void {
		if (game_data.player_board_side) {
			this.bga.images.preloadImage('player_board/player_board_a.jpg');
		} else {
			this.bga.images.preloadImage('player_board/player_board_b.jpg');
		}
	}

	/**
	 * Initialize animation manager and zoom controls
	 * @private
	 */
	private initializeManagers(): void {
		this.animationManager = new BgaAnimations.Manager({
			animationsActive: () => this.bga.gameui.bgaAnimationsActive()
		});
		
		// @ts-ignore - ZoomManager is not strictly typed
		const zoomLevels = Array.from({ length: 20 }, (_, index) => 0.3 + index * 0.05);
        this.zoom = new ZoomManager({
			element: this.bga.gameArea.getElement(),
			localStorageZoomKey: 'postcards-zoom',
			zoomControls: {color: 'black'},
			smooth: false,
			zoomLevels
		});
		
		this.title = document.getElementById('page-title');
	}

	/**
	 * Setup player panel UI elements (sent postcard counters, first player marker)
	 * @param game_data - Game data with player information
	 * @private
	 */
	private setupPlayerPanels(game_data: Gamedatas): void {
		for (const p in game_data.players) {
			const player = game_data.players[p];
			const playerElement = this.bga.playerPanels.getElement(player.id);
			
			// Sent postcards counter
			const counterHtml = document.createElement('sent_postcards_counter');
			playerElement.appendChild(counterHtml);
			this.sentPostcardsCounters[p] = new ebg.counter();
			this.sentPostcardsCounters[p].create(counterHtml, {
				value: player.sent_postcards_counter,
				playerCounter: 'sent_postcards_counter',
				playerId: player.id
			});
			
			// Counter label
			const span = document.createElement('span');
			span.innerHTML = "/4";
			playerElement.appendChild(span);

			// Sent postcards icon
			const sentPostcardsIcon = document.createElement('sent_postcards_text');
			sentPostcardsIcon.innerHTML = "<sent_postcards_icon></sent_postcards_icon>";
			sentPostcardsIcon.id = `sent_postcards_${player.id}`;
			playerElement.appendChild(sentPostcardsIcon);
			this.bga.gameui.addTooltipHtml(
				`sent_postcards_${player.id}`,
				`<h3>${_("Number of sent Postcards")}</h3>`
			);
			
			// First player marker
			if (player.player_no === 1) {
				const firstPlayerMarker = document.createElement('first_player_marker');
				firstPlayerMarker.id = "first_player_marker";
				playerElement.appendChild(firstPlayerMarker);
				this.bga.gameui.addTooltipHtml(
					"first_player_marker",
					`<h3>${_("First Player Token")}</h3>`
				);
			}
		}
	}

	/**
	 * Create main game elements (board, player areas, supply, etc.)
	 * @param game_data - Game data
	 * @private
	 */
	private createGameElements(game_data: Gamedatas): void {
		// Create root element
		this.bga.gameArea.getElement().insertAdjacentHTML('beforeend', '<postcards id="postcards"></postcards>');
		this.html = document.getElementById('postcards');
		
		if (!this.html) {
			throw new Error('Failed to create postcards root element');
		}

		// Postcard supply
		new PostcardSupply(this, 0, game_data.postcard_supply);
		
		// Guide (appears during guide phase)
		if (game_data.postcard_guide.length !== 0) {
			new PostcardGuide(this, 0, game_data.postcard_guide);
		}
		
		// Current player's area (with hand and bonus actions)
		if (!this.bga.players.isCurrentPlayerSpectator()) {
			const currentPlayer = game_data.players[this.bga.gameui.player_id];
			new PlayerArea(this, currentPlayer.id, {
				...currentPlayer,
				end_bonus: game_data.end_bonus,
				hand: game_data.hand,
				bonus_actions: game_data.bonus_actions,
				player_board_side: game_data.player_board_side
			});
		}
		
		// Main board
		new Board(this, 0, {
			players: game_data.players,
			travels: game_data.travel_supply,
			gifts: game_data.gift_supply,
			end_bonus: game_data.end_bonus === undefined
		});
		
		// Other players' areas
		const otherPlayers = this.getOrderedOtherPlayers(game_data.players);
		for (const player of otherPlayers) {
			new PlayerArea(this, player.id, {
				...player,
				end_bonus: game_data.end_bonus,
				player_board_side: game_data.player_board_side
			});
		}
		
		// Easter egg
		if (this.bga.gameui.player_id === 92894721) {
			this.createBar("love", "Szeretlek <3 (Hihi)");
		}
	}

	/**
	 * Setup notification handlers for game events
	 * @private
	 */
	private setupNotifications(): void {
		this.notif = new Notif(this);
		this.bga.notifications.setupPromiseNotifications({
			minDuration: 0,
			minDurationNoText: 0,
			handlers: [this.notif],
			onStart: (notfname: string, msg: any, args: any) => {
				const pagemaintitle = document.getElementById("pagemaintitle_wrap");
				if (pagemaintitle) pagemaintitle.style.display = "none";
				
				const gameaction = document.getElementById("gameaction_status_wrap");
				if (gameaction) gameaction.style.display = "block";
			}
		});
	}

	// ========== State Lifecycle ==========

	/**
	 * Called when entering a game state
	 * Updates UI based on state data and used travels
	 * @param stateName - Name of the state being entered
	 * @param args - State arguments
	 */
	public onEnteringState(stateName: string, args: any): void {
		if (this.bga.players.isCurrentPlayerActive() && args.args?.used_travels !== undefined) {
			const hand = this.c.player_area?.[this.bga.gameui.player_id]?.c.hand?.[0] as Hand | undefined;
			if (hand) {
				hand.usedTravels(args.args.used_travels);
			}
		}
		
		if (args.args?.last_round) {
			this.last_round_bar = this.createBar("last_round", _("This is the last round of the game!"));
		}
	}

	/**
	 * Called when leaving a game state
	 * Cleans up state-specific UI
	 * @param stateName - Name of the state being left
	 */
	public onLeavingState(stateName: string): void {
		if (this.bga.players.isCurrentPlayerActive()) {
			const hand = this.c.player_area?.[this.bga.gameui.player_id]?.c.hand?.[0] as Hand | undefined;
			if (hand) {
				hand.unusedAllTravels();
			}
		}
		
		if (this.last_round_bar) {
			this.last_round_bar.remove();
			delete this.last_round_bar;
		}
	}

	// ========== UI Helper Methods ==========

	/**
	 * Add undo/reset buttons to status bar
	 * @param undo - Number of undo steps available (0, 1, or 2+)
	 */
	public addUndoButtons(undo: number): void {
		if (undo > 0) {
			this.bga.statusBar.addActionButton(
				_("Undo"),
				() => { this.bga.actions.performAction('actUndo'); },
				{ color: "alert" }
			);
		}
		
		if (undo > 1) {
			this.bga.statusBar.addActionButton(
				_("Reset"),
				() => { this.bga.actions.performAction('actReset'); },
				{ color: "alert" }
			);
		}
	}

	/**
	 * Cancel notification logs for undo functionality
	 * Marks logs with cancel attribute to hide them visually
	 * @param notifIds - Array of notification UIDs to cancel
	 */
	public cancelLogs(notifIds: number[]): void {
		notifIds.forEach((uid: number) => {
			if (uid in this._notif_uid_to_log_id) {
				const logId = this._notif_uid_to_log_id[uid];
				const logElement = document.getElementById('log_' + logId);
				if (logElement) {
					logElement.setAttribute("cancel", "true");
				}
			}
			
			if (uid in this._notif_uid_to_mobile_log_id) {
				const mobileLogId = this._notif_uid_to_mobile_log_id[uid];
				const mobileElement = document.getElementById('dockedlog_' + mobileLogId);
				if (mobileElement) {
					mobileElement.setAttribute("cancel", "true");
				}
			}
		});
	}

	/**
	 * Create a status bar notification (e.g., "Last Round", "Undo Warning")
	 * @param type - Bar type for styling (e.g., "warning", "last_round", "love")
	 * @param text - Text content to display
	 * @returns The created bar element
	 */
	public createBar(type: string, text: string): HTMLElement {
		const element = document.createElement("div");
		element.className = "bar";
		element.innerHTML = text;
		element.setAttribute("type", type);
		
		if (!this.title) {
			throw new Error('Title element not found');
		}
		
		this.title.appendChild(element);
		return element;
	}

	// ========== Game Logic Methods ==========

	/**
	 * Reveal guide postcard selection phase
	 * Slides in postcards from deck and displays guide interface
	 * @param deck - Top card ID from deck (null if no top card)
	 * @param postcards - Array of postcard IDs to display
	 */
	public async revealGuidePostcards(deck: number | null, postcards: number[]): Promise<void> {
		new PostcardGuide(this, 0);
		
		const supply = this.c.postcard_supply?.[0] as PostcardSupply | undefined;
		if (!supply) {
			throw new Error('Postcard supply not found');
		}
		
		const topCard = supply.removePostcardFromTop();
		let deckCard: Postcard | null = null;
		
		if (deck !== null) {
			deckCard = supply.addPostcardToTop(deck);
		}
		
		const guide = this.c.postcard_guide?.[0] as PostcardGuide | undefined;
		if (!guide) {
			throw new Error('Postcard guide not found');
		}
		
		supply.html.after(guide.html);
		await guide.slideInPostcards(postcards, topCard, deckCard);
	}

	// ========== Private Helper Methods ==========

	/**
	 * Get players in turn order starting after current player
	 * Used to arrange player areas in visual order
	 * @param players - Object mapping player IDs to player data
	 * @returns Ordered array of players
	 * @private
	 */
	private getOrderedOtherPlayers(players: Record<number, Player>): Player[] {
		let ordered = Object.values(players).sort((a: Player, b: Player) => a.player_no - b.player_no);
		
        if (!this.bga.players.isCurrentPlayerSpectator()) {
            const currentPlayerIndex = ordered.findIndex((p: Player) => p.id === this.bga.gameui.player_id);
            ordered = [...ordered.slice(currentPlayerIndex), ...ordered.slice(0, currentPlayerIndex)];
            return ordered.filter((p: Player) => p.id !== this.bga.gameui.player_id);
        }
		else return ordered;
	}
}