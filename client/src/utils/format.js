export const money = (n, cur = '₹') =>
  `${cur}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const money2 = (n) => Number(n || 0).toFixed(2);

export const compact = (n, cur = '₹') => {
  const v = Number(n || 0);
  if (v >= 1e7) return `${cur}${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${cur}${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `${cur}${(v / 1e3).toFixed(1)}K`;
  return `${cur}${v.toFixed(0)}`;
};

export const dt = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const dateOnly = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
export const timeOnly = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export const ymd = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
};

export const pctChange = (now, prev) => (prev ? ((now - prev) / prev) * 100 : now ? 100 : 0);

export function downloadCSV(filename, rows) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const CHART_COLORS = ['#8f5a3a', '#f59e0b', '#0e7490', '#15803d', '#be185d', '#6d28d9', '#dc2626', '#0284c7'];
