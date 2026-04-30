// Compatibility shim: original `http.mjs` was split into `./http/*` modules.
// Existing imports continue to work via re-export.
export { handleRequest } from './http/index.mjs';
