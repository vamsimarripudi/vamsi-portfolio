import { useEffect, useRef, useState } from 'react';

const W = 720;
const H = 230;
const GROUND = 184;

export default function SignalRunner({ onExit }) {
  const canvas = useRef(null);
  const state = useRef({ phase: 'idle', y: GROUND - 26, velocity: 0, obstacles: [], distance: 0, speed: 5.1, spawn: 0, frame: 0 });
  const frame = useRef(0);
  const [phase, setPhase] = useState('idle');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem('vm-signal-runner-best')) || 0; } catch { return 0; } });

  useEffect(() => {
    const node = canvas.current;
    const context = node.getContext('2d');
    const resize = () => { const dpr = Math.min(window.devicePixelRatio || 1, 2); node.width = W * dpr; node.height = H * dpr; context.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); };
    const draw = () => {
      const game = state.current;
      context.clearRect(0, 0, W, H);
      context.fillStyle = '#151714'; context.fillRect(0, 0, W, H);
      context.strokeStyle = 'rgba(238,237,230,.11)'; context.lineWidth = 1;
      for (let x = -((game.distance * .7) % 36); x < W; x += 36) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, H); context.stroke(); }
      for (let y = 20; y < H; y += 36) { context.beginPath(); context.moveTo(0, y); context.lineTo(W, y); context.stroke(); }
      context.strokeStyle = '#db4c2f'; context.beginPath(); context.moveTo(0, GROUND + .5); context.lineTo(W, GROUND + .5); context.stroke();
      context.fillStyle = '#bedb57'; context.beginPath(); context.arc(88, game.y + 13, 12, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#151714'; context.fillRect(84, game.y + 7, 8, 12);
      game.obstacles.forEach((item) => { context.fillStyle = item.kind === '500' ? '#db4c2f' : '#eeede6'; context.fillRect(item.x, GROUND - item.h, item.w, item.h); context.fillStyle = '#151714'; context.font = '700 11px monospace'; context.fillText(item.kind, item.x + 4, GROUND - item.h + 17); });
      context.fillStyle = '#eeede6'; context.font = '700 12px monospace'; context.fillText(`SIGNAL ${String(Math.floor(game.distance)).padStart(4, '0')}`, 20, 28);
      if (game.phase !== 'playing') { context.fillStyle = 'rgba(21,23,20,.7)'; context.fillRect(0, 0, W, H); context.fillStyle = '#eeede6'; context.textAlign = 'center'; context.font = '700 18px monospace'; context.fillText(game.phase === 'gameover' ? 'SIGNAL INTERRUPTED' : 'TAP / SPACE TO START', W / 2, 92); context.font = '14px Arial'; context.fillStyle = '#b8b9b0'; context.fillText(game.phase === 'gameover' ? 'Tap or press Space to try again' : 'Keep the packet moving through the system', W / 2, 122); context.textAlign = 'left'; }
    };
    const finish = () => { const game = state.current; game.phase = 'gameover'; setPhase('gameover'); const next = Math.floor(game.distance); setScore(next); setBest((current) => { const value = Math.max(current, next); try { localStorage.setItem('vm-signal-runner-best', String(value)); } catch { /* Local storage is optional. */ } return value; }); draw(); };
    const jump = () => { const game = state.current; if (game.phase !== 'playing') { game.phase = 'playing'; game.y = GROUND - 26; game.velocity = 0; game.obstacles = []; game.distance = 0; game.speed = 5.1; game.spawn = 0; setScore(0); setPhase('playing'); } if (game.y >= GROUND - 27) game.velocity = -11.2; };
    const update = () => { const game = state.current; if (game.phase === 'playing' && !document.hidden) { game.velocity += .62; game.y = Math.min(GROUND - 26, game.y + game.velocity); game.distance += game.speed / 5; game.speed = Math.min(9.2, game.speed + .0009); game.spawn -= game.speed; if (game.spawn <= 0) { const kind = Math.random() > .55 ? '500' : 'API'; const h = kind === '500' ? 44 : 30; game.obstacles.push({ x: W + 36, w: kind === '500' ? 39 : 31, h, kind }); game.spawn = 245 + Math.random() * 160 + game.speed * 18; } game.obstacles.forEach((item) => { item.x -= game.speed; }); game.obstacles = game.obstacles.filter((item) => item.x > -60); const player = { x: 76, y: game.y + 2, w: 24, h: 23 }; const collision = game.obstacles.some((item) => player.x < item.x + item.w && player.x + player.w > item.x && player.y < GROUND && player.y + player.h > GROUND - item.h); if (collision) finish(); if (Math.floor(game.distance) % 10 === 0) setScore(Math.floor(game.distance)); }
      draw(); frame.current = requestAnimationFrame(update);
    };
    const key = (event) => { if (event.code === 'Space' || event.code === 'ArrowUp') { event.preventDefault(); jump(); } if (event.code === 'Escape') onExit?.(); };
    const click = () => jump();
    resize(); window.addEventListener('resize', resize); window.addEventListener('keydown', key); node.addEventListener('pointerdown', click); frame.current = requestAnimationFrame(update);
    return () => { cancelAnimationFrame(frame.current); window.removeEventListener('resize', resize); window.removeEventListener('keydown', key); node.removeEventListener('pointerdown', click); };
  }, [onExit]);

  return <section className="signal-runner" aria-label="Optional endless-runner mini-game. Press Space or Up Arrow to jump."><div><p className="eyebrow">Signal Runner / optional</p><p>{phase === 'gameover' ? 'Signal interrupted.' : 'Move a data packet through the pipeline.'}</p></div><canvas ref={canvas} className="signal-canvas" role="img" aria-label="A lightweight data-packet runner game. Tap or press Space to jump obstacles."/><footer><span>Signal {score}</span><span>Best {best}</span><button type="button" onClick={onExit}>Exit game</button></footer></section>;
}
