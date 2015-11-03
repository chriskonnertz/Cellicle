# Cellicle

**2D Browsergame, Agar.io clone, NodeJS, Real-time**

![Screenshot of the game](cellicle.jpg)

This is a simple 2D browser game built with NodeJS (server side) and JavaScript in general.

### Instructions

Some strange bio-mass virus tries to conquer the universe! It aims to eat every asteroids (small yellow circles) in its way. Yes, with its scifimagical abilities it's able to eat yellow asteroids like popcorn. Delicious! But eating asteroids is not enough. Feed on other players (aka bio-mass) as well! But be aware, you can only eat smaller blobs. And never try to eat planetoids (big gray polygons). if you are smaller than them u automagically land on their dark side and they protect you from other players. But if you are bigger you will collide and lose mass! If you have to escape press `spacebar` to expell one third of your mass to provide propulsion. Or press `e` to lose three quarters of your mass in an explosion but to gain a huge speed boost. You are even capable of using your bio-mass as a weapon! Use your mouse to left click and to fire up to one twentieth of your mass on your opponents. Never forget, if your projectiles have lost their speed opponents are able to feed on it!

### Start

* To start the server: `nodejs server.js` (You will have to end it manually by terminating the process or via the remote command `shutdown`)
* The server will listen to port 8080 of the system and will use the websocket protocol. Example URI: `ws://localhost:8080/`

## Config

Open the `server_config.js` file and edit these values:

* `rconPassword` (String): Set the password for remote access
* `maxClients` (Integer): Limit the number of clients (bots do not count)
* `port` (Integer): The server port, default is 8080
* `fieldSizeX` (Integer): The horizontal size of the field
* `fieldSizeY` (Integer): The vertical size of the field
* `logFile` (String): Name of the server log file
* `allowSpectators` (Boolean): Allow clients to connect as spectators?
* `gameLoopDelay` (Integer): Min. delay between two iterations of the game loop. Change this with caution!

## Bots

* `Randy Random`: Moves from one random location to another.
* `Faith Farmer`: Gathering asteroids and bio-mass. Tries to escape from attacks.
* `Garry Gatherer`: Gathering asteroids and bio-mass. Tries to escape from attacks. Tries to eat nearby players.
* `Hayley Hunter`: Gathering asteroids and bio-mass. Tries to escape from attacks. Tries to eat nearby players and to shoot them down.

## Notes

* The server will hibernate if no player is in the game