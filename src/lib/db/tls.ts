// Postgres.js ssl: "require" encrypts traffic but disables certificate validation.
// Remote databases must authenticate the server as well as encrypt the connection.
export function databaseTls(url: string, ca?: string) {
  if (["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) return false;
  return { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
}
