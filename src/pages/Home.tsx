import { BookOpen, CalendarDays, MapPin, MessageCircle, ShieldCheck } from 'lucide-react';

export function Home({ go, cycleEnabled }: { go: (to: string) => void; cycleEnabled: boolean }) {
  const tiles = [
    ...(cycleEnabled ? [{ to: '/cycle', icon: CalendarDays, label: 'Mon cycle', tone: 'pink' }] : []),
    { to: '/assistant', icon: MessageCircle, label: 'Discuter avec l’IA', tone: 'blue' },
    { to: '/infos', icon: BookOpen, label: 'Informations', tone: 'orange' },
    { to: '/centres', icon: MapPin, label: 'Centres de santé', tone: 'green' },
  ];
  return (
    <section className="page-section home">
      <span className="eyebrow"><ShieldCheck size={15} /> Information éducative sourcée</span>
      <h1 className="page-title">Une information fiable.<br /><em>Une santé meilleure.</em></h1>
      <p className="muted lead">Des informations accessibles et sans jugement sur la santé menstruelle et reproductive, avec des sources visibles et des orientations vers des services vérifiés. Aucun compte n’est nécessaire.</p>
      <div className="tile-grid">
        {tiles.map((t) => (
          <button key={t.to} className={`tile tile-${t.tone}`} onClick={() => go(t.to)}>
            <t.icon size={26} /><span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="trust-band">
        <div className="trust-icon"><ShieldCheck /></div>
        <div>
          <h3>Des informations qui méritent votre confiance</h3>
          <p>Chaque fiche affiche ses sources et sa date de revue. L’assistant ne répond qu’à partir de contenus validés et ne remplace pas une consultation médicale.</p>
        </div>
      </div>
    </section>
  );
}
