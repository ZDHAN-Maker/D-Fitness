import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 220,
          background: "linear-gradient(135deg, #881337, #4c0519)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 800,
          borderRadius: 112,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        DG
      </div>
    ),
    {
      ...size,
    }
  );
}

