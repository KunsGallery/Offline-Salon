import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const toBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PDF 표지를 만들 수 없습니다.')), 'image/jpeg', 0.86));

export async function inspectPdf(file) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('PDF 파일만 등록할 수 있습니다.');
  if (file.size >= 50 * 1024 * 1024) throw new Error('PDF는 50MB 미만이어야 합니다.');
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const document = await loadingTask.promise;
  try {
    const page = await document.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2, 900 / base.width, 620 / base.height) });
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const linksByPage = {};
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const currentPage = pageNumber === 1 ? page : await document.getPage(pageNumber);
      const annotations = await currentPage.getAnnotations();
      const links = annotations
        .filter((item) => item.subtype === 'Link' && /^https?:\/\//i.test(item.url || item.unsafeUrl || ''))
        .map((item, index) => ({ url: item.url || item.unsafeUrl, label: item.title || item.contents || `링크 ${index + 1}` }));
      if (links.length) linksByPage[pageNumber] = links;
    }
    return { pageCount: document.numPages, thumbnail: await toBlob(canvas), linksByPage };
  } finally {
    await loadingTask.destroy();
  }
}

export { pdfjs };
