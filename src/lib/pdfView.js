export const PDF_ZOOM_MIN = 0.5;
export const PDF_ZOOM_MAX = 4;
export const PDF_ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export function clampPdfZoom(value) {
  return Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, Number(value || 1)));
}
