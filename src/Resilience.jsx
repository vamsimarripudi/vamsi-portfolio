/* eslint-disable react-refresh/only-export-components */
import { Component, createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiAlertCircle, FiAlertTriangle, FiCheck, FiInfo, FiWifiOff, FiX } from 'react-icons/fi';
import './Resilience.css';

const ToastContext = createContext(null);
const SignalRunner = lazy(() => import('./SignalRunner.jsx'));
const EMAIL = 'enquiry.portfolio@vamsimarripudi.tech';
const timeoutByVariant = { success: 4800, info: 4000, warning: 7200, error: 8200, loading: 0, offline: 0 };

const iconByVariant = { success: FiCheck, info: FiInfo, warning: FiAlertTriangle, error: FiAlertCircle, loading: FiInfo, offline: FiWifiOff };

export const normalizeAppError = (error) => {
  const status = Number(error?.status);
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { type: 'NETWORK_OFFLINE', title: 'You’re offline', description: 'Check your connection, then try again.', retryable: true, status };
  if (error?.name === 'AbortError' || status === 408) return { type: 'NETWORK_TIMEOUT', title: 'That took too long', description: 'Please try again in a moment.', retryable: true, status };
  if (status === 400) return { type: 'VALIDATION_ERROR', title: 'Check the form details', description: error.message || 'Please correct the highlighted fields and try again.', retryable: false, status };
  if (status === 429) return { type: 'RATE_LIMITED', title: 'Too many requests', description: 'Please wait briefly before trying again.', retryable: true, status };
  if (status === 503) return { type: 'SERVICE_UNAVAILABLE', title: 'Contact delivery is unavailable', description: `Try again later or email ${EMAIL} directly.`, retryable: true, status };
  return { type: 'API_ERROR', title: 'Couldn’t complete that action', description: error?.message || `Please try again or email ${EMAIL} directly.`, retryable: true, status };
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);
  const show = useCallback((options) => {
    const id = options.id || `toast-${crypto.randomUUID?.() || Date.now()}`;
    const variant = options.variant || 'info';
    const toast = { id, variant, title: options.title, description: options.description, action: options.action };
    const duration = options.duration ?? timeoutByVariant[variant] ?? timeoutByVariant.info;
    const previousTimer = timers.current.get(id);
    if (previousTimer) window.clearTimeout(previousTimer);
    setToasts((items) => {
      const withoutDuplicate = items.filter((item) => item.id !== id);
      const persistent = withoutDuplicate.filter((item) => item.variant === 'offline' || item.variant === 'loading');
      const temporary = withoutDuplicate.filter((item) => item.variant !== 'offline' && item.variant !== 'loading').slice(-Math.max(0, 2 - persistent.length));
      return [...persistent, ...temporary, toast].slice(-3);
    });
    if (duration > 0) timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);
  const api = useMemo(() => ({
    show,
    dismiss,
    success: (options) => show({ ...options, variant: 'success' }),
    info: (options) => show({ ...options, variant: 'info' }),
    warning: (options) => show({ ...options, variant: 'warning' }),
    error: (options) => show({ ...options, variant: 'error' }),
    loading: (options) => show({ ...options, variant: 'loading' }),
    promise: async (promise, messages) => {
      const id = show({ ...messages.loading, variant: 'loading' });
      try { const result = await promise; show({ ...messages.success, id, variant: 'success' }); return result; }
      catch (error) { show({ ...messages.error, id, variant: 'error' }); throw error; }
    },
  }), [dismiss, show]);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  return <ToastContext.Provider value={api}>{children}<ToastViewport toasts={toasts} dismiss={dismiss}/></ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context;
}

function ToastViewport({ toasts, dismiss }) {
  const labels = { success: 'Saved', info: 'Update', warning: 'Attention', error: 'Action required', loading: 'Working', offline: 'Network' };
  return <div className="toast-viewport" aria-label="Notifications">{toasts.map((toast) => {
    const Icon = iconByVariant[toast.variant] || FiInfo;
    const isAlert = toast.variant === 'error' || toast.variant === 'offline';
    return <section key={toast.id} className={`toast toast-${toast.variant}`} role={isAlert ? 'alert' : 'status'} aria-live={isAlert ? 'assertive' : 'polite'} aria-atomic="true"><span className="toast-icon" aria-hidden="true"><Icon/></span><div className="toast-content"><span className="toast-kind">{labels[toast.variant] || 'Update'}</span><strong>{toast.title}</strong>{toast.description && <p>{toast.description}</p>}{toast.action && <button type="button" className="toast-action" onClick={() => { toast.action.onClick?.(); dismiss(toast.id); }}>{toast.action.label}</button>}</div><button type="button" className="toast-close" aria-label={`Dismiss ${toast.title}`} onClick={() => dismiss(toast.id)}><FiX/></button></section>;
  })}</div>;
}
export function NetworkWatcher() {
  const toast = useToast();
  useEffect(() => {
    let restoredTimer;
    const showOffline = () => toast.show({ id: 'network-offline', variant: 'offline', title: 'Connection lost', description: 'You’re offline. Some actions may be unavailable.', action: { label: 'Open offline mode', onClick: () => { window.location.href = '/offline'; } } });
    const showOnline = () => {
      window.clearTimeout(restoredTimer);
      restoredTimer = window.setTimeout(() => {
        toast.dismiss('network-offline');
        toast.success({ id: 'network-restored', title: 'Back online', description: 'Connection restored.' });
      }, 700);
    };
    if (!navigator.onLine) showOffline();
    window.addEventListener('offline', showOffline);
    window.addEventListener('online', showOnline);
    return () => { window.clearTimeout(restoredTimer); window.removeEventListener('offline', showOffline); window.removeEventListener('online', showOnline); };
  }, [toast]);
  return null;
}

