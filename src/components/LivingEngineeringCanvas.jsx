import { useEffect, useRef } from 'react';
import './LivingEngineeringCanvas.css';

// Decorative engineering topology: SVG is never a source of important information.
export default function LivingEngineeringCanvas() {
  const scene = useRef(null);

  useEffect(() => {
    const element = scene.current;
    const hero = element?.closest('.hero');
    if (!element || !hero || !window.matchMedia) return undefined;

    const motion = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    if (!motion.matches || navigator.connection?.saveData) return undefined;
    let frame = 0;
    let pointer = null;

    const move = (event) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!pointer) return;
        const bounds = hero.getBoundingClientRect();
        const x = ((pointer.x - bounds.left) / Math.max(1, bounds.width) - 0.5) * 13;
        const y = ((pointer.y - bounds.top) / Math.max(1, bounds.height) - 0.5) * 13;
        element.style.setProperty('--canvas-x', x.toFixed(1) + 'px');
        element.style.setProperty('--canvas-y', y.toFixed(1) + 'px');
      });
    };
    const reset = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      pointer = null;
      element.style.removeProperty('--canvas-x');
      element.style.removeProperty('--canvas-y');
    };
    hero.addEventListener('pointermove', move, { passive: true });
    hero.addEventListener('pointerleave', reset);
    window.addEventListener('blur', reset);
    return () => {
      hero.removeEventListener('pointermove', move);
      hero.removeEventListener('pointerleave', reset);
      window.removeEventListener('blur', reset);
      reset();
    };
  }, []);

  return (
    <div ref={scene} className="living-engineering-canvas" aria-hidden="true">
      <svg viewBox="0 0 1100 620" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <linearGradient id="vm-canvas-path" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--line)" stopOpacity=".15"/>
            <stop offset=".54" stopColor="var(--accent)" stopOpacity=".52"/>
            <stop offset="1" stopColor="var(--line)" stopOpacity=".2"/>
          </linearGradient>
          <radialGradient id="vm-canvas-glow">
            <stop offset="0" stopColor="var(--lime)" stopOpacity=".24"/>
            <stop offset="1" stopColor="var(--lime)" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="830" cy="295" r="280" fill="url(#vm-canvas-glow)"/>
        <g className="canvas-engineering-paths" fill="none" stroke="url(#vm-canvas-path)" strokeWidth="1.3">
          <path d="M55 390 C170 300 220 360 315 280 S515 160 605 247 S795 360 970 175"/>
          <path d="M150 125 Q305 155 410 335 T760 395 Q870 430 1050 325"/>
          <path d="M315 280 L410 335 L605 247 L760 395 L970 175"/>
          <path d="M605 247 Q685 110 825 95"/>
          <path d="M410 335 Q320 475 195 505"/>
          <path d="M760 395 Q895 510 1010 525"/>
        </g>
        <g className="canvas-engineering-orbits" fill="none" stroke="var(--accent)" strokeWidth="1" opacity=".28">
          <ellipse cx="605" cy="247" rx="80" ry="32" transform="rotate(-18 605 247)"/>
          <circle cx="760" cy="395" r="53" strokeDasharray="2 8"/>
          <circle cx="315" cy="280" r="35" strokeDasharray="4 7"/>
        </g>
        <g className="canvas-engineering-nodes">
          <circle cx="150" cy="125" r="5" fill="var(--line)"/>
          <circle cx="315" cy="280" r="8" fill="var(--accent)" />
          <circle cx="410" cy="335" r="5" fill="var(--ink)" opacity=".22"/>
          <circle cx="605" cy="247" r="9" fill="var(--accent)" />
          <circle cx="760" cy="395" r="6" fill="var(--lime)" />
          <circle cx="970" cy="175" r="8" fill="var(--accent)" />
          <circle cx="825" cy="95" r="5" fill="var(--ink)" opacity=".22"/>
          <circle cx="195" cy="505" r="5" fill="var(--lime)" />
          <circle cx="1010" cy="525" r="5" fill="var(--line)" />
        </g>
        <g className="canvas-engineering-pulses" fill="var(--accent)" opacity=".7">
          <circle cx="605" cy="247" r="16" opacity=".12"/>
          <circle cx="315" cy="280" r="17" opacity=".09"/>
        </g>
      </svg>
    </div>
  );
}
