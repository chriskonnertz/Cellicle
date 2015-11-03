var sys         = require('sys');
var fs     		= require('fs');
var util 		= require('util');

require('./shared.js');
require('./server_config.js');

var WebSocketServer = require('ws').Server;
var server = new WebSocketServer({ port: serverConfig.port });

var game = {
	t: 'g', // type: game
	field: {
		sizeX: serverConfig.fieldSizeX,
		sizeY: serverConfig.fieldSizeY,
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
var lastPlayerId = 0;
var lastPartId = 0;

for (var i = field.sizeX * field.sizeY / 50000; i >= 0; i--) {
	spawnAsteroid();
};

for (var i = 0; i < asteroids.length / 20; i++) {
	spawnPlanetoid();
};

addBot('Randy Random');
addBot('Randy Random');
addBot('Randy Random');
addBot('Faith Farmer');
addBot('Faith Farmer');
addBot('Faith Farmer');
addBot('Faith Farmer');
addBot('Faith Farmer');
addBot('Garry Gatherer');
addBot('Garry Gatherer');
addBot('Garry Gatherer');
addBot('Garry Gatherer');
addBot('Hayley Hunter');
addBot('Hayley Hunter');
addBot('Hayley Hunter');
addBot('Hayley Hunter');

setTimeout(gameLoop, serverConfig.gameLoopDelay);

server.on('connection', function connection(connection) {
	connection.on('message', function incoming(message) {
		var data;

		try {
			data = JSON.parse(message);
		} catch (exception) {
			log(exception);
			return;
		}

		if (! data.t) {
			log('Error: Missing message param: type.');
			return;
		}

		switch (data.t) {
			case 'auth':
				if (! data.name) {
					log('Error: Missing message param: name');
					return;
				}
				if (! data.version) {
					log('Error: Missing message param: version');
					return;
				}
				if (typeof(data.spectator) == 'undefined') {
					log('Error: Missing message param: spectator');
					return;
				}

				// Only bots are allowed to use [ and ] in their names
				data.name = data.name.replace('[', '(');
				data.name = data.name.replace(']', ')');

				connection.spectator = (data.spectator == true && serverConfig.allowSpectators);

				if (data.version != version) {
					log('Client "' + data.name + '" has a different version: ' + data.version);
					connection.send(JSON.stringify({ t: 'v', v: version }));
					return;
				}

				if (server.clients.length > serverConfig.maxClients) {
					log('Error: Client tried to auth but server is full.');
					connection.send(JSON.stringify({ t: 'f', mc: serverConfig.maxClients }));
					return;
				}

				if (! connection.spectator) {
					spawnPlayer(null, data.name);
				} else {
					if (players.length == 0) {
						log('Error: Client tried to spectate but server is empty.');
						connection.send(JSON.stringify({ t: 'e' }));
						return;
					}
				}

				connection.player = players[players.length - 1];
				connection.send(JSON.stringify({ t: 'i', pid: connection.player.id }));

				log('Client "' + connection.player.name + '" authenticated.');

				break;
			case 'input':
				if (connection.spectator) {
					return; // Simply ignore these kind of messages
				}
				if (typeof(data.a) == 'undefined') {
					log('Error: Missing message param: accel');
					return;
				}
				if (typeof(data.t) == 'undefined') {
					log('Error: Missing message param: turbo');
					return;
				}
				if (typeof(data.f) == 'undefined') {
					log('Error: Missing message param: fire');
					return;
				}
				if (typeof(data.e) == 'undefined') {
					log('Error: Missing message param: explode');
					return;
				}
				if (typeof(data.an) == 'undefined') {
					log('Error: Missing message param: angle');
					return;
				}

				var turbo = (data.tu == true);
				var fire = (data.f == true);
				var explode = (data.e == true);
				var accel = parseFloat(data.a);
				var angle = parseFloat(data.an);

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
				connection.player.explode = explode;
				connection.player.angle = angle;

				break;
			case 'alter':
				if (connection.spectator) {
					var index = 0;
					for (var i = 0; i < players.length; i++) {
						if (players[i].id == connection.player.id) {
							if (i < players.length - 1) {
								index = i + 1;
							}
							break;
						}
					}
					if (players[index]) {
						connection.player = players[index];
						connection.send(JSON.stringify({ t: 's', pid: connection.player.id }));
					}
				} else {
					log('Warning: Client attempted to change specated player but is not specator.');
				}
				break;
			case 'rcon':
				if (! serverConfig.rconPassword) {
					log('Warning: Client attempted to execute rcon command, but no rcon password is set.');
					return;
				}

				if (typeof(data.rp) == 'undefined') {
					log('Error: Missing message param: rcon password');
					return;
				}
				if (typeof(data.c) == 'undefined') {
					log('Error: Missing message param: command');
					return;
				}

				if (data.rp !== serverConfig.rconPassword) {
					log('Warning: Wrong rcon password.');
					return;
				}

				switch (data.c) {
					case 'shutdown':
						log('Server shutdown.');
						process.exit(1); 
						break;
					default:
						log('Warning: Unknown rcon command.');
				}

				break;
			default:
				log('Error: Unkown messsage type.');
		}
	});

	connection.on('close', function close() {
		if (connection.player) {
			log('Client "' + connection.player.name + '" disconnected.');
			connection.player.speed = 40;
			spawnPart(connection.player, connection.player.mass, 10, 360);
			players.splice(players.indexOf(connection.player), 1);
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
	// If there are no clients connected do not let the bots play
	if (server.clients.length == 0) {
		setTimeout(gameLoop, serverConfig.gameLoopDelay);
		return;
	}

	var player;

	players.forEach(function(player)
	{
		if (player.fire) {
			tryFire(player);
		}

		if (player.explode) {
			tryExplode(player);
		}

		var moveDistance = (player.speed + player.accel * 10) / (Math.log(player.mass * massMultiplier) / Math.log(10));

		if (player.turbo) {
			tryTurbo(player);
		}

		player.speed -= 2;
		if (player.speed < 0) {
			player.speed = 0;
		}

		// Move player
		if (player.speed || player.accel) {	
			player.x = Math.round(Math.cos(player.angle * Math.PI / 180) * moveDistance + player.x);
			player.y = Math.round(Math.sin(player.angle * Math.PI / 180) * moveDistance + player.y);

			if (player.x < 0) player.x = 0;
			if (player.y < 0) player.y = 0;
			if (player.x > field.sizeX) player.x = field.sizeX;
			if (player.y > field.sizeY) player.y = field.sizeY;

			// Check collision with asteroids
			var playerRadius = getRadiusByArea(player.mass);
			for (var i = 0; i < asteroids.length; i++) {
				if (getDistance(player.x, player.y, asteroids[i].x, asteroids[i].y) 
					<= playerRadius) {
					player.mass += asteroidsMass;
					spawnAsteroid(i);
					break;
				}
			};

			// Check collision with other player parts
			playerRadius = getRadiusByArea(player.mass);
			for (var i = 0; i < parts.length; i++) {
				if (player.id == parts[i].playerId && parts[i].speed > 0) {
					continue;
				}
				//var partRadius = getRadiusByArea(parts[i].mass);
				if (getDistance(player.x, player.y, parts[i].x, parts[i].y) 
					<= playerRadius) {
					if (parts[i].projectile) {
						spawnDebrisPart(player, parts[i]);
						if (player.mass < 0.5 * startMass) {
							spawnPlayer(player.id);
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
				var distance = getDistance(player.x, player.y, planetoids[i].x, planetoids[i].y);

				if (planetoidsRadius >= playerRadius && distance <= planetoidsRadius) {
					player.isSave = true;
					break;
				}

				if (planetoidsRadius < playerRadius && distance <= playerRadius) {
					spawnCollisionPart(player, planetoids[i], planetoidsMass);
					break;
				}
			}

			// Check collision with other players
			for (var i = 0; i < players.length; i++) {
				if (players[i].id == player.id) {
					continue;
				}
				var distance = getDistance(player.x, player.y, players[i].x, players[i].y);
				if (distance < getRadiusByArea(player.mass) 
					&& player.mass >= players[i].mass * massKillFactor && ! players[i].isSave)
				{
					player.mass += players[i].mass;
					spawnPlayer(players[i].id);
				}
				if (distance < getRadiusByArea(players[i].mass) 
					&& players[i].mass >= player.mass * massKillFactor && ! player.isSave)
				{
					players[i].mass += player.mass;
					spawnPlayer(player.id);
				}
			};
		}

		// Calculate mass
		player.mass *= massConsumption;
	});

	parts.forEach(function(part)
	{
		part.speed -= 1;
		if (part.speed < 0) {
			part.speed = 0;
		}
		if (part.speed == 0) {
			part.projectile = false;
		}

		// Move part
		if (part.speed) {	
			part.x = Math.round(Math.cos(part.angle * Math.PI / 180) * part.speed + part.x);
			part.y = Math.round(Math.sin(part.angle * Math.PI / 180) * part.speed + part.y);

			if (part.x < 0) part.x = 0;
			if (part.y < 0) part.y = 0;
			if (part.x > field.sizeX) part.x = field.sizeX;
			if (part.y > field.sizeY) part.y = field.sizeY;
		}

		if (part.mass >= 0.1 * startMass) {
			part.mass *= 0.999;
		}
	});

	bots.forEach(function(bot)
	{
		player = bot.player;

		switch (bot.type) {
			case 'Randy Random':
				if (typeof(bot.angle) == 'undefined' 
					|| player.x < 100 || player.y < 100 || player.x > field.sizeX - 100 || player.y > field.sizeY - 100
					|| Date.now() - bot.angleDuration > bot.angleSet) 
				{
					
					bot.angle = getRandomInt(0, 360);
					bot.angleSet = Date.now();
					bot.angleDuration = getRandomInt(200, 2000);

					player.accel = 1;
				}

				player.angle += compareAngles(bot.angle, player.angle) * Math.min(15, getAngleDiff(bot.angle, player.angle));
				if (player.angle < 0) player.angle += 360;
				if (player.angle > 360) player.angle -= 360;

				break;
			default:
				// Check start eating
				if (typeof(bot.mode) == 'undefined' || bot.mode === null
					|| (bot.target == 'asteroid' && bot.targetSpawnCounter != asteroids[bot.targetIndex].spawnCounter)
					|| (bot.target == 'part' && (! parts[bot.targetIndex] || bot.targetId != parts[bot.targetIndex].id)))
				{
					bot.mode = 'eat';
					bot.target = null;

					var min = -1;
					for (var i = 0; i < parts.length; i++) {
						if (parts[i].speed > 0) {
							continue;
						}

						var distance = getDistance(player.x, player.y, parts[i].x, parts[i].y);
						if (distance < 800 && (min == -1 || distance < min)) {
							bot.target = 'part';
							bot.targetIndex = i;
							bot.targetId = parts[i].id;
							min = distance;
						}
					}

					if (! bot.target) {
						bot.target = 'asteroid';
						var min = -1;
						for (var i = 0; i < asteroids.length; i++) {
							var distance = getDistance(player.x, player.y, asteroids[i].x, asteroids[i].y);
							if (min == -1 || distance < min) {
								bot.targetIndex = i;
								bot.targetSpawnCounter = asteroids[i].spawnCounter;
								min = distance;
							}
						}
					}
				}

				// Check start escaping/hunting
				if (bot.mode == 'eat') {
					var radius = getRadiusByArea(player.mass);
					for (var i = 0; i < players.length; i++) {
						if (players[i].id  == player.id) {
							continue;
						}
						var distance = getDistance(player.x, player.y, players[i].x, players[i].y);

						if (bot.mode != 'escape' && bot.type != 'Faith Farmer' 
							&& player.mass >= players[i].mass * massKillFactor
							&& ! players[i].isSave && player.mass >= 2 * startMass
							&& (distance < radius + 150 || (bot.type == 'Hayley Hunter' && distance < radius + 300)) 
							&& (bot.target != 'part' || parts[bot.targetIndex].mass < players[i].mass)) 
						{
							var angle = getAngle(players[i].x, players[i].y, player.x, player.x);
							if (getAngleDiff(angle, players[i].angle) <= 90) {
								bot.mode = 'hunt';
								bot.target = 'player';
								bot.targetId = players[i].id;
								bot.targetLife = players[i].life;
								bot.huntStartedAt = Date.now();
							}
						} 

						if (! player.isSave && players[i].mass >= player.mass* massKillFactor &&
							distance < getRadiusByArea(players[i].mass) + 150) 
						{
							bot.mode = 'escape';
							bot.angle = getAngle(players[i].x, players[i].y, player.x, player.y);
							bot.escapeUntil = Date.now() + 2000;
							bot.targetId = players[i].id;
							bot.targetLife = players[i].life;

							if (player.y < 300 && player.y < players[i].y && player.x > players[i].x) bot.angle = 45;
							if (player.y < 300 && player.y < players[i].y && player.x <= players[i].x) bot.angle = 135;
							if (player.y > field.sizeY - 300 && player.y > players[i].y && player.x > players[i].x) bot.angle = 315;
							if (player.y > field.sizeY - 300 && player.y > players[i].y && player.x <= players[i].x) bot.angle = 225;
							if (player.x < 300 && player.x < players[i].x && player.y > players[i].y) bot.angle = 45;
							if (player.x < 300 && player.x < players[i].x && player.y <= players[i].y) bot.angle = 315;
							if (player.x > field.sizeX - 300 && player.x > players[i].x && player.y > players[i].y) bot.angle = 135;
							if (player.x > field.sizeX - 300 && player.x > players[i].x && player.y <= players[i].y) bot.angle = 225;
						}
					}
				}

				// Eat
				if (bot.mode == 'eat') {
					player.accel = 1;

					if (bot.target == 'asteroid') {
						bot.angle = getAngle(player.x, player.y, asteroids[bot.targetIndex].x, asteroids[bot.targetIndex].y);
					}
					if (bot.target == 'part') {
						bot.angle = getAngle(player.x, player.y, parts[bot.targetIndex].x, parts[bot.targetIndex].y);	
					}

					player.angle += compareAngles(bot.angle, player.angle) * Math.min(15, getAngleDiff(bot.angle, player.angle));
					if (player.angle < 0) player.angle += 360;
					if (player.angle > 360) player.angle -= 360;
				}

				// Hunt
				if (bot.mode == 'hunt') {
					var target = getPlayerById(bot.targetId);

					if (target && bot.targetLife == target.life
						&& ! target.isSave && player.mass >= target.mass * massKillFactor
						&& Date.now() - bot.huntStartedAt < 3000 // (It's possible that the hunt restarts immediately)
						&& getDistance(player.x, player.y, target.x, target.y) < getRadiusByArea(player.mass) + 300) 
					{
						player.accel = 1;

						bot.angle = getAngle(player.x, player.y, target.x, target.y);

						player.angle += compareAngles(bot.angle, player.angle) * Math.min(15, getAngleDiff(bot.angle, player.angle));
						if (player.angle < 0) player.angle += 360;
						if (player.angle > 360) player.angle -= 360;

						if (bot.type == 'Hayley Hunter' && getAngleDiff(bot.angle, player.angle) < 10
							&& target.mass > 0.2 * player.mass && target.mass > 3 * startMass) 
						{
							tryFire(player);	
						}
					} else {
						bot.mode = null;
					}
				}

				// Escape
				if (bot.mode == 'escape') {
					player.accel = 1;

					if (player.isSave) {
						player.accel = 0;
					} else {
						var target = getPlayerById(bot.targetId);
						if (target && bot.targetLife == target.life) {
							var distance = getDistance(player.x, player.y, target.x, target.y);
							if (distance < getRadiusByArea(target.mass) + 50) {
								tryTurbo(player);
							}
						}

						player.angle += compareAngles(bot.angle, player.angle) * Math.min(15, getAngleDiff(bot.angle, player.angle));
						if (player.angle < 0) player.angle += 360;
						if (player.angle > 360) player.angle -= 360;
					}

					if (Date.now() > bot.escapeUntil) {
						bot.mode = null; // Stop escaping
					}
				}

				break;
		}
	});

	server.clients.forEach(function each(client) {
		// Client exists before initialization so we return if the player object does not exist yet
		if (! client.player) {
			return;
		}

		var me = client.player;
		var clientGame = { t: 'g', f: { sx: field.sizeX, sy: field.sizeY } };

		var clientPlayers = [];
		players.forEach(function(player)
		{
			if (isVisible(me, player.x, player.y, getRadiusByArea(player.mass))) {
				clientPlayers.push({
					id: player.id,
					x: player.x,
					y: player.y,
					m: player.mass,
					c: player.color,
					cd: player.colorDark,
					an: player.angle,
					n: player.name,
				});
			}
		});
		clientGame.p = clientPlayers;

		var clientParts = [];
		parts.forEach(function(part)
		{
			if (isVisible(me, part.x, part.y, getRadiusByArea(part.mass))) {
				clientParts.push({
					x: part.x,
					y: part.y,
					m: part.mass,
					c: part.color,
				});
			}
		});
		clientGame.pa = clientParts;	

		var clientAsteroids = [];
		asteroids.forEach(function(asteroid)
		{
			if (isVisible(me, asteroid.x, asteroid.y, asteroidsRadius)) {
				clientAsteroids.push({
					x: asteroid.x,
					y: asteroid.y,
				});
			}
		});
		clientGame.a = clientAsteroids;

		var clientPlanetoids = [];
		planetoids.forEach(function(planetoid, index)
		{
			if (isVisible(me, planetoid.x, planetoid.y, 1.1 * planetoidsRadius)) {
				clientPlanetoids.push({
					x: planetoid.x,
					y: planetoid.y,
					i: index,
				});
			}
		});
		clientGame.pl = clientPlanetoids;	

		client.send(JSON.stringify(clientGame), function(error)
		{
			if (error) {
				log('Error: Error occured when sending data to client.');
			}
		});
	});

	setTimeout(gameLoop, serverConfig.gameLoopDelay);
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
 * @param  {Integer} id Optional: The id of an existing player
 * @param  {Integer} name Optional: The name of a new player
 */
function spawnPlayer(id, name)
{
	var color = getRandomColor();
	var player;

	if (typeof(id) == 'undefined' || id === null) {
		player = {
			id: ++lastPlayerId,
			x: getRandomInt(0, field.sizeX), 
			y: getRandomInt(0, field.sizeY),
			color: color,
			colorDark: colorLuminance(color, -0.2),
			mass: startMass,
			name: name,
			angle: getRandomInt(0, 360),
			lastTurbo: 0,
			lastExplode: 0,
			lastFire: 0,
			speed: 0,
			accel: 0,
			life: 0,
		};

		players.push(player);
	} else {
		player = getPlayerById(id);

		player.x = getRandomInt(0, field.sizeX);
		player.y = getRandomInt(0, field.sizeY);
		player.color = color;
		player.colorDark = colorLuminance(color, -0.2);
		player.mass = startMass;
		player.angle = getRandomInt(0, 360);
		player.lastTurbo = 0;
		player.lastExplode = 0;
		player.lastFire = 0;
		player.speed = 0;
		player.accel = 0;
		player.life++;

		bots.some(function(bot)
		{
			if (id == bot.player.id) {
				bot = { type: bot.type, player: bot.player };
				return true; // Break the forEach-loop
			}
		});
	}
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
		spawnCounter: 1,
	};

	if (typeof(index) == 'undefined') {
		asteroids.push(asteroid);
	} else {
		var spawnCounter = asteroids[index].spawnCounter + 1;
		asteroids[index] = asteroid;
		asteroids[index].spawnCounter = spawnCounter;
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

function spawnPart(player, mass, amount, maxAngle)
{
	if (typeof(amount) == 'undefined' || amount < 1) {
		amount = 1;
	}
	if (typeof(mass) == 'undefined' || mass < 1 || mass > player.mass) {
		mass = 0.33 * player.mass;
	}
	if (typeof(maxAngle) == 'undefined' || maxAngle < 0) {
		maxAngle = 60;
	}

	player.mass -= mass;

	var radius = getRadiusByArea(player.mass);

	for (var i = 0; i < amount; i++) {
		var angle = (player.angle + 180) % 360; // Backwards
		angle = angle - getRandomInt(0, maxAngle) + 0.5 * maxAngle;
		if (angle < 0) angle += 360;
		if (angle > 360) angle -= 360;

		var part = {
			x: player.x - radius + getRandomInt(0, radius * 2),
			y: player.y - radius + getRandomInt(0, radius * 2), 
			mass: mass / amount,
			playerId: player.id,
			color: player.color,
			angle: angle,
			speed: player.speed,
			projectile: false,
			id: ++lastPartId,
		}
		parts.push(part);
	};
}

function spawnProjectilePart(player)
{
	var mass = Math.min(0.05 * player.mass, startMass);
	player.mass -= mass;

	var part = {
		x: player.x,
		y: player.y, 
		mass: mass,
		playerId: player.id,
		color: player.color,
		angle: player.angle,
		speed: Math.max(40, player.speed + 10),
		projectile: true,
		id: ++lastPartId,
	}
	parts.push(part);
}

function spawnDebrisPart(player, part)
{
	var extraMass = part.mass;
	player.mass -= extraMass;

	if (player.mass < 0) {
		extraMass += Math.max(0, player.mass);
	}

	part.mass *= 2;
	part.playerId = player.id;
	part.color = player.color;
	//part.speed *= 0.75;
	part.projectile = false;
	part.angle = getAngle(player.x, player.y, part.x, part.y);
	part.id = ++lastPartId;
}

/**
 * Spawns a "player part" after a collision.
 * IMPORTANT: The object needs to have x and y attributes!
 * 
 * @param  {Object} player      The player object
 * @param  {Object} object      The colliding object
 * @param  {Integer} objectMass How much mass?
 */
function spawnCollisionPart(player, object, objectMass) {
	var mass = Math.min(objectMass, player.mass);
	player.mass -= mass;

	var angle = getAngle(object.x, object.y, player.x, player.y);

	if (mass >= 0.5 * startMass) {
		for (var i = 0; i < 5; i++) {
			var part = {
				x: object.x,
				y: object.y, 
				mass: mass / 5,
				playerId: player.id,
				color: player.color,
				angle: addAngle(angle, getRandomInt(-60, 60)),
				speed: getRandomInt(15, 25),
				projectile: false,
				id: ++lastPartId,
			}
			parts.push(part);
		}
	}

	if (player.mass < 0.2 * startMass) {
		spawnPlayer(player.id);
	}
}

function tryFire(player)
{
	if (Date.now() - player.lastFire > 250 && player.mass >= 2 * startMass) {
		player.lastFire = Date.now();
		spawnProjectilePart(player);
	}
}

function tryExplode(player)
{
	if (Date.now() - player.lastExplode > 250 && player.mass >= 4 * startMass) {
		var mass = 0.75 * player.mass;
		player.speed = 60;
		player.lastExplode = Date.now();
		spawnPart(player, mass, getRandomInt(3, 7), 270);
	}
}

function tryTurbo(player)
{
 	if (Date.now() - player.lastTurbo > 250 && player.mass >= 2 * startMass) {
		var mass = 0.33 * player.mass;
		player.speed = 40;
		player.lastTurbo = Date.now();
		spawnPart(player, mass, getRandomInt(3, 7));
	}
}

/**
 * Returns the player object with the given ID
 * 
 * @param  {Integer} id The ID of the player
 * @return {Object}    The player object
 */
function getPlayerById(id)
{
	for (var i = 0; i < players.length; i++) {
		if (players[i].id == id) {
			return players[i];
		}
	}
	return null;
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
 * Logs some text (or object) to the console & a file
 * 
 * @param  {String} text The log text
 */
function log(text)
{
	var date = new Date();

	if (typeof(text) != 'string') {
		text = JSON.stringify(text);
	}

	text = '[' + date.toUTCString() + '] ' + text;

	fs.appendFile(serverConfig.logFile, text + '\r\n'); // File output
	sys.puts(text); // Console ouput 
}

log('Server running on port ' + server.options.port + '.');