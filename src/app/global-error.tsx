"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>Please try again. Your data is safe.</p>
        <button onClick={reset} style={{ padding: "0.75rem 1.25rem", borderRadius: 8 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
