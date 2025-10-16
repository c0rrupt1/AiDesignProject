export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read file as data URL."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read the selected file."));
    reader.readAsDataURL(file);
  });
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) {
    throw new Error("Unexpected image payload; expected a base64 data URL.");
  }
  const [, mimeType, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], filename, { type: mimeType || "image/png" });
}

export const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

export function describePercent(value: number): string {
  const rounded = Math.round(value * 1000) / 10;
  return `${rounded % 1 === 0 ? Math.trunc(rounded) : rounded}%`;
}

export function cropImageToDataUrl(
  src: string,
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const naturalWidth = image.naturalWidth || image.width;
      const naturalHeight = image.naturalHeight || image.height;

      let sx = 0;
      let sy = 0;
      let sw = naturalWidth;
      let sh = naturalHeight;

      if (rect && rect.width > 0 && rect.height > 0) {
        sx = Math.floor(rect.x * naturalWidth);
        sy = Math.floor(rect.y * naturalHeight);
        sw = Math.floor(rect.width * naturalWidth);
        sh = Math.floor(rect.height * naturalHeight);

        if (sw <= 0 || sh <= 0) {
          sw = naturalWidth;
          sh = naturalHeight;
          sx = 0;
          sy = 0;
        } else {
          if (sx < 0) sx = 0;
          if (sy < 0) sy = 0;
          if (sx + sw > naturalWidth) {
            sw = naturalWidth - sx;
          }
          if (sy + sh > naturalHeight) {
            sh = naturalHeight - sy;
          }
        }
      }

      sw = Math.max(sw, 1);
      sh = Math.max(sh, 1);
      if (sx > naturalWidth - sw) {
        sx = Math.max(0, naturalWidth - sw);
      }
      if (sy > naturalHeight - sh) {
        sy = Math.max(0, naturalHeight - sh);
      }

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to create a drawing context."));
        return;
      }
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
      const dataUrl = canvas.toDataURL("image/png");
      resolve(dataUrl);
    };
    image.onerror = () => reject(new Error("Failed to load image for crop."));
    image.src = src;
  });
}
