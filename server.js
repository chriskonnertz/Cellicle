var sys         = require('sys');
var filesys     = require('fs');
var util 		= require('util');

require('./shared.js');

var WebSocketServer = require('ws').Server;
var server = new WebSocketServer({ port: 8080 });

var game = {
	type: 'game',
	field: {
		sizeX: 3000,
		sizeY: 2000,
	},
	players: [],
	asteroids: [],
	planetoids: [],
	parts: [],
}

var field = game.field;
var players = game.players;
var asteroids = game.asteroids;
var planetoids = game.planetoids;
var parts = game.parts;
var bots = [];
var clientUpdateNeeded = false;

for (var i = field.sizeX * field.sizeY / 50000; i >= 0; i--) {
	spawnAsteroid();
};

for (var i = 0; i < asteroids.length / 20; i++) {
	spawnPlanetoid();
};

addBot('Random');
addBot('Random');
addBot('Random');
addBot('Random');
addBot('Gatherer');
addBot('Gatherer');
addBot('Gatherer');
addBot('Gatherer');

setTimeout(gameLoop, 30);

server.on('connection', function connection(connection) {
	connection.on('message', function incoming(message) {
		var data;

		try {
			data = JSON.parse(message);
		} catch (exception) {
			log(exception);
			return;
		}

		if (! data.type) {
			log('Error: Missing message type.');
			return;
		}

		switch (data.type) {
			case 'auth':
				if (! data.name) {
					log('Error: Missing message param: name');
					return;
				}

				data.name = data.name.replace('[', '(');
				data.name = data.name.replace(']', ')');

				spawnPlayer(null, data.name);

				connection.player = players[players.length - 1];

				connection.send(JSON.stringify({ type: 'init', playerIndex: connection.player.index }));

				log('Client "' + connection.player.name + '" authenticated.');

				break;
			case 'input':
				if (typeof(data.accel) == 'undefined') {
					log('Error: Missing message param: accel');
					return;
				}
				if (typeof(data.turbo) == 'undefined') {
					log('Error: Missing message param: turbo');
					return;
				}
				if (typeof(data.fire) == 'undefined') {
					log('Error: Missing message param: fire');
					return;
				}
				if (typeof(data.angle) == 'undefined') {
					log('Error: Missing message param: angle');
					return;
				}

				var turbo = (data.turbo == true);
				var fire = (data.fire == true);
				var accel = parseFloat(data.accel);
				var angle = parseFloat(data.angle);

				if (accel < 0 || accel > 1) {
					log('Error: Invalid message param: accel');
					return;
				}

				if (angle < 0 || angle > 360) {
					log('Error: Invalid message param: angle');
					return;
				}

				connection.player.accel = accel;
				connection.player.turbo = turbo;
				connection.player.fire = fire;
				connection.player.angle = angle;

				clientUpdateNeeded = true;

				break;
			default:
				log('Error: Unkown messsage type.');
		}
	});

	connection.on('close', function close() {
		if (connection.player) {
			log('Client "' + connection.player.name + '" disconnected.');
		} else {
			log('Unkown client disconnected.');
		}	    
	});

	log('Client connected.');
});

/**
 * Game loop
 */
