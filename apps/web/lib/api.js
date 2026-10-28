/** One HTTP boundary: preserve useful server validation errors and reject failed responses. */
export async function api(path, { body, ...options } = {}) {
  const response = await fetch(`/api/${path}`, {
    ...options,
    ...(body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Request failed (${response.status})`);
  return data;
}
