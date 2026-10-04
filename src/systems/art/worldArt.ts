import type Phaser from 'phaser';
import { ell, fillStroke, makeTexture, PAL, rr, shade, stroke, type Ctx } from './canvas';

// ---------------------------------------------------------------- props

function drawCrate(c: Ctx): void {
  const wood = '#A86E3E';
  rr(c, 2, 2, 60, 60, 5);
  fillStroke(c, wood, 3.5);
  // Planks.
  c.fillStyle = shade(wood, -0.15);
  for (const y of [18, 34, 50]) c.fillRect(6, y, 52, 2.5);
  // Cross brace.
  c.beginPath();
  c.moveTo(9, 9);
  c.lineTo(55, 55);
  c.moveTo(55, 9);
  c.lineTo(9, 55);
  stroke(c, 6, shade(wood, -0.3));
  c.beginPath();
  c.moveTo(9, 9);
  c.lineTo(55, 55);
  c.moveTo(55, 9);
  c.lineTo(9, 55);
  stroke(c, 3, shade(wood, 0.15));
  // Frame.
  rr(c, 2, 2, 60, 60, 5);
  stroke(c, 3.5);
  rr(c, 7, 7, 50, 50, 3);
  stroke(c, 2, shade(wood, -0.35));
  c.fillStyle = PAL.outline;
  for (const [x, y] of [[8, 8], [56, 8], [8, 56], [56, 56]]) {
    ell(c, x, y, 1.6, 1.6);
    c.fill();
  }
}

function drawCardboard(c: Ctx, state: 'intact' | 'breaking'): void {
  const tan = '#E3B36C';
  c.save();
  if (state === 'breaking') {
    c.translate(30, 28);
    c.rotate(-0.05);
    c.scale(1.06, 0.94);
    c.translate(-30, -28);
  }
  rr(c, 2, 2, 56, 52, 4);
  fillStroke(c, tan, 3.5);
  // Flaps line and tape.
  c.beginPath();
  c.moveTo(4, 14);
  c.lineTo(56, 14);
  stroke(c, 2, shade(tan, -0.25));
  c.fillStyle = '#F6E7B8';
  c.fillRect(24, 3, 12, 50);
  c.beginPath();
  c.rect(24, 3, 12, 50);
  stroke(c, 1.5, shade(tan, -0.3));
  // "Fragile" icon: a wine glass silhouette (no text).
  c.beginPath();
  c.moveTo(8, 24);
  c.lineTo(20, 24);
  c.quadraticCurveTo(20, 34, 14, 35);
  c.quadraticCurveTo(8, 34, 8, 24);
  c.closePath();
  fillStroke(c, PAL.coral, 2);
  c.beginPath();
  c.moveTo(14, 35);
  c.lineTo(14, 43);
  c.moveTo(10, 44);
  c.lineTo(18, 44);
  stroke(c, 2);
  // Dashed perforation around the edge: the "fragile" pattern cue.
  c.setLineDash([4, 4]);
  rr(c, 6, 6, 48, 44, 3);
  stroke(c, 1.5, shade(tan, -0.4));
  c.setLineDash([]);
  if (state === 'breaking') {
    c.beginPath();
    c.moveTo(40, 4);
    c.lineTo(46, 18);
    c.lineTo(40, 26);
    c.lineTo(50, 40);
    c.moveTo(4, 40);
    c.lineTo(14, 48);
    stroke(c, 2.5);
  }
  c.restore();
}

function drawCardboardBit(c: Ctx): void {
  c.beginPath();
  c.moveTo(2, 4);
  c.lineTo(14, 1);
  c.lineTo(16, 11);
  c.lineTo(5, 13);
  c.closePath();
  fillStroke(c, '#E3B36C', 2);
}

function drawCardboardFlat(c: Ctx): void {
  c.beginPath();
  c.moveTo(2, 10);
  c.lineTo(20, 4);
  c.lineTo(40, 7);
  c.lineTo(62, 3);
  c.lineTo(66, 12);
  c.lineTo(4, 14);
  c.closePath();
  fillStroke(c, '#D9A85E', 2.5);
}

