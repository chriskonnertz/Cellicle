/**
 * Returns the radius of a circle if the area is given
 * (In this game the area of a player's char is the mass.)
 * 
 * @param  {Float} area The area of the circle
 * @return {Float}      The radius of the circle
 */
getRadiusByArea = function(area)
{
	return Math.sqrt(area / Math.PI);
}

/**
 * Returns the area of a circle if the radius is given
 * (In this game the area of a player's char is the mass.)
 * 
 * @param  {Float} radius The radius of the circle
 * @return {Float}        The area of the circle
 */
getAreaByRadius = function(radius)
{
	return Math.PI * radius * radius;
}

/**
 * Returns true, if two points are "close".
 * WARNING: This is just an estimation. Use this before you use getDistance()
 * to check for true collision.
 * 
 * @param  {[type]}  x1       [description]
 * @param  {[type]}  y1       [description]
 * @param  {[type]}  x2       [description]
 * @param  {[type]}  y2       [description]
 * @param  {[type]}  distance [description]
 * @return {Boolean}
 */
isClose = function(x1, y1, x2, y2, distance)
{
	return (Math.abs(x1 - x2) <= distance) && (Math.abs(y1 - y2) <= distance);
}

/**
 * Calculates the distance between two points.
 * 
 * @param  {Integer} x1
 * @param  {Integer} y1
 * @param  {Integer} x2
 * @param  {Integer} y2
 * @return {Float}
 */
getDistance = function(x1, y1, x2, y2)
{
	return Math.sqrt( (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2) );
}

/**
 * Calculates the angle between two points.
 * Source: http://stackoverflow.com/questions/9614109/how-to-calculate-an-angle-from-points
 * 
 * @param  {Integer} x1
 * @param  {Integer} y1
 * @param  {Integer} x2
 * @param  {Integer} y2
 * @return {Float}
 */
getAngle = function(x1, y1, x2, y2) {
	var angle = Math.atan2(y2 - y1, x2 - x1); // range (-PI, PI]
	angle *= 180 / Math.PI; // rads to degs, range (-180, 180]
	if (angle < 0) angle = 360 + angle; // range [0, 360)
	return angle;
}

/**
 * Returns a random int within a specific interval.
 * From: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
 *
 * @param {Integer} min The minimum
 * @param {Integer} max The maximum
 * @return {Integer} The random int
 */
getRandomInt = function(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Lightens or darkens a hex color´.
 * Source: http://www.sitepoint.com/javascript-generate-lighter-darker-color/
 * 
 * @param  {String} hex The hex value
 * @param  {Float}  lum The Luminosity. Greater 0 = lighten
 * @return {String}
 */
colorLuminance = function(hex, lum) {
    hex = String(hex).replace('#', '');

    if (hex.length == 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    var rgb = '#', c, i;
    for (i = 0; i < 3; i++) {
        c = parseInt(hex.substr(i * 2, 2), 16);
        c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
        rgb += ("00" + c).substr(c.length);
    }

    return rgb;
}

/**
 * Returns a random hex color
 * 
 * @return {String}
 */
getRandomColor = function()
{
	var r = getRandomInt(0, 255);
	var g = getRandomInt(0, 255);
	var b = getRandomInt(0, 255);

	r = Number(r).toString(16);
	g = Number(g).toString(16);
	b = Number(b).toString(16);

	if (r.length < 2) r = '0' + r;
	if (g.length < 2) g = '0' + g;
	if (b.length < 2) b = '0' + b;
		
	return '#' + r + g + b;
}

/**
 * Decides if angle1 is "smaller" or "greater" than angle2.
 * 
 * @param  {Float} angle1 The first angle
 * @param  {Float} angle2 The second angle
 * @return {Integer}      Returns 1 if angle2 is greater or -1 if angle2 is smaller
 */
compareAngles = function(angle1, angle2) 
{
	if ((360 + angle1 - angle2) % 360 < 180) {
		return 1;
	} else {
		return -1;
	}
}

addAngle = function(angle1, angle2)
{
	var angle = angle1 + angle2;

	angle %= 360;
	if (angle < 0) angle += 360;

	return angle;
}

/**
 * Checks if a player can see an object
 * 
 * @param  {Integer}  player The player object with x and y attributes
 * @param  {Integer}  x      The x position of the other object
 * @param  {Integer}  y      The y position of the other object
 * @param  {Integer}  radius The radius of the other object
 * @return {Boolean}
 */
isVisible = function(player, x, y, radius)
{
	var width = 2000;
	var height = 1100;

	return (player.x + 0.5 * width >= x - 0.5 * radius && player.x - 0.5 * width <= x + 0.5 * radius &&
		player.y + 0.5 * height >= y - 0.5 * radius && player.y - 0.5 * height <= y + 0.5 * radius);
}

calcTrafficPerSecond = function(traffic, startedAt)
{
	return traffic / ((Date.now() - startedAt) / 1000);
}

version 				= 0.1 // Version for both the server and the client - they have to match.
massMultiplier 			= 0.005; // Player mass multiplier (to calculate a more readable mass)
massConsumption 		= 0.99987; // Multiplier: How much mass is (not) consumed per tick?
startMass 				= 2000; // Player start mass
asteroidsRadius 		= 12;
asteroidsMass 			= 200;
massKillFactor			= 1.3 // Client A has to be this factor bigger then B to eat B
planetoidsRadius		= 70; // Radius (size) of the planetoids
planetoidsMass 			= getAreaByRadius(planetoidsRadius);