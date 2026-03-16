// Hermes API fetch wrapper
// Used by Fund page for API calls with consistent base URL handling

export async function hermesFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
}