function drawTyre(c: Ctx): void {
  ell(c, 24, 21, 21, 18);
  fillStroke(c, '#3A3340', 3.5);
  // Tread notches.
  c.save();
  c.translate(24, 21);
  for (let i = 0; i < 14; i++) {
    c.rotate((Math.PI * 2) / 14);
    c.beginPath();
    c.moveTo(16, 0);
    c.lineTo(20, 0);
    stroke(c, 2.2, '#1f1a24');
  }
  c.restore();
  ell(c, 24, 21, 10, 8.5);
  fillStroke(c, '#9C94A6', 3);
  ell(c, 24, 21, 4, 3.4);
  fillStroke(c, '#5C5466', 2);
  c.beginPath();
  c.arc(24, 21, 15, -2.6, -1.6);
  stroke(c, 2.5, 'rgba(255,255,255,0.35)');
}

function drawPlatformMid(c: Ctx): void {
  // 64×18 tileable steel shelf top.
  c.fillStyle = '#5E7FA6';
  c.fillRect(0, 2, 64, 14);
  c.fillStyle = '#86A6C9';
  c.fillRect(0, 3, 64, 4);
  c.fillStyle = '#41597A';
  c.fillRect(0, 12, 64, 4);
  c.fillStyle = PAL.outline;
  c.fillRect(0, 0, 64, 3);
  c.fillRect(0, 15, 64, 3);
  for (const x of [12, 44]) {
    ell(c, x, 9.5, 1.8, 1.8);
    c.fill();
  }
}

function drawPlatformCap(c: Ctx, right: boolean): void {
  c.save();
  if (right) {
    c.translate(16, 0);
    c.scale(-1, 1);
  }
  rr(c, 1.5, 1.5, 24, 15, 6);
  fillStroke(c, '#5E7FA6', 3);
  c.fillStyle = '#86A6C9';
  c.fillRect(6, 4, 20, 3);
  c.restore();
}

function drawPlatformLeg(c: Ctx): void {
  c.fillStyle = '#4A5F7E';
  c.fillRect(4, 0, 8, 120);
  c.strokeStyle = PAL.outline;
  c.lineWidth = 2.5;
  c.strokeRect(4, 0, 8, 120);
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.fillRect(5.5, 0, 2, 120);
}

function drawGroundTile(c: Ctx): void {
  // 64×120: concrete loading floor.
  const g = c.createLinearGradient(0, 0, 0, 120);
  g.addColorStop(0, '#B29A8A');
  g.addColorStop(0.2, '#9C8576');
  g.addColorStop(1, '#6F5A57');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 120);
  c.fillStyle = '#D9C3AA';
  c.fillRect(0, 2, 64, 6);
  c.fillStyle = PAL.outline;
  c.fillRect(0, 0, 64, 3);
  c.fillStyle = 'rgba(48,35,49,0.35)';
  c.fillRect(0, 8, 64, 2);
  // Expansion joint and speckles.
  c.fillRect(62, 10, 2, 110);
  c.fillStyle = 'rgba(255,255,255,0.12)';
  for (const [x, y] of [[10, 30], [40, 52], [22, 80], [50, 96], [8, 104]]) c.fillRect(x, y, 4, 2);
}

function drawGroundEdge(c: Ctx, right: boolean): void {
  // 24×120 rounded lip used at pit edges.
  c.save();
  if (right) {
    c.translate(24, 0);
    c.scale(-1, 1);
  }
  c.beginPath();
  c.moveTo(24, 0);
  c.lineTo(10, 0);
  c.quadraticCurveTo(2, 0, 2, 10);
  c.lineTo(4, 120);
  c.lineTo(24, 120);
  c.closePath();
  const g = c.createLinearGradient(0, 0, 0, 120);
  g.addColorStop(0, '#B29A8A');
  g.addColorStop(1, '#5F4B4B');
  c.fillStyle = g;
  c.fill();
  c.fillStyle = '#D9C3AA';
  c.fillRect(6, 2, 18, 6);
  c.beginPath();
  c.moveTo(24, 1.5);
  c.lineTo(10, 1.5);
  c.quadraticCurveTo(3.5, 1.5, 3.5, 10);
  c.lineTo(5, 120);
  stroke(c, 3.5);
  c.restore();
}