const pageCopy = {
  'not-found': { label: '404 / NOT FOUND', title: 'This route doesn’t exist.', description: 'The destination may have moved, or the link may be incorrect.', visual: 'route_not_found', actions: [['Go home', '/'], ['Explore work', '/work'], ['Contact', '/contact']] },
  offline: { label: 'OFFLINE', title: 'You’re offline.', description: 'The connection has dropped. I’ll detect when it returns.', visual: 'signal_paused', actions: [['Retry connection', 'retry'], ['Go home', '/'], ['Contact', '/contact']] },
  error: { label: 'SYSTEM ERROR', title: 'Something didn’t load correctly.', description: 'The page hit an unexpected problem, but you can try again safely.', visual: 'node_disconnected', actions: [['Retry', 'retry'], ['Go home', '/'], ['Contact', '/contact']] },
  maintenance: { label: 'MAINTENANCE', title: 'Brief maintenance.', description: 'The site is being updated and should be available again shortly.', visual: 'system_paused', actions: [['Retry', 'retry'], ['Contact', '/contact']] },
  'rate-limited': { label: 'RATE LIMITED', title: 'Too many requests.', description: 'Please wait briefly before trying again.', visual: 'request_paused', actions: [['Try again later', 'retry'], ['Email directly', `mailto:${EMAIL}`]] },
};

export function UtilityPage({ kind = 'error', onRetry }) {
  const copy = pageCopy[kind] || pageCopy.error;
  const heading = useRef(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [checking, setChecking] = useState(false);
  const [showGame, setShowGame] = useState(false);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    const previousTitle = document.title;
    const robots = document.head.querySelector('meta[name="robots"]');
    const previousRobots = robots?.getAttribute('content');
    document.title = `${copy.title.replace(/[.]/g, '')} — Vamsi Marripudi`;
    if (robots) robots.setAttribute('content', 'noindex, follow');
    else { const node = document.createElement('meta'); node.name = 'robots'; node.content = 'noindex, follow'; document.head.append(node); }
    return () => { document.title = previousTitle; const node = document.head.querySelector('meta[name="robots"]'); if (previousRobots) node?.setAttribute('content', previousRobots); else node?.remove(); };
  }, [copy.title]);
  const retryConnection = async () => {
    setChecking(true);
    try { const response = await fetch('/robots.txt', { method: 'HEAD', cache: 'no-store' }); if (response.ok) { setOnline(true); window.location.assign('/'); } }
    catch { setOnline(false); }
    finally { setChecking(false); }
  };
  const retry = kind === 'offline' ? retryConnection : (onRetry || (() => window.location.reload()));
  return <main className="utility-page" id="main"><header className="utility-header"><Link to="/" className="wordmark" aria-label="Vamsi Marripudi home">VM<span>.</span></Link><nav aria-label="Recovery navigation"><Link to="/">Home</Link><Link to="/work">Work</Link><Link to="/contact">Contact</Link></nav></header><section className="utility-content"><p className="eyebrow">{copy.label}</p><div className={`utility-visual utility-${kind}`} aria-hidden="true"><i/><i/><span>{copy.visual}</span></div><h1 ref={heading} tabIndex="-1">{copy.title}</h1><p>{kind === 'offline' && online ? 'Connection restored. You can return to the site.' : copy.description}</p><div className="utility-actions">{copy.actions.map(([label, destination]) => destination === 'retry' ? <button key={label} className="button-link" type="button" onClick={retry} disabled={checking}>{checking ? 'Checking…' : label}</button> : destination.startsWith('mailto:') ? <a key={label} className="text-link" href={destination}>{label}</a> : <Link key={label} className={label === 'Go home' || label === 'Explore work' ? 'button-link' : 'text-link'} to={destination}>{label}</Link>)}</div><section className="utility-game-card" aria-labelledby="signal-runner-title"><div><p className="eyebrow">Optional recovery game</p><h2 id="signal-runner-title">Keep the signal moving.</h2><p>Signal Runner is ready whenever you want a short break while you recover.</p></div><button type="button" className="utility-game-trigger" onClick={() => setShowGame((value) => !value)}>{showGame ? 'Hide Signal Runner' : 'Play Signal Runner'}</button></section>{showGame && <Suspense fallback={<p className="utility-game-loading">Loading Signal Runner…</p>}><SignalRunner onExit={() => setShowGame(false)}/></Suspense>}</section><footer className="utility-footer">Vamsi Marripudi · Founder Engineer</footer></main>;
}

export class AppErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('ui.runtime_error', { name: error?.name || 'Error' }); }
  retry = () => { this.setState({ failed: false }); window.location.reload(); };
  render() { return this.state.failed ? <UtilityPage kind="error" onRetry={this.retry}/> : this.props.children; }
}
