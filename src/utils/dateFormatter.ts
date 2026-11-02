
const TIME_ZONE = "Africa/Porto-Novo";

const parseDate = (date: string | Date | null | undefined): Date | null => {
  if (!date) return null;

  const parsed = date instanceof Date ? date : new Date(date);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** 02/11/2026 */
export const formatDate = (
  date: string | Date | null | undefined
): string => {
  const parsed = parseDate(date);

  if (!parsed) return "Date non renseignée";

  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
};

/** 02 novembre 2026 */
export const formatDateLong = (
  date: string | Date | null | undefined
): string => {
  const parsed = parseDate(date);

  if (!parsed) return "Date non renseignée";

  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
};

/** 02 nov. 2026 */
export const formatDateShort = (
  date: string | Date | null | undefined
): string => {
  const parsed = parseDate(date);

  if (!parsed) return "Date non renseignée";

  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
};

/** 02/11/2026 à 14:35 */
export const formatDateTime = (
  date: string | Date | null | undefined
): string => {
  const parsed = parseDate(date);

  if (!parsed) return "Date et heure non renseignées";

  return parsed.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
};

/** 02 novembre 2026 à 14:35 */
export const formatDateTimeLong = (
  date: string | Date | null | undefined
): string => {
  const parsed = parseDate(date);

  if (!parsed) return "Date et heure non renseignées";

  return parsed.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
};

/** 14:35 */
export const formatTime = (
  date: string | Date | null | undefined
): string => {
  const parsed = parseDate(date);

  if (!parsed) return "Heure non renseignée";

  return parsed.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
};

/** 02 novembre */
export const formatDayMonth = (
  date: string | Date | null | undefined
): string => {
  const parsed = parseDate(date);

  if (!parsed) return "Date non renseignée";

  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    timeZone: TIME_ZONE,
  });
};
