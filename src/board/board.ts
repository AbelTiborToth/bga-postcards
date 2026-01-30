import { Game } from "../game";
import { GameElement } from "../gameElement";
import { DeckStack } from "./deck_stack/deck_stack";
import { Biker } from "./biker/biker";
import { Region } from "./region/region";
import { Campsite } from "./campsite/campsite";
import { TravelDeck } from "./travel_deck/travel_deck";
import { StampSupply } from "./stamp_supply/stamp_supply";
import { GiftDeck } from "./gift_deck/gift_deck";
import { EndGameBonus } from "./end_game_bonus/end_game_bonus";
import { Travel } from "../cards/travel/travel";
import { Gift } from "../cards/gift/gift";
import { Camp } from "../camp/camp";
import { HelpManager, BgaHelpExpandableButton } from "../framework/thoun/bga-help";

/**
 * Manages the main game board
 * 
 * Contains all board elements including regions, campsites, bikers, travel supply,
 * gift supply, stamp supply, and various UI helpers.
 * 
 * Responsibilities:
 *  - Creating and managing board layout (regions, campsites)
 *  - Managing biker positions and movement
 *  - Managing travel card supply and deck
 *  - Managing gift card supply and deck
 *  - Managing stamp supply
 *  - Activating/deactivating regions and campsites
 *  - Managing camp placement and tracking
 *  - Providing help interface for camp tracking
 */
export class Board extends GameElement {
	// ========== Properties ==========

	/** Counter for remaining travels in supply (optional) */
	private travels_counter?: Counter;

	/** Counter for discarded travels (optional) */
	private travels_discard_counter?: Counter;

	/** Counter for remaining gifts in supply (optional) */
	private gifts_counter?: Counter;

	/** Mapping of region to campsite types */
	public campsites: number[][];

	/** Camp counters for tracking camps by player and type */
	public camp_counters: Record<number, Record<number, HTMLElement>> = {};

	// ========== Constructor ==========

