import { writeSnapshotFiles } from "../shared/filesystem";
import type { LongScreenshotComposeRequest } from "../shared/types";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.scope !== "offscreen") {
    return undefined;
  }

  if (message?.type === "writeSnapshotFiles") {
    void writeSnapshotFiles(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error: unknown) => {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }

  if (message?.type === "composeLongScreenshot") {
    void composeLongScreenshot(message.payload as LongScreenshotComposeRequest)
      .then((dataUrl) => sendResponse({ ok: true, result: { dataUrl } }))
      .catch((error: unknown) => {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }

  return undefined;
});

async function composeLongScreenshot(request: LongScreenshotComposeRequest): Promise<string> {
  if (!request.shots.length) {
    throw new Error("LONG_SCREENSHOT_EMPTY");
  }

  const maxCanvasHeight = 16384;
  const baseWidth = Math.max(1, Math.round(request.viewportWidth * request.devicePixelRatio));
  const baseHeight = Math.max(1, Math.round(request.totalHeight * request.devicePixelRatio));
  const scale = Math.min(1, maxCanvasHeight / baseHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(baseWidth * scale));
  canvas.height = Math.max(1, Math.round(baseHeight * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("LONG_SCREENSHOT_CONTEXT_UNAVAILABLE");
  }

  let paintedBottom = 0;
  for (const shot of request.shots) {
    const blob = await (await fetch(shot.dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const visibleBottom = Math.min(request.totalHeight, shot.offsetY + request.viewportHeight);
    const overlapCss = Math.max(0, paintedBottom - shot.offsetY);
    const remainingCss = Math.max(1, visibleBottom - shot.offsetY - overlapCss);
    const sourceY = Math.round(overlapCss * request.devicePixelRatio);
    const sourceHeight = Math.min(bitmap.height - sourceY, Math.round(remainingCss * request.devicePixelRatio));
    const destY = Math.round((shot.offsetY + overlapCss) * request.devicePixelRatio * scale);
    const destHeight = Math.max(1, Math.round(sourceHeight * scale));
    context.drawImage(bitmap, 0, sourceY, bitmap.width, sourceHeight, 0, destY, canvas.width, destHeight);
    paintedBottom = Math.max(paintedBottom, visibleBottom);
    bitmap.close();
  }

  return canvas.toDataURL("image/png");
}