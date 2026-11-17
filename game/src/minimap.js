// The minimap in the top-right corner: the whole city shrunk to a panel, with the
// player as a white arrow, police as red dots, the mission marker as a gold
// diamond and the Hideout as a green square. Drawn straight onto the main canvas.

import { PALETTE, PLACES, ROADS_X, ROADS_Y, WORLD } from './config.js';

const MAP_W = 200;
const MAP_H = 150;

export function drawMinimap(context, view, city, ents, hud) {
  const x = view.width - MAP_W - 18;
  const y = 18;
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;

  context.fillStyle = 'rgba(10, 14, 20, 0.8)';
  context.fillRect(x, y, MAP_W, MAP_H);
  context.strokeStyle = 'rgba(255,255,255,0.35)';
  context.lineWidth = 1;
  context.strokeRect(x, y, MAP_W, MAP_H);

  // Water and beach along the bottom.
  context.fillStyle = '#2f7fb8';
  context.fillRect(x, y + city.waterTop * sy, MAP_W, MAP_H - city.waterTop * sy);
  context.fillStyle = '#e8d39a';
  context.fillRect(x, y + city.beachTop * sy, MAP_W, (city.waterTop - city.beachTop) * sy);

  // Roads.
  context.strokeStyle = 'rgba(220, 225, 235, 0.75)';
  context.lineWidth = 1.5;
  for (const rx of ROADS_X) {
    context.beginPath();
    context.moveTo(x + rx * sx, y);
    context.lineTo(x + rx * sx, y + MAP_H);
    context.stroke();
  }
  for (const ry of ROADS_Y) {
    context.beginPath();
    context.moveTo(x, y + ry * sy);
    context.lineTo(x + MAP_W, y + ry * sy);
    context.stroke();
  }

  // Hideout and Pay N Spray.
  context.fillStyle = PALETTE.green;
  context.fillRect(x + PLACES.hideout.x * sx - 3, y + PLACES.hideout.y * sy - 3, 6, 6);
  context.fillStyle = '#f2f2f2';
  context.fillRect(x + PLACES.spray.x * sx - 2, y + PLACES.spray.y * sy - 2, 4, 4);

  // Mission marker.
  const marker = hud.objective ? hud.objective.marker : null;
  if (marker) {
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.moveTo(x + marker.x * sx, y + marker.y * sy - 5);
    context.lineTo(x + marker.x * sx + 4, y + marker.y * sy);
    context.lineTo(x + marker.x * sx, y + marker.y * sy + 5);
    context.lineTo(x + marker.x * sx - 4, y + marker.y * sy);
    context.closePath();
    context.fill();
  }

  // Police as red dots.
  context.fillStyle = '#ff3b30';
  for (const ped of ents.peds) {
    if (ped.kind === 'cop') {
      context.fillRect(x + ped.x * sx - 1.5, y + ped.y * sy - 1.5, 3, 3);
    }
  }
  for (const car of ents.cars) {
    if (car.driver === 'police') {
      context.fillRect(x + car.x * sx - 1.5, y + car.y * sy - 1.5, 3, 3);
    }
  }

  // The player as a white arrow, pointing the way they face.
  const player = ents.player;
  context.save();
  context.translate(x + player.x * sx, y + player.y * sy);
  context.rotate(player.angle);
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.moveTo(6, 0);
  context.lineTo(-4, -4);
  context.lineTo(-4, 4);
  context.closePath();
  context.fill();
  context.restore();
}
