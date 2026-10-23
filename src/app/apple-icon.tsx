import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 76,
          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 800,
          borderRadius: 40,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        OS
      </div>
    ),
    {
      ...size,
    }
  );
}

