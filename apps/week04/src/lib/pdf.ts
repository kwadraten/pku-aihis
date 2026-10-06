import * as pdfjs from "pdfjs-dist";

// The worker is a copied build asset, resolved against the document base.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "assets/vendor/pdf.worker.min.mjs",
  document.baseURI,
).href;

export async function openPdf(data: ArrayBuffer | Uint8Array) {
  const task = pdfjs.getDocument({
    data: new Uint8Array(data as ArrayLike<number>),
    isEvalSupported: false,
    wasmUrl: new URL('assets/vendor/pdf-wasm/',document.baseURI).href,
    cMapUrl: new URL('assets/vendor/cmaps/',document.baseURI).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('assets/vendor/standard_fonts/',document.baseURI).href,
  } as any);
  const pdf: any = await task.promise;
  pdf.destroy = () => task.destroy();
  return pdf;
}
export async function inspectPdf(file: {
  arrayBuffer: () => Promise<ArrayBuffer>;
}) {
  const pdf = await openPdf(await file.arrayBuffer());
  try {
    const infos = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i),
        view = page.getViewport({ scale: 1 });
      infos.push({ width: view.width, height: view.height, rotation: page.rotate });
    }
    return infos;
  } finally {
    await pdf.destroy();
  }
}
export async function renderPdf(
  pdf: any,
  index: number,
  canvas: HTMLCanvasElement,
  scale = 1.5,
) {
  const page = await pdf.getPage(index + 1),
    viewport = page.getViewport({ scale });
  if (viewport.width * viewport.height > 40000000)
    throw new Error("页面渲染超过 4000 万像素；请降低缩放");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  // Static laboratory raster: do not depend on rAF, which pauses in a background tab.
  await page.render({
    canvasContext: canvas.getContext("2d"),
    viewport,
    intent: "print",
  }).promise;
  return page;
}
export async function extractText(pdf: any, index: number) {
  const page = await pdf.getPage(index + 1),
    viewport = page.getViewport({ scale: 1 }),
    content = await page.getTextContent();
  return content.items
    .filter((i: any) => i.str?.trim())
    .map((i: any) => {
      const t = pdfjs.Util.transform(viewport.transform, i.transform);
      const x = Math.max(0, Math.min(0.9999, t[4] / viewport.width));
      const y = Math.max(
        0,
        Math.min(0.9999, (t[5] - Math.abs(i.height)) / viewport.height),
      );
      return {
        text: i.str,
        x,
        y,
        width: Math.min(
          1 - x,
          Math.max(0.0001, Math.abs(i.width) / viewport.width),
        ),
        height: Math.min(
          1 - y,
          Math.max(0.0001, Math.abs(i.height) / viewport.height),
        ),
        type: "text",
      };
    });
}
// OCR is provided separately by src/lib/ocr.ts in a follow-up task; its
// contract: page raster in, line-level { text, bbox, confidence }[] out,
// honoring an AbortSignal.
