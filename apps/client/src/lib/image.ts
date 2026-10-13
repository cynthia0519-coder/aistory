// 在裝置上先壓縮照片：送 API 的版本控制圖片 token 成本，縮圖版本存本地書櫃。

const API_MAX_EDGE = 1024;
const THUMB_MAX_EDGE = 320;

async function resize(file: Blob, maxEdge: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function prepareImage(file: File): Promise<{ apiBase64: string; thumbnail: Blob }> {
  const [apiBlob, thumbnail] = await Promise.all([
    resize(file, API_MAX_EDGE, 0.8),
    resize(file, THUMB_MAX_EDGE, 0.7),
  ]);
  return { apiBase64: await toBase64(apiBlob), thumbnail };
}
