export const TZ = () => process.env.TZ_NAME || 'Asia/Kolkata';

export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Parse ?from=YYYY-MM-DD&to=YYYY-MM-DD into a date range (defaults to today). */
export function parseRange(query) {
  const from = query.from ? startOfDay(new Date(`${query.from}T00:00:00`)) : startOfDay();
  const to = query.to ? endOfDay(new Date(`${query.to}T00:00:00`)) : endOfDay();
  return { from, to };
}

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
