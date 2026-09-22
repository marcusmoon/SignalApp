import test from 'node:test';
import assert from 'node:assert/strict';
import { trackInflightRequest } from './inflightRequest.ts';

test('successful request is shared only while in flight', async () => {
  const requests = new Map<string, Promise<unknown>>();
  const request = Promise.resolve('news');
  trackInflightRequest(requests, 'news', request);
  assert.equal(requests.get('news'), request);
  await request;
  assert.equal(requests.size, 0);
});

test('handled request failures do not create a second unhandled rejection', async () => {
  const requests = new Map<string, Promise<unknown>>();
  const request = Promise.reject(new Error('offline'));
  trackInflightRequest(requests, 'news', request);
  await assert.rejects(request, /offline/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.size, 0);
});

test('late cleanup does not remove a replacement request', async () => {
  const requests = new Map<string, Promise<unknown>>();
  const previous = Promise.resolve('previous');
  const current = new Promise(() => {});
  trackInflightRequest(requests, 'news', previous);
  requests.set('news', current);
  await previous;
  assert.equal(requests.get('news'), current);
});
