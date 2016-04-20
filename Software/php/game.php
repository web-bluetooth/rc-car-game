<?php
	/*

	** 	This php file makes it possible for the Physical Web Car to create and take part in
	** 	game sessions with other players.
	** 	The code in this file is a draft intended for testing purposes.
	** 	Any feedback and improvement is welcome

	**	The following database and table setup may be used to interact with this script:

	CREATE TABLE IF NOT EXISTS `game` (
	  `timestamp` int(11) NOT NULL,
	  `timeout` int(11) NOT NULL,
	  `id` tinytext CHARACTER SET latin1 NOT NULL,
	  `status` int(11) NOT NULL,
	  `defaultScore` int(11) NOT NULL,
	  `player_1` text CHARACTER SET latin1 NOT NULL,
	  `player_2` text CHARACTER SET latin1 NOT NULL,
	  `player_3` text CHARACTER SET latin1 NOT NULL,
	  `player_4` text CHARACTER SET latin1 NOT NULL,
	  UNIQUE KEY `timestamp` (`timestamp`)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
	
	*/

	// Open database connection

	$host = 		"host";
	$username = 	"user";
	$password = 	"password";
	$dbname = 		"db";

	if($db = new mysqli($host, $username, $password, $dbname));

	$db->set_charset("utf8");


	// Fetch parameters form querystring

	$type = querystring("t");
	$timeToJoin = querystring('ttj');
	$score = querystring('l');
	$gameId = querystring('gid');
	$playerId =	querystring('pid');
	$playerName = querystring('pname');

	$jsonp = $_GET['callback'];

	switch ($type) {
		case 'create':
		global $db;
			// Create random 5 char ID for new game
			$gameId = createGame();

			// New player object
			$id = 1; // ID is set to 1 for the player who creates the game
			$player = new Player($gameId, $playerName, $score, $id);

			// Save player object as JSON to database
			$playerJsonId = 'player_1';
			$playerJson = json_encode($player, JSON_UNESCAPED_UNICODE);
			$sql = "UPDATE game SET $playerJsonId = '$playerJson' WHERE id = '$gameId'";
			$db->query($sql);

			// Player JSON to be returned to js with JSONP
			$response = $playerJson;
			break;
		case 'join':
			// Join an already created game

			// Create new player object
			$player = new Player($gameId, $playerName);

			// joingame() returns player object as JSON to be returned to js
			$response = joinGame($player, $gameId);
			break;
		case 'u':
			// Update settings for player

			// Create new player object
			$player = new Player($gameId, $playerName, $score, $playerId);

			// The update() method returns the gameStatus.
			// If more than one player is still active, player object is returned as JSON.
			// If only one player has lives left, the game is over, and JSON with gameStatus: finished is returned
			$u = $player->update($gameId, $playerId, $score);
			if($u == 'updated' || $u == 'ongoing')
				$response = json_encode($player, JSON_UNESCAPED_UNICODE);
			else if($u == 'finished') {
				$s = $player->gameStatus;
				$response = "{ 'gameStatus': $s }";
			}
		default:
			//
			break;
	}

	//**
	//		Actions
	//**

	// Print the response
	echo "$jsonp (\n";
	echo $response;
	echo ");\n";


	//**
	//		Player class
	//**

	class Player {
		public $id;
		public $gameId;
		public $name;
		public $score;
		public $hitsTaken;
		public $countdown;
		public $gameStatus;

		// Public methods

		public function __construct($gameId, $name = 'Joe', $score = 10, $id = "") {
			// Getting the basic information about the player
			if($id == "")
				$this->id = $this->numberOfPlayers($gameId) + 1;
			else
				$this->id = $id;
			$this->gameId = $gameId;
			$this->name = $name;
			$this->score = $score;
			$this->gameStatus = 10;


		}

		// Function that receives player data from the js and saves it to the database
		public function update($gameId, $playerId, $score) {
			global $db;
			$this->score = $score;
			$status = $this->gameStatus($gameId);
			$this->gameStatus = $status;

			if($status != 10)
				return 'finished';
			else {

				$playerJsonId = 'player_' . $playerId;
				$playerJson = json_encode($this, JSON_UNESCAPED_UNICODE);
				$sql = "UPDATE game SET $playerJsonId = '$playerJson' WHERE id = '$gameId'";
				$db->query($sql);

				if($score != 0)
					return 'updated';
				else
					return 'ongoing';
			}
		}

		// Function that returns the number of players that's already joined the game
		public function numberOfPlayers($gameId) {
			global $db;

			$timeOut = time();

			$sql = "SELECT * FROM game WHERE id = '$gameId'";
			$q = $db->query($sql);
			$r = $q->fetch_assoc();
			$count = 0;

			for($i = 1; $i <= 4; $i++) {
				if($r["player_$i"] != "")
					$count++;
			}

			return $count;
		}


		public function getId() {
			return $this->id;
		}

		public function getName() {
			return $this->name;
		}

		public function getscore() {
			return $this->score;
		}

		public function setName($name) {
			return $this->name = $name;
		}

		public function setscore($score) {
			return $this->score = $score;
		}

		// Private methods

		// Function that returns
		private function gameStatus($gameId) {
			global $db;
			$stillActive = array();

			// Check game status
			$sql = "SELECT * FROM game WHERE id = '$gameId'";
			$q = $db->query($sql);
			$r = $q->fetch_assoc();
			$status = $r['status'];
			$this->gameStatus = $status;

			$playerCount = $this->numberOfPlayers($gameId);

			if($playerCount == 1)
				return 1;

			// Save player data to array if still active (in the sense that the player has > 0 lives left)
			for($k = 1; $k <= $playerCount; $k++) {
				$pId = 'player_' . $k;
				$obj = json_decode($r[$pId]);
				if($obj->score > 0)
					$stillActive[$k] = $obj->score;
			}

			// Check if more than one player is still active. If not, the games is over and the active player has won
			if(sizeof($stillActive) > 1) {
				$sql = "UPDATE game SET status = 10 WHERE id = '$gameId'";
				$db->query($sql);

				return 10;
			} else {
				$s = key($stillActive);
				$sql = "UPDATE game SET status = $s WHERE id = '$gameId'";
				$db->query($sql);

				return $s;
			}
		}
	}

	//**
	// 		Global functions
	//**

	function createGame() {
		global $timeToJoin;
		global $db;
		global $gameId;
		global $score;

		$base = str_split('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
		shuffle($base);
		$id = '';
		foreach (array_rand($base, 5) as $k)
			$id .= $base[$k];

		// Get time and set the timeout for joing the game
		$time = time();
		$timeOut = $time + $timeToJoin;

		// Save game to database
		$sql = "INSERT INTO game (timestamp, timeout, id, status, defaultScore) VALUES ($time, $timeOut, '$id', 10, $score)";
		$db->query($sql);

		return $id;
	}

	function joinGame($player, $gameId) {
		global $db;

		// Current time to be compared to the game's timeout
		$time = time();

		// Get information about the game from database
		$sql = "SELECT * FROM game WHERE id = '$gameId'";
		$q = $db->query($sql);

		// Checks if the game exists, returns error if it doesn't
		if($q && $q->num_rows > 0)
			$r = $q->fetch_assoc();
		else
			return "{ 'gameStatus': 'not_exist' }";

		// Make sure that the game has not started and is open for new players
		$timeOut = $r['timeout'];
		$toStart = $timeOut - $time;

		$player->countdown = $toStart;
		$player->score = intval($r['defaultScore']);

		if($timeOut > $time) {
			// Get the number of already registered players and assign playerId
			$id = $player->numberOfPlayers($gameId) + 1;
			$playerName = 'player_' . $id;

			// Player object -> JSON for saving in database
			$playerJson = json_encode($player, JSON_UNESCAPED_UNICODE);

			// Save the new player to the game
			$sql = "UPDATE game SET $playerName = '$playerJson' WHERE id = '$gameId' AND timeout = $timeOut";
			$db->query($sql);

			// Return JSON
			return $playerJson;

		} else {
			// Return error if the game doesn't exist or if has already started and can't be joined
			return "{ 'gameStatus': 'started' }";
		}

	}


	function querystring($k) {
		global $db;

		if(isset($_GET[$k]))
			return $db->real_escape_string($_GET[$k]);
		else
			return "";
	}


	//**
	//		Functions for debugging
	//**

	function testList() {
		global $db;

		$sql = "SELECT * FROM game";
		$response = $db->query($sql);
		$i = 1;
		$list = "";
		while($row = $response->fetch_assoc()) {
			$player = json_decode($row['player_1']);
			if(isset($player->name))
				$list .= $row['timestamp'] . " - " . $player->name . "\n";

			$i++;
		}

		return $list;
	}

	function var_dump_pre($i) {
		echo "<pre>";
		var_dump($i);
		echo "</pre>";
	}


?>
