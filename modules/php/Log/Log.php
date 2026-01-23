<?php

namespace Bga\Games\Postcards\Log;

use BgaSystemException;

/**
 * Trait providing log management utilities.
 *
 * Responsibilities:
 * - Persisting game actions to the log table
 * - Retrieving log entries for undo/redo
 * - Clearing log entries with gamelog linkage
 */
trait Log
{
	/**
	 * Get the number of log entries.
	 *
	 * @param bool $undoable Include only undoable entries if false.
	 * @param bool $help Include help entries if true.
	 * @return int Log entry count.
	 * @throws BgaSystemException
	 */
	public function getLogLength(bool $undoable = true, bool $help = true): int
	{
		$where = [];
		if (!$help) {
			$where[] = "type != 0";
		}
		if (!$undoable) {
			$lastNonUndoableId = $this->getUniqueValueFromDb("SELECT id FROM log WHERE undoable = false ORDER BY id DESC LIMIT 1");
			if ($lastNonUndoableId !== null) {
				$where[] = "id > {$lastNonUndoableId}";
			}
		}
		$whereClause = empty($where) ? "" : "WHERE " . implode(" AND ", $where);
		return (int)$this->getUniqueValueFromDB("SELECT COUNT(*) FROM log {$whereClause}");
	}

	/**
	 * Save a log entry with optional arguments.
	 *
	 * @param LogType    $type     Log entry type.
	 * @param array|null $args     Optional arguments stored as JSON.
	 * @param int        $undoable Whether the entry is undoable (1/0).
	 * @throws BgaSystemException
	 */
	public function saveLog(LogType $type, ?array $args = null, int $undoable = 1): void
	{
		$id = $this->getLogLength();
		$gamelog_move_id = $this->getUniqueValueFromDB("SELECT gamelog_move_id FROM gamelog ORDER BY gamelog_move_id DESC LIMIT 1") + 1;
		if ($args === null) $this->DbQuery("INSERT INTO log (id, gamelog_move_id, type, undoable) VALUES ({$id}, {$gamelog_move_id},'{$type->value}', {$undoable})");
		else $this->DbQuery("INSERT INTO log (id, gamelog_move_id, type, args, undoable) VALUES ({$id}, {$gamelog_move_id},'{$type->value}','" . json_encode($args) . "', {$undoable})");
	}

	/**
	 * Get the last log entry (optionally offset by $n).
	 *
	 * @param int $n Offset from the last entry (0 = last).
	 * @return array|null The log entry or null if none.
	 * @throws BgaSystemException
	 */
	public function getLastLog(int $n = 0): ?array
	{
		$id = $this->getLogLength() - 1 - $n;
		if ($id < 0) return null;
		$log = $this->getObjectFromDB("SELECT * FROM log WHERE id = {$id}");
		
		$log["type"] = LogType::getLogType($log["type"]);
		$log["gamelog_move_id"] = intval($log["gamelog_move_id"]);
		if ($log["args"] !== null) $log["args"] = json_decode($log["args"], true);
		$log["undoable"] = boolval($log["undoable"]);
		
		return $log;
	}

	/**
	 * Get the gamelog_move_id of the last log entry.
	 *
	 * @return int Last gamelog_move_id.
	 * @throws BgaSystemException
	 */
	public function getLastLogGamelogId(): int
	{
		return $this->getUniqueValueFromDB("SELECT gamelog_move_id FROM log ORDER BY id DESC LIMIT 1");
	}

	/**
	 * Cancel and remove the last log entry.
	 *
	 * @throws BgaSystemException
	 */
	public function clearLastLog(): void
	{
		$this->DbQuery("UPDATE gamelog SET `cancel` = true WHERE gamelog_move_id = {$this->getLastLogGamelogId()}");
		$this->DbQuery("DELETE FROM log ORDER BY id DESC LIMIT 1");
	}

	/**
	 * Delete all log entries.
	 */
	public function clearFullLog(): void
	{
		$this->DbQuery("DELETE FROM log");
	}
}