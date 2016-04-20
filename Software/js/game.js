
//**
//      Demo: RC car controlled over Bluetooth using Web Bluetooth API
//**

//** Object to hold game settings
if(typeof game === 'undefined')
    var game = new Object();

//** Game settings
game.score = game.score || 5;                               // Number of lives each player starts with
game.timeToJoin = game.timeToJoin || 25;                    // Interval from games is created until it starts [s]
game.timeBetweenHits = game.timeBetweenHits || 2000;        // Time from one hit to next possible [ms]
game.coolDownPeriod = game.coolDownPeriod || 2000;          // Shortest allowed interval between shots fired [ms]
game.coolDownStatus = 0;                                    // Players starts with no need of 'cool down'
game.gameOn = 0;                                            // Game is by default not started automatically
game.allowCreate = 1;                                       // Players are allowed to create their own games
game.preventHit = 0;                                        // Variable to prevent being hit before timeBetweenHits is out
game.updateInterval = 1000;                                  // Interval for game updates to and from the server [ms]

game.speedCoeff = 0.78;                                     // This is the default speed coefficient that limits the maximum speed of the car and makes the speed boost power-up possible
                                                            //  -->  The coeffcient has a linear relationship with the output current to the motors, and ranges from 0 to 1
game.playerName;                                            // The player may enter a name that will also be stored in the database when participating in a game session. Not yet implemented in GUI.
game.gameId;                                                // When either creating or joining a game, the game ID is stored
game.playerId;                                              // Each player in a game session receives a unique player ID

game.singlePlayer = false;
game.gameMenuDown = true;
game.allowJoin = true;
game.vibratePossible = "vibrate" in navigator;
game.firstHit = true;

//** Properties needed to control and monitor the data flow over BLE
game.writePermission = true;                                // When true, it's it's possible to write to the GATT characteristic
game.discardedPackets = [];                                 // Array to hold arrays that are created by touch events but never sent over BLE, kind of equivalent to packet loss
game.priorityPacket = 0;                                    // Events like button press, that happen rarely compared to joystick events, are given priority to ensure that the DK gets the information
game.prevNotificationArray = [];                            // The notification characteristic handler uses this array to ensure that it only triggers actions when new values are sent

// RGB LED colors

game.rgbLed = {green: 0, red: 1, blue: 2, off: 100};

//** For local testing, set local to 1 to avoid Web Bluetooth errors
game.local = 0;


//**
//     Joystick, based on the amazing nippleJS by @yoannmoinet: http://yoannmoinet.github.io/nipplejs/
//**

var joystick = nipplejs.create({
    zone: document.getElementById('joystick-container'),
    mode: 'static',
    position: {left: '100px', top: '150px'},
    color: 'white',
    size: 150,
    restOpacity: 0.9
});
game.joystickPos = joystick.position;