function drawBone(c: Ctx): void {
  const knob = (x: number, y: number) => {
    ell(c, x, y, 5.5, 5.5);
    fillStroke(c, PAL.white, 2.5);
  };
  knob(6, 6);
  knob(6, 14);
  knob(30, 6);
  knob(30, 14);
  rr(c, 6, 6, 24, 8, 3);
  c.fillStyle = PAL.white;
  c.fill();
  c.beginPath();
  c.moveTo(8, 6);
  c.lineTo(28, 6);
  c.moveTo(8, 14);
  c.lineTo(28, 14);
  stroke(c, 2.5);
  ell(c, 6, 6, 3.5, 3.5);
  c.fill();
  ell(c, 6, 14, 3.5, 3.5);
  c.fill();
  ell(c, 30, 6, 3.5, 3.5);
  c.fill();
  ell(c, 30, 14, 3.5, 3.5);
  c.fill();
  c.fillStyle = '#F1D9AE';
  c.fillRect(9, 11, 18, 2);
}

function drawScent(c: Ctx): void {
  c.beginPath();
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const a = t * Math.PI * 3.2;
    const r = 3 + t * 9;
    const x = 14 + Math.cos(a) * r;
    const y = 14 + Math.sin(a) * r * 0.75;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  stroke(c, 3.5, 'rgba(66,183,176,0.9)');
  c.beginPath();
  c.arc(14, 14, 3, 0, Math.PI * 2);
  c.fillStyle = 'rgba(255,255,255,0.9)';
  c.fill();
}

function drawGate(c: Ctx): void {
  // 220×280 street-exit frame with daylight behind.
  const g = c.createLinearGradient(0, 30, 0, 280);
  g.addColorStop(0, '#FFF2C4');
  g.addColorStop(1, '#FFD66E');
  rr(c, 24, 30, 172, 250, 6);
  c.fillStyle = g;
  c.fill();
  // Street hints beyond: kerb and a distant tree.
  c.fillStyle = 'rgba(66,183,176,0.35)';
  ell(c, 150, 170, 26, 34);
  c.fill();
  c.fillStyle = 'rgba(48,35,49,0.18)';
  c.fillRect(24, 250, 172, 30);
  // Frame posts and lintel.
  rr(c, 8, 18, 22, 262, 4);
  fillStroke(c, '#C65A4A', 3.5);
  rr(c, 190, 18, 22, 262, 4);
  fillStroke(c, '#C65A4A', 3.5);
  rr(c, 2, 4, 216, 30, 8);
  fillStroke(c, '#E07A63', 3.5);
  // Arrow sign (no text): points onward.
  rr(c, 80, 9, 60, 20, 6);
  fillStroke(c, PAL.teal, 3);
  c.beginPath();
  c.moveTo(92, 19);
  c.lineTo(122, 19);
  c.moveTo(114, 13);
  c.lineTo(124, 19);
  c.lineTo(114, 25);
  stroke(c, 3, PAL.white);
}

function drawGateDoor(c: Ctx): void {
  // 84×240 chain-link half door.
  rr(c, 3, 3, 78, 234, 4);
  c.fillStyle = 'rgba(160,170,190,0.25)';
  c.fill();
  c.save();
  rr(c, 3, 3, 78, 234, 4);
  c.clip();
  c.beginPath();
  for (let i = -240; i < 100; i += 12) {
    c.moveTo(i, 0);
    c.lineTo(i + 240, 240);
    c.moveTo(i + 240, 0);
    c.lineTo(i, 240);
  }
  stroke(c, 1.5, 'rgba(70,80,100,0.65)');
  c.restore();
  rr(c, 3, 3, 78, 234, 4);
  stroke(c, 5, '#6C7A92');
  rr(c, 3, 3, 78, 234, 4);
  stroke(c, 2);
}

function drawShadow(c: Ctx): void {
  ell(c, 60, 10, 58, 9);
  c.fillStyle = 'rgba(48,35,49,0.28)';
  c.fill();
}

