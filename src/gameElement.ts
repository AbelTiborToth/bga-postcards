import { Game } from "./game";

/**
 * Base class for all game elements.
 * Responsible for:
 *  - Managing parent/child relationships
 *  - Creating and attaching HTML elements
 *  - Storing element arguments and attributes
 */
export abstract class GameElement {
    private static ID_GEN: number = 0;

    readonly id: number;
    readonly name: string;
    readonly game: Game;

    parent: Game | GameElement;
    child_id: number;

    readonly c: Record<string, Record<number, GameElement>> = {};
    readonly args: Record<string, string | number | boolean>;
    html: HTMLElement;

    protected constructor(
        parent: GameElement | Game,
        child_id: number,
        name: string,
        args: Record<string, string | number | boolean> = {}
    ) {
        this.id = GameElement.ID_GEN++;
        this.name = name;
        this.game =
            (parent as GameElement).game === undefined
                ? (parent as Game)
                : (parent as GameElement).game;

        this.child_id = child_id;
        this.args = { ...args };

        this.addToParent(parent);
        this.createHtmlElement();
        
        this.parent = parent;
        this.html = document.getElementById(`postcards_${this.id}`) as HTMLElement;

    }

    /**
     * Adds this element to its parent, updating the parent's child registry.
     */
    public addToParent(parent: GameElement | Game, new_child_id: number | null = null): void {
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

        this.html = document.getElementById(`postcards_${this.id}`) as HTMLElement;
    }

    /**
     * Creates the HTML element representing this game element.
     */
    protected createHtmlElement(): void {
        const elementId = `postcards_${this.id}`;
        const element = document.createElement(this.name);

        element.classList.add(this.name);
        element.id = elementId;

        for (const [key, value] of Object.entries(this.args)) {
            if (value !== null) {
                element.setAttribute(key, String(value));
            }
        }

        this.parent.html!.appendChild(element);
        this.html = element;

        if (!this.html) {
            throw new Error(`Failed to create element with id: ${elementId}`);
        }
    }

    /**
     * Updates an argument and its corresponding HTML attribute.
     */
    public setArg(name: string, value: string | number | boolean): void {
        this.html.setAttribute(name, String(value));
        this.args[name] = value;
    }
}