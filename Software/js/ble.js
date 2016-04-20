//**************************************************************************************************************//
//  Functions for connecting to BLE device and setting up main service and characteristics                      //
//                                                                                                              //
//  connect                             Searches for devices that matches the filter criterias                  //
//  notificationCharHandler             Sets up event listener for the notification characteristic              //
//  handleNotification                  Event handler for changes in the notifications                          //
//  readWriteCharHandler                Sets up the readWriteCharacteristic                                     //
//  readFromChar                        Function for reading values from the readWriteCharacteristic            //
//  writeToChar                         Function for reading chosen values from the readWriteCharacterstic      //


//* Creatig BLE object
var ble = {
    /** Declaring the necessary global variables **/
    mainServiceUUID : '00001523-1212-efde-1523-785feabcd123',
    readWriteCharUUID : '00001525-1212-efde-1523-785feabcd123',
    notificationCharUUID : '00001524-1212-efde-1523-785feabcd123',
    bluetoothDevice : '',
    mainServer : '',
    mainService : '',
    readWriteChar : '',
    notificationChar : '',
    notificationContent : '',
    charVal : new Uint8Array(20),
    prevNotification : '',

    /** Function for establishing BLE connection to device advertising the main service **/
    connect : function() {
        'use strict';

        // Searching for Bluetooth devices that match the filter criteria
        console.log('Requesting Bluetooth Device...');
        navigator.bluetooth.requestDevice(
            { filters:[{ services: [ this.mainServiceUUID ]}] })
        .then(device => {
            this.bluetoothDevice = device;
            // Adding event listener to detect loss of connection
            //bluetoothDevice.addEventListener('gattserverdisconnected', disconnectHandler);
            console.log('> Found ' + this.bluetoothDevice.name);
            console.log('Connecting to GATT Server...');
            return this.bluetoothDevice.connectGATT()
            .then(gattServer => {
                this.mainServer = gattServer;
                console.log('> Bluetooth Device connected: ');
                this.connectionStatus(1);

            });
        })

            // When matching device is found and selected, get the main service
            .then(server => {
                console.log('Getting main Service...');
                return this.mainServer.getPrimaryService(this.mainServiceUUID);
            })
            .then(service => {
                // Storing the main service object globally for easy access from other functions
                this.mainService = service;
                console.log('> serviceReturn: ' + service);
                return Promise.all([
                    // Get all characteristics and call handler functions for both
                    service.getCharacteristic(this.readWriteCharUUID)
                    .then(this.readWriteCharHandler),
                    service.getCharacteristic(this.notificationCharUUID)
                    .then(this.notificationCharHandler)
                ])
                // Print errors  to console
                .catch(error => {
                    console.log('>' + error);
                });
            })
        // Print errors  to console
        .catch(error => {
            console.log('Argh! ' + error);
        });
    },


    /** Function for disconnecting th Bluetooth Device **/
    disconnect : function() {
        if (!ble.bluetoothDevice) {
            ble.connectionStatus(0);
            return;
        }
        console.log('> Disconnecting from Bluetooth Device...');
        if (this.bluetoothDevice.gatt.connected) {
            this.bluetoothDevice.gatt.disconnect();
            console.log('> Bluetooth Device connected: ' + this.bluetoothDevice.gatt.connected);
        } else {
            console.log('> Bluetooth Device is already disconnected');
        }
        ble.connectionStatus(0);
    },

    /** Function for handling disconnect event **/
    disconnectHandler : function() {
        ble.connectionStatus(0);
        console.log('>>> Device disconnected.');
    },

    /** Function for handling connection status **/
    connectionStatus : function(status) {
        if(status == 1)
            document.getElementById("connectionStatus").style.backgroundColor = 'rgb(6, 116, 54)';
        else if(status == 0)
            document.getElementById("connectionStatus").style.backgroundColor = 'rgb(175, 7, 7)';
    },

    /** Function for setting up the notification characteristic **/
    notificationCharHandler : function(characteristic) {
        'use strict';

        // Stores the notification characteristic object to ble object for easy access
        ble.notificationChar = characteristic;
        console.log('Notifications started.');

        // Initiates event listener for notifications sent from DK
        ble.notificationChar.addEventListener('characteristicvaluechanged',ble.handleNotification);
        return characteristic.startNotifications();
    },

     /** Function for handling the read and write characteristic **/
    readWriteCharHandler : function(characteristic) {
        'use strict';
        // Stores the readWriteChar to ble object
        ble.readWriteChar = characteristic;
        return 1;
    },


    /** Function for handling notifications **/
    handleNotification : function (event) {
        'use strict';

        // The received notification consists of a DataView object, assigned to value
        let value = event.target.value;
        value = value.buffer ? value : new DataView(value);

        if(value != ble.prevNotification) {

            // Checks if notificationCallback exists, and if it does, calls it with the received data array as argument
            if (typeof game.notificationCallback === "function") {
                var valueArray = new Uint8Array(20);
                for(var i = 0; i < 20; i++)
                    valueArray[i] = value.getUint8(i);

                game.notificationCallback(valueArray);
            }
        } else {
        }

        ble.prevNotification = value;
        return value;

    },

    /** Function for reading from the read and write characteristic **/
    //  Parameter      byteOffset      int, 0-19    or  string, 'all'
    readFromChar : function(byteOffset) {
        'use strict';

        // Data is sent from DK as a 20 byte long Uint8Array, stores in the data variable
        var data = new Uint8Array(20);

        // Calls the redValue method in the readWriteChar
        ble.readWriteChar.readValue()
          .then(value => {
            // DataView is received from DK
            value = value.buffer ? value : new DataView(value);

            // Checks if a single byte or all received data is to be returned from the function
            if(byteOffset == 'all') {
                // Loops through the received DataView and copies to the data array
                for(var i = 0; i < 20 ; i++) {
                    data[i] = value.getUint8(i);
                }
            } else {
                // Copies the chosen byte from the DataView to data array
                data[byteOffset] = value.getUint8(byteOffset);
            }
            console.log('readchar: ' + data);

        });

        // Returns the selected byte or all data as Uint8Array
        if(byteOffset != 'all')
            return data[byteOffset];
        else
            return data;
    },

    /** Function for writing to the read and write characteristic **/
    //  Parameters      byteOffset      int, 0-19
    //                  value           int, 0-255
    writeToChar : function(byteOffset, value) {
        'use strict';

        ble.charVal[byteOffset] = value;

        ble.readWriteChar.writeValue(ble.charVal);
    },

    /** Function for writing array to the read and write characteristic **/
    //  Parameters      charVal     Uint8Array, maximum 20 bytes long
    writeArrayToChar : function(charVal) {
        'use strict';

        if(game.writePermission) {
            ble.readWriteChar.writeValue(charVal);
            return 1;
        } else {
            return 0;
        }
    },

    /** Function for sending data with high priority, pausing other sendings **/

    priorityWrite : function(charVal) {
        game.priorityPacket = 1;

        if(!game.writePermission) {
            setTimeout( function() {
                ble.priorityWrite(charVal);
            }, 20);
            return 0;
        } else {
            game.writePermission = 0;
            return ble.readWriteChar.writeValue(charVal)
                .then( writeReturn => {
                    game.writePermission = true;
                    game.priorityPacket = 0;
            });
        }
    },

    // Sets a bitmask to be able to set individual bits and send them to the DK
    bitMask : [128, 64, 32, 16, 8, 4, 2, 1],

    // Function that sets individual bits in ble.charVal
    setBit : function(byteOffset, bitOffset, value) {
    	if(bitOffset == 'b') {
    		ble.charVal[byteOffset] = value;
    	} else {
    		if(ble.charVal[byteOffset] & ble.bitMask[bitOffset]) {
    			if(value == 0) {
    				ble.charVal[byteOffset] -= ble.bitMask[bitOffset];
    			}
    		} else {
    			 if (value == 1) {
    				ble.charVal[byteOffset] += ble.bitMask[bitOffset];
    			}
    		}
    	}
    }
};
