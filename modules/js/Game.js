const DEFAULT_ZOOM_LEVELS = [0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
function throttle(callback, delay) {
    let last;
    let timer;
    return function () {
        const context = this;
        const now = +new Date();
        const args = arguments;
        if (last && now < last + delay) {
            clearTimeout(timer);
            timer = setTimeout(() => {
                last = now;
                callback.apply(context, args);
            }, delay);
        }
        else {
            last = now;
            callback.apply(context, args);
        }
    };
}
const advThrottle = (func, delay, options = { leading: true, trailing: false }) => {
    let timer = null, lastRan = null, trailingArgs = null;
    return function (...args) {
        if (timer) { //called within cooldown period
            lastRan = this; //update context
            trailingArgs = args; //save for later
            return;
        }
        if (options.leading) { // if leading
            func.call(this, ...args); //call the 1st instance
        }
        else { // else it's trailing
            lastRan = this; //update context
            trailingArgs = args; //save for later
        }
        const coolDownPeriodComplete = () => {
            if (options.trailing && trailingArgs) { // if trailing and the trailing args exist
                func.call(lastRan, ...trailingArgs); //invoke the instance with stored context "lastRan"
                lastRan = null; //reset the status of lastRan
                trailingArgs = null; //reset trailing arguments
                timer = setTimeout(coolDownPeriodComplete, delay); //clear the timout
            }
            else {
                timer = null; // reset timer
            }
        };
        timer = setTimeout(coolDownPeriodComplete, delay);
    };
};
class ZoomManager {
    /**
     * Returns the zoom level
     */
    get zoom() {
        return this._zoom;
    }
    /**
     * Returns the zoom levels
     */
    get zoomLevels() {
        return this._zoomLevels;
    }
    /**
     * Place the settings.element in a zoom wrapper and init zoomControls.
     *
     * @param settings: a `ZoomManagerSettings` object
     */
    constructor(settings) {
        this.settings = settings;
        if (!settings.element) {
            throw new DOMException('You need to set the element to wrap in the zoom element');
        }
        this._zoomLevels = settings.zoomLevels ?? DEFAULT_ZOOM_LEVELS;
        this._zoom = this.settings.defaultZoom || 1;
        if (this.settings.localStorageZoomKey) {
            const zoomStr = localStorage.getItem(this.settings.localStorageZoomKey);
            if (zoomStr) {
                this._zoom = Number(zoomStr);
            }
        }
        this.wrapper = document.createElement('div');
        this.wrapper.id = 'bga-zoom-wrapper';
        this.wrapElement(this.wrapper, settings.element);
        this.wrapper.appendChild(settings.element);
        settings.element.classList.add('bga-zoom-inner');
        if (settings.smooth ?? true) {
            settings.element.dataset.smooth = 'true';
            settings.element.addEventListener('transitionend', advThrottle(() => this.zoomOrDimensionChanged(), this.throttleTime, { leading: true, trailing: true, }));
        }
        if (settings.zoomControls?.visible ?? true) {
            this.initZoomControls(settings);
        }
        if (this._zoom !== 1) {
            this.setZoom(this._zoom);
        }
        this.throttleTime = settings.throttleTime ?? 100;
        window.addEventListener('resize', advThrottle(() => {
            this.zoomOrDimensionChanged();
            if (this.settings.autoZoom?.expectedWidth) {
                this.setAutoZoom();
            }
        }, this.throttleTime, { leading: true, trailing: true, }));
        if (window.ResizeObserver) {
            new ResizeObserver(advThrottle(() => this.zoomOrDimensionChanged(), this.throttleTime, { leading: true, trailing: true, })).observe(settings.element);
        }
        if (this.settings.autoZoom?.expectedWidth) {
            this.setAutoZoom();
        }
    }
    setAutoZoom() {
        const zoomWrapperWidth = document.getElementById('bga-zoom-wrapper').clientWidth;
        if (!zoomWrapperWidth) {
            setTimeout(() => this.setAutoZoom(), 200);
            return;
        }
        const expectedWidth = this.settings.autoZoom?.expectedWidth;
        let newZoom = this.zoom;
        while (newZoom > this._zoomLevels[0] && newZoom > (this.settings.autoZoom?.minZoomLevel ?? 0) && zoomWrapperWidth / newZoom < expectedWidth) {
            newZoom = this._zoomLevels[this._zoomLevels.indexOf(newZoom) - 1];
        }
        if (this._zoom == newZoom) {
            if (this.settings.localStorageZoomKey) {
                localStorage.setItem(this.settings.localStorageZoomKey, '' + this._zoom);
            }
        }
        else {
            this.setZoom(newZoom);
        }
    }
    /**
     * Sets the available zoomLevels and new zoom to the provided values.
     * @param zoomLevels the new array of zoomLevels that can be used.
     * @param newZoom if provided the zoom will be set to this value, if not the last element of the zoomLevels array will be set as the new zoom
     */
    setZoomLevels(zoomLevels, newZoom) {
        if (!zoomLevels || zoomLevels.length <= 0) {
            return;
        }
        this._zoomLevels = zoomLevels;
        const zoomIndex = newZoom && zoomLevels.includes(newZoom) ? this._zoomLevels.indexOf(newZoom) : this._zoomLevels.length - 1;
        this.setZoom(this._zoomLevels[zoomIndex]);
    }
    /**
     * Set the zoom level. Ideally, use a zoom level in the zoomLevels range.
     * @param zoom zool level
     */
    setZoom(zoom = 1) {
        this._zoom = zoom;
        if (this.settings.localStorageZoomKey) {
            localStorage.setItem(this.settings.localStorageZoomKey, '' + this._zoom);
        }
        const newIndex = this._zoomLevels.indexOf(this._zoom);
        this.zoomInButton?.classList.toggle('disabled', newIndex === this._zoomLevels.length - 1);
        this.zoomOutButton?.classList.toggle('disabled', newIndex === 0);
        this.settings.element.style.transform = zoom === 1 ? '' : `scale(${zoom})`;
        this.settings.onZoomChange?.(this._zoom);
        this.zoomOrDimensionChanged();
    }
    /**
     * Call this method for the browsers not supporting ResizeObserver, everytime the table height changes, if you know it.
     * If the browsert is recent enough (>= Safari 13.1) it will just be ignored.
     */
    manualHeightUpdate() {
        if (!window.ResizeObserver) {
            this.zoomOrDimensionChanged();
        }
    }
    /**
     * Everytime the element dimensions changes, we update the style. And call the optional callback.
     * Unsafe method as this is not protected by throttle. Surround with  `advThrottle(() => this.zoomOrDimensionChanged(), this.throttleTime, { leading: true, trailing: true, })` to avoid spamming recomputation.
     */
    zoomOrDimensionChanged() {
        this.settings.element.style.width = `${this.wrapper.offsetWidth / this._zoom}px`;
        this.wrapper.style.height = `${this.settings.element.offsetHeight * this._zoom}px`;
        this.settings.onDimensionsChange?.(this._zoom);
    }
    /**
     * Simulates a click on the Zoom-in button.
     */
    zoomIn() {
        if (this._zoom === this._zoomLevels[this._zoomLevels.length - 1]) {
            return;
        }
        const newIndex = this._zoomLevels.indexOf(this._zoom) + 1;
        this.setZoom(newIndex === -1 ? 1 : this._zoomLevels[newIndex]);
    }
    /**
     * Simulates a click on the Zoom-out button.
     */
    zoomOut() {
        if (this._zoom === this._zoomLevels[0]) {
            return;
        }
        const newIndex = this._zoomLevels.indexOf(this._zoom) - 1;
        this.setZoom(newIndex === -1 ? 1 : this._zoomLevels[newIndex]);
    }
    /**
     * Changes the color of the zoom controls.
     */
    setZoomControlsColor(color) {
        if (this.zoomControls) {
            this.zoomControls.dataset.color = color;
        }
    }
    /**
     * Set-up the zoom controls
     * @param settings a `ZoomManagerSettings` object.
     */
    initZoomControls(settings) {
        this.zoomControls = document.createElement('div');
        this.zoomControls.id = 'bga-zoom-controls';
        this.zoomControls.dataset.position = settings.zoomControls?.position ?? 'top-right';
        this.zoomOutButton = document.createElement('button');
        this.zoomOutButton.type = 'button';
        this.zoomOutButton.addEventListener('click', () => this.zoomOut());
        if (settings.zoomControls?.customZoomOutElement) {
            settings.zoomControls.customZoomOutElement(this.zoomOutButton);
        }
        else {
            this.zoomOutButton.classList.add(`bga-zoom-out-icon`);
        }
        this.zoomInButton = document.createElement('button');
        this.zoomInButton.type = 'button';
        this.zoomInButton.addEventListener('click', () => this.zoomIn());
        if (settings.zoomControls?.customZoomInElement) {
            settings.zoomControls.customZoomInElement(this.zoomInButton);
        }
        else {
            this.zoomInButton.classList.add(`bga-zoom-in-icon`);
        }
        this.zoomControls.appendChild(this.zoomOutButton);
        this.zoomControls.appendChild(this.zoomInButton);
        this.wrapper.appendChild(this.zoomControls);
        this.setZoomControlsColor(settings.zoomControls?.color ?? 'black');
    }
    /**
     * Wraps an element around an existing DOM element
     * @param wrapper the wrapper element
     * @param element the existing element
     */
    wrapElement(wrapper, element) {
        element.parentNode.insertBefore(wrapper, element);
        wrapper.appendChild(element);
    }
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
class sAction {
    // ========== Constructor ==========
    /**
     * Initialize the Action state handler
     * @param game - Main game instance
     * @param bga - BGA framework instance
     */
    constructor(game, bga) {
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
    onEnteringState(args, isCurrentPlayerActive) {
        this.setTitle(args, isCurrentPlayerActive);
        if (!isCurrentPlayerActive)
            return;
        this.game.possible_actions = args.possible_actions;
        this.game.possible_actions.double = args.used_travels.length < args.max_travels - 1;
        const playerId = this.bga.gameui.player_id;
        const playerArea = this.game.c.player_area?.[playerId];
        const bonusActions = playerArea.c.bonus_actions?.[0];
        const doubleActions = playerArea.c.hand?.[0].c.double_actions?.[0];
        const hand = playerArea.c.hand?.[0];
        const postcardPlayer = playerArea.c.postcard_player?.[0];
        const giftPlayer = playerArea.c.gift_player?.[0];
        // Activate bonus actions
        bonusActions.activateBonusActions();
        doubleActions.activate(args.possible_actions.postcard, args.possible_actions.camp, args.possible_actions.stamp.all);
        if (args.used_travels.length !== args.max_travels) {
            hand?.activateTravelsExcept(args.used_travels);
        }
        for (const index of args.send) {
            (postcardPlayer.c.postcard?.[index]).activate();
        }
        for (const index of args.gifts) {
            (giftPlayer.c.gift?.[index]).activate();
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
    onLeavingState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        const playerId = this.bga.gameui.player_id;
        const playerArea = this.game.c.player_area?.[playerId];
        if (!playerArea)
            return;
        const hand = playerArea.c.hand?.[0];
        const bonusActions = playerArea.c.bonus_actions?.[0];
        const postcardPlayer = playerArea.c.postcard_player?.[0];
        const giftPlayer = playerArea.c.gift_player?.[0];
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
    setTitle(args, isCurrentPlayerActive) {
        const travel = args.used_travels.length !== args.max_travels;
        const bonus = args.possible_actions.bonus.move ||
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
            }
            else {
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
        }
        else {
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

/**
 * Handles the "Camp" game state
 *
 * This state is triggered when a player activates a Camp action through a Travel card
 * or when receiving a camp bonus from a souvenir placement.
 *
 * Responsibilities:
 *  - Activating available campsites in the player's current region
 *  - Setting the dynamic status bar title
 *  - Adding skip button if this is a bonus camp action
 *  - Cleaning up campsite UI on exit
 *  - Managing undo buttons
 */
class sCamp {
    // ========== Constructor ==========
    /**
     * Initialize the Camp state handler
     * @param game - Main game instance
     * @param bga - BGA framework instance
     */
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    // ========== State Lifecycle Methods ==========
    /**
     * Called when entering the Camp state
     *
     * Actions:
     *  - Sets the status bar title based on context
     *  - Activates available campsites in the player's region
     *  - Adds Skip button if this is a bonus camp action
     *  - Adds undo/reset buttons if available
     *
     * @param args - State arguments containing region, available campsites, and undo level
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onEnteringState(args, isCurrentPlayerActive) {
        this.setTitle(args, isCurrentPlayerActive);
        if (!isCurrentPlayerActive)
            return;
        const board = this.game.c.board?.[0];
        // Activate campsites available in the current region
        board.activateCampsites(args.region, args.campsites);
        // Add Skip button if this is a bonus camp action (gift-related)
        if (args.gift_bonus) {
            this.bga.statusBar.addActionButton(_("Skip"), () => this.bga.actions.performAction("actSkip"));
        }
        // Add undo buttons
        this.game.addUndoButtons(args.undo);
    }
    /**
     * Called when leaving the Camp state
     *
     * Cleans up:
     *  - Deactivates all campsites on the board
     *
     * @param args - State arguments (unused)
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onLeavingState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        const board = this.game.c.board?.[0];
        board.inactivateAllCampsites();
    }
    // ========== Private Helper Methods ==========
    /**
     * Sets the dynamic title shown in the status bar
     *
     * Only displays a title if this is a bonus camp action from a gift.
     * Otherwise uses the default state description from the game state definition.
     *
     * The title informs the player that they can place a Camp token on an available
     * campsite in their current region as part of the gift bonus action.
     *
     * @param args - State arguments containing gift_bonus flag
     * @param isCurrentPlayerActive - Whether this is the current active player
     * @private
     */
    setTitle(args, isCurrentPlayerActive) {
        if (!args.gift_bonus)
            return;
        const title = isCurrentPlayerActive
            ? _("${you} can place a Camp on a campsite in your region")
            : _("${actplayer} can place a Camp on a campsite in their region");
        this.bga.statusBar.setTitle(title, args);
    }
}

/**
 * Handles the "Confirm" game state
 *
 * Responsibilities:
 *  - Displaying confirmation UI to the player
 *  - Adding the Confirm action button
 *  - Managing undo buttons
 *
 * The Confirm state is typically used after a player completes an action sequence
 * and needs to confirm before the action is committed to the server.
 */
class sConfirm {
    // ========== Constructor ==========
    /**
     * Initialize the Confirm state handler
     * @param game - Main game instance
     * @param bga - BGA framework instance
     */
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    // ========== State Lifecycle Methods ==========
    /**
     * Called when entering the Confirm state
     *
     * Actions:
     *  - Adds a Confirm button to the status bar
     *  - Respects user preference for auto-clicking confirmation
     *  - Adds undo buttons if available
     *
     * @param args - State arguments containing undo level
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onEnteringState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive) {
            return;
        }
        // Check user preference for auto-confirming actions
        const autoClickPreference = this.bga.userPreferences.get(100) === 1;
        // Add confirm button with optional auto-click
        if (autoClickPreference) {
            this.bga.statusBar.addActionButton(_("Confirm"), () => this.bga.actions.performAction("actConfirm"), { autoclick: { pausable: true } });
        }
        else {
            this.bga.statusBar.addActionButton(_("Confirm"), () => this.bga.actions.performAction("actConfirm"));
        }
        // Add undo/reset buttons if available
        this.game.addUndoButtons(args.undo);
    }
}

/**
 * Handles the "Gift" game state
 *
 * This state occurs after a player sends a postcard and must choose a gift card.
 *
 * Responsibilities:
 *  - Activating all available gift cards on the board
 *  - Displaying a warning that this action cannot be undone
 *  - Adding undo buttons if available
 *  - Cleaning up gift UI when exiting the state
 *  - Deactivating all gift cards
 */
class sGift {
    // ========== Constructor ==========
    /**
     * Initialize the Gift state handler
     * @param game - Main game instance
     * @param bga - BGA framework instance
     */
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    // ========== State Lifecycle Methods ==========
    /**
     * Called when entering the Gift state
     *
     * Actions:
     *  - Activates all gift cards on the board for selection
     *  - Displays a warning bar that this action cannot be undone
     *  - Adds undo/reset buttons if available
     *
     * @param args - State arguments containing undo level
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onEnteringState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        const board = this.game.c.board?.[0];
        // Activate all gift cards for selection
        board.activateAllGifts();
        // Show warning that this action cannot be undone
        this.game.undo_bar = this.game.createBar("warning", _("You won't be able to undo this action!"));
        this.game.addUndoButtons(args.undo);
    }
    /**
     * Called when leaving the Gift state
     *
     * Cleans up:
     *  - Removes the undo warning bar
     *  - Deactivates all gift cards
     *
     * @param args - State arguments (unused)
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onLeavingState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        const board = this.game.c.board?.[0];
        // Remove the undo warning bar
        if (this.game.undo_bar) {
            this.game.undo_bar.remove();
            delete this.game.undo_bar;
        }
        // Deactivate all gift cards
        board.activateAllGifts(false);
    }
}

/**
 * Handles the "Move" game state
 *
 * This state occurs when a player activates a Movement action through a Travel card.
 * The player's biker moves to a new region and they can place camps there.
 *
 * Responsibilities:
 *  - Updating the biker position on the board
 *  - Activating selectable regions for movement
 *  - Adding optional discard postcards button
 *  - Adding undo buttons if available
 *  - Cleaning up region UI on exit
 */
class sMove {
    // ========== Constructor ==========
    /**
     * Initialize the Move state handler
     * @param game - Main game instance
     * @param bga - BGA framework instance
     */
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    // ========== State Lifecycle Methods ==========
    /**
     * Called when entering the Move state
     *
     * Actions:
     *  - Updates the biker position to the current region
     *  - Activates all selectable regions for movement
     *  - Adds optional "Discard Postcards from supply" button
     *  - Adds undo/reset buttons if available
     *
     * @param args - State arguments containing biker region, selectable regions, and options
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onEnteringState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        const board = this.game.c.board?.[0];
        // Update biker position
        board.setBikerRegion(args.biker);
        // Activate selectable regions
        board.activateRegions(args.regions);
        // Add optional discard button
        if (args.discard) {
            this.bga.statusBar.addActionButton(_("Discard Postcards from supply"), () => this.bga.actions.performAction("actDiscardPostcards"));
        }
        this.game.addUndoButtons(args.undo);
    }
    /**
     * Called when leaving the Move state
     *
     * Cleans up:
     *  - Deactivates all regions on the board
     *
     * @param args - State arguments (unused)
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onLeavingState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        const board = this.game.c.board?.[0];
        board.inactivateAllRegions();
    }
}

/**
 * Handles the "Guide" game state
 *
 * This state occurs during the guide phase where players select postcards from the deck.
 * Players must select exactly 2 postcards before they can confirm their selection.
 *
 * Responsibilities:
 *  - Activating postcard selection UI in the guide display
 *  - Adding the "Take selected Postcards" button with initial disabled state
 *  - Managing button state based on selection count
 *  - Adding undo buttons if available
 *  - Cleaning up button reference on exit
 */
class sGuide {
    // ========== Constructor ==========
    /**
     * Initialize the Guide state handler
     * @param game - Main game instance
     * @param bga - BGA framework instance
     */
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    // ========== State Lifecycle Methods ==========
    /**
     * Called when entering the Guide state
     *
     * Actions:
     *  - Activates all postcards in the guide for selection
     *  - Adds the "Take selected Postcards" button to the status bar (initially disabled)
     *  - The button becomes enabled once player selects 2 postcards
     *  - Adds undo/reset buttons if available
     *
     * @param args - State arguments containing undo level
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onEnteringState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        const guide = this.game.c.postcard_guide?.[0];
        // Activate all postcards for selection
        guide.activatePostcards();
        // Add the "Take selected Postcards" button with initial disabled state
        this.game.takeButton = this.bga.statusBar.addActionButton(_("Take selected Postcards"), () => {
            this.bga.actions.performAction("actGuide", {
                postcard_1: guide.selected_1?.child_id,
                postcard_2: guide.selected_2?.child_id
            });
        }, { classes: "disabled" });
        // Add undo buttons
        this.game.addUndoButtons(args.undo);
    }
    /**
     * Called when leaving the Guide state
     *
     * Cleans up:
     *  - Removes reference to the Take button
     *
     * @param args - State arguments (unused)
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onLeavingState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        delete this.game.takeButton;
    }
}

/**
 * Handles the "Postcard" game state
 *
 * This state occurs when a player activates a Postcard action through a Travel card.
 * The player must take a postcard from the supply or optionally discard postcards.
 *
 * Responsibilities:
 *  - Activating postcards in the supply for selection
 *  - Displaying a warning that this action cannot be undone
 *  - Adding optional discard postcards button
 *  - Setting the dynamic status bar title
 *  - Adding undo buttons if available
 *  - Cleaning up postcard UI on exit
 */
class sPostcard {
    // ========== Constructor ==========
    /**
     * Initialize the Postcard state handler
     * @param game - Main game instance
     * @param bga - BGA framework instance
     */
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    // ========== State Lifecycle Methods ==========
    /**
     * Called when entering the Postcard state
     *
     * Actions:
     *  - Sets the status bar title based on available actions
     *  - Activates all postcards in the supply for selection
     *  - Displays a warning that this action cannot be undone
     *  - Adds optional "Discard Postcards from supply" button
     *  - Adds undo/reset buttons if available
     *
     * @param args - State arguments containing action availability and undo level
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onEnteringState(args, isCurrentPlayerActive) {
        this.setTitle(args, isCurrentPlayerActive);
        if (!isCurrentPlayerActive)
            return;
        const supply = this.game.c.postcard_supply?.[0];
        // Activate all postcards for selection
        supply.activatePostcards();
        // Show warning that this action cannot be undone
        this.game.undo_bar = this.game.createBar("warning", _("You won't be able to undo this action!"));
        // Add optional discard button
        if (args.discard) {
            this.bga.statusBar.addActionButton(_("Discard Postcards from supply"), () => this.bga.actions.performAction("actDiscardPostcards"));
        }
        this.game.addUndoButtons(args.undo);
    }
    /**
     * Called when leaving the Postcard state
     *
     * Cleans up:
     *  - Deactivates all postcards in the supply
     *  - Removes the undo warning bar
     *
     * @param args - State arguments (unused)
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onLeavingState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        const supply = this.game.c.postcard_supply?.[0];
        // Deactivate all postcards
        supply.activatePostcards(false);
        // Remove the undo warning bar
        if (this.game.undo_bar) {
            this.game.undo_bar.remove();
            delete this.game.undo_bar;
        }
    }
    // ========== Private Helper Methods ==========
    /**
     * Sets the dynamic title shown in the status bar
     *
     * Only displays a custom title if the discard option is available.
     * Otherwise uses the default state description from the game state definition.
     *
     * The title informs the player that they can either take a postcard from the supply
     * or discard postcards if that option is available.
     *
     * @param args - State arguments containing discard availability
     * @param isCurrentPlayerActive - Whether this is the current active player
     * @private
     */
    setTitle(args, isCurrentPlayerActive) {
        if (!args.discard)
            return;
        const title = isCurrentPlayerActive
            ? _("${you} must take a Postcard from the supply or discard them")
            : _("${actplayer} must take a Postcard from the supply or discard them");
        this.bga.statusBar.setTitle(title, args);
    }
}

/**
 * Handles the "Souvenir" game state
 *
 * This state occurs when a player places a postcard and needs to place souvenirs on it.
 * Players can choose to place souvenirs on available spaces or skip if they prefer.
 *
 * Responsibilities:
 *  - Activating available souvenir placement spaces
 *  - Adding the Skip button for optional souvenir placement
 *  - Adding undo buttons if available
 *  - Cleaning up souvenir UI on exit
 *  - Deactivating all souvenir spaces
 */
class sSouvenir {
    // ========== Constructor ==========
    /**
     * Initialize the Souvenir state handler
     * @param game - Main game instance
     * @param bga - BGA framework instance
     */
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    // ========== State Lifecycle Methods ==========
    /**
     * Called when entering the Souvenir state
     *
     * Actions:
     *  - Activates available souvenir placement spaces on postcards
     *  - Adds Skip button to allow players to skip souvenir placement
     *  - Adds undo/reset buttons if available
     *
     * @param args - State arguments containing available souvenir spaces and undo level
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onEnteringState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        const area = this.game.c.player_area?.[this.bga.gameui.player_id];
        // Activate souvenir spaces available for placement
        area.activateSouvenirSpaces(args.spaces);
        // Add Skip button (placement is optional)
        this.bga.statusBar.addActionButton(_("Skip"), () => this.bga.actions.performAction("actSkip"));
        this.game.addUndoButtons(args.undo);
    }
    /**
     * Called when leaving the Souvenir state
     *
     * Cleans up:
     *  - Deactivates all souvenir spaces on the postcards
     *
     * @param args - State arguments (unused)
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onLeavingState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        const area = this.game.c.player_area?.[this.bga.gameui.player_id];
        if (!area)
            return;
        // Deactivate all souvenir spaces
        area.inactivateAllSouvenirSpaces();
    }
}

/**
 * Handles the "Stamp" game state
 *
 * This state occurs when a player places a postcard and needs to place stamps on it.
 * Players must place stamps on available spaces to complete the postcard action.
 *
 * Responsibilities:
 *  - Activating available stamp placement spaces
 *  - Adding undo buttons if available
 *  - Cleaning up stamp UI on exit
 *  - Deactivating all stamp spaces
 */
class sStamp {
    // ========== Constructor ==========
    /**
     * Initialize the Stamp state handler
     * @param game - Main game instance
     * @param bga - BGA framework instance
     */
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    // ========== State Lifecycle Methods ==========
    /**
     * Called when entering the Stamp state
     *
     * Actions:
     *  - Activates available stamp placement spaces on postcards
     *  - Adds undo/reset buttons if available
     *
     * @param args - State arguments containing available stamp spaces and undo level
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onEnteringState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        const area = this.game.c.player_area?.[this.bga.gameui.player_id];
        // Activate stamp spaces available for placement
        area.activateStampSpaces(args.spaces);
        // Add undo buttons for the current action
        this.game.addUndoButtons(args.undo);
    }
    /**
     * Called when leaving the Stamp state
     *
     * Cleans up:
     *  - Deactivates all stamp spaces on the postcards
     *
     * @param args - State arguments (unused)
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onLeavingState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        const area = this.game.c.player_area?.[this.bga.gameui.player_id];
        // Deactivate all stamp spaces
        area.inactivateAllStampSpaces();
    }
}

/**
 * Handles the "Star" game state
 *
 * This state occurs when a player activates a star effect from completing a postcard.
 * The player must choose one of three available star effects to activate.
 *
 * Responsibilities:
 *  - Adding three selectable star effect buttons (Movement, Postcard, Stamp)
 *  - Adding undo buttons if available
 */
class sStar {
    // ========== Constructor ==========
    /**
     * Initialize the Star state handler
     * @param game - Main game instance
     * @param bga - BGA framework instance
     */
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    // ========== State Lifecycle Methods ==========
    /**
     * Called when entering the Star state
     *
     * Actions:
     *  - Adds three action buttons for star effect selection:
     *    - Movement: Allows player to move their biker
     *    - Postcard: Allows player to take a postcard
     *    - Stamp: Allows player to place a stamp
     *  - Adds undo/reset buttons if available
     *
     * @param args - State arguments containing undo level
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onEnteringState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        // Add three star effect options
        this.bga.statusBar.addActionButton(_("Movement"), () => this.bga.actions.performAction("actStar", { effect: 1 }));
        this.bga.statusBar.addActionButton(_("Postcard"), () => this.bga.actions.performAction("actStar", { effect: 2 }));
        this.bga.statusBar.addActionButton(_("Stamp"), () => this.bga.actions.performAction("actStar", { effect: 3 }));
        this.game.addUndoButtons(args.undo);
    }
}

/**
 * Handles the "Travel" game state
 *
 * This state occurs when a player needs to select a Travel card to play.
 * Players can choose from the travel deck or any travel cards currently in the supply.
 *
 * Responsibilities:
 *  - Activating the travel deck for card selection
 *  - Activating all travel cards in the supply for selection
 *  - Adding undo buttons if available
 *  - Cleaning up travel UI on exit
 *  - Deactivating travel deck and cards
 */
class sTravel {
    // ========== Constructor ==========
    /**
     * Initialize the Travel state handler
     * @param game - Main game instance
     * @param bga - BGA framework instance
     */
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    // ========== State Lifecycle Methods ==========
    /**
     * Called when entering the Travel state
     *
     * Actions:
     *  - Activates the travel deck for card selection
     *  - Activates all travel cards in the supply for selection
     *  - Adds undo/reset buttons if available
     *
     * @param args - State arguments containing undo level
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onEnteringState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        const board = this.game.c.board?.[0];
        // Activate travel deck and all travel cards
        board.activateTravelDeck();
        board.activateAllTravels();
        this.game.addUndoButtons(args.undo);
    }
    /**
     * Called when leaving the Travel state
     *
     * Cleans up:
     *  - Deactivates the travel deck
     *  - Deactivates all travel cards
     *
     * @param args - State arguments (unused)
     * @param isCurrentPlayerActive - Whether this is the current active player
     */
    onLeavingState(args, isCurrentPlayerActive) {
        if (!isCurrentPlayerActive)
            return;
        const board = this.game.c.board?.[0];
        // Deactivate travel deck and all travel cards
        board.activateTravelDeck(false);
        board.activateAllTravels(false);
    }
}

/**
 * Base class for all game elements.
 * Responsible for:
 *  - Managing parent/child relationships
 *  - Creating and attaching HTML elements
 *  - Storing element arguments and attributes
 */
class GameElement {
    constructor(parent, child_id, name, args = {}) {
        this.c = {};
        this.id = GameElement.ID_GEN++;
        this.name = name;
        this.game =
            parent.game === undefined
                ? parent
                : parent.game;
        this.child_id = child_id;
        this.args = { ...args };
        this.addToParent(parent);
        this.createHtmlElement();
        this.parent = parent;
        this.html = document.getElementById(`postcards_${this.id}`);
    }
    /**
     * Adds this element to its parent, updating the parent's child registry.
     */
    addToParent(parent, new_child_id = null) {
        if (this.parent !== undefined) {
            delete this.parent.c[this.name][this.child_id];
            if (Object.keys(this.parent.c[this.name]).length === 0) {
                delete this.parent.c[this.name];
            }
        }
        this.parent = parent;
        if (this.parent.c[this.name] === undefined) {
            this.parent.c[this.name] = {};
        }
        const child_id = new_child_id === null ? this.child_id : new_child_id;
        if (this.parent.c[this.name][child_id] !== undefined) {
            throw new Error(`child_id already taken: ${this.name} ${child_id}`);
        }
        this.parent.c[this.name][child_id] = this;
        this.child_id = child_id;
        this.html = document.getElementById(`postcards_${this.id}`);
    }
    /**
     * Creates the HTML element representing this game element.
     */
    createHtmlElement() {
        const elementId = `postcards_${this.id}`;
        const element = document.createElement(this.name);
        element.classList.add(this.name);
        element.id = elementId;
        for (const [key, value] of Object.entries(this.args)) {
            if (value !== null) {
                element.setAttribute(key, String(value));
            }
        }
        this.parent.html.appendChild(element);
        this.html = element;
        if (!this.html) {
            throw new Error(`Failed to create element with id: ${elementId}`);
        }
    }
    /**
     * Updates an argument and its corresponding HTML attribute.
     */
    setArg(name, value) {
        this.html.setAttribute(name, String(value));
        this.args[name] = value;
    }
}
GameElement.ID_GEN = 0;

/**
 * Manages the postcard guide display and selection interface
 *
 * The guide appears during the guide phase and allows players to select
 * exactly 2 postcards from a revealed set. Used in the early game round.
 *
 * Responsibilities:
 *  - Displaying postcards available for selection
 *  - Managing postcard selection state (selected_1 and selected_2)
 *  - Activating/deactivating postcards for player interaction
 *  - Animating postcard reveal and slide-in effects
 */
class PostcardGuide extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the postcard guide with initial postcard data
     * @param parent - Parent Game instance
     * @param child_id - Element ID
     * @param data - Initial array of postcard IDs to display (empty if none yet)
     */
    constructor(parent, child_id, data = []) {
        super(parent, child_id, "postcard_guide");
        let supply = 1;
        // Add initial postcards if provided
        for (let i in data) {
            new Postcard(this, data[i], false, null, supply++);
        }
    }
    // ========== Public Methods ==========
    /**
     * Activate or deactivate all postcards in the guide for selection
     * @param b - True to activate (default), false to deactivate
     */
    activatePostcards(b = true) {
        for (const i in this.c.postcard) {
            this.c.postcard[i].activate(b);
        }
    }
    /**
     * Animate sliding in postcards from the deck reveal
     *
     * Creates new postcard elements and animates them sliding in from the deck.
     * The top card is positioned last. Properly assigns supply positions for layout.
     *
     * Actions:
     *  - Creates new Postcard elements for each revealed card
     *  - Animates each card sliding in with 1000ms duration
     *  - Handles top card positioning separately
     *  - Waits for animations to complete
     *
     * @param postcards - Array of postcard IDs to slide in
     * @param top - ID of the top card from deck
     * @param d - Optional reference postcard to animate from
     * @returns Promise resolving when all animations complete
     */
    async slideInPostcards(postcards, top, d) {
        let supply = 1;
        let supply_save = null;
        // Slide in all postcards except the top card
        for (const i in postcards) {
            if (postcards[i] !== top) {
                const e = new Postcard(this, postcards[i], false, null, supply++);
                this.game.animationManager.slideIn(e.html, d === null ? null : d.html, {
                    duration: 800,
                });
            }
            else {
                supply_save = supply++;
            }
        }
        // Slide in the top card last
        const e = new Postcard(this, top, false, null, Number(supply_save));
        this.game.animationManager.slideIn(e.html, d === null ? null : d.html, {
            duration: 800,
        });
        await new Promise((resolve) => setTimeout(resolve, 800));
    }
}

/**
 * Manages a player's postcard collection and placement spaces
 *
 * Handles all postcards in a player's possession, including:
 * display, stamps, souvenirs, and activation/deactivation of placement spaces.
 *
 * Responsibilities:
 *  - Storing and displaying player's postcard collection
 *  - Activating/deactivating souvenir placement spaces
 *  - Activating/deactivating stamp placement spaces
 *  - Managing postcard animations (adding, sending)
 *  - Managing undo operations for sent postcards
 */
class PostcardPlayer extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the postcard player area with initial postcards
     * @param parent - Parent PlayerArea instance
     * @param child_id - Element ID
     * @param data - Array of postcard data objects
     */
    constructor(parent, child_id, data) {
        super(parent, child_id, "postcard_player");
        // Create postcards from initial data
        for (const i in data) {
            new Postcard(this, data[i].type, true, data[i]);
        }
    }
    // ========== Souvenir Space Methods ==========
    /**
     * Activate souvenir placement spaces on specific postcards
     *
     * Enables souvenir spaces where players can place souvenirs on their postcards.
     *
     * @param spaces - Object mapping postcard IDs to arrays of souvenir space indices
     */
    activateSouvenirSpaces(spaces) {
        for (const p in spaces) {
            for (const s in spaces[p]) {
                this.c.postcard[p].c.souvenir_space[spaces[p][s]].activate();
            }
        }
    }
    /**
     * Deactivate all souvenir placement spaces across all postcards
     */
    inactivateAllSouvenirSpaces() {
        for (const p in this.c.postcard) {
            for (const s in this.c.postcard[p].c.souvenir_space) {
                const souvenir_space = this.c.postcard[p].c.souvenir_space[s];
                souvenir_space.inactivate();
            }
        }
    }
    // ========== Stamp Space Methods ==========
    /**
     * Activate stamp placement spaces on specific postcards
     *
     * Enables stamp spaces where players can place stamps on their postcards.
     *
     * @param spaces - Object mapping postcard IDs to arrays of stamp space indices
     */
    activateStampSpaces(spaces) {
        for (const p in spaces) {
            for (const s in spaces[p]) {
                this.c.postcard[p].c.stamp_space[spaces[p][s]].activate();
            }
        }
    }
    /**
     * Deactivate all stamp placement spaces across all postcards
     */
    inactivateAllStampSpaces() {
        for (const p in this.c.postcard) {
            for (const s in this.c.postcard[p].c.stamp_space) {
                const stamp_space = this.c.postcard[p].c.stamp_space[s];
                stamp_space.inactivate();
            }
        }
    }
    // ========== Postcard Management Methods ==========
    /**
     * Animate adding a postcard to the player's collection
     *
     * Actions:
     *  - Sets postcard to face-up
     *  - Adds postcard as child of this player area
     *  - Sets up postcard face display
     *  - Animates postcard flip and positioning
     *
     * @param postcard - Postcard to add
     * @returns Promise resolving when animation completes
     */
    async addPostcard(postcard) {
        postcard.setArg("face", true);
        postcard.addToParent(this);
        postcard.setupFace();
        return await this.game.animationManager.slideAndAttach(postcard.html, this.html, {
            duration: 800,
            parallelAnimations: [
                {
                    keyframes: [
                        { transform: 'rotate(90deg) rotateX(180deg)' },
                        { transform: 'rotate(0deg) rotateX(0deg)' },
                    ],
                },
            ],
        });
    }
    /**
     * Activate or deactivate all postcards in the collection for interaction
     * @param b - True to activate (default), false to deactivate
     */
    activatePostcards(b = true) {
        for (const i in this.c.postcard) {
            this.c.postcard[i].activate(b);
        }
    }
    /**
     * Restore a postcard that was previously sent (undo operation)
     *
     * Creates a new postcard with the given stamps and souvenirs that were
     * on the postcard when it was sent.
     *
     * @param postcard - Postcard ID to restore
     * @param stamps - Stamps that were on the postcard
     * @param souvenirs - Souvenirs that were on the postcard
     */
    undoSend(postcard, stamps, souvenirs) {
        new Postcard(this, postcard, true, { stamps, souvenirs });
    }
}

/**
 * Represents a single souvenir token placed on a postcard
 *
 * Souvenirs are earned by placing matching camp tokens and provide immediate effects.
 * Each souvenir has a type matching a specific camp type and is placed on a
 * corresponding souvenir space on the postcard.
 *
 * Responsibilities:
 *  - Displaying souvenir token on postcard space
 *  - Tracking souvenir location on the postcard
 */
class Souvenir extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize a souvenir token on a postcard
     * @param parent - Parent Postcard instance
     * @param child_id - Souvenir ID
     * @param location - Souvenir space location on the postcard
     */
    constructor(parent, child_id, location) {
        super(parent, child_id, "souvenir", { location });
    }
}

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
class SouvenirSpace extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize a souvenir space on a postcard
     * @param parent - Parent Postcard instance
     * @param child_id - Element ID
     * @param space - Space location number on the postcard (1-3)
     */
    constructor(parent, child_id, space) {
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
    activate() {
        this.setArg("active", true);
    }
    /**
     * Deactivate this souvenir space
     */
    inactivate() {
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
    async onClick() {
        if (this.game.bga.players.isCurrentPlayerActive() && this.args.active === true) {
            switch (this.game.bga.gameui.gamedatas.gamestate.name) {
                case 'Souvenir':
                    this.game.bga.actions.performAction('actSouvenir', {
                        postcard: this.parent.child_id,
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
    setupTooltip() {
        this.game.bga.gameui.addTooltipHtml(`postcards_${this.id}`, `<tooltip>
				<h3>${_("Souvenir Space")}</h3>
				<p>${_("After placing a Camp on a campsite, if it's type matches an available Souvenir space on one of your Postcards, you may take a Souvenir token from the supply and place it on that Souvenir space. This immediately grants you an effect.")}</p>
				<p>${this.game.bga.gameui.format_string(_("<b>Type:</b> ${t}"), {
            t: this.getSpaceTypeName(),
        })}</p>
				<p>${this.game.bga.gameui.format_string(_("<b>Effect:</b> ${e}"), {
            e: this.getEffectTooltip(),
        })}</p>
			</tooltip>`);
    }
    /**
     * Get the souvenir type name for this space based on postcard and space location
     *
     * @returns Localized type name (e.g., "Gastronomy", "Shore", "Culture")
     * @private
     */
    getSpaceTypeName() {
        switch (this.parent.child_id) {
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
    getEffectTooltip() {
        // ...existing code...
        switch (this.parent.child_id) {
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

/**
 * Represents a single stamp token placed on a postcard
 *
 * Stamps are required to send postcards. Each stamp has a color matching
 * the Travel card used to place it. Postcards need all stamp spaces filled
 * before they can be sent.
 *
 * Responsibilities:
 *  - Displaying stamp token on postcard space
 *  - Tracking stamp location on the postcard
 */
class Stamp extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize a stamp token on a postcard
     * @param parent - Parent Postcard instance
     * @param child_id - Stamp ID
     * @param location - Stamp space location on the postcard
     */
    constructor(parent, child_id, location) {
        super(parent, child_id, "stamp", { location });
    }
}

/**
 * Represents a single stamp placement space on a postcard
 *
 * Each postcard has multiple stamp spaces where players can place stamp tokens.
 * Stamps are required to send postcards and have colors matching travel cards.
 *
 * Responsibilities:
 *  - Displaying stamp placement space on postcard
 *  - Handling click interactions for stamp placement
 *  - Tracking space location for stamp placement
 *  - Managing activation state for player selection
 */
class StampSpace extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize a stamp space on a postcard
     * @param parent - Parent Postcard instance
     * @param child_id - Element ID
     * @param space - Space location number on the postcard
     */
    constructor(parent, child_id, space) {
        super(parent, child_id, "stamp_space", { space });
        // Register click handler
        $(`postcards_${this.id}`).addEventListener('click', () => this.onClick());
    }
    // ========== Public Methods ==========
    /**
     * Activate this stamp space for stamp placement
     */
    activate() {
        this.setArg("active", true);
    }
    /**
     * Deactivate this stamp space
     */
    inactivate() {
        this.setArg("active", false);
    }
    // ========== Private Helper Methods ==========
    /**
     * Handle stamp space click - places stamp when clicked
     *
     * During Stamp phase:
     *  - Click: Place stamp on this space
     *
     * @private
     */
    async onClick() {
        if (this.game.bga.players.isCurrentPlayerActive() && this.args.active === true) {
            switch (this.game.bga.gameui.gamedatas.gamestate.name) {
                case 'Stamp':
                    this.game.bga.actions.performAction('actStamp', {
                        postcard: this.parent.child_id,
                        space: this.args.space,
                    });
                    break;
            }
        }
    }
}

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
class Postcard extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize a postcard
     * @param parent - Parent container (PostcardSupply, PostcardGuide, or PostcardPlayer)
     * @param child_id - Postcard ID
     * @param face - Whether postcard is face-up (true) or face-down (false)
     * @param data - Optional postcard data (stamps and souvenirs)
     * @param supply - Optional supply position for layout (1 = top/deck, 2+ = row)
     */
    constructor(parent, child_id, face, data = null, supply = null) {
        if (supply === null) {
            super(parent, child_id, "postcard", { type: child_id, face });
        }
        else {
            super(parent, child_id, "postcard", { type: child_id, face, supply });
        }
        // Register click handler
        this.html.addEventListener('click', () => this.onClick());
        // Setup face-up display or tooltip for face-down
        if (face) {
            this.setupFace(data?.stamps, data?.souvenirs);
        }
        else {
            this.setupTooltip();
        }
    }
    // ========== Public Methods ==========
    /**
     * Activate or deactivate this postcard for interaction
     * @param b - True to activate (default), false to deactivate
     */
    activate(b = true) {
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
    setupFace(stamps = [], souvenirs = []) {
        // Create initial souvenirs
        for (const i in souvenirs) {
            new Souvenir(this, souvenirs[i], souvenirs[i]);
        }
        // Create souvenir spaces (always 3)
        for (let i = 1; i <= 3; i++) {
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
    async addSouvenir(location) {
        new Souvenir(this, location, location);
        return await this.game.animationManager.slideIn(this.c.souvenir[location].html, this.game.c.board[0].c.stamp_supply[0].html, {
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
        });
    }
    /**
     * Animate removing a souvenir from the postcard
     *
     * Animates souvenir spinning out to the supply and removes it.
     *
     * @param space - Souvenir space location to remove from
     * @returns Promise resolving when animation completes
     */
    async removeSouvenir(space) {
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
    async addStamp(location) {
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
    async removeStamp(space) {
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
    onClick() {
        if (this.game.bga.players.isCurrentPlayerActive() &&
            (this.args.active === true || this.args.active === "selected")) {
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
                        if (this.parent.selected_1 === undefined) {
                            this.setArg("active", "selected");
                            this.parent.selected_1 = this;
                        }
                        else if (this.parent.selected_1 === this &&
                            this.parent.selected_2 === undefined) {
                            this.setArg("active", true);
                            this.parent.selected_1 = undefined;
                        }
                        else if (this.parent.selected_1 === this) {
                            this.game.takeButton.classList.add("disabled");
                            this.setArg("active", true);
                            this.parent.selected_1 = this.parent.selected_2;
                            this.parent.selected_2 = undefined;
                        }
                        else if (this.parent.selected_2 === this) {
                            this.game.takeButton.classList.add("disabled");
                            this.setArg("active", true);
                            this.parent.selected_2 = undefined;
                        }
                        else if (this.parent.selected_2 === undefined) {
                            this.game.takeButton.classList.remove("disabled");
                            this.setArg("active", "selected");
                            this.parent.selected_2 = this;
                        }
                        else {
                            this.parent.selected_1.setArg("active", true);
                            this.parent.selected_1 = this.parent.selected_2;
                            this.setArg("active", "selected");
                            this.parent.selected_2 = this;
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
    setupStampSpaces() {
        let stamp_space = [];
        const n = (this.args.type - 1) % 4;
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
    setupTooltip() {
        this.game.bga.gameui.addTooltipHtml(`postcards_${this.id}`, `<tooltip>
				<h3>${_("Postcard")}</h3>
				${!this.args.face
            ? `<p>${_("The number in the upper-left corner of a Postcard indicates its region. The one in the upper-right corner indicates the amount of Stamps required to send that Postcard.")}</p>`
            : `<p>${_("In addition to playing your 3 Travel cards, you can send a Postcard at any time during your turn if: all the Stamp spaces on that Postcard are filled AND you are in the region indicated on that Postcard.")}</p>
						<p>${_("When sending a Postcard, return all tokens on it to the supply, then immediately score the points indicated in its bottom-right corner and choose 1 Gift card.")}</p>
						<p><i>${_("<b>Note:</b> You can send multiple Postcards during your turn.")}</i></p>`}
			</tooltip>`);
    }
}

/**
 * Manages the postcard supply display and interactions
 *
 * Responsibilities:
 *  - Displaying postcards available for taking from the supply
 *  - Activating/deactivating postcards for player selection
 *  - Rearranging supply row when postcards are taken
 *  - Handling supply discard operations
 *  - Managing postcard counters (optional based on user preferences)
 *  - Managing top card of the postcard deck
 */
class PostcardSupply extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the postcard supply with initial data
     * @param parent - Parent Game instance
     * @param child_id - Element ID
     * @param data - Initial supply data containing deck card and row postcards
     */
    constructor(parent, child_id, data) {
        super(parent, child_id, "postcard_supply", { count: 3 });
        let supply = 1;
        // Add deck card if present
        if (data.deck !== null) {
            new Postcard(this, data.deck, false, null, supply++);
        }
        else {
            supply++;
        }
        // Add supply row postcards
        for (let i in data.row) {
            new Postcard(this, data.row[i], false, null, supply++);
        }
        // Create optional counters if user preference is enabled
        if (this.game.bga.userPreferences.get(101) === 1) {
            const postcards_counter_html = document.createElement("postcards_counter");
            this.html.appendChild(postcards_counter_html);
            this.postcards_counter = new ebg.counter();
            this.postcards_counter.create(postcards_counter_html, {
                value: data.postcards_counter,
                tableCounter: 'postcards_counter'
            });
            const postcards_discard_counter_html = document.createElement("postcards_discard_counter");
            this.html.appendChild(postcards_discard_counter_html);
            this.postcards_discard_counter = new ebg.counter();
            this.postcards_discard_counter.create(postcards_discard_counter_html, {
                value: data.postcards_discard_counter,
                tableCounter: 'postcards_discard_counter'
            });
        }
        // Set initial count display
        if (data.postcards_counter === 2) {
            this.setArg("count", 2);
        }
        else if (data.postcards_counter === 1 || data.postcards_counter === 0) {
            this.setArg("count", 1);
        }
    }
    // ========== Public Methods ==========
    /**
     * Animate adding a postcard to the supply
     *
     * Actions:
     *  - Sets postcard to face-down
     *  - Adds postcard as child of supply
     *  - Rearranges supply row to accommodate new card
     *  - Animates postcard flip and positioning
     *
     * @param postcard - Postcard to add
     * @returns Promise resolving when animation completes
     */
    async addPostcard(postcard) {
        postcard.setArg("face", false);
        postcard.addToParent(this);
        this.rearrangeSupplyRow();
        return await this.game.animationManager.slideAndAttach(postcard.html, this.html, {
            duration: 800,
            parallelAnimations: [
                {
                    keyframes: [
                        { transform: 'rotate(-90deg) rotateX(0deg)' },
                        { transform: 'rotate(0deg) rotateX(180deg)' },
                    ],
                },
            ],
        });
    }
    /**
     * Activate or deactivate all postcards in the supply for selection
     * @param b - True to activate (default), false to deactivate
     */
    activatePostcards(b = true) {
        for (const i in this.c.postcard) {
            this.c.postcard[i].activate(b);
        }
    }
    /**
     * Rearrange supply row after a postcard is taken
     *
     * Reorders postcards in the supply to fill gaps and maintain spacing.
     * Optionally excludes a specific postcard from rearrangement.
     *
     * @param except - Optional postcard to exclude from rearrangement
     */
    rearrangeSupplyRow(except = null) {
        this.activatePostcards(false);
        let keys = Object.keys(this.c.postcard)
            .map(Number)
            .sort((a, b) => a - b);
        let supply = 2;
        for (const key of keys) {
            if (this.c.postcard[key] !== undefined) {
                const postcard = this.c.postcard[key];
                if (postcard.args.supply !== 1 &&
                    (except === null || except.args.type !== postcard.args.type)) {
                    postcard.setArg("supply", supply++);
                }
            }
        }
    }
    /**
     * Discard all non-top postcards from the supply
     *
     * Removes all postcards except the one at supply position 1 (top card).
     * Animates cards fading out and scaling to zero.
     *
     * @returns Promise resolving when all discard animations complete
     */
    discardPostcardSupply() {
        this.activatePostcards(false);
        for (const i in this.c.postcard) {
            const postcard = this.c.postcard[i];
            if (postcard.args.supply !== 1) {
                this.game.animationManager.fadeOutAndDestroy(postcard.html, null, {
                    duration: 800,
                    parallelAnimations: [
                        {
                            keyframes: [{ transform: 'rotateX(-180deg) rotate(-90deg) scale(1)' }, { transform: 'rotateX(-180deg) rotate(-90deg) scale(0)' }],
                        },
                    ],
                });
                delete this.c.postcard[i];
            }
        }
        return new Promise((resolve) => setTimeout(resolve, 800));
    }
    /**
     * Refill the postcard supply with new card
     *
     * Actions:
     *  - Removes top card indicator from current top card
     *  - Adds new top card if provided
     *  - Rearranges supply row
     *
     * @param top - Optional new top card ID
     * @returns Promise resolving when refill animation completes
     */
    async refillPostcardSupply(top) {
        for (const i in this.c.postcard) {
            const postcard = this.c.postcard[i];
            if (postcard.args.supply === 1) {
                postcard.setArg("supply", 0);
            }
        }
        if (top !== undefined) {
            this.addPostcardToTop(top);
        }
        this.rearrangeSupplyRow();
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    /**
     * Add a postcard to the top position of the supply
     *
     * Creates a new postcard at supply position 1 (top/deck position).
     *
     * @param top - Postcard ID to place at top
     * @returns The created Postcard element
     */
    addPostcardToTop(top) {
        return new Postcard(this, top, false, null, 1);
    }
    /**
     * Remove and return the top postcard ID
     *
     * Finds the postcard at supply position 1, removes it from DOM and registry,
     * and returns its ID.
     *
     * @returns The ID of the removed top postcard
     */
    removePostcardFromTop() {
        for (const i in this.c.postcard) {
            if (this.c.postcard[i].args.supply === 1) {
                this.c.postcard[i].html.remove();
                delete this.c.postcard[i];
                return Number(i);
            }
        }
        throw new Error('No postcard found at top position');
    }
}

/**
 * Represents the end game bonus token
 *
 * The end game bonus token is earned by the first player to send 4 postcards.
 * It grants 3 additional points at the end of the game and marks when the
 * final round of the game begins.
 *
 * Responsibilities:
 *  - Displaying the end game bonus token
 *  - Tracking which player has earned the bonus
 *  - Providing tooltip with bonus information
 */
class EndGameBonus extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the end game bonus token
     * @param parent - Parent container (Board or PlayerArea)
     * @param child_id - Element ID
     */
    constructor(parent, child_id) {
        super(parent, child_id, "end_game_bonus");
        // Setup tooltip
        this.setupTooltip();
    }
    // ========== Private Helper Methods ==========
    /**
     * Setup tooltip with end game bonus information
     *
     * Displays:
     *  - How to earn the end game bonus (first to send 4 postcards)
     *  - Game flow when bonus is earned
     *  - End-game scoring value (3 points)
     *
     * @private
     */
    setupTooltip() {
        this.game.bga.gameui.addTooltipHtml(`postcards_${this.id}`, `<tooltip>
				<h3>${_("End Game Bonus Token")}</h3>
				<p>${_("The player who first sends 4 postcards immediately receives the End Game Bonus token and the game continues until the last player has played their turn. When that round is complete, proceed to final scoring.")}</p>
				<p>${_("<b>At the end of the game:</b> the player who received the End Game Bonus token scores 3 additional points.")}</p>
			</tooltip>`);
    }
}

/**
 * Represents a single region circle on the itinerary card
 *
 * Each circle corresponds to one of the four regions on the itinerary.
 * Circles can be activated to indicate that the player has sent a postcard
 * from that region, tracking progress toward the itinerary bonus.
 *
 * Responsibilities:
 *  - Displaying the circle for a specific region
 *  - Tracking activation state (whether region objective is met)
 *  - Updating visual state when activated
 */
class Circle extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize a circle for the itinerary
     * @param parent - Parent Itinerary instance
     * @param child_id - Circle index (0-3 representing regions 1-4)
     * @param active - Whether this circle is initially active
     */
    constructor(parent, child_id, active) {
        super(parent, child_id, "circle", { type: child_id, active });
    }
    // ========== Public Methods ==========
    /**
     * Activate this circle to indicate region objective is met
     *
     * Sets the active state to true, triggering visual updates to show
     * that the player has sent a postcard from this region.
     */
    activate() {
        this.setArg("active", true);
    }
}

/**
 * Manages a player's itinerary card and progress tracking
 *
 * The itinerary card shows which regions a player should send postcards from
 * to earn bonus end-game points. Tracks progress through numbered circles.
 *
 * Responsibilities:
 *  - Displaying the player's itinerary card with region objectives
 *  - Managing circle progress indicators (1/2/3/4 regions completed)
 *  - Providing information about scoring bonuses
 *  - Displaying tooltip with rules and scoring information
 */
class Itinerary extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the itinerary card with circles for progress tracking
     * @param parent - Parent PlayerArea instance
     * @param child_id - Element ID
     * @param type - Itinerary card type/variant
     * @param circles - Data for circles representing region progress (1-4)
     */
    constructor(parent, child_id, type, circles) {
        super(parent, child_id, "itinerary", { type });
        // Create circles for each region (0-3 representing 1-4 regions completed)
        for (const c in circles) {
            new Circle(this, Number(c), circles[c]);
        }
        // Setup tooltip with rules and scoring information
        this.setupTooltip();
    }
    // ========== Private Helper Methods ==========
    /**
     * Setup tooltip for the itinerary card
     *
     * Displays:
     *  - Itinerary card setup rules
     *  - Biker starting position
     *  - End-game scoring for region matches
     *  - Scoring progression (2/4/7/11 points)
     *  - Rules about multiple postcards from same region
     *  - Explanation of maximum score requirement
     *
     * @private
     */
    setupTooltip() {
        this.game.bga.gameui.addTooltipHtml(`postcards_${this.id}`, `<tooltip>
				<h3>${_("Itinerary Card")}</h3>
				<p>${_("During setup give an Itinerary cards to each player randomly. Each player places their Biker on the region indicated in the top-left corner of their Itinerary card. The remaining Itinerary cards are removed from the game.")}</p>
				<p>${_("At the end of the game, if you have sent 1/2/3/4 Postcards that match the regions shown at the bottom of the card, you score 2/4/7/11 points.")}</p>
				<p>${_("It is not mandatory to complete your Itinerary card, but it can give you valuable extra points!")}</p>
				<p>${_("You may send multiple Postcards from the same region, but each region on your Itinerary card only counts once towards the objective. To score the maximum amount of points, you must send Postcards from all 4 different regions!")}</p>
			</tooltip>`);
    }
}

/**
 * Represents a single camp token
 *
 * Camp tokens are placed by players on campsites in regions to earn points
 * and trigger souvenir placement opportunities. Each player has a limited
 * number of camps available on their player board.
 *
 * Responsibilities:
 *  - Displaying camp token with player color
 *  - Tracking camp location and placement
 *  - Managing region and campsite information
 */
class Camp extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize a camp token
     * @param parent - Parent container (PlayerBoard or Board)
     * @param child_id - Camp ID
     * @param color - Player color for camp styling
     * @param location - Location identifier (camp order on player board)
     * @param region - Region where camp is placed (0 if unplaced)
     * @param campsite - Campsite number within region (0 if unplaced)
     */
    constructor(parent, child_id, color, location, region = 0, campsite = 0) {
        super(parent, child_id, "camp", { color, location, region, campsite });
    }
}

/**
 * Manages a player's personal board display
 *
 * Displays the player's camp token placement board and manages their available camps.
 * Handles camp placement animations and rotations based on position.
 *
 * Responsibilities:
 *  - Creating and displaying camp tokens
 *  - Managing camp placement on the board
 *  - Animating camp placement with appropriate rotations
 *  - Displaying player name and board information
 *  - Providing tooltips explaining board mechanics
 */
class PlayerBoard extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the player board with camps and player information
     * @param parent - Parent PlayerArea instance
     * @param child_id - Element ID
     * @param color - Player color for camp styling
     * @param name - Player name to display
     * @param side - Whether using side A (true) or side B (false) of the board
     * @param camps - Array of already placed camps
     */
    constructor(parent, child_id, color, name, side, camps) {
        super(parent, child_id, "player_board", { color, side });
        // Create available camps (starting from camps.length + 1 up to 13)
        for (let i = camps.length + 1; i <= 13; i++) {
            new Camp(this, i, color, i);
        }
        // Setup tooltips for the board
        this.setupTooltip();
        // Add player name label
        this.html.innerHTML += `<name_label>${name}<name_label>`;
    }
    // ========== Public Methods ==========
    /**
     * Animate adding a camp to the player board
     *
     * Actions:
     *  - Sets camp location on the board
     *  - Calculates appropriate rotation based on position
     *  - Adds camp as child of this board at specified location
     *  - Animates camp sliding and attaching with rotation
     *
     * Rotation angles by position:
     *  - Positions 1, 2: 90 degrees
     *  - Position 3: 45 degrees
     *  - Position 10: -45 degrees
     *  - Positions 11, 12, 13: -90 degrees
     *  - Other positions: 0 degrees
     *
     * @param camp - Camp token to place
     * @param location - Board location (1-13) where camp should be placed
     * @returns Promise resolving when animation completes
     */
    async addCamp(camp, location) {
        camp.setArg("location", location);
        // Determine rotation based on location
        let rotate = 0;
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
        // Add camp to board and animate
        camp.addToParent(this, location);
        return this.game.animationManager.slideAndAttach(camp.html, this.html, {
            duration: 800,
            parallelAnimations: [
                {
                    keyframes: [{ transform: 'rotate(0deg)' }, { transform: `rotate(${rotate}deg)` }],
                },
            ],
        });
    }
    // ========== Private Helper Methods ==========
    /**
     * Setup tooltips for the player board
     *
     * Displays information about:
     *  - When camps grant immediate effects (5th, 7th, 9th)
     *  - When camps grant immediate scoring (11th, 12th, 13th)
     *  - Side B special rules (if applicable)
     *
     * @private
     */
    setupTooltip() {
        this.game.bga.gameui.addTooltipHtml(`postcards_${this.id}`, `<tooltip>
				<h3>${_("Player Board")}</h3>
				<p>${_("The 5th, 7th and 9th Camp tokens on your player board will grant you an immediate effect when you place them.")}</p>
				<p>${_("The 11th, 12th and 13th Camp tokens on your player board will immediately score points when you place them.")}</p>
				${this.args.side
            ? ""
            : `<h4>${_("Side B")}</h4>
					<p>${_("When using side B of the player board, each time you benefit from a Star effect, you can choose between: a Movement effect, a Postcard effect, or placing 1 Stamp.")}</p>`}
			</tooltip>`);
    }
}

/**
 * Represents a deck stack indicator on the board
 *
 * Displays remaining cards in either the travel deck or gift deck.
 * Shows visual count indicator (1-3 cards) based on deck fullness.
 *
 * Responsibilities:
 *  - Displaying deck stack with type indicator
 *  - Tracking remaining cards in the deck
 *  - Providing visual feedback on deck status
 */
class DeckStack extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize a deck stack indicator
     * @param parent - Parent Board instance
     * @param child_id - Element ID
     * @param type - Deck type (0 = Travel, 1 = Gift)
     */
    constructor(parent, child_id, type) {
        super(parent, child_id, "deck_stack", { type, count: 3 });
    }
}

/**
 * Represents a player's biker token on the board
 *
 * Each player has a biker that moves between regions during the game.
 * The biker's position determines which region the player can place camps in
 * and is used for various game mechanics.
 *
 * Responsibilities:
 *  - Displaying biker token with player color
 *  - Managing biker position on the board
 *  - Tracking whether this is the current player's biker
 *  - Providing tooltip with player information
 */
class Biker extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize a biker token
     * @param parent - Parent Board instance
     * @param child_id - Biker ID (player ID)
     * @param color - Player color hex code
     * @param location - Starting region location
     * @param own - Whether this is the current player's biker
     */
    constructor(parent, child_id, color, location, own) {
        super(parent, child_id, "biker", { color, location, own });
        // Setup tooltip
        this.setupTooltip();
    }
    // ========== Public Methods ==========
    /**
     * Move biker to a new region
     * @param region - Destination region number
     */
    move(region) {
        this.setArg("location", region);
    }
    // ========== Private Helper Methods ==========
    /**
     * Setup tooltip with biker player information
     *
     * Displays:
     *  - Player color name
     *  - Indicator if this is the current player's biker
     *
     * @private
     */
    setupTooltip() {
        this.game.bga.gameui.addTooltipHtml(`postcards_${this.id}`, `<tooltip>
				<h3>${this.game.bga.gameui.format_string(_("${color} Biker"), {
            color: this.getColor(),
        })}</h3>
				${this.args.own
            ? `<p><span style="color: #FF39A5">⬤</span> ${_("This is your Biker")}</p>`
            : ''}
			</tooltip>`);
    }
    /**
     * Get localized player color name from hex code
     *
     * Maps color hex codes to localized color names.
     *
     * @returns Localized color name
     * @private
     */
    getColor() {
        switch (this.args.color) {
            case "174D62":
                return _("Blue");
            case "A4C877":
                return _("Green");
            case "EE7628":
                return _("Orange");
            case "FCC922":
                return _("Yellow");
        }
        return '';
    }
}

/**
 * Represents a single region on the game board
 *
 * Regions are locations where players move their bikers and place camps.
 * Each region can be activated for selection during movement or camp placement.
 *
 * Responsibilities:
 *  - Displaying region on the board
 *  - Managing biker presence indicator
 *  - Handling click interactions for region selection
 *  - Tracking region activation state
 */
class Region extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize a region on the board
     * @param parent - Parent Board instance
     * @param child_id - Element ID
     * @param type - Region type/number (1-13)
     */
    constructor(parent, child_id, type) {
        super(parent, child_id, "region", { type, active: false });
        // Register click handler
        this.html.addEventListener('click', () => this.onClick());
    }
    // ========== Public Methods ==========
    /**
     * Mark this region as containing the biker
     */
    setBiker() {
        this.setArg("active", "biker");
    }
    /**
     * Activate or deactivate this region for selection
     * @param b - True to activate (default), false to deactivate
     */
    activate(b = true) {
        this.setArg("active", b);
    }
    // ========== Private Helper Methods ==========
    /**
     * Handle region click - moves biker to region when clicked
     *
     * During Move phase:
     *  - Click: Move biker to this region
     *
     * @private
     */
    async onClick() {
        if (this.args.active === true) {
            switch (this.game.bga.gameui.gamedatas.gamestate.name) {
                case 'Move':
                    this.game.bga.actions.performAction('actMove', { region: this.args.type });
                    break;
            }
        }
    }
}

/**
 * Represents a single campsite on the game board
 *
 * Campsites are locations where players place camp tokens. Each campsite has a type
 * matching souvenir types, and only one camp token can be placed per site.
 * Completing all campsites in a region grants bonus points.
 *
 * Responsibilities:
 *  - Displaying campsite with type information
 *  - Handling click interactions for camp placement
 *  - Tracking campsite location and region
 *  - Providing tooltip with campsite rules and scoring
 */
class Campsite extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize a campsite on the board
     * @param parent - Parent Board instance
     * @param child_id - Element ID
     * @param type - Campsite type (1-8, matching souvenir types)
     * @param region - Region number containing this campsite
     * @param location - Campsite location within the region
     */
    constructor(parent, child_id, type, region, location) {
        super(parent, child_id, "campsite", { type, region, location, active: false });
        // Register click handler
        this.html.addEventListener('click', () => this.onClick());
        // Setup tooltip
        this.setupTooltip();
    }
    // ========== Public Methods ==========
    /**
     * Activate or deactivate this campsite for camp placement
     * @param b - True to activate (default), false to deactivate
     */
    activate(b = true) {
        this.setArg("active", b);
    }
    // ========== Private Helper Methods ==========
    /**
     * Handle campsite click - places camp when clicked
     *
     * During Camp phase:
     *  - Click: Place camp on this campsite
     *
     * @private
     */
    async onClick() {
        if (this.args.active === true) {
            switch (this.game.bga.gameui.gamedatas.gamestate.name) {
                case 'Camp':
                    this.game.bga.actions.performAction('actCamp', {
                        campsite: this.args.location,
                    });
                    break;
            }
        }
    }
    /**
     * Setup tooltip with campsite information and rules
     *
     * Displays:
     *  - Campsite type
     *  - Rules about camp placement
     *  - Best traveler bonus scoring
     *
     * @private
     */
    setupTooltip() {
        this.game.bga.gameui.addTooltipHtml(`postcards_${this.id}`, `<tooltip>
				<h3>${_("Campsite")}</h3>
				<p>${this.game.bga.gameui.format_string(_("<b>Type:</b> ${t}"), {
            t: this.getCampsiteTypeName(),
        })}</p>
				<p>${_("There can only be 1 Camp token per campsite.")}</p>
				<p>${_("You can place a Camp token on a campsite even if you don't have an available Souvenir space that matches it. However, when doing so, you don't place a Souvenir token.")}</p>
				<h4>${_("Best Traveler In The Region")}</h4>
				<p>${_("If a player manages to place their Camp tokens on ALL the campsites in a region, they become known as the best traveler in that region! That player immediately scores 1 point per Camp token they have placed there.")}</p>
			</tooltip>`);
    }
    /**
     * Get the campsite type name based on type number
     *
     * Maps type numbers to localized souvenir/campsite type names.
     *
     * @returns Localized campsite type name
     * @private
     */
    getCampsiteTypeName() {
        switch (this.args.type) {
            case 1:
                return _("Sight");
            case 2:
                return _("History");
            case 3:
                return _("Culture");
            case 4:
                return _("Gastronomy");
            case 5:
                return _("Forest");
            case 6:
                return _("Mountain");
            case 7:
                return _("Shore");
            case 8:
                return _("Beach");
        }
        return '';
    }
}

/**
 * Represents the travel card deck on the board
 *
 * Players can draw from the travel deck as an alternative to selecting
 * from the travel supply. Drawing from the deck provides a random card.
 *
 * Responsibilities:
 *  - Displaying the travel deck on the board
 *  - Handling click interactions for deck drawing
 *  - Tracking activation state for player interaction
 */
class TravelDeck extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the travel deck
     * @param parent - Parent Board instance
     * @param child_id - Element ID
     */
    constructor(parent, child_id) {
        super(parent, child_id, "travel_deck");
        // Register click handler
        $(`postcards_${this.id}`).addEventListener('click', () => this.onClick());
    }
    // ========== Public Methods ==========
    /**
     * Activate or deactivate the travel deck for interaction
     * @param b - True to activate (default), false to deactivate
     */
    activate(b = true) {
        this.setArg("active", b);
    }
    // ========== Private Helper Methods ==========
    /**
     * Handle travel deck click - draws card from deck when clicked
     *
     * During Travel phase:
     *  - Click: Draw card from travel deck
     *
     * @private
     */
    async onClick() {
        if (this.game.bga.players.isCurrentPlayerActive() && this.args.active === true) {
            switch (this.game.bga.gameui.gamedatas.gamestate.name) {
                case 'Travel':
                    this.game.bga.actions.performAction('actTravelDeck');
                    break;
            }
        }
    }
}

/**
 * Represents the stamp supply on the board
 *
 * The stamp supply contains all available stamp tokens that players can take
 * during gameplay. Stamps are placed on postcard spaces to fulfill sending requirements.
 *
 * Responsibilities:
 *  - Displaying the stamp supply on the board
 *  - Serving as a visual reference for available stamps
 */
class StampSupply extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the stamp supply
     * @param parent - Parent Board instance
     * @param child_id - Element ID
     */
    constructor(parent, child_id) {
        super(parent, child_id, "stamp_supply");
    }
}

/**
 * Represents the gift card deck on the board
 *
 * The gift deck contains gift cards that are drawn to refill the gift supply.
 * When a player sends a postcard, they choose a gift card from the supply,
 * and the empty space is refilled from the deck.
 *
 * Responsibilities:
 *  - Displaying the gift deck on the board
 *  - Serving as a visual reference for available gift cards
 */
class GiftDeck extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the gift deck
     * @param parent - Parent Board instance
     * @param child_id - Element ID
     */
    constructor(parent, child_id) {
        super(parent, child_id, "gift_deck");
    }
}

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
class BonusActions extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the bonus actions interface with four travel options
     * @param parent - Parent PlayerArea instance
     * @param child_id - Element ID
     * @param bonus_actions - Optional bonus actions data containing counter values
     */
    constructor(parent, child_id, bonus_actions = null) {
        super(parent, child_id, "bonus_actions");
        if (bonus_actions !== null) {
            // Create travel options with counter data
            new TravelOption(this, 1, 1, 'move_bonus_counter', bonus_actions.move_bonus_counter);
            new TravelOption(this, 2, 2, 'postcard_bonus_counter', bonus_actions.postcard_bonus_counter);
            new TravelOption(this, 3, 3, 'camp_bonus_counter', bonus_actions.camp_bonus_counter);
            new TravelOption(this, 4, 4, 'stamp_bonus_counter', bonus_actions.stamp_bonus_counter);
        }
        else {
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
    activateBonusActions() {
        if (this.game.possible_actions?.bonus.move) {
            this.c.travel_option[1].activate();
        }
        if (this.game.possible_actions?.bonus.postcard) {
            this.c.travel_option[2].activate();
        }
        if (this.game.possible_actions?.bonus.camp) {
            this.c.travel_option[3].activate();
        }
    }
    /**
     * Deactivate all bonus actions
     *
     * Disables all three bonus action buttons (Move, Postcard, Camp).
     * Note: Stamp bonus (position 4) is not deactivated here.
     */
    inactivateBonusActions() {
        this.c.travel_option[1].activate(false);
        this.c.travel_option[2].activate(false);
        this.c.travel_option[3].activate(false);
    }
}

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
class TravelOption extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize a travel option button
     * @param parent - Parent element (Travel, DoubleActions, or BonusActions)
     * @param child_id - Element ID
     * @param type - Option type (1-4 for actions, 5-8 for colors)
     * @param counter - Optional counter name for tracking
     * @param n - Optional initial counter value
     */
    constructor(parent, child_id, type, counter = null, n = 0) {
        super(parent, child_id, "travel_option", { type });
        // ========== Properties ==========
        /** Optional counter for tracking remaining uses (bonus actions, etc.) */
        this.counter = null;
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
    setupCounter(counter, n) {
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
            }
            else if (n === 1) {
                this.setArg("count", 1);
            }
            else {
                this.setArg("count", 0);
            }
        }
        else {
            this.setArg("count", 0);
        }
    }
    /**
     * Activate or deactivate this option for interaction
     * @param b - True to activate (default), false to deactivate
     */
    activate(b = true) {
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
    async onClick() {
        switch (this.game.bga.gameui.gamedatas.gamestate.name) {
            case "Action":
                if (this.parent instanceof Travel) {
                    // Travel card action: check if specific action (1-3) or stamp color (4+)
                    if (this.args.type <= 3) {
                        this.game.bga.actions.performAction("actActionTravel", {
                            travel: this.parent.child_id,
                        });
                    }
                    else {
                        this.game.bga.actions.performAction("actActionTravelColor", {
                            travel: this.parent.child_id,
                        });
                    }
                    break;
                }
                else if (this.parent instanceof BonusActions && this.args.active) {
                    // Bonus action
                    this.game.bga.actions.performAction("actActionBonus", {
                        type: this.args.type,
                    });
                    break;
                }
                else if (this.parent instanceof DoubleActions) {
                    // Double action: two travel cards
                    this.game.bga.actions.performAction("actActionDouble", {
                        travel_1: this.parent.parent.selected_1?.child_id,
                        travel_2: this.parent.parent.selected_2?.child_id,
                        type: this.args.type,
                    });
                    break;
                }
        }
    }
}

/**
 * Manages the double action selection interface
 *
 * Provides four travel option buttons that allow the player to select
 * two travel cards to play as a double action combination.
 *
 * Responsibilities:
 *  - Creating and displaying travel option buttons
 *  - Allowing selection of dual actions from hand
 */
class DoubleActions extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the double actions interface with four travel options
     * @param parent - Parent Hand instance
     * @param child_id - Element ID
     */
    constructor(parent, child_id) {
        super(parent, child_id, "double_actions");
        // Create four travel option buttons (1-4)
        new TravelOption(this, 1, 1);
        new TravelOption(this, 2, 2);
        new TravelOption(this, 3, 3);
        new TravelOption(this, 4, 4);
    }
    // ========== Methods ==========
    activate(postcard, camp, stamp) {
        (this.c.travel_option?.[2]).activate(postcard);
        (this.c.travel_option?.[3]).activate(camp);
        (this.c.travel_option?.[4]).activate(stamp);
    }
}

/**
 * Manages the current player's hand of Travel cards
 *
 * The hand contains Travel cards that can be played during the Action phase.
 * Handles activation, discard, and selection of travel cards.
 *
 * Responsibilities:
 *  - Storing and displaying player's Travel cards
 *  - Managing card activation/deactivation for selection
 *  - Tracking selected cards (selected_1 and selected_2 for double actions)
 *  - Handling card discard animations
 *  - Managing used/unused card states
 *  - Managing double action selection
 */
class Hand extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the hand with initial Travel cards
     * @param parent - Parent PlayerArea instance
     * @param child_id - Element ID
     * @param data - Array of travel card data objects
     */
    constructor(parent, child_id, data) {
        super(parent, child_id, "hand", { double: false });
        // Create travel cards from initial data
        for (const d in data) {
            new Travel(this, data[d].type);
        }
        // Create double actions interface
        new DoubleActions(this, 0);
    }
    // ========== Card Activation Methods ==========
    /**
     * Activate Travel cards except those specified
     *
     * Allows player to select from available cards, excluding those already played.
     *
     * @param except - Array of travel card IDs to exclude from activation (default: empty)
     */
    activateTravelsExcept(except = []) {
        for (const i in this.c.travel) {
            if (!except.includes(Number(i))) {
                this.c.travel[i].activate();
            }
        }
    }
    /**
     * Deactivate all Travel cards
     *
     * Disables all cards and clears selection state.
     * Optionally preserves "used" cards from deactivation.
     *
     * @param not_used - If true, only deactivate cards not marked as "used"
     */
    inactivateAllTravels(not_used = false) {
        for (const i in this.c.travel) {
            if (!not_used || this.c.travel[i].args.active !== "used") {
                this.c.travel[i].activate(false);
            }
        }
        // Clear selected cards
        if (this.selected_1 !== undefined) {
            this.selected_1.removeButtons();
            this.selected_1 = undefined;
        }
        if (this.selected_2 !== undefined) {
            this.selected_2.removeButtons();
            this.selected_2 = undefined;
        }
        // Clear double action flag
        this.setArg("double", false);
    }
    // ========== Card State Methods ==========
    /**
     * Mark Travel cards as "used" (played this turn)
     *
     * Updates visual state to show cards that have been played.
     *
     * @param data - Array of travel card IDs to mark as used
     */
    usedTravels(data) {
        for (const i in data) {
            this.c.travel[data[i]].used();
        }
    }
    /**
     * Mark all Travel cards as "unused"
     *
     * Resets the used state of all cards.
     */
    unusedAllTravels() {
        for (const i in this.c.travel) {
            this.c.travel[i].used(false);
        }
    }
    // ========== Card Discard/Management Methods ==========
    /**
     * Animate discarding Travel cards
     *
     * Actions:
     *  - Animates cards fading out and scaling to zero
     *  - Removes cards from hand registry
     *  - Animates to stamp supply destination
     *
     * @param travels - Array of travel card IDs to discard
     * @returns Promise resolving when discard animation completes
     */
    discardTravels(travels) {
        for (const i in travels) {
            const travel = this.c.travel[travels[i]];
            this.game.animationManager.fadeOutAndDestroy(travel.html, this.game.c.board[0].c.stamp_supply[0].html, {
                duration: 800,
                parallelAnimations: [
                    {
                        keyframes: [{ transform: 'scale(1)' }, { transform: 'scale(0)' }],
                    },
                ],
            });
            delete this.c.travel[travels[i]];
        }
        return new Promise((resolve) => setTimeout(resolve, 800));
    }
    /**
     * Restore discarded Travel cards (undo operation)
     *
     * Recreates travel cards that were previously discarded.
     *
     * @param travels - Array of travel card IDs to restore
     * @returns Promise resolving when restoration completes
     */
    undoDiscardTravels(travels) {
        for (const i in travels) {
            new Travel(this, travels[i]);
        }
        return new Promise((resolve) => setTimeout(resolve, 800));
    }
    /**
     * Animate adding a Travel card to the hand
     *
     * Actions:
     *  - Adds card as child of hand
     *  - Animates card sliding and attaching with slight rotation
     *
     * @param travel - Travel card to add
     * @returns Promise resolving when animation completes
     */
    addTravel(travel) {
        travel.addToParent(this);
        return this.game.animationManager.slideAndAttach(travel.html, this.html, {
            duration: 800,
            fromPlaceholder: "off",
            parallelAnimations: [
                {
                    keyframes: [{ transform: 'rotate(0.5deg)' }, { transform: 'rotate(0deg)' }],
                },
            ],
        });
    }
    /**
     * Animate adding a Travel card from the deck
     *
     * Similar to addTravel but with a flip animation indicating card came from deck.
     *
     * Actions:
     *  - Adds card as child of hand
     *  - Animates card flipping (rotateY) and attaching with rotation
     *
     * @param travel - Travel card from deck to add
     * @returns Promise resolving when animation completes
     */
    addTravelFromDeck(travel) {
        travel.addToParent(this);
        return this.game.animationManager.slideAndAttach(travel.html, this.html, {
            duration: 800,
            fromPlaceholder: "off",
            parallelAnimations: [
                {
                    keyframes: [
                        { transform: 'rotateY(180deg) rotate(1deg)' },
                        { transform: 'rotateY(0deg) rotate(0deg)' },
                    ],
                },
            ],
        });
    }
}

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
class Travel extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize a Travel card
     * @param parent - Parent GameElement (Board or Hand)
     * @param child_id - Card ID
     * @param location - Optional location on board (null if in hand)
     */
    constructor(parent, child_id, location = null) {
        if (location !== null)
            super(parent, child_id, "travel", { location: location, active: false });
        else
            super(parent, child_id, "travel", { active: false });
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
    activate(b = true) {
        this.setArg("active", b);
    }
    /**
     * Mark card as used/unused during current turn
     * @param b - True to mark as used (default), false to mark as unused
     */
    used(b = true) {
        const s = b ? "used" : false;
        this.setArg("active", s);
    }
    /**
     * Remove action buttons (called when deselecting)
     */
    removeButtons() {
        if (this.c.travel_option !== undefined) {
            if (this.c.travel_option[0] !== undefined)
                this.c.travel_option[0].html.remove();
            if (this.c.travel_option[1] !== undefined)
                this.c.travel_option[1].html.remove();
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
    async onClick() {
        if (this.game.bga.players.isCurrentPlayerActive() &&
            (this.args.active === true || this.args.active === "selected")) {
            switch (this.game.bga.gameui.gamedatas.gamestate.name) {
                case 'Action':
                    if (this.parent instanceof Hand) {
                        if (this.game.possible_actions?.double) {
                            if (this.parent.selected_1 === undefined) {
                                this.addButtons();
                                this.setArg("active", "selected");
                                this.parent.selected_1 = this;
                            }
                            else if (this.parent.selected_1 === this &&
                                this.parent.selected_2 === undefined) {
                                this.setArg("active", true);
                                this.removeButtons();
                                this.parent.selected_1 = undefined;
                            }
                            else if (this.parent.selected_1 === this) {
                                this.parent.setArg("double", false);
                                this.setArg("active", true);
                                this.parent.selected_1 = this.parent.selected_2;
                                this.parent.selected_2 = undefined;
                                this.parent.selected_1.addButtons();
                            }
                            else if (this.parent.selected_2 === this) {
                                this.parent.setArg("double", false);
                                this.setArg("active", true);
                                this.parent.selected_2 = undefined;
                                this.parent.selected_1.addButtons();
                            }
                            else if (this.parent.selected_2 === undefined) {
                                this.parent.setArg("double", true);
                                this.setArg("active", "selected");
                                this.parent.selected_2 = this;
                                this.parent.selected_1.removeButtons();
                            }
                            else {
                                this.parent.selected_1.setArg("active", true);
                                this.parent.selected_1 = this.parent.selected_2;
                                this.setArg("active", "selected");
                                this.parent.selected_2 = this;
                            }
                        }
                        else {
                            if (this.parent.selected_1 === undefined) {
                                this.addButtons();
                                this.setArg("active", "selected");
                                this.parent.selected_1 = this;
                            }
                            else if (this.parent.selected_1 === this) {
                                this.parent.selected_1.setArg("active", true);
                                this.parent.selected_1.removeButtons();
                                this.parent.selected_1 = undefined;
                            }
                            else {
                                this.parent.selected_1.setArg("active", true);
                                this.parent.selected_1.removeButtons();
                                this.parent.selected_1 = undefined;
                                this.addButtons();
                                this.setArg("active", "selected");
                                this.parent.selected_1 = this;
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
    getColorType() {
        return (Math.floor((this.child_id - 1) / 6) % 4) + 1;
    }
    /**
     * Get the option type of this card (determines action type)
     * @returns Option type 1-3 (Movement, Postcard, Camp)
     * @private
     */
    getOptionType() {
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
    addButtons() {
        const type = this.getOptionType();
        if (type === 1 ||
            (type === 2 && this.game.possible_actions?.postcard) ||
            (type === 3 && this.game.possible_actions?.camp)) {
            new TravelOption(this, 0, this.getOptionType());
        }
        const color = this.getColorType();
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
    setupTooltip() {
        this.game.bga.gameui.addTooltipHtml(`postcards_${this.id}`, `<tooltip>
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
			</tooltip>`);
    }
    /**
     * Get action-specific tooltip text based on card type
     *
     * @returns HTML string with action-specific rules
     * @private
     */
    getSpecificTooltip() {
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

class BgaHelpButton {
}
class BgaHelpPopinButton extends BgaHelpButton {
    constructor(settings) {
        super();
        this.settings = settings;
    }
    add(toElement) {
        const button = document.createElement('button');
        button.classList.add('bga-help_button', 'bga-help_popin-button', ...(this.settings.buttonExtraClasses ? this.settings.buttonExtraClasses.split(/\s+/g) : []));
        button.innerHTML = `?`;
        if (this.settings.buttonBackground) {
            button.style.setProperty('--background', this.settings.buttonBackground);
        }
        if (this.settings.buttonColor) {
            button.style.setProperty('--color', this.settings.buttonColor);
        }
        toElement.appendChild(button);
        button.addEventListener('click', () => this.showHelp());
    }
    showHelp() {
        const popinDialog = new window.ebg.popindialog();
        popinDialog.create('bgaHelpDialog');
        popinDialog.setTitle(this.settings.title);
        popinDialog.setContent(`<div id="help-dialog-content">${this.settings.html ?? ''}</div>`);
        this.settings.onPopinCreated?.(document.getElementById('help-dialog-content'));
        popinDialog.show();
    }
}
class BgaHelpExpandableButton extends BgaHelpButton {
    constructor(settings) {
        super();
        this.settings = settings;
    }
    add(toElement) {
        let folded = this.settings.defaultFolded ?? true;
        if (this.settings.localStorageFoldedKey) {
            const localStorageValue = localStorage.getItem(this.settings.localStorageFoldedKey);
            if (localStorageValue) {
                folded = localStorageValue == 'true';
            }
        }
        const button = document.createElement('button');
        button.dataset.folded = folded.toString();
        button.classList.add('bga-help_button', 'bga-help_expandable-button', ...(this.settings.buttonExtraClasses ? this.settings.buttonExtraClasses.split(/\s+/g) : []));
        button.innerHTML = `
            <div class="bga-help_folded-content ${(this.settings.foldedContentExtraClasses ?? '').split(/\s+/g)}">${this.settings.foldedHtml ?? ''}</div>
            <div class="bga-help_unfolded-content  ${(this.settings.unfoldedContentExtraClasses ?? '').split(/\s+/g)}">${this.settings.unfoldedHtml ?? ''}</div>
        `;
        button.style.setProperty('--expanded-width', this.settings.expandedWidth ?? 'auto');
        button.style.setProperty('--expanded-height', this.settings.expandedHeight ?? 'auto');
        button.style.setProperty('--expanded-radius', this.settings.expandedRadius ?? '10px');
        toElement.appendChild(button);
        button.addEventListener('click', () => {
            button.dataset.folded = button.dataset.folded == 'true' ? 'false' : 'true';
            if (this.settings.localStorageFoldedKey) {
                localStorage.setItem(this.settings.localStorageFoldedKey, button.dataset.folded);
            }
        });
    }
}
class HelpManager {
    constructor(game, settings) {
        this.game = game;
        if (!settings?.buttons) {
            throw new Error('HelpManager need a `buttons` list in the settings.');
        }
        const leftSide = document.getElementById('left-side');
        const buttons = document.createElement('div');
        buttons.id = `bga-help_buttons`;
        leftSide.appendChild(buttons);
        settings.buttons.forEach(button => button.add(buttons));
    }
}

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
class Board extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the board with all elements
     * @param parent - Parent Game instance
     * @param child_id - Element ID
     * @param data - Board data containing players, travels, gifts, and initial state
     */
    constructor(parent, child_id, data) {
        super(parent, child_id, "board");
        /** Camp counters for tracking camps by player and type */
        this.camp_counters = {};
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
            new Biker(this, data.players[p].id, data.players[p].color, data.players[p].biker, data.players[p].id === this.game.bga.gameui.player_id);
            for (const c in data.players[p].camps) {
                const region = data.players[p].camps[c].region;
                const campsite = data.players[p].camps[c].location;
                new Camp(this, region * 10 + campsite, data.players[p].color, 0, region, campsite);
                this.camp_counters[data.players[p].id][this.campsites[region - 1][campsite - 1]].innerHTML = String(Number(this.camp_counters[data.players[p].id][this.campsites[region - 1][campsite - 1]].innerHTML) + 1);
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
        }
        else if (data.travels.travels_counter === 1) {
            this.setArg("travels_count", 1);
        }
        new DeckStack(this, 0, 0);
        if (data.travels.travels_counter === 2) {
            this.game.c.board[0].c.deck_stack[0].setArg("count", 2);
        }
        else if (data.travels.travels_counter === 1) {
            this.game.c.board[0].c.deck_stack[0].setArg("count", 1);
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
        }
        else if (data.gifts.gifts_counter === 1) {
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
    setBikerRegion(region) {
        this.c.region[region].setBiker();
    }
    /**
     * Activate specific regions for player interaction
     * @param regions - Array of region numbers to activate
     */
    activateRegions(regions) {
        for (const r of regions) {
            this.c.region[r].activate();
        }
    }
    /**
     * Deactivate all regions
     */
    inactivateAllRegions() {
        for (const r in this.c.region) {
            this.c.region[r].activate(false);
        }
    }
    /**
     * Animate biker movement to a new region
     * @param player_id - Player whose biker is moving
     * @param region - Destination region
     * @returns Promise resolving when animation completes
     */
    async moveBiker(player_id, region) {
        this.c.biker[player_id].move(region);
        return await new Promise((resolve) => setTimeout(resolve, 800));
    }
    // ========== Campsite Management Methods ==========
    /**
     * Activate specific campsites for camp placement
     * @param region - Region containing campsites
     * @param campsites - Array of campsite numbers to activate
     */
    activateCampsites(region, campsites) {
        for (const i in campsites) {
            this.c.campsite[region * 10 + campsites[i]].activate();
        }
    }
    /**
     * Deactivate all campsites
     */
    inactivateAllCampsites() {
        for (const i in this.c.campsite) {
            this.c.campsite[i].activate(false);
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
    async addCamp(camp, player_id, region, campsite) {
        this.camp_counters[player_id][this.campsites[region - 1][campsite - 1]].innerHTML = String(Number(this.camp_counters[player_id][this.campsites[region - 1][campsite - 1]].innerHTML) + 1);
        camp.addToParent(this, region * 10 + campsite);
        camp.setArg("region", region);
        camp.setArg("campsite", campsite);
        let rotate = 0;
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
    activateTravelDeck(b = true) {
        this.c.travel_deck[0].activate(b);
    }
    /**
     * Activate or deactivate all travel cards in supply
     * @param b - True to activate (default), false to deactivate
     */
    activateAllTravels(b = true) {
        for (const i in this.c.travel) {
            this.c.travel[i].activate(b);
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
    async refillTravel(travel, location) {
        new Travel(this, travel, location);
        this.c.travel[travel].setArg("deck", true);
        await this.game.animationManager.slideIn(this.c.travel[travel].html, this.game.c.board[0].c.travel_deck[0].html, {
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
        }).then(() => {
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
    async addTravel(travel, location) {
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
    createTravelToDeck(travel) {
        return new Travel(this, travel);
    }
    // ========== Gift Supply Methods ==========
    /**
     * Activate or deactivate all gift cards in supply
     * @param b - True to activate (default), false to deactivate
     */
    activateAllGifts(b = true) {
        for (const i in this.c.gift) {
            this.c.gift[i].activate(b);
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
    async refillGift(gift, location) {
        new Gift(this, gift, location);
        this.c.gift[gift].setArg("deck", true);
        let rotate = "0";
        if (location === 1)
            rotate = "-5.5";
        else if (location === 2)
            rotate = "-4.5";
        else if (location === 3)
            rotate = "-4";
        await this.game.animationManager.slideIn(this.c.gift[gift].html, this.game.c.board[0].c.gift_deck[0].html, {
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
        });
    }
    /**
     * Add gift card from deck with animation
     *
     * @param gift - Gift card to add
     * @param location - Supply location
     * @returns Promise resolving when animation completes
     */
    addGiftFromDeck(gift, location) {
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
    createGiftToDeck(gift) {
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
    setupCampHelp(data) {
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
                this.camp_counters[data.players[i].id][j] = document.getElementById(`camp_counter_${data.players[i].id}_${j}`);
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
    getCampHelpTable(players) {
        let res = "<tr><td></td>";
        for (let i in players) {
            res += `<td><camp_icon color="${players[i].color}"></camp_icon></td>`;
        }
        res += `</tr>`;
        for (let i = 1; i <= 8; i++) {
            res += `<tr><td><campsite_icon type="${i}"></campsite_icon></td>`;
            for (let j in players) {
                res += `<td id="camp_counter_${players[j].id}_${i}" ${this.game.bga.players.getCurrentPlayerId() === players[j].id ? `own=true` : ``}>0</td>`;
            }
            res += `</tr>`;
        }
        return res;
    }
}

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
class Gift extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize a gift card
     * @param parent - Parent container (Board or GiftPlayer)
     * @param child_id - Gift card ID
     * @param location - Optional location on board (null if in hand)
     */
    constructor(parent, child_id, location = null) {
        if (location !== null) {
            super(parent, child_id, "gift", { location });
        }
        else {
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
    activate(b = true) {
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
    async onClick() {
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
    getGiftType() {
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
    setupTooltip() {
        this.game.bga.gameui.addTooltipHtml(`postcards_${this.id}`, `<tooltip>
				<h3>${_("Gift Card")}</h3>
				<p>${_("When you send a postcard, choose a face‑up Gift card and place it in front of you. Then fill the empty space with a new card from the deck.")}</p>
				${this.getSpecificTooltip()}
			</tooltip>`);
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
    getSpecificTooltip() {
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
					<p>${this.game.bga.gameui.format_string(_("<b>At the end of the game:</b> if you have 1/2/3/4/5/6 camps on ${t} type of campsite, score 1/3/6/10/14/20 points."), {
                    t: this.getKeyType(),
                })}</p>
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
    getKeyType() {
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

/**
 * Manages a player's gift card collection
 *
 * Stores and displays the gift cards a player has received during the game.
 * Handles gift card animations and activation/deactivation for interaction.
 *
 * Responsibilities:
 *  - Storing and displaying player's gift card collection
 *  - Animating gift card addition to collection
 *  - Managing gift card activation/deactivation for selection
 *  - Handling undo operations for gift cards
 */
class GiftPlayer extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the gift player area with initial gift cards
     * @param parent - Parent PlayerArea instance
     * @param child_id - Element ID
     * @param data - Array of gift card IDs
     */
    constructor(parent, child_id, data) {
        super(parent, child_id, "gift_player");
        // Create initial gift cards
        for (const d in data) {
            new Gift(this, data[d]);
        }
    }
    // ========== Public Methods ==========
    /**
     * Animate adding a gift card to the player's collection
     *
     * Actions:
     *  - Adds gift as child of this player area
     *  - Animates gift sliding and attaching with slight rotation
     *
     * @param gift - Gift card to add
     * @returns Promise resolving when animation completes
     */
    addGift(gift) {
        gift.addToParent(this);
        return this.game.animationManager.slideAndAttach(gift.html, this.html, {
            duration: 800,
            //fromPlaceholder: "off",
            parallelAnimations: [
                {
                    keyframes: [{ rotate: '-5deg' }, { rotate: '0deg' }],
                },
            ],
        });
    }
    /**
     * Restore a gift card that was previously used (undo operation)
     *
     * Creates a new gift card with the given ID.
     *
     * @param gift - Gift card ID to restore
     */
    addGiftFromUndo(gift) {
        new Gift(this, gift);
    }
    /**
     * Activate or deactivate all gift cards in the collection for interaction
     * @param b - True to activate (default), false to deactivate
     */
    activateGifts(b = true) {
        for (const i in this.c.gift) {
            this.c.gift[i].activate(b);
        }
    }
}

/**
 * Manages a player's personal game area
 *
 * Contains all player-specific UI elements including:
 * postcards, gifts, hand, itinerary, player board, and bonus actions.
 *
 * Responsibilities:
 *  - Managing player's postcard collection
 *  - Managing player's gift cards
 *  - Managing player's travel hand (if current player)
 *  - Managing player's itinerary progress
 *  - Managing player's camp placement board
 *  - Managing player's bonus actions (if current player)
 *  - Activating/deactivating stamp and souvenir placement spaces
 */
class PlayerArea extends GameElement {
    // ========== Constructor ==========
    /**
     * Initialize the player area with all child elements
     * @param parent - Parent Game instance
     * @param child_id - Element ID
     * @param data - Player data containing all card and game state information
     */
    constructor(parent, child_id, data) {
        super(parent, child_id, "player_area");
        this.player_id = data.id;
        // Create itinerary track
        new Itinerary(this, 0, data.itinerary, data.itinerary_postcards);
        // Create player board (camps and personal board display)
        new PlayerBoard(this, 0, data.color, data.name, data.player_board_side, data.camps);
        // Create end game bonus if this player has it
        if (data.end_bonus === data.id) {
            new EndGameBonus(this, 0);
        }
        // Create gift player area
        new GiftPlayer(this, 0, data.gifts);
        // Create postcard player area
        new PostcardPlayer(this, 0, data.postcards);
        // Create bonus actions and hand only for current player
        if (this.game.bga.gameui.player_id === data.id) {
            if (this.game.bga.players.isCurrentPlayerActive()) {
                new BonusActions(this, 0, data.bonus_actions);
            }
            else {
                new BonusActions(this, 0);
            }
            new Hand(this, 0, data.hand);
        }
    }
    // ========== Public Methods ==========
    /**
     * Activate stamp placement spaces on postcards
     *
     * Allows the player to select where to place stamps on their postcards.
     *
     * @param spaces - Object mapping postcard IDs to arrays of available stamp space indices
     */
    activateStampSpaces(spaces) {
        this.c.postcard_player[0].activateStampSpaces(spaces);
    }
    /**
     * Activate souvenir placement spaces on postcards
     *
     * Allows the player to select where to place souvenirs on their postcards.
     *
     * @param spaces - Object mapping postcard IDs to arrays of available souvenir space indices
     */
    activateSouvenirSpaces(spaces) {
        this.c.postcard_player[0].activateSouvenirSpaces(spaces);
    }
    /**
     * Deactivate all souvenir placement spaces
     *
     * Disables all souvenir spaces across all postcards.
     */
    inactivateAllSouvenirSpaces() {
        this.c.postcard_player[0].inactivateAllSouvenirSpaces();
    }
    /**
     * Deactivate all stamp placement spaces
     *
     * Disables all stamp spaces across all postcards.
     */
    inactivateAllStampSpaces() {
        this.c.postcard_player[0].inactivateAllStampSpaces();
    }
}

/**
 * Handles all game notifications and animations
 *
 * Responsibilities:
 *  - Processing game notifications from the server
 *  - Animating game state changes (card movements, scoring, etc.)
 *  - Updating UI elements based on notification data
 *  - Managing undo operations and state rollbacks
 */
class Notif {
    // ========== Constructor ==========
    /**
     * Initialize the Notification handler
     * @param game - Main game instance
     */
    constructor(game) {
        this.game = game;
    }
    // ========== Action Notifications ==========
    /**
     * Handles movement notification - moves biker to new region
     * @param args - Contains player_id and region
     */
    async notif_move(args) {
        if (this.game.bga.gameui.player_id === args.player_id) {
            this.game.c.player_area[args.player_id].c.hand[0].inactivateAllTravels(true);
            this.game.c.board[0].inactivateAllRegions();
            this.game.c.player_area[args.player_id].c.postcard_player[0].activatePostcards(false);
            this.game.c.board[0].inactivateAllCampsites();
        }
        await this.game.c.board[0].moveBiker(args.player_id, args.region);
    }
    /**
     * Handles postcard taking notification - adds postcard to player area
     * @param args - Contains player_id and postcard id
     */
    async notif_postcard(args) {
        const postcard = this.game.c.postcard_supply[0].c.postcard[args.postcard];
        this.game.c.postcard_supply[0].rearrangeSupplyRow(postcard);
        await this.game.c.player_area[args.player_id].c.postcard_player[0].addPostcard(postcard);
    }
    /**
     * Handles postcard from deck notification - adds postcard from deck to player area
     * @param args - Contains player_id, postcard id, and optional top card
     */
    async notif_postcardDeck(args) {
        this.game.c.postcard_supply[0].activatePostcards(false);
        if (args.top !== undefined)
            this.game.c.postcard_supply[0].addPostcardToTop(args.top);
        const postcard = this.game.c.postcard_supply[0].c.postcard[args.postcard];
        await this.game.c.player_area[args.player_id].c.postcard_player[0].addPostcard(postcard);
    }
    /**
     * Handles camp placement notification - places camp on board
     * @param args - Contains player_id, camp id, region, and campsite location
     */
    async notif_camp(args) {
        this.game.c.board[0].inactivateAllCampsites();
        const camp = this.game.c.player_area[args.player_id].c.player_board[0].c.camp[args.camp];
        await this.game.c.board[0].addCamp(camp, args.player_id, args.region, args.campsite);
    }
    /**
     * Handles undo camp notification - removes camp from board and returns to player
     * @param args - Contains player_id, camp id, region, and campsite location
     */
    async notif_undoCamp(args) {
        this.game.c.board[0].camp_counters[args.player_id][this.game.c.board[0].campsites[args.region - 1][args.campsite - 1]].innerHTML = String(Number(this.game.c.board[0].camp_counters[args.player_id][this.game.c.board[0].campsites[args.region - 1][args.campsite - 1]].innerHTML) - 1);
        if (this.game.bga.gameui.player_id === args.player_id) {
            this.game.c.player_area[args.player_id].inactivateAllSouvenirSpaces();
            this.game.c.player_area[args.player_id].c.hand[0].inactivateAllTravels(true);
            this.game.c.player_area[args.player_id].c.postcard_player[0].activatePostcards(false);
        }
        const camp = this.game.c.board[0].c.camp[args.region * 10 + args.campsite];
        await this.game.c.player_area[args.player_id].c.player_board[0].addCamp(camp, args.camp);
    }
    /**
     * Handles souvenir placement notification - adds souvenir to postcard
     * @param args - Contains player_id, postcard id, and souvenir location
     */
    async notif_souvenir(args) {
        this.game.c.player_area[args.player_id].inactivateAllSouvenirSpaces();
        await this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard[args.postcard].addSouvenir(args.location);
    }
    /**
     * Handles undo souvenir notification - removes souvenir from postcard
     * @param args - Contains player_id, postcard id, and souvenir space
     */
    async notif_undoSouvenir(args) {
        if (this.game.bga.gameui.player_id === args.player_id) {
            this.game.c.player_area[args.player_id].c.bonus_actions[0].inactivateBonusActions();
            this.game.c.player_area[args.player_id].inactivateAllStampSpaces();
            this.game.c.player_area[args.player_id].c.hand[0].inactivateAllTravels(true);
            this.game.c.player_area[args.player_id].c.postcard_player[0].activatePostcards(false);
        }
        await this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard[args.postcard].removeSouvenir(args.space);
    }
    /**
     * Handles stamp placement notification - adds stamp to postcard
     * @param args - Contains player_id, postcard id, and stamp location
     */
    async notif_stamp(args) {
        this.game.c.player_area[args.player_id].inactivateAllStampSpaces();
        await this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard[args.postcard].addStamp(args.location);
    }
    /**
     * Handles undo stamp notification - removes stamp from postcard
     * @param args - Contains player_id, postcard id, and stamp space
     */
    async notif_undoStamp(args) {
        if (this.game.bga.gameui.player_id === args.player_id) {
            this.game.c.player_area[args.player_id].c.hand[0].inactivateAllTravels(true);
            this.game.c.player_area[args.player_id].c.postcard_player[0].activatePostcards(false);
        }
        await this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard[args.postcard].removeStamp(args.space);
    }
    // ========== Postcard Supply Notifications ==========
    /**
     * Handles discard postcards notification - discards supply row
     */
    async notif_discardPostcards() {
        await this.game.c.postcard_supply[0].discardPostcardSupply();
    }
    /**
     * Handles discard travels notification - discards travels from player hand
     * @param args - Contains player_id and array of travel ids to discard
     */
    async notif_discardTravels_(args) {
        this.game.c.player_area[args.player_id].c.hand[0].inactivateAllTravels(true);
        this.game.c.player_area[args.player_id].c.postcard_player[0].activatePostcards(false);
        await this.game.c.player_area[args.player_id].c.hand[0].discardTravels(args.travels);
    }
    /**
     * Handles refill travel supply notification - refills travel card from deck
     * @param args - Contains travel id and supply location
     */
    async notif_refillTravelSupply(args) {
        await this.game.c.board[0].refillTravel(args.travel, args.location);
    }
    /**
     * Handles undo discard travels notification - restores discarded travels to hand
     * @param args - Contains player_id and array of travel ids
     */
    async notif_undoDiscardTravels(args) {
        await this.game.c.player_area[args.player_id].c.hand[0].undoDiscardTravels(args.travels);
    }
    /**
     * Handles refill postcard supply notification - refills postcard supply
     * @param args - Contains optional top card id
     */
    async notif_refillPostcardSupply(args) {
        await this.game.c.postcard_supply[0].refillPostcardSupply(args.top);
    }
    /**
     * Handles travel card selection notification - adds travel to player hand or animates away
     * @param args - Contains player_id and travel id
     */
    async notif_travel(args) {
        this.game.c.board[0].activateTravelDeck(false);
        this.game.c.board[0].activateAllTravels(false);
        const travel = this.game.c.board[0].c.travel[args.travel];
        if (this.game.bga.gameui.player_id === args.player_id) {
            await this.game.c.player_area[args.player_id].c.hand[0].addTravel(travel);
        }
        else {
            await this.game.animationManager.fadeOutAndDestroy(travel.html, this.game.bga.playerPanels.getElement(args.player_id), {
                duration: 800,
            });
            delete this.game.c.board[0].c.travel[args.travel];
        }
    }
    /**
     * Handles gift card selection notification - adds gift to player area
     * @param args - Contains player_id and gift id
     */
    async notif_gift(args) {
        this.game.c.board[0].activateAllGifts(false);
        const gift = this.game.c.board[0].c.gift[args.gift];
        delete this.game.c.board[0].c.gift[args.gift];
        await this.game.c.player_area[args.player_id].c.gift_player[0].addGift(gift);
    }
    /**
     * Handles undo travel notification - returns travel card to board supply
     * @param args - Contains player_id, travel id, and location
     */
    async notif_undoTravel(args) {
        if (this.game.bga.gameui.player_id === args.player_id) {
            const travel = this.game.c.player_area[args.player_id].c.hand[0].c.travel[args.travel];
            await this.game.c.board[0].addTravel(travel, args.location);
        }
        else {
            await this.game.c.board[0].refillTravel(args.travel, args.location);
        }
    }
    /**
     * Handles travel deck draw notification - animates travel taken from deck
     * @param args - Contains player_id
     */
    async notif_travelDeck(args) {
        this.game.c.board[0].activateTravelDeck(false);
        this.game.c.board[0].activateAllTravels(false);
        if (this.game.bga.gameui.player_id !== args.player_id) {
            const element = document.createElement('travel_deck');
            await this.game.animationManager.slideFloatingElement(element, this.game.c.board[0].c.travel_deck[0].html, this.game.bga.playerPanels.getElement(args.player_id), { duration: 800, parallelAnimations: [{ keyframes: [{ opacity: '1' }, { opacity: '0' }] }] });
        }
    }
    /**
     * Handles refill gift notification - refills gift card from deck
     * @param args - Contains player_id, gift id, and location
     */
    async notif_refillGift(args) {
        await this.game.c.board[0].refillGift(args.gift, args.location);
        this.game.c.board[0].c.gift[args.gift].setArg("deck", false);
    }
    /**
     * Handles travel from deck notification - adds travel from deck to player hand
     * @param args - Contains player_id and travel id
     */
    async notif_travelDeck_(args) {
        const travel = this.game.c.board[0].createTravelToDeck(args.travel);
        travel.setArg("deck", true);
        await this.game.c.player_area[args.player_id].c.hand[0].addTravelFromDeck(travel);
        travel.setArg("deck", false);
    }
    /**
     * Handles send postcard notification - removes postcard from player area
     * @param args - Contains player_id and postcard id
     */
    async notif_send(args) {
        const postcard = this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard[args.postcard];
        delete this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard[args.postcard];
        await this.game.animationManager.fadeOutAndDestroy(postcard.html, this.game.bga.playerPanels.getElement(args.player_id), {
            duration: 800,
            ignoreRotation: false,
            parallelAnimations: [
                {
                    keyframes: [{ transform: 'scale(1)' }, { transform: 'scale(0)' }],
                },
            ],
        });
    }
    /**
     * Handles undo send postcard notification - restores postcard to player area
     * @param args - Contains player_id, postcard id, stamps, and souvenirs
     */
    notif_undoSend(args) {
        this.game.c.player_area[args.player_id].c.postcard_player[0].undoSend(args.postcard, args.stamps, args.souvenirs);
    }
    /**
     * Handles best traveller scoring notification - displays scoring for region camps
     * @param args - Contains player_color and region
     */
    async notif_best_traveller(args) {
        for (const c in this.game.c.board[0].c.camp) {
            if (this.game.c.board[0].c.camp[c].args.region === args.region) {
                this.game.animationManager.displayScoring(this.game.c.board[0].c.camp[c].html, 1, args.player_color);
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    // ========== Bonus and End Game Notifications ==========
    /**
     * Handles end bonus notification - moves end game bonus to player area
     * @param args - Contains player_id
    */
    async notif_endBonus(args) {
        this.game.c.board[0].c.end_game_bonus[0].addToParent(this.game.c.player_area[args.player_id]);
        await this.game.animationManager.slideAndAttach(this.game.c.player_area[args.player_id].c.end_game_bonus[0].html, this.game.c.player_area[args.player_id].html, { duration: 800 });
    }
    /**
     * Handles undo end bonus notification - returns end game bonus to board
     * @param args - Contains player_id
     */
    async notif_undoEndBonus(args) {
        this.game.c.player_area[args.player_id].c.end_game_bonus[0].addToParent(this.game.c.board[0]);
        await this.game.animationManager.slideAndAttach(this.game.c.board[0].c.end_game_bonus[0].html, this.game.c.board[0].html, { duration: 800 });
    }
    /**
     * Handles end bonus scoring notification - displays scoring animation for bonus
     * @param args - Contains player_id, player_color, amount, and gift
     */
    async notif_scoreEndBonus(args) {
        await this.game.animationManager.displayScoring(this.game.c.player_area[args.player_id].c.end_game_bonus[0].html, 3, args.player_color);
    }
    /**
     * Handles unsent postcards scoring notification - displays scoring for unsent cards
     * @param args - Contains player_id and player_color
     */
    async notif_scoreUnsentPostcards(args) {
        for (const p in this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard) {
            this.game.animationManager.displayScoring(this.game.c.player_area[args.player_id].c.postcard_player[0].c.postcard[p].html, 1, args.player_color);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    /**
     * Handles gift scoring notification - displays scoring for gift card
     * @param args - Contains player_id, player_color, amount, and gift id
     */
    async notif_scoreGift(args) {
        await this.game.animationManager.displayScoring(this.game.c.player_area[args.player_id].c.gift_player[0].c.gift[args.gift].html, args.n, args.player_color);
    }
    /**
     * Handles itinerary scoring notification - displays scoring for itinerary completion
     * @param args - Contains player_id, player_color, and amount
     */
    async notif_scoreItinerary(args) {
        this.game.c.player_area[args.player_id].html?.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
        await this.game.bga.gameui.wait(1000);
        await this.game.animationManager.displayScoring(this.game.c.player_area[args.player_id].c.itinerary[0].html, args.n, args.player_color);
    }
    /**
     * Handles action gift notification - removes gift card after use
     * @param args - Contains player_id and gift id
     */
    async notif_actionGift(args) {
        const gift = this.game.c.player_area[args.player_id].c.gift_player[0].c.gift[args.gift];
        gift.html.remove();
        delete this.game.c.player_area[args.player_id].c.gift_player[0].c.gift[args.gift];
    }
    /**
     * Handles undo action gift notification - restores gift card
     * @param args - Contains player_id and gift id
     */
    async notif_undoActionGift(args) {
        this.game.c.player_area[args.player_id].c.gift_player[0].addGiftFromUndo(args.gift);
    }
    // ========== Guide Phase Notifications ==========
    /**
     * Handles reveal guide postcards notification - displays postcard selection guide
     * @param args - Contains optional deck card and array of postcards
     */
    async notif_revealGuidePostcards(args) {
        await this.game.revealGuidePostcards(args.deck, args.postcards);
    }
    /**
     * Handles guide notification - adds two postcards to player from guide
     * @param args - Contains player_id and two postcard ids
     */
    async notif_guide(args) {
        this.game.c.postcard_guide[0].activatePostcards(false);
        const postcard_1 = this.game.c.postcard_guide[0].c.postcard[args.postcard_1];
        await this.game.c.player_area[args.player_id].c.postcard_player[0].addPostcard(postcard_1);
        const postcard_2 = this.game.c.postcard_guide[0].c.postcard[args.postcard_2];
        await this.game.c.player_area[args.player_id].c.postcard_player[0].addPostcard(postcard_2);
        this.game.c.postcard_guide[0].html.remove();
        delete this.game.c.postcard_guide[0];
    }
    /**
     * Handles guide1 notification - adds one postcard to player from guide
     * @param args - Contains player_id and postcard id
     */
    async notif_guide1(args) {
        this.game.c.postcard_guide[0].activatePostcards(false);
        const postcard_1 = this.game.c.postcard_guide[0].c.postcard[args.postcard_1];
        await this.game.c.player_area[args.player_id].c.postcard_player[0].addPostcard(postcard_1);
    }
    /**
     * Handles reveal top postcard notification - reveals top card of postcard deck
     * @param args - Contains player_id and top card id
     */
    async notif_revealTopPostcard(args) {
        this.game.c.postcard_supply[0].addPostcardToTop(args.top);
    }
    /**
     * Handles itinerary notification - activates circle on itinerary
     * @param args - Contains player_id and circle number
     */
    async notif_itinerary(args) {
        this.game.c.player_area[args.player_id].c.itinerary[0].c.circle[args.n].activate();
    }
    // ========== Counter Notifications ==========
    /**
     * Handles table counter update notification - updates various game counters
     * @param args - Contains counter name, value, oldValue, inc, absInc, and playerId
     */
    notif_setTableCounter(args) {
        if (args.name === 'postcards_counter') {
            if (args.value === 2)
                this.game.c.postcard_supply[0].setArg("count", 2);
            else if (args.value === 1 || args.value === 0)
                this.game.c.postcard_supply[0].setArg("count", 1);
            else
                this.game.c.postcard_supply[0].setArg("count", 3);
        }
        else if (args.name === 'travels_counter') {
            if (args.value === 2)
                this.game.c.board[0].c.deck_stack[0].setArg("count", 2);
            else if (args.value === 1)
                this.game.c.board[0].c.deck_stack[0].setArg("count", 1);
            else
                this.game.c.board[0].c.deck_stack[0].setArg("count", 3);
        }
        else if (args.name === 'move_bonus_counter') {
            if (this.game.bga.players.isCurrentPlayerActive()) {
                if (args.value === 0)
                    this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[1].setArg("count", 0);
                else if (args.value === 1)
                    this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[1].setArg("count", 1);
                else
                    this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[1].setArg("count", 2);
            }
        }
        else if (args.name === 'postcard_bonus_counter') {
            if (this.game.bga.players.isCurrentPlayerActive()) {
                if (args.value === 0)
                    this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[2].setArg("count", 0);
                else if (args.value === 1)
                    this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[2].setArg("count", 1);
                else
                    this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[2].setArg("count", 2);
            }
        }
        else if (args.name === 'camp_bonus_counter') {
            if (this.game.bga.players.isCurrentPlayerActive()) {
                if (args.value === 0)
                    this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[3].setArg("count", 0);
                else if (args.value === 1)
                    this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[3].setArg("count", 1);
                else
                    this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[3].setArg("count", 2);
            }
        }
        else if (args.name === 'stamp_bonus_counter') {
            if (this.game.bga.players.isCurrentPlayerActive()) {
                if (args.value === 0)
                    this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[4].setArg("count", 0);
                else if (args.value === 1)
                    this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[4].setArg("count", 1);
                else
                    this.game.c.player_area[this.game.bga.gameui.player_id].c.bonus_actions[0].c.travel_option[4].setArg("count", 2);
            }
        }
    }
    // ========== Undo Management ==========
    /**
     * Handles cancel notifs notification - marks logs for undo operations
     * @param args - Contains array of notification IDs to cancel
     */
    async notif_cancelNotifs(args) {
        this.game.cancelLogs(args.notifIds);
    }
}

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
const BgaAnimations = await globalThis.importEsmLib('bga-animations', '1.x');
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
class Game {
    // ========== Constructor ==========
    /**
     * Initialize game with BGA framework
     * @param bga - BGA framework instance
     */
    constructor(bga) {
        /** Current game state data */
        this.gamedatas = null;
        /** Mapping of notification UIDs to log element IDs for undo/cancel */
        this._notif_uid_to_log_id = {};
        /** Mapping of notification UIDs to mobile log element IDs */
        this._notif_uid_to_mobile_log_id = {};
        /** Current player ID */
        this.player_id = null;
        /** Root HTML element for game UI */
        this.html = null;
        /** Registry of game elements by type and ID */
        this.c = {};
        /** Sent postcards counters for each player */
        this.sentPostcardsCounters = [];
        /** Notification handler (for undo/action tracking) */
        this.notif = null;
        this.bga = bga;
        this.setupStates();
        this.setupUndoLogging();
    }
    // ========== Initialization Methods ==========
    /**
     * Register all game state handlers
     * @private
     */
    setupStates() {
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
    setupUndoLogging() {
        const originalOnPlaceLogOnChannel = this.bga.gameui.onPlaceLogOnChannel.bind(this.bga.gameui);
        this.bga.gameui.onPlaceLogOnChannel = (msg) => {
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
    setup(game_data) {
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
    preloadImages(game_data) {
        if (game_data.player_board_side) {
            this.bga.images.preloadImage('player_board/player_board_a.jpg');
        }
        else {
            this.bga.images.preloadImage('player_board/player_board_b.jpg');
        }
    }
    /**
     * Initialize animation manager and zoom controls
     * @private
     */
    initializeManagers() {
        this.animationManager = new BgaAnimations.Manager({
            animationsActive: () => this.bga.gameui.bgaAnimationsActive()
        });
        // @ts-ignore - ZoomManager is not strictly typed
        const zoomLevels = Array.from({ length: 20 }, (_, index) => 0.3 + index * 0.05);
        this.zoom = new ZoomManager({
            element: this.bga.gameArea.getElement(),
            localStorageZoomKey: 'postcards-zoom',
            zoomControls: { color: 'black' },
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
    setupPlayerPanels(game_data) {
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
            this.bga.gameui.addTooltipHtml(`sent_postcards_${player.id}`, `<h3>${_("Number of sent Postcards")}</h3>`);
            // First player marker
            if (player.player_no === 1) {
                const firstPlayerMarker = document.createElement('first_player_marker');
                firstPlayerMarker.id = "first_player_marker";
                playerElement.appendChild(firstPlayerMarker);
                this.bga.gameui.addTooltipHtml("first_player_marker", `<h3>${_("First Player Token")}</h3>`);
            }
        }
    }
    /**
     * Create main game elements (board, player areas, supply, etc.)
     * @param game_data - Game data
     * @private
     */
    createGameElements(game_data) {
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
    setupNotifications() {
        this.notif = new Notif(this);
        this.bga.notifications.setupPromiseNotifications({
            minDuration: 0,
            minDurationNoText: 0,
            handlers: [this.notif],
            onStart: (notfname, msg, args) => {
                const pagemaintitle = document.getElementById("pagemaintitle_wrap");
                if (pagemaintitle)
                    pagemaintitle.style.display = "none";
                const gameaction = document.getElementById("gameaction_status_wrap");
                if (gameaction)
                    gameaction.style.display = "block";
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
    onEnteringState(stateName, args) {
        if (this.bga.players.isCurrentPlayerActive() && args.args?.used_travels !== undefined) {
            const hand = this.c.player_area?.[this.bga.gameui.player_id]?.c.hand?.[0];
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
    onLeavingState(stateName) {
        if (this.bga.players.isCurrentPlayerActive()) {
            const hand = this.c.player_area?.[this.bga.gameui.player_id]?.c.hand?.[0];
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
    addUndoButtons(undo) {
        if (undo > 0) {
            this.bga.statusBar.addActionButton(_("Undo"), () => { this.bga.actions.performAction('actUndo'); }, { color: "alert" });
        }
        if (undo > 1) {
            this.bga.statusBar.addActionButton(_("Reset"), () => { this.bga.actions.performAction('actReset'); }, { color: "alert" });
        }
    }
    /**
     * Cancel notification logs for undo functionality
     * Marks logs with cancel attribute to hide them visually
     * @param notifIds - Array of notification UIDs to cancel
     */
    cancelLogs(notifIds) {
        notifIds.forEach((uid) => {
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
    createBar(type, text) {
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
    async revealGuidePostcards(deck, postcards) {
        new PostcardGuide(this, 0);
        const supply = this.c.postcard_supply?.[0];
        if (!supply) {
            throw new Error('Postcard supply not found');
        }
        const topCard = supply.removePostcardFromTop();
        let deckCard = null;
        if (deck !== null) {
            deckCard = supply.addPostcardToTop(deck);
        }
        const guide = this.c.postcard_guide?.[0];
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
    getOrderedOtherPlayers(players) {
        let ordered = Object.values(players).sort((a, b) => a.player_no - b.player_no);
        if (!this.bga.players.isCurrentPlayerSpectator()) {
            const currentPlayerIndex = ordered.findIndex((p) => p.id === this.bga.gameui.player_id);
            ordered = [...ordered.slice(currentPlayerIndex), ...ordered.slice(0, currentPlayerIndex)];
            return ordered.filter((p) => p.id !== this.bga.gameui.player_id);
        }
        else
            return ordered;
    }
}

export { Game };
