const FALLBACK = ['#004AAD', '#AAD004', '#41D8FF'];
const clamp = (value) => Math.min(255, Math.max(0, Math.round(value)));
const toHex = (value) => clamp(value).toString(16).padStart(2, '0');
const rgbHex = (rgb) => `#${rgb.map(toHex).join('')}`;
const hexRgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
const mix = (a, b, amount) => rgbHex(hexRgb(a).map((value, index) => value + (hexRgb(b)[index] - value) * amount));
const saturation = (rgb) => (Math.max(...rgb) - Math.min(...rgb)) / 255;
const luminance = (rgb) => rgb.reduce((sum, value, index) => sum + (value / 255) * [0.2126, 0.7152, 0.0722][index], 0);
const distance = (a, b) => Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));

export function buildBranding(palette) {
  const colors = [...(palette || []), ...FALLBACK].slice(0, 3);
  const primaryColor = luminance(hexRgb(colors[0])) > 0.62 ? mix(colors[0], '#071225', 0.42) : colors[0];
  return {
    primaryColor,
    secondaryColor: colors[1],
    tertiaryColor: colors[2],
    backgroundColor: mix(colors.reduce((best, color) => saturation(hexRgb(color)) < saturation(hexRgb(best)) ? color : best, colors[0]), '#ffffff', 0.9),
    palette: colors,
  };
}

export async function extractPalette(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPG, PNG, WEBP 이미지만 사용할 수 있습니다.');
  if (file.size >= 12 * 1024 * 1024) throw new Error('이미지는 12MB 미만이어야 합니다.');
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 96 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = new Map();
  for (let index = 0; index < pixels.length; index += 16) {
    const rgb = [pixels[index], pixels[index + 1], pixels[index + 2]];
    if (pixels[index + 3] < 210 || luminance(rgb) > 0.92 || luminance(rgb) < 0.035) continue;
    const key = rgb.map((value) => Math.round(value / 32) * 32).join(',');
    const current = buckets.get(key) || { total: [0, 0, 0], count: 0, score: 0 };
    current.total = current.total.map((value, channel) => value + rgb[channel]);
    current.count += 1;
    current.score += 1 + saturation(rgb) * 1.7;
    buckets.set(key, current);
  }
  const candidates = [...buckets.values()].map((entry) => ({ rgb: entry.total.map((value) => value / entry.count), score: entry.score })).sort((a, b) => b.score - a.score);
  const selected = [];
  candidates.forEach((candidate) => {
    if (selected.length < 3 && selected.every((item) => distance(item.rgb, candidate.rgb) >= 70)) selected.push(candidate);
  });
  return [...selected.map((item) => rgbHex(item.rgb)), ...FALLBACK].slice(0, 3);
}

export function sessionThemeStyle(session) {
  const branding = session?.branding || {};
  const primary = branding.primaryColor || FALLBACK[0];
  const secondary = branding.secondaryColor || FALLBACK[1];
  const tertiary = branding.tertiaryColor || FALLBACK[2];
  const extractedBackground = branding.backgroundColor || '#F6F4EE';
  const dark = branding.backgroundMode === 'dark';
  const background = dark ? mix(primary, '#050816', 0.82) : extractedBackground;
  return {
    '--accent': primary,
    '--accent-2': secondary,
    '--accent-3': tertiary,
    '--room-blue': primary,
    '--room-lime': secondary,
    '--room-cyan': tertiary,
    '--room-bg': background,
    '--room-surface': dark ? mix(primary, '#0b1224', 0.86) : '#ffffff',
    '--room-surface-2': dark ? mix(primary, '#111b31', 0.82) : mix(extractedBackground, '#ffffff', 0.45),
    '--room-ink': dark ? '#f7f9ff' : '#111827',
    '--room-muted': dark ? '#aab6ce' : '#6b7280',
    '--room-line': `color-mix(in srgb, ${primary} 22%, transparent)`,
    '--session-gradient': `linear-gradient(135deg, ${primary}, ${secondary})`,
    '--session-glow': `color-mix(in srgb, ${tertiary} 20%, transparent)`,
  };
}