joystick.on('end', function(evt, data) {
        // May send 'stop packet' to the car here
        ble.charVal[10] = 0;
        ble.charVal[11] = 0;
        ble.charVal[12] = 0;
        ble.charVal[13] = 0;
        ble.priorityWrite(ble.charVal);
    }).on('move', function(evt, data) {

    if( ble.readWriteChar &&  (game.writePermission == true) && (game.priorityPacket != 1) && !game.local) {
        var outputRight;
        var outputLeft;

        var x = data.position.x-110;
        var y = -1*(data.position.y-155);
        var hypotenus = Math.sqrt((Math.pow(x, 2)) + (Math.pow(y, 2)));
        var speed = Math.round((255/75)*hypotenus);
        var angle = (180/Math.PI)*Math.acos(x/hypotenus);
        var directionRight, directionLeft;
        if(y < 0) {
            angle = 360 - angle;
            directionRight = directionLeft = 0;
        } else {
            directionRight = directionLeft = 1;
        }

        angle = Math.round(angle);

        if(speed > 255)
            speed = 255;

        if(angle >= 10 && angle <= 85) {
            outputRight = (angle/85)*speed;
            outputLeft = speed;
        } else if(angle > 85 && angle < 95) {
            outputLeft = outputRight = speed;
        } else if(angle >= 95 && angle <= 160) {
            outputRight = speed;
            outputLeft = ((180-angle)/80)*speed;
        } else if(angle > 160 && angle < 200) {
            outputRight = speed;
            directionRight = 1;
            outputLeft = speed;
            directionLeft = 0;
        } else if(angle >= 200 && angle <= 265) {
            outputRight = speed;
            outputLeft = ((angle-180)/80)*speed;
        } else if(angle > 265 && angle < 275) {
            outputRight = outputLeft = speed;
        } else if(angle >= 275 && angle <= 340) {
            outputRight = ((360-angle)/80)*speed;
            outputLeft = speed;
        } else if(angle > 340 || angle < 20) {
            outputRight = speed;
            directionRight = 0;
            outputLeft = speed;
            directionLeft = 1;
        }

        outputRight *= game.speedCoeff;
        outputLeft *= game.speedCoeff;

        ble.charVal[10] = outputRight;          // Motor 1
        ble.charVal[14] = directionRight;

        ble.charVal[11] = outputLeft;           // Motor 2
        ble.charVal[15] = directionLeft;

        ble.charVal[12] = outputLeft;           // Motor 3
        ble.charVal[16] = directionLeft;

        ble.charVal[13] = outputRight;          // Motor 4
        ble.charVal[17] = directionRight;

        game.writePermission = false;

        return ble.readWriteChar.writeValue(ble.charVal)
                .then( writeReturn => {
                    game.writePermission = true;
            });
    } else {
        // Pushes arrays that were never sent to a discarder packets array to use in debugging
        game.discardedPackets.push(ble.charVal);
    }
});

    ble.charVal[10] = 0;
    ble.charVal[11] = 0;
    ble.charVal[12] = 0;
    ble.charVal[13] = 0;
    ble.priorityWrite(ble.charVal);

//////////////////////////////////////////////*
//                                          //*
//            Game administration           //*
//                                          //*
//////////////////////////////////////////////*

//**
//      Function that creates a new game sessions with it's own 'unique' ID (not really unique, but unique enough for this purpose..)
//**

game.createGame = function() {

    // Check that it's actually allowed to create a new game session before initiating. Two sessions may not be initiated by the same player at once.
    if(game.allowCreate) {
        // Prevents multiple games being created
        game.allowCreate = 0;

        // Variables needed to time the start of the game for all players
        var countDown = game.timeToJoin;

        // Sets text to be shown while game is being created and
        $('#message-container').fadeIn(300);
        $('#message').text('Creating...');

        // Send AJAX request to PHP page that creates game ID and entry in database. Object with player and game information is returned as JSONP
        // to avoid cross-domain issues. Should consider to use JSON if the php page may run on local server.

        $.getJSON('php/game.php?t=create&ttj=' + game.timeToJoin + '&pname=' + game.playerName + '&l=' + game.score + '&callback=?', function(r) {

            // Returned object is stored to global variables for easy access for all functions
            game.score = r.score;
            game.playerName = r.name;
            game.gameId = r.gameId;
            game.playerId = r.id;

            // Push new gameId to #message so other players may see it and join in
            $('#message').fadeOut(500).promise().done( function() {
                $(this).text(game.gameId).fadeIn(500);
            });

        });

        // Starts timer before startgame() is called. Really bad solution, and should be replaced by a promise chained to the countdown clock itself.
        $('#game-info').show();
        setTimeout(function() {
            game.startGame();
        }, 1000*countDown+1);

        // Countdown clock
        // The timing works well in testing, but should be replaced by a more sophisticated solution to compensate for possible delayed requests for other player
        $('#game-info').text('Game starts in ' + countDown);
        var countDownInterval = setInterval(function() {
            if(countDown > 1) {
                countDown--;
                $('#game-info').text('Game starts in ' + countDown);
            } else {
                $('#game-info').slideToggle('slow');
                clearInterval(countDownInterval);
            }
        }, 1000);
    }
}

//**
//      Functions that displays a text input where a player can enter game ID to join a game created by another player
//**

