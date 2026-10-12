import { useEffect, useRef } from 'react';
import './Motion.css';
const standard = value => Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });

/** Animate a visual copy, never the authoritative accessible/report value. */
export default function CountNumber({ value, format = standard }) {
  const visual = useRef(null), outer = useRef(null), previous = useRef(0);
  const valid = typeof value === 'number' && Number.isFinite(value);
  const text = valid ? format(value) : '—';
  useEffect(() => {
    const node = visual.current, host = outer.current;
    if (!node || !host || !valid) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let alive = true, tween;
    const finish = () => { node.textContent = text; host.removeAttribute('data-counting'); };
    const complete = () => { previous.current = value; finish(); };
    const stop = () => { tween?.kill(); finish(); };
    const change = () => { if (reduced.matches) stop(); };
    const from = previous.current;
    reduced.addEventListener('change', change);
    if (!reduced.matches && !navigator.connection?.saveData && from !== value) {
      import('gsap').then(({ gsap }) => {
        if (!alive || reduced.matches) return;
        const state = { value: from }; host.dataset.counting = 'true';
        tween = gsap.to(state, { value, duration: .55, ease: 'power2.out', onUpdate: () => { node.textContent = format(state.value); }, onComplete: complete });
      }).catch(finish);
    }
    return () => { alive = false; reduced.removeEventListener('change', change); stop(); };
  }, [value, text, format, valid]);
  return <span className="ui-count" ref={outer}><span className="ui-count-value">{text}</span><span className="ui-count-visual" ref={visual} aria-hidden="true">{text}</span></span>;
}
