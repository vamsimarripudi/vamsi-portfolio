/* Adapted from React Bits AnimatedContent, Copyright (c) 2026 David Haz.
 * See LICENSE.md. Uses a visible fallback, local lazy GSAP, scoped cleanup and
 * reduced motion. IntersectionObserver replaces the heavier ScrollTrigger.
 */
import { createElement, useEffect, useRef } from 'react';

export default function AnimatedContent({ as: Tag = 'div', children, distance = 6, duration = .28, delay = 0, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let alive = true, context, observer;
    const stop = () => { context?.revert(); element.removeAttribute('data-bits-animated'); };
    const enter = async () => {
      observer?.disconnect();
      if (reduced.matches || navigator.connection?.saveData) return;
      try {
        const { gsap } = await import('gsap');
        if (!alive || reduced.matches) return;
        context = gsap.context(() => {
          element.dataset.bitsAnimated = 'true';
          gsap.fromTo(element, { y: distance }, { y: 0, duration, delay, ease: 'power2.out', clearProps: 'transform' });
        }, element);
      } catch { /* Progressive enhancement must not hide or block content. */ }
    };
    const change = () => { if (reduced.matches) stop(); };
    reduced.addEventListener('change', change);
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => { if (entries.some(item => item.isIntersecting)) enter(); }, { threshold: .05 });
      observer.observe(element);
    } else enter();
    return () => { alive = false; observer?.disconnect(); reduced.removeEventListener('change', change); stop(); };
  }, [distance, duration, delay]);
  return createElement(Tag, { ref, ...props }, children);
}