game.joinGamePopup = function(fail = false) {
    game.allowJoin = true;
    var input = `
                    <div id="join-fail"></div>
                    <input type='text' id='game-id' placeholder='GAME ID' maxlength='5' size='5' autofocus>
                    <div id="btn-join-container">
                        <div id='btn-join-popup' class='msg-button'>
                            Join
                        </div>
                        <div id="btn-return" class="msg-button" onclick="game.restartGame()">
                            Return
                        </div>
                    </div>`;

    $('#message').html(input).fadeIn(500);
    if(!fail) {
        $('#message-container').fadeIn(500);
    } else {
        $('#join-fail').text('').fadeOut(100).promise().done( function() {
            $(this).text("Could not join the game. Please try again.").fadeIn(500);
        });
    }


    $('#btn-join-container').fadeIn(500);
    $('#btn-join-popup').on('touchstart mousedown', function() {
        var pin = $('#game-id').val();
        $('#game-info').fadeOut(300).promise().done(function() {
            game.joinGame(pin);
        });
    });
}

//**
//      Function that allows the player to join a game created by another player. Called by joinGamePopup() where the game ID is submitted.
//**
//**    @parameter       gId        the ID2 of the game the player wants to join

game.joinGame = function(gId) {
    if(game.allowJoin == true) {
        game.allowJoin = false;
        // #message fades out
        $('#message').fadeOut(100).promise().done( function() {

            // All html content of #message (most likely a text input and a button) is replaced
            $('#message').html("Joining...");
            $('#message').fadeIn(500).promise().done( function() {

                // AJAX request to php file that taes care of the database connection and makes sure that the new player gets a playerId in return
                // and is connected to the right game session
                // JSONP is used to avoid cross-domain issues when php page is placed on a diffrent domain than this script. Consider to replace by JSON if not needed.
                $.getJSON('php/game.php?t=join&gid=' + gId + '&pname=' + game.playerName + '&callback=?', function(r) {

                    // Check if the game had started or did'nt exist and therefore could not be joined
                    if(r.gameStatus == 'not_exist' || r.gameStatus == 'started') {
                        $('#message').fadeOut(500).promise().done( function() {
                            game.joinGamePopup(1);
                        });

                    } else {

                        // If the php file was able to connect the player to the game, information from the returnerd object is stored i global variables

                        game.score = r.score;
                        game.playerName = r.name;
                        game.gameId = r.gameId;
                        game.playerId = r.id;

                        // This is an attempt to time the start of the game and sync all players. Works fine in tests, but by no means good enough
                        // and should be replaced. In short, it uses the php server's timestamp to sync the new players joining the game, and is therefore
                        // exposed to delays over the network. The player who created the game has a countdown based on the browser's timestamp.
                        // And because of this, syncing is more luck than skill everytime it works, and is doomed to fail, and sometimes badly so, from time to time.
                        var countDown = r.countdown;

                        // Push to #message as confirmation that the game is successfully joined
                        $('#message').fadeOut(1000, function() {
                            $(this).text("You're in!").fadeIn(1000);
                        });
                        $('#game-info').hide();
                        // Countdown clock, with the drawbacks previusly mentioned
                        var countDownInterval = setInterval(function() {
                            if(countDown > 1) {
                                countDown--;
                                $('#game-info').text('Game starts in ' + countDown).fadeIn(1000);
                            } else {

                                // When the countdown is done, hide the counter and attached message and prevent further updates by clearing interval
                                $('#game-info').hide('slow');
                                clearInterval(countDownInterval);

                                // Start the game
                                game.startGame();
                            }
                        }, 1000);
                    }
                });
            });
        });
    }
}

//**
//      Function called when the countdown to game start runs out and triggers it
//**
//**    The player will now be able to control the car, and the browser starts polling the server via updateGame()

