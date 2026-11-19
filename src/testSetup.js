import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);
if (typeof window !== "undefined") {
  window.scrollTo = vi.fn();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  if (!Blob.prototype.arrayBuffer)
    Blob.prototype.arrayBuffer = function () {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
}
