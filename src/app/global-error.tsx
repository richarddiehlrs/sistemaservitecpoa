"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f1f5f9",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            background: "#fff",
            borderRadius: 16,
            padding: "2rem",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>
            Algo deu errado
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 8 }}>
            Não foi possível carregar esta página. Tente novamente.
          </p>
          {error.digest && (
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 12 }}>
              Código do erro: <code>{error.digest}</code>
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              background: "#1d4ed8",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
