use strict';

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
  aurora: { bg:['#030313','#0d1028','#071b22'], colors:['#7bf5ca','#7aa7ff','#c17cff','#35d48b'], hint:'Gentle northern-light flow' },
  ember:  { bg:['#080302','#160806','#2a0c05'], colors:['#ffb15c','#ff6a3d','#ffe0a3','#9c2f1f'], hint:'Warm low-light glowing embers' },
  night:  { bg:['#020306','#050712','#090b16'], colors:['#a8c7ff','#6c83aa','#d8e5ff','#47566f'], hint:'Low stimulation monochrome motion' },
  focus:  { bg:['#040806','#08120f','#0d1712'], colors:['#86e8bd','#b5ffd9','#4da184','#7ec8a5'], hint:'Consistent motion for thinking space' }
};

let presetName = localStorage.getItem('lavaPreset') || 'forest';
let particles = [];
let w = 0, h = 0, dpr = 1, t = 0, last = 0, paused = false, pointer = null, deferredPrompt = null;
let seed = Math.random() * 1000;

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const ease = v => v * v * (3 - 2 * v);
function hexAlpha(hex, a) { return hex + Math.round(clamp(a,0,1)*255).toString(16).padStart(2,'0'); }
function currentSettings() { return { energy:+ui.energy.value/100, density:+ui.density.value/100, glow:+ui.glow.value/100, coherence:+ui.coherence.value/100 }; }
function particleTarget() { const d = currentSettings().density; return Math.round(18 + ease(d) * 122); }
function flowNoise(x, y, time, scale) {
  return Math.sin(x * 0.0038 * scale + time * 0.00012 + seed) + Math.cos(y * 0.0031 * scale - time * 0.00010 + seed * 1.7);
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = Math.floor(innerWidth * dpr); h = Math.floor(innerHeight * dpr);
  canvas.width = w; canvas.height = h;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  rebuild(false);
}

function makeParticle(i) {
  const s = currentSettings();
  const calm = 1 - s.energy;
  const densityBias = 1 - s.density * 0.35;
  return {
    x: rand(0, innerWidth), y: rand(0, innerHeight),
    vx: rand(-0.04,0.04), vy: rand(-0.04,0.04),
    r: rand(14, 46) * (1.05 + calm * 0.9) * densityBias,
    phase: rand(0, Math.PI*2),
    depth: rand(0.65, 1.25),
    color: palettes[presetName].colors[i % palettes[presetName].colors.length]
  };
}

function rebuild(reset = true) {
  const target = particleTarget();
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

function update(dtMs) {
  const s = currentSettings();
  const step = Math.min(2.0, dtMs / 16.67);
  const energy = 0.015 + ease(s.energy) * 0.36; // deliberately calm at the low end
  const coherence = s.coherence;
  const cx = innerWidth * 0.5, cy = innerHeight * 0.49;

  for (const p of particles) {
    const independent = p.phase + Math.sin(t * 0.00009 + p.phase) * Math.PI;
    const field = flowNoise(p.x, p.y, t, 0.8 + coherence * 1.7) * Math.PI + p.phase * 0.08;
    const dxC = p.x - cx, dyC = p.y - cy;
    const orbit = Math.atan2(dyC, dxC) + Math.PI / 2;
    const angle = independent * (1 - coherence) + (field * 0.7 + orbit * 0.3) * coherence;

    let ax = Math.cos(angle) * energy * (0.010 + coherence * 0.010) * p.depth;
    let ay = Math.sin(angle) * energy * (0.010 + coherence * 0.010) * p.depth;

    // Coherence now visibly organizes the field: high values make a slow, shared river around center.
    ax += (cx - p.x) * 0.0000045 * coherence * energy;
    ay += (cy - p.y) * 0.0000045 * coherence * energy;

    if (pointer) {
      const dx = p.x - pointer.x, dy = p.y - pointer.y, dist = Math.hypot(dx,dy) || 1;
      const influence = clamp(1 - dist/180, 0, 1) * (0.010 + energy * 0.030);
      ax += (dx/dist) * influence; ay += (dy/dist) * influence;
    }

    p.vx = (p.vx + ax * step) * (0.965 - coherence * 0.010);
    p.vy = (p.vy + ay * step) * (0.965 - coherence * 0.010);
    const maxV = 0.10 + energy * 1.45;
    p.vx = clamp(p.vx, -maxV, maxV); p.vy = clamp(p.vy, -maxV, maxV);
    p.x += p.vx * step; p.y += p.vy * step;

    const margin = 120;
    if (p.x < -margin) p.x = innerWidth+margin; if (p.x > innerWidth+margin) p.x = -margin;
    if (p.y < -margin) p.y = innerHeight+margin; if (p.y > innerHeight+margin) p.y = -margin;
  }
}

function drawBlob(p, glow, layer) {
  const pulse = 1 + Math.sin(t*.00045 + p.phase) * .035;
  const r = p.r * p.depth * pulse;
  const glowScale = 1.15 + glow * 1.05;
  const alphaScale = layer === 'soft' ? 0.36 : 0.52;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r*2.35*glowScale);
  g.addColorStop(0, hexAlpha(p.color, 0.42 * alphaScale + glow * 0.12));
  g.addColorStop(.30, hexAlpha(p.color, 0.25 * alphaScale + glow * 0.07));
  g.addColorStop(.68, hexAlpha(p.color, 0.09 * alphaScale + glow * 0.03));
  g.addColorStop(1, hexAlpha(p.color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(p.x,p.y,r*2.35*glowScale,0,Math.PI*2); ctx.fill();
}

function render(now) {
  if (!last) last = now;
  const dt = Math.min(34, now - last); last = now; t = now;
  const p = palettes[presetName];
  const s = currentSettings();
  drawBackground(p);
  if (!paused) update(dt);
  const glow = ease(s.glow) * 0.65; // caps intensity so it no longer whites out

  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = `blur(${1.5 + glow * 5.5}px)`;
  particles.forEach(part => drawBlob(part, glow, 'soft'));

  ctx.globalCompositeOperation = 'lighter';
  ctx.filter = `blur(${glow * 2.2}px)`;
  particles.filter((_,i)=>i%3===0).forEach(part => drawBlob(part, glow * 0.65, 'highlight'));

  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
  const vignette = ctx.createRadialGradient(innerWidth/2, innerHeight/2, Math.min(innerWidth,innerHeight)*.2, innerWidth/2, innerHeight/2, Math.max(innerWidth,innerHeight)*.78);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.48)');
  ctx.fillStyle = vignette; ctx.fillRect(0,0,innerWidth,innerHeight);
  requestAnimationFrame(render);
}

function randomize() {
  seed = Math.random() * 10000;
  ui.energy.value = Math.floor(rand(5, 48));
  ui.density.value = Math.floor(rand(8, 55));
  ui.glow.value = Math.floor(rand(8, 55));
  ui.coherence.value = Math.floor(rand(15, 90));
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
