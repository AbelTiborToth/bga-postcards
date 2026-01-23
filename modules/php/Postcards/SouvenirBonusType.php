<?php

namespace Bga\Games\Postcards\Postcards;

/**
 * Souvenir bonus effects granted when placing souvenirs on postcards.
 * Determines which immediate bonus a souvenir space provides.
 */
enum SouvenirBonusType: int
{
	/** Gain 2 movement actions */
	case Move = 0;
	/** Perform a postcard action */
	case Postcard = 1;
	/** Perform a camp action */
	case Camp = 2;
	/** Place a stamp token */
	case Stamp = 3;
	/** Play an additional travel card */
	case Travel = 4;
	/** Immediately score 2 points */
	case Point = 5;
}