function drawToy(c: Ctx): void {
  // Battered sausage squeaky toy.
  rr(c, 4, 6, 52, 18, 9);
  fillStroke(c, PAL.coral, 3);
  c.beginPath();
  c.moveTo(16, 8);
  c.lineTo(16, 22);
  c.moveTo(44, 8);
  c.lineTo(44, 22);
  stroke(c, 2, '#b44d3e');
  c.beginPath();
  c.moveTo(4, 15);
  c.lineTo(-1, 12);
  c.moveTo(56, 15);
  c.lineTo(61, 18);
  stroke(c, 3);
  ell(c, 22, 11, 7, 2);
  c.fillStyle = 'rgba(255,255,255,0.5)';
  c.fill();
}

// --------------------------------------------------------------- enemies

type SquirrelPose = 'idle' | 'taunt' | 'throw' | 'run' | 'startled';

function drawAcorn(c: Ctx, x: number, y: number, s = 1): void {
  ell(c, x, y + 2 * s, 6 * s, 7 * s);
  fillStroke(c, '#C98B4A', 2.2);
  c.beginPath();
  c.ellipse(x, y - 3 * s, 7.5 * s, 4.2 * s, 0, Math.PI, 0);
  c.closePath();
  fillStroke(c, '#7A5233', 2.2);
  c.beginPath();
  c.moveTo(x, y - 7 * s);
  c.lineTo(x + 1.5 * s, y - 10 * s);
  stroke(c, 2);
}

function drawSquirrel(c: Ctx, pose: SquirrelPose): void {
  const fur = '#8E8798';
  const furDark = '#6A6275';
  const belly = '#F1E4CF';
  c.save();
  // Canvas is 90×90, feet at y=86, facing left (toward the hero).
  if (pose === 'run') {
    c.translate(45, 86);
    c.scale(-1, 1);
    c.translate(-45, -86);
  }
  const puff = pose === 'startled' ? 1.25 : 1;
  // Tail: big curl behind.
  c.save();
  c.translate(62, 60);
  c.scale(puff, puff);
  c.beginPath();
  c.moveTo(-6, 22);
  c.bezierCurveTo(26, 26, 30, -10, 14, -30);
  c.bezierCurveTo(4, -44, -18, -36, -12, -20);
  c.bezierCurveTo(-4, -26, 8, -24, 8, -10);
  c.bezierCurveTo(8, 4, -4, 8, -12, 8);
  c.closePath();
  fillStroke(c, furDark, 3);
  c.beginPath();
  c.moveTo(6, -24);
  c.bezierCurveTo(14, -14, 14, 4, 2, 12);
  stroke(c, 2, 'rgba(255,255,255,0.3)');
  c.restore();
  // Body.
  const lean = pose === 'throw' ? -0.25 : pose === 'run' ? -0.6 : 0;
  c.save();
  c.translate(44, 70);
  c.rotate(lean);
  ell(c, 0, -2, 15, 19);
  fillStroke(c, fur, 3);
  ell(c, -4, 2, 8, 12);
  c.fillStyle = belly;
  c.fill();
  // Head.
  ell(c, -6, -26, 14, 12);
  fillStroke(c, fur, 3);
  // Ears.
  c.beginPath();
  c.moveTo(-2, -36);
  c.lineTo(4, -48);
  c.lineTo(8, -33);
  c.closePath();
  fillStroke(c, fur, 2.5);
  // Muzzle + nose.
  ell(c, -17, -22, 6, 5);
  fillStroke(c, belly, 2.5);
  ell(c, -22, -24, 2.5, 2.2);
  c.fillStyle = PAL.outline;
  c.fill();
  // Eye.
  if (pose === 'startled') {
    ell(c, -9, -29, 5.5, 6.5);
    fillStroke(c, PAL.white, 2.2);
    ell(c, -10, -29, 1.6, 1.6);
    c.fillStyle = PAL.outline;
    c.fill();
  } else {
    ell(c, -9, -29, 4.5, 5);
    fillStroke(c, PAL.white, 2.2);
    ell(c, -11, -28, 2.6, 3);
    c.fillStyle = PAL.outline;
    c.fill();
    // Smug half-lid.
    c.beginPath();
    c.moveTo(-15, -32);
    c.lineTo(-3, -31);
    stroke(c, 2.6);
  }
  // Mouth.
  c.beginPath();
  if (pose === 'taunt' || pose === 'idle') {
    c.moveTo(-20, -18);
    c.quadraticCurveTo(-13, -14, -8, -19);
  } else {
    ell(c, -16, -17, 3, 2.5);
  }
  stroke(c, 2.2);
  // Arms.
  c.beginPath();
  if (pose === 'taunt') {
    c.moveTo(-4, -8);
    c.lineTo(-12, -30);
  } else if (pose === 'throw') {
    c.moveTo(-6, -6);
    c.lineTo(-24, -10);
  } else if (pose === 'startled') {
    c.moveTo(-6, -6);
    c.lineTo(-18, -26);
    c.moveTo(6, -6);
    c.lineTo(16, -26);
  } else {
    c.moveTo(-6, -4);
    c.lineTo(-14, 2);
  }
  stroke(c, 5, PAL.outline);
  stroke(c, 2.5, fur);
  if (pose === 'taunt') drawAcorn(c, -13, -38, 1);
  c.restore();
  // Feet.
  ell(c, 34, 86, 8, 3.5);
  fillStroke(c, furDark, 2.2);
  ell(c, 52, 86, 8, 3.5);
  fillStroke(c, furDark, 2.2);
  c.restore();
}

