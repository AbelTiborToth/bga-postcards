<?php

namespace Bga\Games\Postcards\Log\Undo;

use Bga\GameFramework\States\PossibleAction;
use BgaSystemException;
use BgaVisibleSystemException;

/**
 * Trait providing undo/reset action handling.
 *
 * Responsibilities:
 * - Undo the last undoable game action (and related notifications)
 * - Reset the turn by undoing all actions since the last non-undoable entry
 */
trait Undo
{
	/**
	 * Undo the last undoable action.
	 *
	 * Flow:
	 *  - Fetch last log entry
	 *  - Validate undoable flag
	 *  - Cancel related notifications (if any)
	 *  - Call processUndoMethod and pop the log
	 *  - Repeat until a state is returned
	 *
	 * @param int $active_player_id Current active player.
	 * @return string Next state name to transition to.
	 * @throws BgaSystemException
	 * @throws BgaVisibleSystemException
	 */
	#[PossibleAction]
	public function actUndo(int $active_player_id): string
	{
		do {
			$log = $this->game->getLastLog();
			if (!$log["undoable"]) throw new BgaVisibleSystemException("Undo.php [actUndo] - Can't undo this action: {$log["type"]->value}");
			$notifs = $this->game->getUniqueValueFromDb("SELECT `gamelog_notification` FROM gamelog WHERE `gamelog_move_id` = {$log['gamelog_move_id']} ORDER BY 1 LIMIT 1");
			if ($notifs !== null) {
				$this->notify->all("cancelNotifs",'', ["notifIds" => array_map(function ($value) {return $value["uid"];}, json_decode($notifs, true))]);
			}
			$state = $this->game->processUndoMethod($active_player_id, $log);
			$this->game->clearLastLog();
		} while ($state === null);
		$this->game->dbQuery("DELETE FROM gamelog WHERE `cancel` = 1");
		return $state;
	}

	/**
	 * Reset the turn by undoing all undoable actions since the last non-undoable log.
	 *
	 * @param int $active_player_id Current active player.
	 * @return string Next state name after reset.
	 * @throws BgaSystemException
	 * @throws BgaVisibleSystemException
	 */
	#[PossibleAction]
	public function actReset(int $active_player_id): string
	{
		$log_length = $this->game->getLogLength(false, false);
		$state = null;
		for ($i = 0; $i < $log_length; $i++) $state = $this->actUndo($active_player_id);
		if ($state === null) throw new BgaVisibleSystemException("Undo.php [actReset] - No log to undo during reset}");
		return $state;
	}
}