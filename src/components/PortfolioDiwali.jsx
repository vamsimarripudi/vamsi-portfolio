import { useEffect, useRef, useState } from 'react';
import { isDiwali2026Active, nextDiwali2026Boundary } from '../festivals/diwali2026.js';
import './PortfolioDiwali.css';

const rootAsset = '/diwali-2026/';
const reducedQuery = '(prefers-reduced-motion: reduce)';
const contrastQuery = '(prefers-contrast: more)';
const MAX_TIMER = 2_147_000_000;

function FestivalSparks() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !context) return undefined;

    const reduced = window.matchMedia(reducedQuery);
    const contrast = window.matchMedia(contrastQuery);
    const connection = navigator.connection;
    let frame = 0;
    let interval = 0;
    let initial = 0;
    let lastFrame = 0;
    let width = 0;
    let height = 0;
    let particles = [];

    const allowed = () => isDiwali2026Active() &&
      !document.hidden && !reduced.matches && !contrast.matches &&
      !connection?.saveData;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      // Bound 4K memory, including high-density mobile / retina screens.
      const dpr = Math.max(.5, Math.min(window.devicePixelRatio || 1, 1.5,
        Math.sqrt(9_000_000 / (width * height))));
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (interval) window.clearInterval(interval);
      if (initial) window.clearTimeout(initial);
      frame = 0;
      interval = 0;
      initial = 0;
      lastFrame = 0;
      particles = [];
      context.clearRect(0, 0, width, height);
    };

    const paint = (timestamp) => {
      frame = 0;
      if (!allowed()) {
        stop();
        return;
      }
      if (lastFrame && timestamp - lastFrame < 33) {
        frame = window.requestAnimationFrame(paint);
        return;
      }
      const change = lastFrame ? Math.min(2.2, (timestamp - lastFrame) / 33) : 1;
      lastFrame = timestamp;
      context.clearRect(0, 0, width, height);
      const remaining = [];
      for (const spark of particles) {
        spark.x += spark.vx * change;
        spark.y += spark.vy * change;
        spark.vy += .02 * change;
        spark.age += change;
        const fade = Math.max(0, 1 - spark.age / spark.life);
        if (!fade) continue;
        context.globalAlpha = fade * .62;
        context.fillStyle = spark.color;
        context.beginPath();
        context.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2);
        context.fill();
        remaining.push(spark);
      }
      context.globalAlpha = 1;
      particles = remaining;
      if (remaining.length) frame = window.requestAnimationFrame(paint);
    };

    const burst = () => {
      if (!allowed()) return;
      const count = width < 650 ? 8 : 16;
      const x = width * (.77 + Math.random() * .15);
      const y = Math.min(height * .24, 185 + Math.random() * 120);
      const palette = ['#ebad53', '#f5cf80', '#ffdca2', '#e3a057', '#b99076'];
      for (let index = 0; index < count; index += 1) {
        const angle = Math.PI * 2 * index / count + (Math.random() - .5) * .15;
        const speed = .85 + Math.random() * 1.2;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - .15,
          radius: .85 + Math.random() * 1.15,
          age: 0,
          life: 32 + Math.random() * 22,
          color: palette[index % palette.length],
        });
      }
      if (particles.length > 64) particles = particles.slice(-64);
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    const sync = () => {
      stop();
      if (!allowed()) return;
      resize();
      // Sparse, gentle sparks rather than a high-frequency screen-wide show.
      initial = window.setTimeout(burst, 3100);
      interval = window.setInterval(burst, 14_500);
    };

    resize();
    sync();
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener?.('change', sync);
    contrast.addEventListener?.('change', sync);
    connection?.addEventListener?.('change', sync);
    return () => {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener?.('change', sync);
      contrast.removeEventListener?.('change', sync);
      connection?.removeEventListener?.('change', sync);
    };
  }, []);

  return <canvas ref={canvasRef} className="portfolio-diwali__sparks" aria-hidden="true"/>;
}

/** Absolutely positioned decorative layer; leaves the real portfolio UI intact. */
export default function PortfolioDiwali() {
  const [active, setActive] = useState(isDiwali2026Active);

  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      const now = Date.now();
      const boundary = nextDiwali2026Boundary(now);
      if (boundary !== null) {
        timer = window.setTimeout(tick, Math.min(MAX_TIMER, Math.max(1, boundary - now + 1)));
      }
    };
    const tick = () => {
      setActive(isDiwali2026Active());
      schedule();
    };
    const recheck = () => tick();
    schedule();
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('pageshow', recheck);
    window.addEventListener('focus', recheck);
    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('pageshow', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, []);

  if (!active) return null;
  return (
    <div className="portfolio-diwali" aria-hidden="true" data-portfolio-diwali="2026">
      <div className="portfolio-diwali__gold-frame"/>
      <div className="portfolio-diwali__wire" aria-hidden="true">
        {Array.from({ length: 22 }, (_, index) => <span key={index} style={{ '--bulb-delay': `${index * 105}ms` }}/>) }
      </div>
      <div className="portfolio-diwali__garland"/>
      <img className="portfolio-diwali__lantern portfolio-diwali__lantern--left"
        src={rootAsset + 'lantern.svg'} alt="" decoding="async" draggable="false"/>
      <img className="portfolio-diwali__lantern portfolio-diwali__lantern--right"
        src={rootAsset + 'lantern.svg'} alt="" decoding="async" draggable="false"/>
      <div className="portfolio-diwali__light-trail portfolio-diwali__light-trail--left"/>
      <div className="portfolio-diwali__light-trail portfolio-diwali__light-trail--right"/>
      <img className="portfolio-diwali__diya portfolio-diwali__diya--left"
        src={rootAsset + 'diya.svg'} alt="" decoding="async" draggable="false"/>
      <img className="portfolio-diwali__diya portfolio-diwali__diya--right"
        src={rootAsset + 'diya.svg'} alt="" decoding="async" draggable="false"/>
      <img className="portfolio-diwali__rangoli"
        src={rootAsset + 'rangoli.svg'} alt="" decoding="async" draggable="false"/>
      <div className="portfolio-diwali__lower-wire"/>
      <FestivalSparks/>
    </div>
  );
}
