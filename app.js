'use strict';

const VERSION = 'v2.3 balanced visibility test';

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d', { alpha: false });
const ui = {
  panel: document.getElementById('panel'), showUi: document.getElementById('showUi'), hideUi: document.getElementById('hideUi'),
  energy: document.getElementById('energy'), density: document.getElementById('density'), glow: document.getElementById('glow'), coherence: document.getElementById('coherence'),
  randomize: document.getElementById('randomize'), pause: document.getElementById('pause'), install: document.getElementById('install'), modeHint: document.getElementById('modeHint'),
};

const palettes = {
  ocean:  { bg:['#010406','#021017','#05232a'], colors:['#155f6c','#2b9da9','#76d5cf','#0d3e49'], hint:'Slow teal drift with soft large forms' },
  forest: { bg:['#020806','#06130d','#101d12'], colors:['#2b8d58','#6db97b','#b5c566','#996e35'], hint:'Green amber breathing motion' },
  aurora: { bg:['#02020a','#090b1a','#07151a'], colors:['#3aa77e','#4b72bc','#8750b7','#23865e'], hint:'Gentle northern-light flow' },
  ember:  { bg:['#050201','#100503','#1d0804'], colors:['#b66f31','#c54327','#d6a463','#6e2419'], hint:'Warm low-light glowing embers' },
  night:  { bg:['#010204','#03050a','#070912'], colors:['#516684','#6f86ac','#9badca','#39465c'], hint:'Low stimulation monochrome motion' },
  focus:  { bg:['#020504','#05100c','#0a140f'], colors:['#438b68','#74b993','#a9d5bd','#5e9179'], hint:'Consistent motion for thinking space' }
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
function particleTarget() { const d = currentSettings().density; return Math.round(18 + ease(d) * 92); }
function flowNoise(x, y, time, scale) {
  return Math.sin(x * 0.0014 * scale + time * 0.000018 + seed) + Math.cos(y * 0.0012 * scale - time * 0.000015 + seed * 1.7);
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
  const densityBias = 1 - s.density * 0.18;
  return {
    x: rand(0, innerWidth), y: rand(0, innerHeight),
    vx: rand(-0.0025,0.0025), vy: rand(-0.0025,0.0025),
    r: rand(34, 96) * (1.0 + calm * 0.35) * densityBias,
    phase: rand(0, Math.PI*2),
    depth: rand(0.65, 1.18),
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
  g.addColorStop(0, p.bg[2]); g.addColorStop(.55, p.bg[1]); g.addColorStop(1, p.bg[0]);
  ctx.fillStyle = g; ctx.fillRect(0,0,innerWidth,innerHeight);
}

function update(dtMs) {
  const s = currentSettings();
  const step = Math.min(1.25, dtMs / 16.67);
  // Perceptual remap: low end is genuinely slow; high end is still controlled.
  const energy = 0.0016 + Math.pow(s.energy, 2.15) * 0.052;
  const coherence = s.coherence;
  const cx = innerWidth * 0.5, cy = innerHeight * 0.49;

  for (const p of particles) {
    const independent = p.phase + Math.sin(t * 0.000012 + p.phase) * Math.PI;
    const field = flowNoise(p.x, p.y, t, 0.6 + coherence * 1.9) * Math.PI + p.phase * 0.06;
    const dxC = p.x - cx, dyC = p.y - cy;
    const orbit = Math.atan2(dyC, dxC) + Math.PI / 2;
    const angle = independent * (1 - coherence) + (field * 0.38 + orbit * 0.62) * coherence;

    let ax = Math.cos(angle) * energy * (0.012 + coherence * 0.014) * p.depth;
    let ay = Math.sin(angle) * energy * (0.012 + coherence * 0.014) * p.depth;

    // High coherence visibly makes a shared circular/river-like flow.
    ax += (cx - p.x) * 0.0000028 * coherence;
    ay += (cy - p.y) * 0.0000028 * coherence;

    if (pointer) {
      const dx = p.x - pointer.x, dy = p.y - pointer.y, dist = Math.hypot(dx,dy) || 1;
      const influence = clamp(1 - dist/180, 0, 1) * (0.003 + energy * 0.018);
      ax += (dx/dist) * influence; ay += (dy/dist) * influence;
    }

    p.vx = (p.vx + ax * step) * (0.988 - coherence * 0.010);
    p.vy = (p.vy + ay * step) * (0.988 - coherence * 0.010);
    const maxV = 0.012 + Math.pow(s.energy, 1.65) * 0.34;
    p.vx = clamp(p.vx, -maxV, maxV); p.vy = clamp(p.vy, -maxV, maxV);
    p.x += p.vx * step; p.y += p.vy * step;

    const margin = 160;
    if (p.x < -margin) p.x = innerWidth+margin; if (p.x > innerWidth+margin) p.x = -margin;
    if (p.y < -margin) p.y = innerHeight+margin; if (p.y > innerHeight+margin) p.y = -margin;
  }
}

function drawBlob(p, glow, layer) {
  const pulse = 1 + Math.sin(t*.00009 + p.phase) * .018;
  const r = p.r * p.depth * pulse;
  const glowScale = layer === 'soft' ? (1.0 + glow * 0.38) : (0.66 + glow * 0.18);
  const alphaBoost = layer === 'soft' ? 1.0 : 0.78;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r*1.85*glowScale);
  g.addColorStop(0, hexAlpha(p.color, (0.34 + glow * 0.10) * alphaBoost));
  g.addColorStop(.30, hexAlpha(p.color, (0.22 + glow * 0.06) * alphaBoost));
  g.addColorStop(.72, hexAlpha(p.color, (0.075 + glow * 0.025) * alphaBoost));
  g.addColorStop(1, hexAlpha(p.color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(p.x,p.y,r*2.05*glowScale,0,Math.PI*2); ctx.fill();
}

function render(now) {
  if (!last) last = now;
  const dt = Math.min(34, now - last); last = now; t = now;
  const p = palettes[presetName];
  const s = currentSettings();
  drawBackground(p);
  if (!paused) update(dt);
  const glow = Math.pow(s.glow, 1.8) * 0.42; // balanced; visible glow without whiteout

  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = `blur(${0.35 + glow * 2.6}px)`;
  particles.forEach(part => drawBlob(part, glow, 'soft'));

  // Keep highlights subtle; no additive full-screen burn.
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = `blur(${glow * 0.65}px)`;
  particles.filter((_,i)=>i%4===0).forEach(part => drawBlob(part, glow * 0.55, 'highlight'));

  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
  const vignette = ctx.createRadialGradient(innerWidth/2, innerHeight/2, Math.min(innerWidth,innerHeight)*.18, innerWidth/2, innerHeight/2, Math.max(innerWidth,innerHeight)*.8);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.36)');
  ctx.fillStyle = vignette; ctx.fillRect(0,0,innerWidth,innerHeight);
  requestAnimationFrame(render);
}

function randomize() {
  seed = Math.random() * 10000;
  ui.energy.value = Math.floor(rand(0, 28));
  ui.density.value = Math.floor(rand(12, 48));
  ui.glow.value = Math.floor(rand(18, 58));
  ui.coherence.value = Math.floor(rand(10, 95));
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

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js?v=2.3.0'));
window.addEventListener('resize', resize);
setPreset(presetName); resize(); requestAnimationFrame(render);