game.startGame = function() {

    // Array that contains start messages
    var startMsg = ['Ready...', 'Set...', 'Go!'];

    // The repeat variable has to be set outside the function where it's first assigned to make it accessible for the startMesssages() function
    var repeat;
    var n = 0;

    // Hide the content in #message by setting the text opacity to 0
    $('#message').css({'color': 'rgba(0, 0, 0, 0)', 'transition': 'color 1s'});

    // Runs updateGame() one single time to check if other players have joined the game.
    // updateGame() returns a promise with the following alternative values when resolved: 'updated', 'finished', 'single_player'
    // If the creator is the only player, a popup will appear with an option to enter single player mode
    if(!game.singlePlayer) {
        game.updateGame()
        .then( status => {
            if(status != 'single_player') {
                repeat = setInterval(function() {
                    startMessages();
                }, 1000);
            }
        })
        .catch( e => {
            console.log(e);
        });
    } else {
        repeat = setInterval(function() {
            startMessages();
        }, 1000);
    }

    function startMessages() {

        // Loops through the startMsg array and displays them in #message with som fancy transition effects.
        // Use the opacity to fade the text in and out instead hide/show beacause it then keeps its size.
        $('#message').text(startMsg[n]);
        $('#message').css({'color': 'rgba(255, 255, 255, 1)', 'transition': 'color 0.4s'});
        // Fade out the text after 800 millisecs
            setTimeout(function() {
                $('#message').css({'color': 'rgba(0,0,0,0)', 'transition': 'color 0.4s'});
            }, 600);
        n++;

        if(n >= startMsg.length) {
            clearInterval(repeat);
            // When the excitement reaches its peak during the start messages, the following hides the #message-container and brings in the game controllers
            // and other elements within the .wait-till-game class
            setTimeout(function() {
                $('#message-container').fadeOut('fast');
                $('.wait-till-game').show('fast');
            }, 800);

            // Allow the players to control the car and shoot, and let the game begin!
            game.writePermission = true;
            game.gameOn = 1;

            // Start updating the game status if the game is not single player
            if(!game.singlePlayer)
                game.updateGame();
        }
    }
}

//**
//      Function that updates the game info at a given interval set in the updatePeriod variable. By default every 2 seconds.
//**

game.firstUpdate = true;
game.updateGame = function() {
    return new Promise(function(resolve, reject) {
        sendRequest();
        function sendRequest() {

            //  AJAX request to php-file that communicates with database and handles information about all the players
            //  in each game session and returned updated player object and game status
            //  Is set up to use JSONP to handle cross-domain issues if necessary. Should consider to be removed and replaced by JSON if not needed.
            //  This is for testing only. Consider other options like WebSocket or long polling instead of frequent AJAX requests in cases when possible
            $.getJSON('php/game.php?t=u&gid=' + game.gameId + '&pid=' + game.playerId + '&pname=' + game.playerName + '&l=' + game.score + '&callback=?', function(r) {

                //  Checking the gameStatus property of the received object to see if game is still active
                //  The game is active as long as the status is 10. As soon as only one player still has points left, the returnes gameStatus
                //  changes to this player's ID
                if(game.firstUpdate != false && r.gameStatus == 1) {
                    // If the first update returns that the player who created the game has won, it means that no other players joined the game in time
                    // The player will then be presented a message with question to drive about a bit in single player mode
                    game.gameOn = 0;
                    setTimeout(function() {
                        game.singlePlayerPopup();
                    }, 1000);
                    resolve('single_player');
                } else if((r.gameStatus == 10) && (game.score <= 0) && (r.score != game.score)) {
                    game.updateGame();
                    resolve('updateAgain');
                } else if(r.gameStatus == 10) {
                    if(game.score <= 0)

                        // The game is active, but the players is out of points
                        game.gameLost('active');
                    else {

                        // The game is still active, and the player has more lives left
                    }
                    resolve('updated');
                } else if(r.gameStatus != 10) {
                    //  Since the status is no longer 10, ie the game is over, perform check to see if the player has won or lost the game,
                    //  and call functions accordingly
                    if(r.gameStatus == game.playerId) {
                        // The game is over and player won the game
                        game.gameWon();
                    } else {
                        // The game is over and another player won
                        game.gameLost();
                    }
                    resolve('finished');
                }
                else {
                    reject(Error('Failed to update'));
                }
                game.firstUpdate = false;
            });
            // Update every given interval as long as the game is ongoing, which is as long as gameStatus is 10 in the returned JSONP in this function
            if(game.gameOn) {
                setTimeout(function() {
                    if(game.gameOn)
                        sendRequest();
                }, game.updateInterval);
            }
        }
    });
}



