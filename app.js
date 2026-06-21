'use strict';

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d', { alpha: false });
const ui = {
  panel: document.getElementById('panel'), showUi: document.getElementById('showUi'), hideUi: document.getElementById('hideUi'),
  energy: document.getElementById('energy'), density: document.getElementById('density'), glow: document.getElementById('glow'), coherence: document.getElementById('coherence'),
  randomize: document.getElementById('randomize'), pause: document.getElementById('pause'), install: document.getElementById('install'), modeHint: document.getElementById('modeHint'),
};

const palettes = {
  ocean:  { bg:['#02070b','#041a22','#052f37'], colors:['#3edbd2','#42aaff','#b9fff4','#0f6f7a'], hint:'Slow teal drift with soft large forms' },
  forest: { bg:['#03100b','#092015','#162616'], colors:['#6ff0a6','#c7e56b','#27a06c','#f3bd62'], hint:'Green amber breathing motion' },
  aurora: { bg:['#030313','#0d1028','#071b22'], colors:['#7bf5ca','#7aa7ff','#c17cff','#35d48b'], hint:'Ribbon-like northern-light flow' },
  ember:  { bg:['#080302','#160806','#2a0c05'], colors:['#ffb15c','#ff6a3d','#ffe0a3','#9c2f1f'], hint:'Warm low-light glowing embers' },
  night:  { bg:['#020306','#050712','#090b16'], colors:['#a8c7ff','#6c83aa','#d8e5ff','#47566f'], hint:'Low stimulation monochrome motion' },
  focus:  { bg:['#040806','#08120f','#0d1712'], colors:['#86e8bd','#b5ffd9','#4da184','#7ec8a5'], hint:'Consistent motion for thinking space' }
};

let presetName = localStorage.getItem('lavaPreset') || 'forest';
let particles = [];
let w = 0, h = 0, dpr = 1, t = 0, paused = false, pointer = null, deferredPrompt = null;
let seed = Math.random() * 1000;

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
function wave(x, y, time, s) { return Math.sin(x * .006 * s + time * .00038 + seed) + Math.cos(y * .005 * s - time * .00031 + seed * 1.7); }
function currentSettings() { return { energy:+ui.energy.value, density:+ui.density.value, glow:+ui.glow.value, coherence:+ui.coherence.value }; }

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = Math.floor(innerWidth * dpr); h = Math.floor(innerHeight * dpr);
  canvas.width = w; canvas.height = h;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  rebuild(false);
}

function makeParticle(i) {
  const settings = currentSettings();
  const calm = 1 - settings.energy / 100;
  return {
    x: rand(0, innerWidth), y: rand(0, innerHeight),
    vx: rand(-.25,.25), vy: rand(-.25,.25),
    r: rand(10, 54) * (0.75 + calm * .75),
    phase: rand(0, Math.PI*2),
    depth: rand(.55, 1.4),
    color: palettes[presetName].colors[i % palettes[presetName].colors.length]
  };
}

function rebuild(reset = true) {
  const target = Math.floor(+ui.density.value);
  if (reset || particles.length === 0) particles = Array.from({length: target}, (_, i) => makeParticle(i));
  while (particles.length < target) particles.push(makeParticle(particles.length));
  particles.length = target;
}

function setPreset(name) {
  presetName = name; localStorage.setItem('lavaPreset', name);
  document.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('active', b.dataset.preset === name));
  ui.modeHint.textContent = palettes[name].hint;
  particles.forEach((p,i)=> p.color = palettes[name].colors[i % palettes[name].colors.length]);
}

function drawBackground(p) {
  const g = ctx.createRadialGradient(innerWidth*.5, innerHeight*.42, 10, innerWidth*.5, innerHeight*.52, Math.max(innerWidth, innerHeight));
  g.addColorStop(0, p.bg[2]); g.addColorStop(.52, p.bg[1]); g.addColorStop(1, p.bg[0]);
  ctx.fillStyle = g; ctx.fillRect(0,0,innerWidth,innerHeight);
}