function drawParcel(c: Ctx, w: number, h: number): void {
  rr(c, 2, 2, w - 4, h - 4, 4);
  fillStroke(c, '#C98D52', 3.5);
  c.fillStyle = '#F2D9A2';
  c.fillRect(w / 2 - 5, 3, 10, h - 6);
  c.fillStyle = PAL.coral;
  c.beginPath();
  c.moveTo(8, h - 18);
  c.lineTo(14, h - 26);
  c.lineTo(20, h - 18);
  c.closePath();
  c.fill();
  c.fillRect(12, h - 18, 4, 8);
  rr(c, 2, 2, w - 4, h - 4, 4);
  stroke(c, 3.5);
}

// ------------------------------------------------------------------ boss

function drawTrolley(c: Ctx): void {
  // 300×200. Cage on a chassis; the latch mounts on the front (left) face.
  const steel = '#6F86A8';
  // Chassis.
  rr(c, 10, 150, 270, 26, 8);
  fillStroke(c, '#4D5F7D', 3.5);
  // Cage body.
  rr(c, 20, 30, 250, 124, 10);
  c.fillStyle = 'rgba(169,217,235,0.35)';
  c.fill();
  c.save();
  rr(c, 20, 30, 250, 124, 10);
  c.clip();
  c.beginPath();
  for (let x = 40; x < 270; x += 22) {
    c.moveTo(x, 30);
    c.lineTo(x, 154);
  }
  stroke(c, 4, steel);
  c.beginPath();
  c.moveTo(20, 92);
  c.lineTo(270, 92);
  stroke(c, 5, steel);
  c.restore();
  rr(c, 20, 30, 250, 124, 10);
  stroke(c, 6, steel);
  rr(c, 20, 30, 250, 124, 10);
  stroke(c, 3);
  // Roof with warning light.
  rr(c, 12, 18, 266, 18, 8);
  fillStroke(c, '#E07A63', 3.5);
  rr(c, 130, 2, 30, 18, 8);
  fillStroke(c, PAL.butter, 3);
  // Handle at back (right).
  c.beginPath();
  c.moveTo(270, 60);
  c.lineTo(296, 46);
  c.lineTo(296, 30);
  stroke(c, 7);
  stroke(c, 4, '#9AA9C2');
  // Emblem: a bone in a circle with a slash — comic "no dogs" badge.
  ell(c, 150, 120, 18, 18);
  fillStroke(c, PAL.white, 3);
  rr(c, 138, 116, 24, 8, 4);
  fillStroke(c, PAL.cream, 2);
  c.beginPath();
  c.moveTo(138, 106);
  c.lineTo(162, 134);
  stroke(c, 3.5, PAL.coral);
}