//**
//      When a game is over, this function the opportunity to create a new game without reloading the page and thus maintaining the Bluetooth connection
//**
//**    If a new game is created, a new gameId is now set and the players will have to rejoin the new session even if they were part of the previous one

game.restartGame = function() {

    // Allow the player to create a new game
    game.allowCreate = 1;

    // Stop the ongoing game and gameUpdate()
    game.gameOn = 0;

    // Avoid cached version of the controllers-file
    var time = new Date();
    var e = time.getTime();

    // AJAX request to restart the game session without interefering with the Bluetooth connection
    $('#main').load('controllers.html?t=' + e);
}

//**
//      Popup-menu opened when a player creates a game and no other players join in time.
//      This is a temporary solution, and the html should be taken out of the js when fully functional
//**

game.singlePlayerPopup = function() {

    var input = `   <div class='msg'>
                        <h2>Oh no!</h2>
                        It seems noone joined the game in time. Do you want to enter singleplayer mode?
                    </div>
                    <div id='btn-singleplayer' class='msg-button' onclick='game.startSingleplayer();'>Singleplayer Mode</div>
                    <div id='btn-main-menu' class='msg-button' onclick='game.restartGame();'>Main Menu</div>`;


    $('#message-container').fadeOut(500).promise().done(function() {
        $('#message').html(input);
        $('#message-container').fadeIn(500).promise().done(function() {
            $('#message').fadeIn(1000);
        });
    });

}

//**
//      If a player wants to just drive the car without creating a new game, this function is called
//**

game.startSingleplayer = function() {
    game.singlePlayer = true;
    $('#message').html('s').fadeIn(500).promise().done(function() {
        $('#points').text('');
        game.startGame();
        $('#message-container').fadeIn(500);
    });
};


//////////////////////////////////////////////*
//                                          //*
//         The-game-itself-functions        //*
//                                          //*
//////////////////////////////////////////////*


game.notificationCallback = function(dataArray) {
    var newNotificationValue = !(dataArray.length == game.prevNotificationArray.length && dataArray.every(function(v,i) { return v === game.prevNotificationArray[i]})) ? true : false;
    var preventSlotFirst = (game.firstHit && (dataArray[0] == 1 || dataArray[1] == 1 || dataArray[2] == 1 || dataArray[3] == 1)) ? true : false;
    var preventSlot = (dataArray[4] == game.prevNotificationArray[4]) ? true : false ;
    game.firstHit = false;

    if(game.gameOn) {
        if(!preventSlotFirst && !preventSlot) {
                slot.start();
        } else if(!game.preventHit && newNotificationValue) {

            // If the player is hit...
            game.preventHit = 1;
            setTimeout(function() {
                game.preventHit = 0;
                game.rgbSetColor('green');
            }, game.timeBetweenHits);
            if(game.gameOn == 1) {
                game.score--;
                game.vibrate(500);   // vibrates for 500 ms
                game.rgbSetColor('red');
                $('#points').text('♥ ' + game.score);
            }
            if(game.score < 0) {
                game.score = 0;
            }
        }
        game.prevNotificationArray = dataArray;
    } else {
        // Unchanged notification array
    }
}

//**
//      Function called when the player wins a game
//**

game.gameWon = function() {
    this.ameOn = 0;

    ble.charVal[10] = 0;
    ble.charVal[11] = 0;
    ble.charVal[12] = 0;
    ble.charVal[13] = 0;

    if(!game.local) {
        ble.priorityWrite(ble.charVal);
        game.writePermission = false;
    }
    vibrate(300, 400, 5);
    $('#game-message').html('You won :)');
    $('#game-message').fadeIn('slow');
    $('body').css({'background': '-webkit-radial-gradient(center, ellipse cover, rgba(58,132,74,1) 0%,rgba(13,25,15,1) 100%)'});
}