function update(dt) {
  const s = currentSettings();
  const energy = 0.18 + s.energy / 58;
  const coherence = s.coherence / 100;
  for (const p of particles) {
    const angle = wave(p.x, p.y, t, 1.7 + coherence * 1.6) * Math.PI + p.phase * .16;
    let ax = Math.cos(angle) * 0.016 * energy * p.depth;
    let ay = Math.sin(angle) * 0.016 * energy * p.depth;
    // gentle center gravity keeps the field cohesive
    ax += (innerWidth*.5 - p.x) * 0.0000025 * coherence;
    ay += (innerHeight*.47 - p.y) * 0.0000025 * coherence;
    if (pointer) {
      const dx = p.x - pointer.x, dy = p.y - pointer.y, dist = Math.hypot(dx,dy) || 1;
      const influence = clamp(1 - dist/220, 0, 1) * 0.08;
      ax += (dx/dist) * influence; ay += (dy/dist) * influence;
    }
    p.vx = (p.vx + ax * dt) * (0.988 - coherence * 0.006);
    p.vy = (p.vy + ay * dt) * (0.988 - coherence * 0.006);
    p.x += p.vx * dt; p.y += p.vy * dt;
    const margin = 100;
    if (p.x < -margin) p.x = innerWidth+margin; if (p.x > innerWidth+margin) p.x = -margin;
    if (p.y < -margin) p.y = innerHeight+margin; if (p.y > innerHeight+margin) p.y = -margin;
  }
}

function drawBlob(p, glow) {
  const pulse = 1 + Math.sin(t*.001 + p.phase) * .08;
  const r = p.r * p.depth * pulse;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r*2.6);
  g.addColorStop(0, p.color + 'f2');
  g.addColorStop(.28, p.color + '82');
  g.addColorStop(.62, p.color + '30');
  g.addColorStop(1, p.color + '00');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(p.x,p.y,r*2.6,0,Math.PI*2); ctx.fill();
  if (glow > 0.45) {
    ctx.strokeStyle = p.color + '28'; ctx.lineWidth = Math.max(1, r*.04);
    ctx.beginPath(); ctx.arc(p.x,p.y,r*.96,0,Math.PI*2); ctx.stroke();
  }
}

function render(now) {
  const dt = Math.min(34, now - (t || now)); t = now;
  const p = palettes[presetName];
  drawBackground(p);
  if (!paused) update(dt);
  const glow = +ui.glow.value / 100;
  ctx.globalCompositeOperation = 'lighter';
  ctx.filter = `blur(${2 + glow * 10}px)`;
  particles.filter((_,i)=>i%2===0).forEach(part => drawBlob(part, glow));
  ctx.filter = `blur(${glow * 3}px)`;
  particles.filter((_,i)=>i%2===1).forEach(part => drawBlob(part, glow));
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
  // soft vignette
  const vignette = ctx.createRadialGradient(innerWidth/2, innerHeight/2, Math.min(innerWidth,innerHeight)*.2, innerWidth/2, innerHeight/2, Math.max(innerWidth,innerHeight)*.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.42)');
  ctx.fillStyle = vignette; ctx.fillRect(0,0,innerWidth,innerHeight);
  requestAnimationFrame(render);
}

function randomize() {
  seed = Math.random() * 10000;
  ui.energy.value = Math.floor(rand(18, 72));
  ui.density.value = Math.floor(rand(55, 150));
  ui.glow.value = Math.floor(rand(52, 92));
  ui.coherence.value = Math.floor(rand(45, 90));
  rebuild(true);
}

document.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', () => setPreset(btn.dataset.preset)));
[ui.energy, ui.density, ui.glow, ui.coherence].forEach(el => el.addEventListener('input', () => { if (el === ui.density) rebuild(false); }));
ui.randomize.addEventListener('click', randomize);
ui.pause.addEventListener('click', () => { paused = !paused; ui.pause.textContent = paused ? 'Resume' : 'Pause'; });
ui.hideUi.addEventListener('click', () => { ui.panel.classList.add('hidden'); ui.showUi.hidden = false; });
ui.showUi.addEventListener('click', () => { ui.panel.classList.remove('hidden'); ui.showUi.hidden = true; });

canvas.addEventListener('pointerdown', e => { pointer = {x:e.clientX, y:e.clientY}; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (pointer) pointer = {x:e.clientX, y:e.clientY}; });
canvas.addEventListener('pointerup', () => pointer = null);
canvas.addEventListener('pointercancel', () => pointer = null);

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; ui.install.hidden = false; });
ui.install.addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; ui.install.hidden = true; });

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
window.addEventListener('resize', resize);
setPreset(presetName); resize(); requestAnimationFrame(render);