function drawTrolleyDoor(c: Ctx): void {
  // 30×110 front door the hero would be scooped through.
  rr(c, 3, 3, 24, 104, 6);
  fillStroke(c, '#5D7396', 3);
  c.beginPath();
  for (let y = 18; y < 104; y += 16) {
    c.moveTo(6, y);
    c.lineTo(24, y);
  }
  stroke(c, 2.5, '#8FA5C4');
}

function drawWheel(c: Ctx): void {
  ell(c, 28, 28, 25, 25);
  fillStroke(c, '#3A3340', 3.5);
  ell(c, 28, 28, 13, 13);
  fillStroke(c, '#C7CDD8', 3);
  c.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    c.moveTo(28, 28);
    c.lineTo(28 + Math.cos(a) * 12, 28 + Math.sin(a) * 12);
  }
  stroke(c, 3);
}

function drawLatch(c: Ctx, state: 'intact' | 'damaged' | 'broken'): void {
  // 44×56 padlock-style latch mechanism.
  c.beginPath();
  c.arc(22, 20, 12, Math.PI, 0);
  stroke(c, 8, PAL.outline);
  stroke(c, 4.5, '#B9C2D3');
  if (state === 'broken') {
    c.save();
    c.translate(22, 38);
    c.rotate(0.35);
    c.translate(-22, -38);
  }
  rr(c, 4, 20, 36, 32, 7);
  fillStroke(c, state === 'intact' ? PAL.butter : state === 'damaged' ? '#F5B65A' : '#C98D52', 3.5);
  ell(c, 22, 33, 4.5, 4.5);
  c.fillStyle = PAL.outline;
  c.fill();
  c.fillRect(20.5, 33, 3, 10);
  if (state !== 'intact') {
    c.beginPath();
    c.moveTo(8, 24);
    c.lineTo(16, 32);
    c.lineTo(12, 40);
    c.moveTo(34, 24);
    c.lineTo(30, 34);
    stroke(c, 2.5);
  }
  if (state === 'broken') c.restore();
}

type CatcherPose = 'walk' | 'run' | 'windup' | 'frustrated' | 'tumble';

