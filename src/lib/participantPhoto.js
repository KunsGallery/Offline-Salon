const MAX_EDGE = 1440;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_INPUT_BYTES = 100 * 1024 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했습니다.')); };
    image.src = url;
  });
}

async function decodePhoto(file) {
  // Content providers on Android may omit or misreport the MIME type.
  // Let the browser decode the bytes rather than rejecting by file.type.
  try { return await loadImage(file); } catch (nativeError) {
    const header = new TextDecoder('latin1').decode(await file.slice(0, 64).arrayBuffer());
    const isHeif = /ftyp/.test(header) && /heic|heix|hevc|hevx|heim|heis|mif1|msf1/.test(header);
    if (!isHeif && !/\.(heic|heif|hif)$/i.test(file.name || '') && !/image\/hei[cf]/i.test(file.type)) {
      throw new Error('사진을 읽지 못했습니다. 갤러리에서 원본 사진을 다시 선택하거나 JPG·PNG로 저장해 주세요.');
    }
    try {
      // Only download the decoder when native HEIC/HEIF decoding is unavailable.
      const { heicTo } = await import('heic-to');
      return await loadImage(await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 }));
    } catch (error) {
      throw new Error('고효율 사진을 변환하지 못했습니다. 갤러리에서 JPG로 저장하거나 지금 촬영을 이용해 주세요.', { cause: error });
    }
  }
}

export async function prepareParticipantPhoto(file) {
  if (!file?.size) throw new Error('휴대폰 갤러리에서 사진을 선택해 주세요.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('100MB 이하 사진을 선택해 주세요.');
  const image = await decodePhoto(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('사진을 처리할 메모리가 부족합니다. 다른 앱을 닫고 다시 시도해 주세요.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.84, 0.7, 0.55, 0.4]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob?.size && blob.type === 'image/jpeg' && blob.size < MAX_OUTPUT_BYTES) {
        return new File([blob], 'visit-photo.jpg', { type: 'image/jpeg' });
      }
    }
    throw new Error('사진을 변환하지 못했습니다. 다른 사진으로 다시 시도해 주세요.');
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    image.src = '';
  }
}
