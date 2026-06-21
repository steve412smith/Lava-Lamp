const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d', { alpha: false });
const controls = {
  speed: document.getElementById('speed'),
  density: document.getElementById('density'),
  glow: document.getElementById('glow'),
  coherence: document.getElementById('coherence'),
};
const panel = document.getElementById('panel');
const showUi = document.getElementById('showUi');
let dpr = 1, w = 0, h = 0, particles = [], raf, paused = false;
let pointer = { active: false, x: 0, y: 0, strength: 0 };

const palettes = {
  forest: { bg: ['#020806', '#072019'], colors: ['#7cffc6', '#3ed59f', '#d3ff72', '#ffb15f'] },
  ocean:  { bg: ['#020812', '#061d2b'], colors: ['#63e8ff', '#2f91ff', '#7affd9', '#dceeff'] },
  ember:  { bg: ['#100504', '#2a0b08'], colors: ['#ff8b45', '#ffd166', '#ff4d6d', '#f6f1d1'] },
  aurora: { bg: ['#050711', '#11173c'], colors: ['#84ffc9', '#aab6ff', '#e384ff', '#66e3ff'] },
  night:  { bg: ['#02020a', '#070716'], colors: ['#a7c7ff', '#d6bcff', '#86fff0', '#f8f7ff'] },
};
let current = palettes.forest;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = Math.floor(innerWidth * dpr); h = Math.floor(innerHeight * dpr);
  canvas.width = w; canvas.height = h;
  canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
  seedParticles();
}
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function particleCount() { return Math.floor(Number(controls.density.value) * Math.min(1.6, Math.sqrt((w*h)/(390*844*dpr*dpr)))); }
function seedParticles() {
  const n = particleCount();
  particles = Array.from({ length: n }, (_, i) => ({
    x: rand(0, w), y: rand(0, h),
    vx: rand(-0.12, 0.12), vy: rand(-0.12, 0.12),
    r: rand(2.2, 13.5) * dpr * (Math.random() < 0.08 ? rand(1.7, 3.4) : 1),
    phase: rand(0, Math.PI * 2),
    orbit: rand(0.0006, 0.0028) * (Math.random() < 0.5 ? -1 : 1),
    color: pick(current.colors),
    depth: rand(0.45, 1.35),
    seed: Math.random() * 1000
  }));
}
function field(x, y, t, p) {
  const s = 0.0016 * (1.25 - Number(controls.coherence.value) * 0.65);
  const a = Math.sin(x*s + t*0.00022 + p.seed) + Math.cos(y*s*1.3 - t*0.00017);
  const b = Math.cos((x+y)*s*0.74 + t*0.00013 + p.phase);
  return (a + b) * Math.PI;
}
function drawBackground() {
  const g = ctx.createLinearGradient(0,0,w,h);
  g.addColorStop(0, current.bg[0]); g.addColorStop(1, current.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
}
function step(t) {
  if (paused) return;
  drawBackground();
  const speed = Number(controls.speed.value), coherence = Number(controls.coherence.value), glow = Number(controls.glow.value);
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const a = field(p.x, p.y, t, p);
    const drift = (0.045 + coherence * 0.06) * speed * dpr * p.depth;
    p.vx += Math.cos(a) * drift + Math.cos(t*p.orbit + p.phase) * 0.008 * dpr;
    p.vy += Math.sin(a) * drift + Math.sin(t*p.orbit - p.phase) * 0.008 * dpr;
    if (pointer.active) {
      const dx = pointer.x - p.x, dy = pointer.y - p.y, dist2 = dx*dx + dy*dy + 1600;
      const pull = Math.min(0.9, 22000 / dist2) * pointer.strength * dpr;
      p.vx += dx * 0.00014 * pull; p.vy += dy * 0.00014 * pull;
    }
    p.vx *= 0.986; p.vy *= 0.986;
    p.x += p.vx * speed; p.y += p.vy * speed;
    if (p.x < -60*dpr) p.x = w + 40*dpr; if (p.x > w + 60*dpr) p.x = -40*dpr;
    if (p.y < -60*dpr) p.y = h + 40*dpr; if (p.y > h + 60*dpr) p.y = -40*dpr;
    const pulse = 1 + Math.sin(t*0.0012 + p.phase) * 0.12;
    const radius = p.r * pulse;
    const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * (5.5 * glow));
    grd.addColorStop(0, p.color + 'ee');
    grd.addColorStop(0.12, p.color + 'aa');
    grd.addColorStop(0.46, p.color + '35');
    grd.addColorStop(1, p.color + '00');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(p.x, p.y, radius * (4.8 * glow), 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = p.color + 'c8';
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.8*dpr, radius * 0.33), 0, Math.PI*2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  raf = requestAnimationFrame(step);
}
function restart() { cancelAnimationFrame(raf); paused = false; document.getElementById('pause').textContent='Pause'; seedParticles(); raf = requestAnimationFrame(step); }

document.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); current = palettes[btn.dataset.preset]; restart();
}));
controls.density.addEventListener('input', seedParticles);
document.getElementById('randomize').onclick = () => {
  controls.speed.value = rand(0.25, 1.45).toFixed(2);
  controls.density.value = Math.floor(rand(90, 340));
  controls.glow.value = rand(0.75, 1.9).toFixed(2);
  controls.coherence.value = rand(0.25, 0.9).toFixed(2);
  restart();
};
document.getElementById('pause').onclick = e => { paused = !paused; e.target.textContent = paused ? 'Resume' : 'Pause'; if (!paused) raf = requestAnimationFrame(step); };
document.getElementById('collapse').onclick = () => panel.classList.toggle('collapsed');
document.getElementById('hide').onclick = () => { panel.classList.add('hidden'); showUi.classList.add('visible'); };
showUi.onclick = () => { panel.classList.remove('hidden'); showUi.classList.remove('visible'); };
function point(e) { const touch = e.touches?.[0] || e; pointer.x = touch.clientX * dpr; pointer.y = touch.clientY * dpr; pointer.strength = 1; }
canvas.addEventListener('pointerdown', e => { pointer.active = true; point(e); });
canvas.addEventListener('pointermove', e => { if (pointer.active) point(e); });
canvas.addEventListener('pointerup', () => pointer.active = false);
canvas.addEventListener('pointercancel', () => pointer.active = false);
window.addEventListener('resize', resize);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
resize(); raf = requestAnimationFrame(step);
