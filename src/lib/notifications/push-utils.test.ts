import { describe, expect, it } from "vitest";
import { urlB64ToUint8Array } from "./push-utils";

describe("urlB64ToUint8Array", () => {
  it("converts base64 url string into uint8array", () => {
    // Standard test key (base64url)
    const testKey = "BOELI0yCxNeIJoLztwewwn1yhB9UfePEkZ8HNOWXsQa_O9L_9zOiCIZ_m0fs8e53VrM4d-Qro_j0QO0S5xZ44fY";
    const uint8 = urlB64ToUint8Array(testKey);

    expect(uint8).toBeInstanceOf(Uint8Array);
    expect(uint8.length).toBe(65); // standard P-256 public key length (uncompressed)
  });
});

