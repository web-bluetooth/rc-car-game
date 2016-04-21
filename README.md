# **Physical Web RC Car**
## **Bluetooth Smart Controlled Car**

This project is a bachelor thesis done by four students of electrical engineering at [The Norwegian University of Science and Technology](http://www.ntnu.edu/).
The project utilizes the [nRF52 Development Kit](http://no.mouser.com/new/nordicsemiconductor/nordic-nrf52-dk/) (DK for short) from [Nordic Semiconductor](http://www.nordicsemi.com/), which is a versatile single-board development kit for Bluetooth® Smart, ANT and 2.4GHz proprietary applications. It is hardware-compatible with the Arduino Uno Revision 3 standard, so it  enables the use of 3rd-party shields that conform to this standard.

The thesis itself is scheduled to be delivered May 25th 2016, so the publication of this project is a snapshot of the functionality to coincide with the release of [The Physical Web](https://google.github.io/physical-web/). Although the project is not fully completed, the main functonality is in place, and we are only missing simple lights and sound.

[![Physical Web Car](http://i.imgur.com/bhzXKaB.png)](https://youtu.be/CvxeobtZiWY "Physical Web Car")

A working version of the game can be found and tested [here](https://jtguggedal.github.io)

Our goal was to make several Bluetooth Smart controlled cars that can play a game of laser tag against each other as well as receive random power ups by driving over RFID tags.

The cars are built using a prefabricated kit designed for Arduino and other microcontrollers. We are also in the process of making a body that goes over the cars using vacuum forming, and 3D-printing parts to attach various peripherals to the cars.

Below we will go through the different parts - hardware, firmware and software - in further detail.

## Hardware
### nRF52 Development Kit
As mentioned in the introduction, our project is built around the nRF52 Development Kit (DK) from Nordic Semiconductor. It functions as both a Bluetooth® Smart beacon using Eddystone, and as a [microcontroller](https://en.wikipedia.org/wiki/Microcontroller).
### 4WD "Robot" Car
The car chassis is a [prefabricated kit](http://www.banggood.com/4WD-Smart-Robot-Car-Chassis-Kits-With-Strong-Magneto-Speed-Encoder-p-917007.html) consisting of two identical acrylic sheets stacked on top of each other, four DC-motors - one for each wheel - placed between the acrylic sheets and four wheels. The cars were chosen primarily because they were a good platform to experiment and prototype with, but also because we felt it very important to have a small as possible turning radius. The latter we achieved by driving the cars like a tank, where the wheels turn in parallell, making the car capable of spinning around itself.
### Motor Shield
To be able to control the voltage that goes to the DC-motors in a good way we decided to get a motorshield that stacks on top of the development kit. The motorshield we use is produced by [Adafruit](https://www.adafruit.com/products/1438), and is capable of driving 2 hobby servos and 4 DC motors or 2 stepper motors. Since the shield is produced for Arduino and the firmware to drive it doesn't exist for the nRF52 DK, we had to use a [logic analyzer](https://www.saleae.com/) to decipher the data being sent from the Arduino code to the motorshield, and reconstruct it in the firmware for our DK, to produce our own [I²C/TWI](https://en.wikipedia.org/wiki/I%C2%B2C) driver. So now other people wanting to use the Adafruit motorshield with the nRF52 development kit can use our code.
### NFC/RFID Controller Shield
To be able to read RFID-tags and realize our power up functionality we decided to use [Adafruits NFC/RFID Controller Shield](https://www.adafruit.com/products/789). We chose this because the shield uses the I²C communication protocol as default, is compatible with Arduino (thus compatible with our DK) and Adafruit has very good documentation of their products.
### Infrared transmitters and recievers
The laser tag functionality is realized using [IR transmitters and recievers](http://www.dx.com/p/mini-38khz-infrared-transmitter-ir-emitter-module-infrared-receiver-sensor-module-for-arduino-327293#.VuqPR_krKhc). We use transmitters and recievers prefabricated on tiny PCBs with three pins: ground (GND), positive supply voltage (VCC), and signal (SIG). They are rated to run on 3.3 - 5.5 volts, so they are pretty much "plug and play".
### "Bells & Whistles"
We wanted the cars to be a bit more fun, so we decided to add:
- Simple sound using a [piezoelectric speaker](https://en.wikipedia.org/wiki/Piezoelectric_speaker)
- RGB LEDs to provide lights beside the IR recievers to indicate hits and other things,
- A [laser diode](https://www.adafruit.com/products/1054) to work as a sight for the IR transmitter.

## Firmware
### Eddystone and Bluetooth Smart
The very heart in our DK, powered by [Eddystone](https://en.wikipedia.org/wiki/Eddystone_(Google) and Bluetooth® Smart, makes it possible to connect to our 4WD "Robot" Cars instantenously with almost any Bluetooth-device with access to the web. Thanks to Eddystone, our DK will act as a beacon, which in turn makes it a quick and easy process for connecting to the car. The DK will simply advertise our web-URL, and through our website you can control the car through any Bluetooth-device supporting Bluetooth® Smart. The DK itself runs a [very fast chip at 64MHz](https://www.nordicsemi.com/Products/nRF52-Series-SoC), which makes our system very capable for this very use.
### Software Development Kit
Our project is based on Nordic Semiconductors Software Development Kit 11, and is a heavily modified version of ble_app_blinky and its bluetooth service "ble_lbs-service". The bluetooth service itself is greatly modified for our use, and consists of two characteristics; one used for read/write - used mainly by the software -, and one for notifications to the web from the firmware itself.

Both characteristics consists of 20 bytes, and they both have several bytes which are not in use by the project at this moment. This makes our project flexible for further development.
### TWI Motor- and RFID-driver
In order for our DK to connect and communicate with our [motor](https://learn.adafruit.com/adafruit-motor-shield-v2-for-arduino/overview)- and [RFID](https://www.adafruit.com/products/789)-shields, we had to create designated drivers. These drivers were created purely on analyzing the logic on their first-party drivers made for Arduino, and although their design might be vastly different, our drivers work as intended. These drivers are made completely independent of our project, and can be used as libraries for other projects which utilizes these shields.

Note that the motordriver will always set new values for every motor, and currently there is no way of setting a motor value independently. Therefore, if there is a need to change only one motor value, you have to make certain that the old motor values is also defined.

Currently the RFID-driver does not have the option to read a RFID-tag or write to it; as this is not needed for our project. Our RFID-driver is designed to only notify the DK when a nearby tag is in the area.

### "Ouch! I've been hit!" also known as infrared receivers and emitters
Our DK has the ability to receive and send infrared signals, which is the staple function for creating the thrill of the hunt in our "lasertag"-game. The DK simply sends a high pulse to our emitter whenever the client has notified (via Bluetooth) the DK to shoot, and it recognizes a hit through Nordic Semiconductors very own GPIOTE driver.

There is no other trick to it!

### RGB-LEDs and PWM
In order to get more feedback from the game, we added some lights to our project. The DK communicates to these devices with a changing PWM-signal, and you guessed it, this is powered by Nordic Semiconductors app_pwm-library. It should be noted that we've added quite a lot to this library to make it possible to not collide with our other timers, pins and Bluetooth-functionality.

Right now you can call a simple function, `set_rgb_color`, to change the light to a set of predefined values. There is also room for defining further values.

## Software
### Web Bluetooth
The broadcasted Eddystone URL by the Development Kit directs the user to a website that can connect the device to the car using [Web Bluetooth API](https://webbluetoothcg.github.io/web-bluetooth/#introduction). This means that any device with a Web Bluetooth enabled browser is able to connect to and control the car. The part of the JavaScript that takes care of the connection with the Development Kit can be found in `js/ble.js`. 

We have chosen to use a modified version of the LED Button Service included in the nRF52 SDK 11 as our GATT service in this project, and the website will only show devices advertising this particular service when a user tries to connect to the car via the website. This can easily be changed by replacing the UUIDs for your custom service and characteristic UUIDs in `js/ble.js`.

Please keep in mind that we have made these controllers for the car and the game as a demonstration of the potential in the new nRF52 Development Kit. Our background is from the hardware side of things, and the JavaScript is far from perfect. Feedback and tips for improvements to the JavaScript are very welcome. We have learned a lot from working with this, and it would be great to learn even more from more experienced people.

## The Game of Cars
As part of this demo, we have made a version of laser tag for multiple players. In the game menu there's an option to create a multiplayer game that others can join. When a game session is created, a game PIN is shown on the creator's device and others may enter this on their own device to be included in the same session and play against each other. To keep track of the game status and be able to notify the players when the game is over, the browser will make AJAX requests to `php/game.php` at the given interval set in the updateInterval property of the game object in game.js file (1 second by default). This is a solution made for testing purposes, and is probably not a very good one. The database setup needed can be found in the same php-file.

The controllers on the website include a joystick to control the car's movements and a button to 'shoot' at the other cars. The vehicles are equipped with IR-transmitters and receivers to simulate hits. The players have a certain amount of lives and loses one when hit. The car is also equipped with a laser used to aim on other vehicles to make the shooting part of the game easier.

The players can gain life when driving the car over a power up plate. In addition the slot gives three other power ups: shield, rapid fire and speed up only for a certain amount of time. When the vehicle uses shield it's protected against hits. With rapid fire the player is able to shoot three times faster than default shooting speed. When speeded up the car's speed increases by approximately 25%.

The RBG leds signals different actions in the game. Green is a sort of default light that indicates that nothing in particular is happening, the car can also be hit when green. The led changes to red when the car is hit. When red the car gets a power boost it can not be hit again until it's green. The blue led indicates shooting.

A working version of the game can be found and tested [here](https://jtguggedal.github.io)
