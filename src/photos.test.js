import { describe, expect, it } from "vitest";
import { validatePhotoFiles } from "./photos";

describe("Issue photo validation", () => {
  const png = () =>
    new File(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])],
      "screenshot.png",
      { type: "image/png" },
    );
  it("accepts real PNG, JPEG, GIF and WebP signatures", async () => {
    const files = [
      png(),
      new File([new Uint8Array([255, 216, 255, 224])], "photo.jpg", {
        type: "image/jpeg",
      }),
      new File(["GIF89a...."], "photo.gif", { type: "image/gif" }),
      new File(["RIFF....WEBP"], "photo.webp", { type: "image/webp" }),
    ];
    expect(
      (await validatePhotoFiles(files)).map((item) => item.extension),
    ).toEqual(["png", "jpg", "gif", "webp"]);
  });
  it("rejects renamed non-images and oversized batches before uploading", async () => {
    await expect(
      validatePhotoFiles([
        new File(["<script>alert(1)</script>"], "fake.png", {
          type: "image/png",
        }),
      ]),
    ).rejects.toThrow("valid PNG");
    await expect(
      validatePhotoFiles(Array.from({ length: 11 }, png)),
    ).rejects.toThrow("10 photos");
    await expect(
      validatePhotoFiles([
        { name: "big.png", type: "image/png", size: 10485761 },
      ]),
    ).rejects.toThrow("10 MB");
    await expect(
      validatePhotoFiles([new File([""], "empty.png", { type: "image/png" })]),
    ).rejects.toThrow("10 MB");
  });
});
