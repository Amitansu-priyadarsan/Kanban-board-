const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const PHOTO_ACCEPT = Object.keys(TYPES).join(",");
export const PHOTO_HINT =
  "JPG, PNG, WebP or GIF · Up to 10 MB each · Up to 10 photos per upload";

export async function validatePhotoFiles(files) {
  if (files.length > 10) throw new Error("Choose up to 10 photos per upload.");
  const prepared = [];
  for (const file of files) {
    const extension = TYPES[file.type];
    if (!extension || !file.size || file.size > 10485760)
      throw new Error("Choose JPG, PNG, WebP or GIF photos up to 10 MB each.");
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const ascii = (start, end) =>
      String.fromCharCode(...bytes.slice(start, end));
    const matches = {
      "image/jpeg": bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
      "image/png": [137, 80, 78, 71, 13, 10, 26, 10].every(
        (value, index) => bytes[index] === value,
      ),
      "image/webp": ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP",
      "image/gif": ["GIF87a", "GIF89a"].includes(ascii(0, 6)),
    };
    if (!matches[file.type])
      throw new Error(
        `“${file.name}” does not contain a valid ${extension.toUpperCase()} image.`,
      );
    prepared.push({ file, extension });
  }
  return prepared;
}
