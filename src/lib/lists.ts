/**
 * Lecture tolérante d'une liste renvoyée par l'API. Selon le point d'accès, Laravel renvoie :
 *  - un tableau simple                               [ {...}, {...} ]
 *  - une réponse enveloppée                          { data: [ ... ] }
 *  - une liste paginée                               { data: [ ... ], current_page, last_page, total }
 *  - une collection filtrée, sérialisée en objet     { "2": {...}, "5": {...} }
 */
export interface ListView<T> {
  items: T[];
  /** false = forme inconnue : l'appelant peut afficher une erreur au lieu de planter. */
  recognized: boolean;
  /** true = le serveur découpe en pages (paramètre ?page=). */
  serverPaged: boolean;
  page?: number;
  lastPage?: number;
  total?: number;
}

export function readList<T>(raw: unknown): ListView<T> {
  if (Array.isArray(raw)) return { items: raw as T[], recognized: true, serverPaged: false, total: raw.length };

  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.data)) {
      const paged = typeof o.last_page === 'number';
      return {
        items: o.data as T[], recognized: true, serverPaged: paged,
        page: paged ? Number(o.current_page ?? 1) : undefined,
        lastPage: paged ? Number(o.last_page) : undefined,
        total: typeof o.total === 'number' ? o.total : o.data.length,
      };
    }
    const values = Object.values(o);
    if (values.length > 0 && values.every((v) => v && typeof v === 'object' && !Array.isArray(v))) {
      return { items: values as T[], recognized: true, serverPaged: false, total: values.length };
    }
    if (values.length === 0) return { items: [], recognized: true, serverPaged: false, total: 0 };
  }
  return { items: [], recognized: raw == null, serverPaged: false, total: 0 };
}
