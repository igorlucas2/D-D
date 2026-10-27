"use client";

import "./globals.css";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#171512",
          color: "#ece4d4",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <title>Erro — Eldoria RPG</title>
        <main style={{ maxWidth: 480, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>
            A aplicação encontrou um erro
          </h1>
          <p style={{ opacity: 0.75, marginBottom: 20 }}>
            Recarregue a página. Se o problema continuar, tente de novo mais
            tarde.
          </p>
          <button
            type="button"
            onClick={unstable_retry}
            style={{
              border: "1px solid #c59448",
              background: "#c59448",
              color: "#171512",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
          {error.digest ? (
            <p style={{ opacity: 0.5, fontSize: 12, marginTop: 16 }}>
              Código do erro: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
