const MAX_EDGE = 1440;
const JPEG_QUALITY = 0.84;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했습니다. JPG 또는 PNG 사진으로 다시 시도해 주세요.')); };
    image.src = url;
  });
}

export async function prepareParticipantPhoto(file) {
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error('휴대폰 갤러리에서 사진을 선택해 주세요.');
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) throw new Error('사진을 변환하지 못했습니다. 다른 사진으로 다시 시도해 주세요.');
  return new File([blob], 'visit-photo.jpg', { type: 'image/jpeg' });
}
