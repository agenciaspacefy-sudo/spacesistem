import { useEffect, useRef, useState } from 'react';

/**
 * Fundo animado para a tela de login: estrelas no canvas + planetas em CSS.
 *  - Canvas: 200 estrelas estaticas com brilho pulsante, 50 com twinkle, 8 estrelas cadentes
 *  - DOM/CSS: Sol + 8 planetas (com Lua na Terra) em orbita via @keyframes rotate
 *  - Mouse parallax: movimento sutil das estrelas e do conjunto solar
 *  - Tooltip ao passar mouse no planeta
 *  - Click no planeta dispara ripple
 *
 * Sem libs externas. Performante via requestAnimationFrame e prefers-reduced-motion respeitado.
 */

const PLANETAS = [
  { id: 'sol',      nome: 'Sol',      cor: 'sol',      orbita: 0,   tamanho: 70, periodo: 0,  faceClass: 'sun-face' },
  { id: 'mercurio', nome: 'Mercúrio', cor: '#B5B5B5',  orbita: 90,  tamanho: 7,  periodo: 8 },
  { id: 'venus',    nome: 'Vênus',    cor: '#E8C474',  orbita: 130, tamanho: 11, periodo: 12 },
  { id: 'terra',    nome: 'Terra',    cor: '#4F8DDC',  orbita: 175, tamanho: 12, periodo: 16, lua: true },
  { id: 'marte',    nome: 'Marte',    cor: '#C1502E',  orbita: 220, tamanho: 9,  periodo: 20 },
  { id: 'jupiter',  nome: 'Júpiter',  cor: '#D9A66A',  orbita: 290, tamanho: 24, periodo: 28, faceClass: 'jupiter-face' },
  { id: 'saturno',  nome: 'Saturno',  cor: '#E0C57A',  orbita: 360, tamanho: 20, periodo: 36, anel: true },
  { id: 'urano',    nome: 'Urano',    cor: '#A6D8E2',  orbita: 420, tamanho: 14, periodo: 44 },
  { id: 'netuno',   nome: 'Netuno',   cor: '#3F5DBE',  orbita: 480, tamanho: 14, periodo: 52 }
];

function rand(min, max) { return Math.random() * (max - min) + min; }