	/**
	 * Initialize the board with all elements
	 * @param parent - Parent Game instance
	 * @param child_id - Element ID
	 * @param data - Board data containing players, travels, gifts, and initial state
	 */
	public constructor(parent: Game, child_id: number, data: any) {
		super(parent, child_id, "board");

		// Setup Regions
		for (let i = 0; i <= 13; i++) {
			new Region(this, i, i);
		}

		// Setup campsites with type mappings
		this.campsites = [
			[1, 3, 3],
			[8, 4, 7, 2, 5],
			[2, 1, 4, 6],
			[5, 6, 4, 3],
			[2, 6, 6, 4, 3],
			[5, 3, 7, 8],
			[8, 4, 6, 7],
			[2, 1, 8, 6, 3, 6],
			[2, 4, 5, 7, 8],
			[1, 1, 5],
			[4, 1, 2, 3, 7],
			[7, 1, 8, 5],
			[8, 7, 5, 2],
		];

		for (let r = 1; r <= this.campsites.length; r++) {
			const region = this.campsites[r - 1];
			for (let l = 1; l <= region.length; l++) {
				const t = region[l - 1];
				const id = r * 10 + l;
				new Campsite(this, id, t, r, l);
			}
		}

		// Setup Bikers and Camps
		this.setupCampHelp(data);
		for (const p in data.players) {
			new Biker(
				this,
				data.players[p].id,
				data.players[p].color,
				data.players[p].biker,
				data.players[p].id === this.game.bga.gameui.player_id
			);
			for (const c in data.players[p].camps) {
				const region = data.players[p].camps[c].region;
				const campsite = data.players[p].camps[c].location;
				new Camp(this, region * 10 + campsite, data.players[p].color, 0, region, campsite);
				this.camp_counters[data.players[p].id][this.campsites[region - 1][campsite - 1]].innerHTML = String(
					Number(this.camp_counters[data.players[p].id][this.campsites[region - 1][campsite - 1]].innerHTML) + 1
				);
			}
		}

		// Setup travel supply
		for (const t in data.travels.travels) {
			new Travel(this, data.travels.travels[t].type, data.travels.travels[t].location);
		}

		if (this.game.bga.userPreferences.get(101) === 1) {
			const travels_counter_html = document.createElement("travels_counter");
			this.html.appendChild(travels_counter_html);
			this.travels_counter = new ebg.counter();
			this.travels_counter.create(travels_counter_html, {
				value: data.travels.travels_counter,
				tableCounter: 'travels_counter'
			});
			const travels_discard_counter_html = document.createElement("travels_discard_counter");
			this.html.appendChild(travels_discard_counter_html);
			this.travels_discard_counter = new ebg.counter();
			this.travels_discard_counter.create(travels_discard_counter_html, {
				value: data.travels.travels_discard_counter,
				tableCounter: 'travels_discard_counter'
			});
		}

		if (data.travels.travels_counter === 2) {
			this.setArg("travels_count", 2);
		} else if (data.travels.travels_counter === 1) {
			this.setArg("travels_count", 1);
		}

		new DeckStack(this, 0, 0);

		if (data.travels.travels_counter === 2) {
			(this.game.c.board[0].c.deck_stack[0] as DeckStack).setArg("count", 2);
		} else if (data.travels.travels_counter === 1) {
			(this.game.c.board[0].c.deck_stack[0] as DeckStack).setArg("count", 1);
		}

		new TravelDeck(this, 0);

		// Setup gift supply
		for (const g in data.gifts.gifts) {
			new Gift(this, data.gifts.gifts[g].type, data.gifts.gifts[g].location);
		}

		if (this.game.bga.userPreferences.get(101) === 1) {
			const gifts_counter_html = document.createElement("gifts_counter");
			this.html.appendChild(gifts_counter_html);
			this.gifts_counter = new ebg.counter();
			this.gifts_counter.create(gifts_counter_html, {
				value: data.gifts.gifts_counter,
				tableCounter: 'gifts_counter'
			});
		}

		if (data.gifts.gifts_counter === 2) {
			this.setArg("gifts_count", 2);
		} else if (data.gifts.gifts_counter === 1) {
			this.setArg("gifts_count", 1);
		}

		new DeckStack(this, 1, 1);

		new GiftDeck(this, 0);

		// Setup stamp supply
		new StampSupply(this, 0);

		if (data.end_bonus) {
			new EndGameBonus(this, 0);
		}
	}

	// ========== Region Management Methods ==========

	/**
	 * Set biker position to a specific region
	 * @param region - Region number to move biker to
	 */
	public setBikerRegion(region: number): void {
		(this.c.region[region] as Region).setBiker();
	}

	/**
	 * Activate specific regions for player interaction
	 * @param regions - Array of region numbers to activate
	 */
	public activateRegions(regions: any): void {
		for (const r of regions) {
			(this.c.region[r] as Region).activate();
		}
	}

	/**
	 * Deactivate all regions
	 */
	public inactivateAllRegions(): void {
		for (const r in this.c.region) {
			(this.c.region[r] as Region).activate(false);
		}
	}

	/**
	 * Animate biker movement to a new region
	 * @param player_id - Player whose biker is moving
	 * @param region - Destination region
	 * @returns Promise resolving when animation completes
	 */
	public async moveBiker(player_id: number, region: number): Promise<void> {
		(this.c.biker[player_id] as Biker).move(region);
		return await new Promise((resolve) => setTimeout(resolve, 800));
	}

	// ========== Campsite Management Methods ==========

	/**
	 * Activate specific campsites for camp placement
	 * @param region - Region containing campsites
	 * @param campsites - Array of campsite numbers to activate
	 */
	public activateCampsites(region: number, campsites: number[]): void {
		for (const i in campsites) {
			(this.c.campsite[region * 10 + campsites[i]] as Campsite).activate();
		}
	}

	/**
	 * Deactivate all campsites
	 */
	public inactivateAllCampsites(): void {
		for (const i in this.c.campsite) {
			(this.c.campsite[i] as Campsite).activate(false);
		}
	}

