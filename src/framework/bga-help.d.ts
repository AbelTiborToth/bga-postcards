interface HelpPopinSettings {
    /**
     * The popin title.
     */
    title: string;
    /**
     * The HTML content to put on the popin.
     */
    html?: string;
    /**
     * A function to call when the popin is created.
     */
    onPopinCreated?: (popinContentElement: HTMLElement) => void;
    /**
     * Classes to add to the button, separated by spaces
     */
    buttonExtraClasses?: string;
    /**
     * Css background property for the help background.
     * Default 'black'.
     */
    buttonBackground?: string;
    /**
     * Css background property for the "?" color.
     * Default 'white'.
     */
    buttonColor?: string;
}
interface HelpExpandableSettings {
    /**
     * Content of the button, when folded
     */
    foldedHtml?: string;
    /**
     * Classes to add to the folded content
     */
    foldedContentExtraClasses?: string;
    /**
     * Content of the button, when unfolded
     */
    unfoldedHtml?: string;
    /**
     * Classes to add to the unfolded content
     */
    unfoldedContentExtraClasses?: string;
    /**
     * Classes to add to the button, separated by spaces
     */
    buttonExtraClasses?: string;
    /**
     * Css size of the width when expanded.
     * Default 'auto'. Note that auto will not provide a expand animation, you need to set a fixed size (in px for example) to make it work.
     */
    expandedWidth?: string;
    /**
     * Css size of the height when expanded.
     * Default 'auto'. Note that auto will not provide a expand animation, you need to set a fixed size (in px for example) to make it work.
     */
    expandedHeight?: string;
    /**
     * Css size of the radius when expanded.
     * Default '10px'.
     */
    expandedRadius?: string;
    /**
     * If the help button is folded by default.
     * If you set it to false, you really should set localStorageFoldedKey so players don't have to close it everytime if they are not interested.
     * Default true.
     */
    defaultFolded?: boolean;
    /**
     * The key used to persist the folded state on localStorage.
     * Default (unset) is no storage.
     */
    localStorageFoldedKey?: string;
}
declare abstract class BgaHelpButton {
    abstract add(toElement: HTMLElement): void;
}
declare class BgaHelpPopinButton extends BgaHelpButton {
    private settings;
    constructor(settings: HelpPopinSettings);
    add(toElement: HTMLElement): void;
    protected showHelp(): void;
}
declare class BgaHelpExpandableButton extends BgaHelpButton {
    private settings;
    constructor(settings: HelpExpandableSettings);
    add(toElement: HTMLElement): void;
}
interface HelpSettings {
    /**
     * The list of buttons to show on the bottom left corner of the screen.
     */
    buttons: BgaHelpButton[];
}
declare class HelpManager {
    private game;
    constructor(game: any, settings: HelpSettings);
}