function gameLoop()
{
	var player;

	players.forEach(function(player)
	{
		if (player.fire && Date.now() - player.lastFire > 250 && player.mass >= 2 * startMass) {
			player.lastFire = Date.now();
			spawnProjectilePart(player);
		}

		var moveDistance = (player.speed + player.accel * 10) / (Math.log(player.mass) / Math.log(10));

		if (player.turbo && Date.now() - player.lastTurbo > 250 && player.mass >= 2 * startMass) {
			var mass = 0.33 * player.mass;
			player.speed = 40;
			player.lastTurbo = Date.now();
			spawnPart(player, mass, getRandomInt(3, 7));
		}

		player.speed -= 2;
		if (player.speed < 0) {
			player.speed = 0;
		}

		// Move player
		if (player.speed || player.accel) {
			clientUpdateNeeded = true;
			
			player.x = Math.round(Math.cos(player.angle * Math.PI / 180) * moveDistance + player.x);
			player.y = Math.round(Math.sin(player.angle * Math.PI / 180) * moveDistance + player.y);

			if (player.x < 0) player.x = 0;
			if (player.y < 0) player.y = 0;
			if (player.x > field.sizeX) player.x = field.sizeX;
			if (player.y > field.sizeY) player.y = field.sizeY;

			// Check collision with asteroids
			var playerRadius = getRadiusByArea(player.mass * playerRadiusMultiplier);
			for (var i = 0; i < asteroids.length; i++) {
				if (getDistance(player.x, player.y, asteroids[i].x, asteroids[i].y) 
					<= playerRadius) {
					player.mass++;
					spawnAsteroid(i);
					break;
				}
			};

			// Check collision with other player parts
			playerRadius = getRadiusByArea(player.mass * playerRadiusMultiplier);
			for (var i = 0; i < parts.length; i++) {
				if (player.index == parts[i].playerIndex) {
					continue;
				}
				//var partRadius = getRadiusByArea(parts[i].mass * playerRadiusMultiplier);
				if (getDistance(player.x, player.y, parts[i].x, parts[i].y) 
					<= playerRadius) {
					if (parts[i].projectile) {
						spawnDebrisPart(player, parts[i]);
						if (player.mass < 0.5 * startMass) {
							spawnPlayer(player.index);
						}
					} else {
						player.mass += parts[i].mass;
						parts.splice(i, 1);
					}					
					break;
				}
			};

			// Check collision with planetoids
			player.isSave = false;
			for (var i = 0; i < planetoids.length; i++) {
				if (planetoidRadius >= playerRadius) {
					if (getDistance(player.x, player.y, planetoids[i].x, planetoids[i].y) <= planetoidRadius) {
						player.isSave = true;
						break;
					}
				}
			}

			// Check collision with other players
			for (var i = 0; i < players.length; i++) {
				if (i == player.index) {
					continue;
				}
				var distance = getDistance(player.x, player.y, players[i].x, players[i].y);
				if (distance < getRadiusByArea(player.mass * playerRadiusMultiplier) 
					&& player.mass * massKillFactor >= players[i].mass && ! players[i].isSave)
				{
					player.mass += players[i].mass;
					spawnPlayer(i);
				}
				if (distance < getRadiusByArea(players[i].mass * playerRadiusMultiplier) 
					&& players[i].mass * massKillFactor >= player.mass && ! player.isSave)
				{
					players[i].mass += player.mass;
					spawnPlayer(player.index);
				}
			};
		}

		// Calculate mass
		var massRounded = Math.round(player.mass);
		player.mass = player.mass * 0.99987;

		if (Math.round(player.mass) != massRounded) {
			clientUpdateNeeded = true;
		}
	});

	parts.forEach(function(part)
	{
		part.speed -= 1;
		if (part.speed < 0) {
			part.speed = 0;
		}

		// Move player
		if (part.speed) {
			clientUpdateNeeded = true;
			
			part.x = Math.round(Math.cos(part.angle * Math.PI / 180) * part.speed + part.x);
			part.y = Math.round(Math.sin(part.angle * Math.PI / 180) * part.speed + part.y);

			if (part.x < 0) part.x = 0;
			if (part.y < 0) part.y = 0;
			if (part.x > field.sizeX) part.x = field.sizeX;
			if (part.y > field.sizeY) part.y = field.sizeY;
		}
	});

	bots.forEach(function(bot)
	{
		player = bot.player;

		switch (bot.type) {
			case 'Random':
				if (typeof(bot.angle) == 'undefined' 
					|| player.x < 100 || player.y < 100 || player.x > field.sizeX - 100 || player.y > field.sizeY - 100
					|| Date.now() - bot.angleDuration > bot.angleSet) 
				{
					
					bot.angle = getRandomInt(0, 360);
					bot.angleSet = Date.now();
					bot.angleDuration = getRandomInt(200, 2000);

					player.accel = 1;
				}

				player.angle += compareAngles(bot.angle, player.angle) * 15;
				if (player.angle < 0) player.angle += 360;
				if (player.angle > 360) player.angle -= 360;

				break;
			case 'Gatherer':
				if (typeof(bot.asteroidIndex) == 'undefined' 
					|| bot.asteroidX != asteroids[bot.asteroidIndex].x || bot.asteroidY != asteroids[bot.asteroidIndex].y) 
				{
					var min = -1;
					for (var i = 0; i < asteroids.length; i++) {
						var distance = getDistance(player.x, player.y, asteroids[i].x, asteroids[i].y);
						if (min == -1 || distance < min) {
							bot.asteroidIndex = i;
							bot.asteroidX = asteroids[i].x;
							bot.asteroidY = asteroids[i].y;
							min = distance;
						}
					}
					player.accel = 1;
				}

				bot.angle = getAngle(player.x, player.y, bot.asteroidX, bot.asteroidY);
				player.angle += compareAngles(bot.angle, player.angle) * 15;
				if (player.angle < 0) player.angle += 360;
				if (player.angle > 360) player.angle -= 360;

				break;
		}
	});

	if (clientUpdateNeeded) {
		server.clients.forEach(function each(client) {
			client.send(JSON.stringify(game), function(error)
			{
				if (error) log(error);
			});
		});

		clientUpdateNeeded = false;
	}

	setTimeout(gameLoop, 30);
}

