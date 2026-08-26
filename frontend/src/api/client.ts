export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

type GraphqlError = {
  message: string;
  extensions?: { code?: unknown };
};

type GraphqlResponse<T> = {
  data?: T;
  errors?: GraphqlError[];
};

const graphqlUrl = import.meta.env.VITE_GRAPHQL_URL || "/graphql";

export async function graphqlRequest<T>(
  query: string,
  variables: Record<string, unknown> | undefined,
  token: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token !== null && token !== "") {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as GraphqlResponse<T>;
  const firstError = payload.errors?.[0];
  if (firstError) {
    const code =
      typeof firstError.extensions?.code === "string"
        ? firstError.extensions.code
        : "GRAPHQL_ERROR";
    throw new ApiError(code, firstError.message);
  }

  if (payload.data === undefined) {
    throw new ApiError("GRAPHQL_ERROR", "The API returned no data.");
  }

  return payload.data;
}
