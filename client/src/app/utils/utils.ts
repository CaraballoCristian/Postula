export function fixUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  return 'https://' + url;
}

export function formatFecha(f: string) {
  const d = f.substring(0, 10);
  const [y, m, day] = d.split('-');
  return `${day}-${m}-${y.substring(2)}`;
}

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function stagger(i: number): string {
  return `${Math.min(i * 30, 300)}ms`;
}

export function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^_+|_+$/g, '');
}

export function labelFromKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function bra(s: string) {
  return '{' + s + '}';
}