	/**
	 * Animate adding a camp to a campsite
	 * 
	 * Updates camp counter and animates camp placement with rotation based on location.
	 * 
	 * @param camp - Camp token to place
	 * @param player_id - Player placing the camp
	 * @param region - Target region
	 * @param campsite - Target campsite within region
	 * @returns Promise resolving when animation completes
	 */
	public async addCamp(camp: Camp, player_id: number, region: number, campsite: number): Promise<void> {
		this.camp_counters[player_id][this.campsites[region - 1][campsite - 1]].innerHTML = String(
			Number(this.camp_counters[player_id][this.campsites[region - 1][campsite - 1]].innerHTML) + 1
		);
		camp.addToParent(this, region * 10 + campsite);
		camp.setArg("region", region);
		camp.setArg("campsite", campsite);

		let rotate: number = 0;
		switch (camp.args.location) {
			case 1:
			case 2:
				rotate = 90;
				break;
			case 3:
				rotate = 45;
				break;
			case 10:
				rotate = -45;
				break;
			case 11:
			case 12:
			case 13:
				rotate = -90;
				break;
		}

		await this.game.animationManager.slideAndAttach(camp.html, this.html, {
			duration: 800,
			fromPlaceholder: "off",
			toPlaceholder: "off",
			parallelAnimations: [
				{
					keyframes: [{ rotate: `${rotate}deg` }, { rotate: '0deg' }],
				},
			],
		});
	}

	// ========== Travel Supply Methods ==========

	/**
	 * Activate or deactivate the travel deck
	 * @param b - True to activate (default), false to deactivate
	 */
	public activateTravelDeck(b: boolean = true): void {
		(this.c.travel_deck[0] as TravelDeck).activate(b);
	}

	/**
	 * Activate or deactivate all travel cards in supply
	 * @param b - True to activate (default), false to deactivate
	 */
	public activateAllTravels(b: boolean = true): void {
		for (const i in this.c.travel) {
			(this.c.travel[i] as Travel).activate(b);
		}
	}

	/**
	 * Refill travel card to board supply from deck
	 * 
	 * Creates travel card and animates it flipping in from the deck.
	 * 
	 * @param travel - Travel card ID
	 * @param location - Supply location
	 * @returns Promise resolving when animation completes
	 */
	public async refillTravel(travel: number, location: number): Promise<void> {
		new Travel(this, travel, location);
		this.c.travel[travel].setArg("deck", true);
		await this.game.animationManager.slideIn(
			this.c.travel[travel].html,
			this.game.c.board[0].c.travel_deck[0].html,
			{
				duration: 800,
				fromPlaceholder: "off",
				toPlaceholder: "off",
				ignoreRotation: false,
				parallelAnimations: [
					{
						keyframes: [
							{ transform: 'rotateY(180deg)', rotate: '1deg' },
							{ transform: 'rotateY(0deg)', rotate: '0.5deg' },
						],
					},
				],
			}
		).then(() => {
			this.c.travel[travel].setArg("deck", false);
		});
	}

	/**
	 * Add travel card from deck with animation
	 * 
	 * @param travel - Travel card to add
	 * @param location - Supply location
	 * @returns Promise resolving when animation completes
	 */
	public async addTravel(travel: Travel, location: number): Promise<void> {
		travel.addToParent(this);
		travel.setArg("location", location);
		await this.game.animationManager.slideAndAttach(travel.html, this.html, {
			duration: 800,
			toPlaceholder: "off",
			parallelAnimations: [
				{
					keyframes: [{ rotate: '0deg' }, { rotate: '0.5deg' }],
				},
			],
		});
	}

	/**
	 * Create a new travel card for the deck
	 * @param travel - Travel card ID
	 * @returns Created Travel element
	 */
	public createTravelToDeck(travel: number): Travel {
		return new Travel(this, travel);
	}

	// ========== Gift Supply Methods ==========

	/**
	 * Activate or deactivate all gift cards in supply
	 * @param b - True to activate (default), false to deactivate
	 */
	public activateAllGifts(b: boolean = true): void {
		for (const i in this.c.gift) {
			(this.c.gift[i] as Gift).activate(b);
		}
	}

