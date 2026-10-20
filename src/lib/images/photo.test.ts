import { describe, expect, it } from "vitest";
import { buildPhotoPath, extensionFor, fitWithin, isOwnPhotoPath } from "./photo";

const uid = "7f1c0a52-4d57-4c0a-9e0b-0c6f6f5d9a11";
const id = "11111111-1111-4111-8111-111111111111";

describe("photo paths", () => {
  it("builds <user>/<uuid>.<ext>", () => expect(buildPhotoPath(uid, id, "image/jpeg")).toBe(`${uid}/${id}.jpg`));
  it("rejects unsupported types", () => {
    expect(() => buildPhotoPath(uid, id, "image/gif")).toThrow();
    expect(extensionFor("application/pdf")).toBeNull();
  });
  it("accepts only the caller's own generated paths", () => {
    expect(isOwnPhotoPath(uid, `${uid}/${id}.jpg`)).toBe(true);
    expect(isOwnPhotoPath(uid, `${uid}/${id}.webp`)).toBe(true);
  });
  it.each([
    ["another user's folder", `00000000-0000-4000-8000-000000000000/${id}.jpg`],
    ["path traversal", `${uid}/../${id}.jpg`],
    ["nested folder", `${uid}/x/${id}.jpg`],
    ["non-uuid file name", `${uid}/avatar.jpg`],
    ["wrong extension", `${uid}/${id}.exe`],
    ["no folder", `${id}.jpg`],
  ])("rejects %s", (_n, p) => expect(isOwnPhotoPath(uid, p)).toBe(false));
});

describe("fitWithin", () => {
  it("scales the long edge down to 1600", () => expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 }));
  it("handles portrait photos", () => expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 }));
  it("never upscales", () => expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 }));
  it("is safe with bad input", () => expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 }));
});
