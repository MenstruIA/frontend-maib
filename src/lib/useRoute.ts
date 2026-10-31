import { useEffect, useState } from 'react';

/** Routeur minimal par hash : #/assistant, #/admin… (aucune dépendance, compatible hébergement statique). */
export function useRoute(): [string, (to: string) => void] {
  const read = () => (window.location.hash.replace(/^#/, '') || '/');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo?.({ top: 0 }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [route, (to) => { window.location.hash = to; }];
}