	/**
	 * Refill gift card to board supply from deck
	 * 
	 * Creates gift card and animates it flipping in from the deck with rotation.
	 * 
	 * @param gift - Gift card ID
	 * @param location - Supply location
	 * @returns Promise resolving when animation completes
	 */
	public async refillGift(gift: number, location: number): Promise<void> {
		new Gift(this, gift, location);
		this.c.gift[gift].setArg("deck", true);
		let rotate: string = "0";
		if (location === 1) rotate = "-5.5";
		else if (location === 2) rotate = "-4.5";
		else if (location === 3) rotate = "-4";

		await this.game.animationManager.slideIn(
			this.c.gift[gift].html,
			this.game.c.board[0].c.gift_deck[0].html,
			{
				duration: 800,
				fromPlaceholder: "off",
				toPlaceholder: "off",
				ignoreRotation: false,
				parallelAnimations: [
					{
						keyframes: [
							{ transform: 'rotateY(180deg) rotate(-4deg)' },
							{ transform: `rotateY(0deg) rotate(${rotate}deg)` },
						],
					},
				],
			}
		);
	}

	/**
	 * Add gift card from deck with animation
	 * 
	 * @param gift - Gift card to add
	 * @param location - Supply location
	 * @returns Promise resolving when animation completes
	 */
	public addGiftFromDeck(gift: Gift, location: number): Promise<void> {
		return this.game.animationManager.slideAndAttach(gift.html, this.html, {
			duration: 800,
			fromPlaceholder: "off",
			parallelAnimations: [
				{
					keyframes: [
						{ transform: 'rotateY(180deg)', rotate: '-4.5deg' },
						{ transform: 'rotateY(0deg)', rotate: '-5deg' },
					],
				},
			],
		});
	}

	/**
	 * Create a new gift card for the deck
	 * @param gift - Gift card ID
	 * @returns Created Gift element
	 */
	public createGiftToDeck(gift: number): Gift {
		return new Gift(this, gift);
	}

	// ========== Private Helper Methods ==========

	/**
	 * Setup camp help interface with camp counter tracking
	 * 
	 * Creates expandable help button showing camp counts by player and type.
	 * Initializes camp counter element references for tracking.
	 * 
	 * @param data - Player data for counter setup
	 * @private
	 */
	private setupCampHelp(data: any): void {
		this.game.helpManager = new HelpManager(this.game, {
			buttons: [
				new BgaHelpExpandableButton({
					foldedContentExtraClasses: 'camp-help-folded-content',
					unfoldedContentExtraClasses: 'camp-help-unfolded-content',
					expandedWidth: '200px',
					expandedHeight: '410px',
					unfoldedHtml: `
						<h3>${_("Number of Camps")}</h3>
						<table>
							${this.getCampHelpTable(data.players)}
						</table>`,
				}),
			],
		});

		this.camp_counters = [];
		for (let i in data.players) {
			this.camp_counters[data.players[i].id] = [];
			for (let j = 1; j <= 8; j++) {
				this.camp_counters[data.players[i].id][j] = document.getElementById(
					`camp_counter_${data.players[i].id}_${j}`
				)!;
			}
		}
	}

	/**
	 * Generate HTML table for camp help display
	 * 
	 * Creates table with rows for each camp type and columns for each player,
	 * showing camp counts by type.
	 * 
	 * @param players - Player data
	 * @returns HTML string for camp counter table
	 * @private
	 */
	private getCampHelpTable(players: any): string {
		let res = "<tr><td></td>";
		for (let i in players) {
			res += `<td><camp_icon color="${players[i].color}"></camp_icon></td>`;
		}
		res += `</tr>`;
		for (let i = 1; i <= 8; i++) {
			res += `<tr><td><campsite_icon type="${i}"></campsite_icon></td>`;
			for (let j in players) {
				res += `<td id="camp_counter_${players[j].id}_${i}" ${
					this.game.bga.players.getCurrentPlayerId() === players[j].id ? `own=true` : ``
				}>0</td>`;
			}
			res += `</tr>`;
		}
		return res;
	}
}