export default function SpaceBackground() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const tooltipRef = useRef({ visible: false });
  const [tooltip, setTooltip] = useState(null); // { name, x, y }
  const [ripples, setRipples] = useState([]);   // [{ id, planetId }]

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0, height = 0;
    let stars = [];
    let twinkles = [];
    let shooters = [];
    let mouseSpeed = 0;
    let lastMouseX = 0, lastMouseY = 0;
    let parallax = { x: 0, y: 0 };
    let rafId = 0;
    let running = true;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      stars = [];
      twinkles = [];
      shooters = [];
      for (let i = 0; i < 200; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: rand(0.5, 1.5),
          a: rand(0.4, 0.95),
          ps: rand(0.0006, 0.0018), // pulse speed
          po: Math.random() * Math.PI * 2 // pulse offset
        });
      }
      for (let i = 0; i < 50; i++) {
        twinkles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: rand(0.8, 2),
          phase: Math.random() * Math.PI * 2,
          speed: rand(0.0015, 0.004)
        });
      }
      for (let i = 0; i < 8; i++) shooters.push(makeShooter(true));
    }

    function makeShooter(initial = false) {
      // Direção diagonal padrão (top-left → bottom-right) com leve variação
      const angle = rand(Math.PI * 0.18, Math.PI * 0.32); // ~30°-55° abaixo do eixo X
      const speed = rand(380, 700); // px/s
      const length = rand(70, 180);
      const startX = rand(-width * 0.2, width * 0.6);
      const startY = rand(-height * 0.2, height * 0.4);
      return {
        x: initial ? rand(-width, width) : startX,
        y: initial ? rand(-height, height) : startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length,
        life: 0,
        maxLife: rand(1.2, 2.2),
        delay: initial ? 0 : rand(0.5, 4.5)
      };
    }

    function step(t, dt) {
      ctx.clearRect(0, 0, width, height);
      // Parallax: aplicado direto no draw para nao precisar mexer no transform CSS do canvas
      const px = parallax.x * 12;
      const py = parallax.y * 12;

      // Estrelas pulsantes
      ctx.fillStyle = '#fff';
      for (const s of stars) {
        const a = s.a * (0.7 + 0.3 * Math.sin(t * s.ps + s.po));
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(s.x + px * 0.4, s.y + py * 0.4, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Twinkles (mais aggressive)
      for (const tw of twinkles) {
        const a = (Math.sin(t * tw.speed + tw.phase) + 1) / 2;
        if (a < 0.05) continue;
        ctx.globalAlpha = a * 0.95;
        ctx.beginPath();
        ctx.arc(tw.x + px * 0.6, tw.y + py * 0.6, tw.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Estrelas cadentes
      ctx.globalAlpha = 1;
      const speedMult = 1 + Math.min(mouseSpeed / 600, 1.5);
      for (const sh of shooters) {
        if (sh.delay > 0) {
          sh.delay -= dt;
          continue;
        }
        sh.life += dt;
        sh.x += sh.vx * dt * speedMult;
        sh.y += sh.vy * dt * speedMult;

        const tailX = sh.x - (sh.vx / Math.hypot(sh.vx, sh.vy)) * sh.length;
        const tailY = sh.y - (sh.vy / Math.hypot(sh.vx, sh.vy)) * sh.length;

        const grad = ctx.createLinearGradient(tailX, tailY, sh.x, sh.y);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.6, 'rgba(180,210,255,0.5)');
        grad.addColorStop(1, 'rgba(255,255,255,0.95)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(sh.x, sh.y);
        ctx.stroke();

        // Cabeca
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.arc(sh.x, sh.y, 1.5, 0, Math.PI * 2);
        ctx.fill();

        if (sh.x > width + 200 || sh.y > height + 200 || sh.life > sh.maxLife * 4) {
          Object.assign(sh, makeShooter(false));
        }
      }

      // Decay do mouseSpeed (volta a zero suave)
      mouseSpeed *= 0.92;
    }

    let prev = performance.now();
    function loop(now) {
      if (!running) return;
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      step(now, dt);
      rafId = requestAnimationFrame(loop);
    }

    function onMouseMove(e) {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = (e.clientX - rect.left) / rect.width - 0.5;
      const cy = (e.clientY - rect.top) / rect.height - 0.5;
      parallax.x = cx;
      parallax.y = cy;

      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      const dist = Math.hypot(dx, dy);
      mouseSpeed = Math.max(mouseSpeed, dist * 8);
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      // CSS variables para parallax dos planetas
      if (stageRef.current) {
        stageRef.current.style.setProperty('--px', `${cx * 14}px`);
        stageRef.current.style.setProperty('--py', `${cy * 14}px`);
      }
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    if (!reduceMotion) {
      rafId = requestAnimationFrame(loop);
    } else {
      // Renderiza um frame estatico
      step(0, 0);
    }

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  // ---------- Eventos dos planetas ----------
  function showTooltip(name, e) {
    setTooltip({ name, x: e.clientX, y: e.clientY });
    tooltipRef.current.visible = true;
  }
  function moveTooltip(e) {
    if (tooltipRef.current.visible) {
      setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
    }
  }
  function hideTooltip() {
    tooltipRef.current.visible = false;
    setTooltip(null);
  }
  function handleClick(planetId, e) {
    const id = Date.now() + Math.random();
    setRipples((rs) => [...rs, { id, planetId, x: e.clientX, y: e.clientY }]);
    setTimeout(() => {
      setRipples((rs) => rs.filter((r) => r.id !== id));
    }, 720);
  }

  return (
    <div className="space-bg" ref={wrapRef} aria-hidden="true">
      <canvas ref={canvasRef} className="space-bg-canvas" />

      <div className="space-bg-stage" ref={stageRef}>
        <div className="solar-system">
          {/* Anéis de orbita */}
          {PLANETAS.filter((p) => p.orbita > 0).map((p) => (
            <div
              key={`ring-${p.id}`}
              className="orbit-ring"
              style={{
                width: p.orbita * 2,
                height: p.orbita * 2
              }}
            />
          ))}

          {/* Sol */}
          <div className="sun-wrapper">
            <button
              type="button"
              className="planet sun"
              onMouseEnter={(e) => showTooltip('Sol', e)}
              onMouseMove={moveTooltip}
              onMouseLeave={hideTooltip}
              onClick={(e) => handleClick('sol', e)}
              aria-label="Sol"
            />
            <span className="sun-glow" aria-hidden="true" />
            <span className="sun-rays" aria-hidden="true" />
          </div>

          {/* Planetas */}
          {PLANETAS.filter((p) => p.orbita > 0).map((p) => (
            <div
              key={p.id}
              className="orbit"
              style={{
                width: p.orbita * 2,
                height: p.orbita * 2,
                animationDuration: `${p.periodo}s`
              }}
            >
              <div
                className={`planet planet-${p.id}`}
                style={{
                  width: p.tamanho,
                  height: p.tamanho,
                  background: p.cor,
                  animationDuration: `${p.periodo}s`
                }}
                onMouseEnter={(e) => showTooltip(p.nome, e)}
                onMouseMove={moveTooltip}
                onMouseLeave={hideTooltip}
                onClick={(e) => handleClick(p.id, e)}
                aria-label={p.nome}
                role="button"
                tabIndex={0}
              >
                {p.anel && <span className="planet-ring" aria-hidden="true" />}
                {p.lua && (
                  <div className="moon-orbit">
                    <span className="moon" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {tooltip && (
        <div
          className="space-tooltip"
          style={{ left: tooltip.x + 14, top: tooltip.y - 28 }}
        >
          {tooltip.name}
        </div>
      )}

      {ripples.map((r) => (
        <span
          key={r.id}
          className="space-ripple"
          style={{ left: r.x, top: r.y }}
        />
      ))}
    </div>
  );
}
