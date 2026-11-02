declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export class PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<any>;
  }
  export function getDocument(params: any): { promise: Promise<PDFDocumentProxy> };
  export namespace GlobalWorkerOptions {
    let workerSrc: string;
  }
  const GlobalWorkerOptions: { workerSrc: string };
  export default GlobalWorkerOptions;
  export { GlobalWorkerOptions };
}

declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  const workerSrc: string;
  export default workerSrc;
  export { workerSrc };
}
