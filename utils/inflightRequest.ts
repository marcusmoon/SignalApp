/** Cleanup must consume both outcomes without creating an unhandled rejected promise. */
export function trackInflightRequest<T>(
  requests: Map<string, Promise<unknown>>,
  key: string,
  request: Promise<T>,
): void {
  requests.set(key, request);
  const remove = () => {
    if (requests.get(key) === request) requests.delete(key);
  };
  void request.then(remove, remove);
}
