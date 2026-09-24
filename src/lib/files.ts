/** mock 모드용: 파일 → data: URL. 이미지는 긴 변 1280px JPEG 로 줄여 localStorage 에 들어가게 한다 */
export async function fileToDataUrl(file: File, maxBytes = 900_000): Promise<string> {
  if (file.type.startsWith("image/") && file.type !== "image/gif") {
    const img = await loadImage(file);
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", 0.8);
    if (url.length > maxBytes * 1.37) throw new Error("이미지가 너무 커요");
    return url;
  }
  if (file.size > maxBytes) throw new Error("가짜 데이터 모드에서는 1MB 이하 파일만 올릴 수 있어요");
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("파일을 읽지 못했어요")); r.readAsDataURL(file); });
}
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("이미지를 읽지 못했어요")); };
    img.src = url;
  });
}
export const isImage = (e: { mimeType?: string; url?: string; type: string }) =>
  (e.mimeType?.startsWith("image/") ?? false) || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(e.url ?? "") || (e.url?.startsWith("data:image/") ?? false);