function drawDogcatcher(c: Ctx, pose: CatcherPose): void {
  // 170×250, feet at y=246, facing left (pushing the trolley).
  const uniform = '#4F6AA3';
  const skin = '#F2B48C';
  const lean = pose === 'run' ? -0.12 : pose === 'windup' ? 0.06 : 0;
  c.save();
  c.translate(90, 246);
  c.rotate(lean);
  // Legs.
  const legA = pose === 'run' ? -0.35 : pose === 'walk' ? -0.15 : 0;
  for (const [dx, a] of [[-16, legA], [14, -legA]] as const) {
    c.save();
    c.translate(dx, -66);
    c.rotate(a);
    rr(c, -11, 0, 22, 62, 9);
    fillStroke(c, '#38466E', 3.5);
    ell(c, -6, 64, 15, 7);
    fillStroke(c, PAL.outline, 0);
    c.restore();
  }
  // Big round torso.
  ell(c, 0, -112, 52, 56);
  fillStroke(c, uniform, 3.5);
  // Belt.
  rr(c, -50, -80, 100, 12, 4);
  fillStroke(c, '#2E3550', 2.5);
  rr(c, -10, -82, 20, 16, 3);
  fillStroke(c, PAL.butter, 2.5);
  // Badge.
  ell(c, -22, -130, 9, 9);
  fillStroke(c, PAL.butter, 2.5);
  // Whistle cord.
  c.beginPath();
  c.moveTo(-14, -164);
  c.quadraticCurveTo(-24, -140, -34, -150);
  stroke(c, 2, PAL.white);
  // Arms reaching forward (left) to the handle.
  c.beginPath();
  c.moveTo(-30, -136);
  if (pose === 'frustrated') c.quadraticCurveTo(-60, -170, -40, -188);
  else c.quadraticCurveTo(-70, -128, -88, -112);
  stroke(c, 18, PAL.outline);
  stroke(c, 12, uniform);
  ell(c, pose === 'frustrated' ? -40 : -90, pose === 'frustrated' ? -190 : -110, 9, 9);
  fillStroke(c, skin, 3);
  // Head.
  const hy = -184;
  ell(c, -4, hy, 30, 28);
  fillStroke(c, skin, 3.5);
  // Big nose.
  ell(c, -32, hy + 4, 12, 10);
  fillStroke(c, '#E8907A', 3);
  // Moustache.
  c.beginPath();
  c.moveTo(-42, hy + 14);
  c.quadraticCurveTo(-30, hy + 6, -14, hy + 14);
  c.quadraticCurveTo(-24, hy + 24, -42, hy + 14);
  fillStroke(c, '#5A3A2E', 2.5);
  // Eye(s).
  if (pose === 'tumble') {
    c.beginPath();
    c.moveTo(-22, hy - 12);
    c.lineTo(-12, hy - 2);
    c.moveTo(-12, hy - 12);
    c.lineTo(-22, hy - 2);
    stroke(c, 3);
  } else {
    ell(c, -16, hy - 7, 6, 7);
    fillStroke(c, PAL.white, 2.5);
    ell(c, -19, hy - 6, 2.6, 3);
    c.fillStyle = PAL.outline;
    c.fill();
  }
  // Brow.
  c.beginPath();
  if (pose === 'frustrated') {
    c.moveTo(-28, hy - 22);
    c.lineTo(-8, hy - 14);
  } else if (pose === 'windup') {
    c.moveTo(-26, hy - 16);
    c.lineTo(-8, hy - 20);
  } else {
    c.moveTo(-26, hy - 18);
    c.quadraticCurveTo(-16, hy - 24, -6, hy - 18);
  }
  stroke(c, 4);
  // Whistle in mouth when winding up.
  if (pose === 'windup') {
    ell(c, -30, hy + 22, 7, 7);
    fillStroke(c, '#C9D1DE', 2.5);
    ell(c, -6, hy + 6, 12, 10);
    c.fillStyle = 'rgba(240,117,98,0.55)';
    c.fill();
  }
  // Cap.
  c.beginPath();
  c.moveTo(-32, hy - 14);
  c.quadraticCurveTo(-4, hy - 50, 26, hy - 14);
  c.closePath();
  fillStroke(c, '#38466E', 3.5);
  rr(c, -52, hy - 18, 40, 9, 4);
  fillStroke(c, '#2E3550', 3);
  // Steam puffs when frustrated.
  if (pose === 'frustrated') {
    for (const [x, y, r] of [[18, hy - 46, 8], [30, hy - 60, 6], [40, hy - 72, 4]] as const) {
      ell(c, x, y, r, r);
      fillStroke(c, PAL.white, 2);
    }
  }
  c.restore();
}

// ------------------------------------------------------------------- fx

function drawPuff(c: Ctx): void {
  for (const [x, y, r] of [[20, 24, 12], [12, 18, 9], [28, 16, 10], [20, 12, 9]] as const) {
    ell(c, x, y, r, r);
    fillStroke(c, PAL.white, 2.5);
  }
  for (const [x, y, r] of [[20, 24, 9], [12, 18, 6], [28, 16, 7], [20, 12, 6]] as const) {
    ell(c, x, y, r, r);
    c.fillStyle = PAL.white;
    c.fill();
  }
}

function drawStar(c: Ctx, color: string): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 10 : 4.2;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = 11 + Math.cos(a) * r;
    const y = 11 + Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
  fillStroke(c, color, 2.2);
}

function drawSparkle(c: Ctx): void {
  c.beginPath();
  c.moveTo(9, 0);
  c.quadraticCurveTo(10, 8, 18, 9);
  c.quadraticCurveTo(10, 10, 9, 18);
  c.quadraticCurveTo(8, 10, 0, 9);
  c.quadraticCurveTo(8, 8, 9, 0);
  c.closePath();
  c.fillStyle = PAL.white;
  c.fill();
}

