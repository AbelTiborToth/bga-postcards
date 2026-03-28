<?php

/*
 * From this file, you can edit the various meta-information of your game.
 *
 * Once you modified the file, don't forget to click on "Reload game informations" from the Control Panel in order in can be taken into account.
 *
 * See documentation about this file here:
 * http://en.doc.boardgamearena.com/Game_meta-information:_gameinfos.inc.php
*/

$gameinfos = [
    'game_name' => "Postcards",
    'publisher' => 'Synapses Games',
    'publisher_website' => 'https://www.jeuxsynapsesgames.com/',
    'publisher_bgg_id' => 39502,
    'bgg_id' => 429423,
    'players' => [2, 3, 4],
    'suggest_player_number' => null,
    'not_recommend_player_number' => null,
    'estimated_duration' => 30,
    'fast_additional_time' => 30,
    'medium_additional_time' => 40,
    'slow_additional_time' => 50,
	'tie_breaker_split' => array(100, 1),
    'tie_breaker_description' => "In case of a tie, the player who sent the most Postcards wins. If there’s still a tie, the player who placed the most Camp tokens wins. If the tie persists, the tied players share the victory.",
	'losers_not_ranked' => false,
	'solo_mode_ranked' => false,
    'is_coop' => 0,
    'language_dependency' => false,
    'player_colors' => ['174D62', 'A4C877', 'EE7628', 'FCC922'],
    'favorite_colors_support' => true,
    'disable_player_order_swap_on_rematch' => false,
    'game_interface_width' => ['min' => 900],
];