//**
//      Function called when the player loses a game
//**

game.gameLost = function(status = "") {
    this.gameOn = 0;

    ble.charVal[10] = 0;
    ble.charVal[11] = 0;
    ble.charVal[12] = 0;
    ble.charVal[13] = 0;

    if(!game.local) {
        ble.priorityWrite(ble.charVal);
        game.writePermission = false;
    }
    game.vibrate(300, 400, 5);
    $('#game-message').html('You lost :(');
    $('#game-message').fadeIn('slow');
    $('body').css({'background': '-webkit-radial-gradient(center, ellipse cover, rgba(143, 2, 34, 1) 0%,rgba(38, 0, 0, 1) 100%)'});
}


//**
//      Function to add 'shooting' functionality. Is called when the fire button is pushed
//**

game.shoot = function() {
    if(!game.coolDownStatus) {
        game.coolDownStatus = 1;
        if(!game.local) {
            ble.setBit(1, 0, 1);
            ble.priorityWrite(ble.charVal);

            setTimeout(function() {
                ble.setBit(1, 0, 0);
                ble.priorityWrite(ble.charVal);
            }, 100);
        }
        game.vibrate(100);
        game.coolDown();
    }
}



//**
//      Function to ensure that a player can't shoot again before a certain time has passed. The 'cool-down time' is set in the timeOute variable [ms]
//**

game.coolDown = function() {
    var timeOut = game.coolDownPeriod;
    var e = document.getElementById("cool-down-bar");
    var width = 1;
    var interval = setInterval(coolDownCounter, timeOut/100);
    function coolDownCounter() {
        if (width >= 100) {
            clearInterval(interval);
            game.coolDownStatus = 0;
            e.style.backgroundColor = '#367d59';
        } else {
            width++;
            e.style.width = width + '%';

            if(width <= 35)
                e.style.backgroundColor = 'rgb(203, 8, 8)';
            else if(width <= 90)
                e.style.backgroundColor = 'rgb(242, 142, 8)';
            else
                e.style.backgroundColor = '#367d59';
        }
    }
}

//** Print to console array containing packets that's not been sent  **/

game.printDiscardedPackets = function() {
    console.log(game.discardedPackets);
}

//**
//      Vibration
//**

game.vibrate = function(duration, interval = 0, repeats = 1) {
    if(game.vibratePossible) {
        if(interval) {
            var n = 1;
            var repeat = setInterval(function() {
                if(n <= repeats)
                    navigator.vibrate(duration);
                else {
                    clearInterval(repeat);
                }
                n++;
            }, interval)
        } else {
            navigator.vibrate(duration);
        }
    }
}

//**
//      Function control RGB LEDs on the DK
//**

game.rgbSetColor = function(color) {
    ble.charVal[5] = game.rgbLed[color];
    ble.priorityWrite(ble.charVal);
}

//**
//      Slot machine to enable powerups
//**

var slot = slot || {};

slot.spinTime = 2500;		// The duration the slot spins when first triggered, 2,5 seconds
slot.duration = 10000;		// The duration of the power-up
slot.running = false;		// Variable to make sure the method start() can not be triggered when it is already running
slot.powerups = ["boost", "rapidfire", "shield", "health"];
slot.prevVal = 0;

slot.start = function() {
	if(slot.running == false){
		var randomPower;
		slot.running = true;

		$('#slotmachine-container').fadeIn(1000);
		$('span').toggleClass(randomPower);
		$('span').addClass('spin_forward');

		randomPower = slot.powerups[Math.floor(Math.random() * slot.powerups.length)];
		$('span').toggleClass(randomPower);

		setTimeout(function (){
			slot.stop(randomPower);
		}, slot.spinTime);
	}
};

slot.stop = function(powerup){
	$('span').removeClass('spin_forward');
	slot.activatePowerup(powerup);
	setTimeout(function() {
		slot.fadeout(powerup);
	}, slot.duration);
};

slot.fadeout = function(powerup) {
	$('#slotmachine-container').fadeOut(1000);
	slot.deactivatePowerup(powerup);
	slot.running = false;
};

