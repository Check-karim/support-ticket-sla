import { ApiError } from "./api/client.js";

export function ErrorBanner({ error }: { error: unknown }) {
  if (error === null || error === undefined) {
    return null;
  }
  const message = error instanceof Error ? error.message : "Something went wrong.";
  const code = error instanceof ApiError ? error.code : null;
  return (
    <div className="banner error" role="alert">
      {code ? <strong>{code}</strong> : null}
      <span>{message}</span>
    </div>
  );
}