/**
 * Adds a new bot to the game
 * 
 * @param {String} type The type of the bot
 */
function addBot(type)
{
	spawnPlayer(null, '[' + type + ']');
	bots.push({ type: type, player: players[players.length - 1] });
}

/**
 * Spawns a player
 * 
 * @param  {Integer} index Optional: The index of an existing player
 * @param  {Integer} name Optional: The name of a new player
 */
function spawnPlayer(index, name)
{
	var color = getRandomColor();
	var player;

	if (typeof(index) == 'undefined' || index === null) {
		player = {
			index: players.length,
			x: getRandomInt(0, field.sizeX), 
			y: getRandomInt(0, field.sizeY),
			color: color,
			colorDark: colorLuminance(color, -0.2),
			mass: startMass,
			name: name,
			angle: getRandomInt(0, 360),
			lastTurbo: 0,
			lastFire: 0,
			speed: 0,
			accel: 0,
		};

		players.push(player);
	} else {
		player = players[index];

		player.x = getRandomInt(0, field.sizeX);
		player.y = getRandomInt(0, field.sizeY);
		player.color = color;
		player.colorDark = colorLuminance(color, -0.2);
		player.mass = startMass;
		player.angle = getRandomInt(0, 360);
		player.lastTurbo = 0;
		player.lastFire = 0;
		player.speed = 0;
		player.accel = 0;

		bots.some(function(bot)
		{
			if (bot.player.index == index) {
				bot = { type: bot.type, player: bot.player };
				return true; // Break the forEach-loop
			}
		});
	}

	clientUpdateNeeded = true;
}

/**
 * Spawns a mini
 * 
 * @param  {Integer} index Optional: The index of an existing asteroid
 */
function spawnAsteroid(index)
{
	var asteroid = { 
		x: getRandomInt(0, field.sizeX), 
		y: getRandomInt(0, field.sizeY), 
		radius: getRandomInt(10, 20),
	};

	if (typeof(index) == 'undefined') {
		asteroids.push(asteroid);
	} else {
		asteroids[index] = asteroid;
	}
}

/**
 * Spawns a planetoid
 */
function spawnPlanetoid()
{
	var planetoid = { 
		x: getRandomInt(0, field.sizeX), 
		y: getRandomInt(0, field.sizeY),
	};
	planetoids.push(planetoid);
}

function spawnPart(player, mass, amount)
{
	if (typeof(amount) == 'undefined' || amount < 1) {
		amount = 1;
	}
	if (typeof(mass) == 'undefined' || mass < 1 || mass > player.mass) {
		mass = 0.33 * player.mass;
	}

	player.mass -= mass;

	var radius = getRadiusByArea(player.mass * playerRadiusMultiplier);

	for (var i = 0; i < amount; i++) {
		var angle = (player.angle - 180) % 360; // Backwards
		angle = angle - getRandomInt(0, 60) + 30;
		if (angle < 0) angle += 360;
		if (angle > 360) angle -= 360;

		var part = {
			x: player.x - radius + getRandomInt(0, radius * 2),
			y: player.y - radius + getRandomInt(0, radius * 2), 
			mass: mass / amount,
			playerIndex: player.index,
			angle: angle,
			speed: player.speed,
			projectile: false,
		}
		parts.push(part);
	};
}

function spawnProjectilePart(player)
{
	var mass = 0.05 * player.mass;
	player.mass -= mass;

	var part = {
		x: player.x,
		y: player.y, 
		mass: mass,
		playerIndex: player.index,
		angle: player.angle,
		speed: Math.max(40, player.speed + 10),
		projectile: true,
	}
	parts.push(part);
}

function spawnDebrisPart(player, part)
{
	player.mass -= part.mass;

	//part.mass *= 2;
	part.playerIndex = player.index;
	part.speed = 0.75;
	part.projectile = false;
	part.angle = getAngle(player.x, player.y, part.x, part.y);
}

/**
 * Exits the process and prints a JSON-like representation of any passed arguments.
 */
function dd()
{
	for (var i = 0; i < arguments.length; i++) {
		sys.puts(util.inspect(arguments[i], {showHidden: false, depth: 1}));
	};
	process.exit(1); // See: https://nodejs.org/api/process.html#process_process_exit_code
}

/**
 * Logs some text (or object) to the console
 * 
 * @param  {String} text The log text
 */
function log(text)
{
	var date = new Date();

	if (typeof(text) != 'string') {
		text = JSON.stringify(text);
	}

	sys.puts('[' + date.toUTCString() + '] ' + text); 
}

log('Server running on port ' + server.options.port + '.');