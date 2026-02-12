import { GameElement } from "../gameElement";
import { PlayerBoard } from "../player_area/player_board/player_board";
import { Board } from "../board/board";

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
export class Camp extends GameElement {
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
	public constructor(
		parent: PlayerBoard | Board,
		child_id: number,
		color: string,
		location: number,
		region: number = 0,
		campsite: number = 0
	) {
		super(parent, child_id, "camp", { color, location, region, campsite });
	}
}