slot.activatePowerup = function(powerup) {
	switch(powerup) {
		case "boost":
			slot.prevVal = game.speedCoeff;
			game.speedCoeff = 1;
			break;
		case "rapidfire":
			slot.prevVal = game.coolDownPeriod;
			game.coolDownPeriod = 500;
			break;
		case "shield":
			slot.prevVal = game.preventShot;
			game.preventShot = 1;
			break;
		case "health":
			game.score++
			$('#points').text('♥ ' + game.score);
			break;
	};
};

slot.deactivatePowerup = function(powerup) {
	switch(powerup) {
		case "boost":
			slot.speedCoeff = slot.prevVal;
			break;
		case "rapidfire":
			slot.coolDownPeriod = slot.prevVal;
			break;
		case "shield":
			slot.preventShot = slot.prevVal;
			break;
		case "health":
			break;
	};
};


//**
//      Buttons and actions
//**

$('#control-button').on('touchstart mousedown', function(event) {
    event.preventDefault();
    $(this).css({'box-shadow': '0px 0px 10px 3px rgba(0,0,0, 0.2)', 'height': '115px', 'width': '115px', 'transition-timing-function' : 'ease'});
    if(game.coolDownStatus != 1)
        game.shoot();
});

$('#btn-create-game').on('touchstart mousedown', function(event) {
    event.preventDefault();
    $('#btn-gamemenu-container').fadeOut("slow").promise().done(function() {
        game.createGame();
    });

});

$('#btn-join-game').on('touchstart mousedown', function(event) {
    event.preventDefault();
    $('#btn-gamemenu-container').fadeOut("slow").promise().done(function() {
        game.joinGamePopup();
    });
});

$('#btn-restart-game').on('touchstart mousedown', function(event) {
    event.preventDefault();
    game.restartGame();
});

$('#btn-slotmachine').on('touchstart mousedown', function(event) {
    event.preventDefault();
    slot.start();
});

$('#btn-reconnect').on('touchstart mousedown', function(event) {
    event.preventDefault();
    ble.connect();
});

$('#btn-return').on('touchstart mousedown', function(event) {
    event.preventDefault();
    $('#message-container').fadeOut("slow").promise().done(function() {
        $('#main').load('controllers.html', function() {
            $(this).fadeIn(200);
        });
    });
});

$('#btn-singleplayer').on('touchstart mousedown', function(event) {
    event.preventDefault();
    $('#btn-gamemenu-container').fadeOut("slow").promise().done(function() {
        game.startSingleplayer();
    });
});

$('#btn-home').on('touchstart mousedown', function(event) {
    event.preventDefault();
    $('#btn-gamemenu-container').fadeOut("slow").promise().done(function() {
        $('body').load('index.html', function() {
            $(this).fadeIn(200);
        });
    });
});

// Set transition time for cool-down-bar. Placed here instead of static CSS to give a more sensible transition time based on the chosen coolDownPeriod
$('#cool-down-bar').css('transition', 'background-color ' + game.coolDownPeriod*3/5000 + 's');

$('.wait-till-game').css('visibility', 'visible');
$('.wait-till-game').hide();

// Populate the #points with the score (needs 'manual' update incase it is changed by joining a game with different settings than set here)
$('#points').text('♥ ' + game.score);


$('#btn-menu').on('touch click', function (event) {
    event.preventDefault();
    game.toggleGameMenu();
});

game.toggleGameMenu = function() {
    if (game.gameMenuDown == true){
        $('#slide-menu').animate({height: "60px"},'slow');
        $('#btn-menu').animate({bottom: "50px"},'slow');

        game.gameMenuDown = false;
    }
    else if (game.gameMenuDown == false){
        $('#slide-menu').animate({height: "0px"},'slow');
        $('#btn-menu').animate({bottom: "10px"},'slow');

        game.gameMenuDown = true;
    }
};

$('#btn-exit').on('touchstart mousedown', function (event) {
    $('body').css({'background': "url('img/bg.jpg')"});
    $('#main').load('controllers.html?t=' + e);
});