function drawExclaim(c: Ctx): void {
  // Speech bubble with an exclamation glyph drawn as shapes.
  c.beginPath();
  c.moveTo(6, 4);
  c.lineTo(30, 4);
  c.quadraticCurveTo(34, 4, 34, 8);
  c.lineTo(34, 30);
  c.quadraticCurveTo(34, 34, 30, 34);
  c.lineTo(18, 34);
  c.lineTo(10, 42);
  c.lineTo(12, 34);
  c.lineTo(6, 34);
  c.quadraticCurveTo(2, 34, 2, 30);
  c.lineTo(2, 8);
  c.quadraticCurveTo(2, 4, 6, 4);
  c.closePath();
  fillStroke(c, PAL.butter, 3);
  rr(c, 15, 9, 6, 15, 3);
  c.fillStyle = PAL.outline;
  c.fill();
  ell(c, 18, 29, 3.2, 3.2);
  c.fill();
}

export function generateWorldArt(scene: Phaser.Scene): void {
  makeTexture(scene, 'crate', 64, 64, drawCrate);
  makeTexture(scene, 'cardboard', 60, 56, (c) => drawCardboard(c, 'intact'));
  makeTexture(scene, 'cardboard_breaking', 60, 56, (c) => drawCardboard(c, 'breaking'));
  makeTexture(scene, 'cardboard_bit', 18, 14, drawCardboardBit);
  makeTexture(scene, 'cardboard_flat', 68, 16, drawCardboardFlat);
  makeTexture(scene, 'tyre', 48, 42, drawTyre);
  makeTexture(scene, 'platform_mid', 64, 18, drawPlatformMid);
  makeTexture(scene, 'platform_left', 16, 18, (c) => drawPlatformCap(c, false));
  makeTexture(scene, 'platform_right', 16, 18, (c) => drawPlatformCap(c, true));
  makeTexture(scene, 'platform_leg', 16, 120, drawPlatformLeg);
  makeTexture(scene, 'ground_mid', 64, 120, drawGroundTile);
  makeTexture(scene, 'ground_edge_left', 24, 120, (c) => drawGroundEdge(c, false));
  makeTexture(scene, 'ground_edge_right', 24, 120, (c) => drawGroundEdge(c, true));
  makeTexture(scene, 'bone', 36, 20, drawBone);
  makeTexture(scene, 'scent', 28, 28, drawScent);
  makeTexture(scene, 'exit_gate', 220, 282, drawGate);
  makeTexture(scene, 'gate_door', 84, 240, drawGateDoor);
  makeTexture(scene, 'shadow', 120, 20, drawShadow);
  makeTexture(scene, 'toy', 62, 30, drawToy);
  for (const p of ['idle', 'taunt', 'throw', 'run', 'startled'] as SquirrelPose[]) {
    makeTexture(scene, `squirrel_${p}`, 90, 90, (c) => drawSquirrel(c, p));
  }
  makeTexture(scene, 'acorn', 22, 24, (c) => drawAcorn(c, 11, 13, 1.1));
  makeTexture(scene, 'parcel_small', 46, 42, (c) => drawParcel(c, 46, 42));
  makeTexture(scene, 'parcel_big', 58, 56, (c) => drawParcel(c, 58, 56));
  makeTexture(scene, 'trolley_body', 300, 180, drawTrolley);
  makeTexture(scene, 'trolley_door', 30, 110, drawTrolleyDoor);
  makeTexture(scene, 'trolley_wheel', 56, 56, drawWheel);
  for (const s of ['intact', 'damaged', 'broken'] as const) makeTexture(scene, `trolley_latch_${s}`, 44, 56, (c) => drawLatch(c, s));
  for (const p of ['walk', 'run', 'windup', 'frustrated', 'tumble'] as CatcherPose[]) {
    makeTexture(scene, `dogcatcher_${p}`, 170, 250, (c) => drawDogcatcher(c, p));
  }
  makeTexture(scene, 'fx_puff', 40, 36, drawPuff);
  makeTexture(scene, 'fx_star', 22, 22, (c) => drawStar(c, PAL.butter));
  makeTexture(scene, 'fx_sparkle', 18, 18, drawSparkle);
  makeTexture(scene, 'fx_exclaim', 36, 44, drawExclaim);
}
