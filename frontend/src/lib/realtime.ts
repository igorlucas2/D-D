const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

/**
 * Endereço do namespace Socket.IO. Com a API relativa ("/api"), fica na mesma
 * origem da página ("/vtt") e o Next repassa /socket.io ao backend.
 */
export function getSocketUrl(namespace: string) {
  const baseUrl = API_URL.replace(/\/api\/?$/, "");
  const normalizedNamespace = namespace.startsWith("/") ? namespace : `/${namespace}`;
  return `${baseUrl}${normalizedNamespace}`;
}
