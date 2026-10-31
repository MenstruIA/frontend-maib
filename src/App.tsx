import { useEffect } from 'react';
import { BookOpen, CalendarDays, Home as HomeIcon, LogOut, MapPin, MessageCircle } from 'lucide-react';
import { useRoute } from './lib/useRoute';
import { Home } from './pages/Home';
import { Assistant } from './pages/Assistant';
import { Library } from './pages/Library';
import { Services } from './pages/Services';
import { Cycle } from './pages/Cycle';
import { Privacy } from './pages/Privacy';
import { Admin } from './admin/Admin';

// Le suivi du cycle est local à l'appareil ; il peut être coupé par VITE_ENABLE_CYCLE=false (décision produit en attente).
const CYCLE_ENABLED = import.meta.env.VITE_ENABLE_CYCLE !== 'false';

// Sortie rapide (appareil partagé, crainte d'être vu) : remplace la page par un site neutre.
// Limite : l'historique du navigateur peut encore contenir les pages MenstruAI déjà visitées.
const QUICK_EXIT_URL = import.meta.env.VITE_QUICK_EXIT_URL || 'https://www.google.com';
const quickExit = () => window.location.replace(QUICK_EXIT_URL);

function QuickExit() {
  useEffect(() => {
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const now = Date.now();
      if (now - last < 600) quickExit(); // Échap deux fois de suite
      last = now;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <button type="button" className="quick-exit" onClick={quickExit} aria-label="Quitter rapidement ce site">
      <LogOut size={15} aria-hidden="true" /> <span>Quitter</span>
    </button>
  );
}

export default function App() {
  const [route, go] = useRoute();
  const nav = [
    { to: '/', label: 'Accueil', icon: HomeIcon },
    ...(CYCLE_ENABLED ? [{ to: '/cycle', label: 'Cycle', icon: CalendarDays }] : []),
    { to: '/assistant', label: 'IA', icon: MessageCircle },
    { to: '/infos', label: 'Infos', icon: BookOpen },
    { to: '/centres', label: 'Centres', icon: MapPin },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); go('/'); }}>
          <img className="brand-logo" src="/logo.png" alt="" width={38} height={38} /><span>Menstru<span>AI</span> Bénin</span>
        </a>
        <nav className="desktop-nav" aria-label="Navigation principale">
          {nav.map((n) => <button key={n.to} className={`nav-button ${route === n.to ? 'active' : ''}`} onClick={() => go(n.to)}>{n.label}</button>)}
        </nav>
        <QuickExit />
      </header>

      <main id="main">
        {route === '/' && <Home go={go} cycleEnabled={CYCLE_ENABLED} />}
        {route === '/assistant' && <Assistant go={go} />}
        {route === '/infos' && <Library />}
        {route === '/centres' && <Services />}
        {route === '/cycle' && CYCLE_ENABLED && <Cycle go={go} />}
        {route === '/confidentialite' && <Privacy />}
        {route.startsWith('/admin') && <Admin />}
        <section className="disclaimer"><p><strong>Important :</strong> MenstruAI Bénin fournit des informations éducatives et ne remplace pas un professionnel de santé. En cas de symptômes inquiétants ou d’urgence, rendez-vous sans attendre dans un service de santé.</p></section>
      </main>

      <footer className="footer">
        <p>Information fiable, respect et confidentialité. <a href="#/confidentialite">Confidentialité</a></p>
        <span className="footer-small">Version pilote · contenus soumis à validation médicale</span>
      </footer>

      <nav className="bottom-nav" aria-label="Navigation mobile">
        {nav.map((n) => <button key={n.to} className={route === n.to ? 'active' : ''} aria-current={route === n.to ? 'page' : undefined} onClick={() => go(n.to)}><n.icon size={20} /><span>{n.label}</span></button>)}
      </nav>
    </div>
  );
}
