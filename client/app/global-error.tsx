"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html>
      <body>
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>⚠️</div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "8px" }}>
            Something went wrong
          </h2>
          <p style={{ color: "#6b7280", marginBottom: "24px" }}>
            A critical error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: "#2563eb",
              color: "white",
              padding: "8px 20px",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
