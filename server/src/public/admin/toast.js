import { esc } from './format.js';
import { $ } from './state.js';

const toastState = { items: [] };

function toastDurationMs(kind) {
  if (kind === 'error') return 0; // manual close
  return kind === 'warning' ? 4500 : 4000;
}

function renderToasts() {
  const host = $('toastHost');
  if (!host) return;
  const items = toastState.items.slice(0, 3);
  if (items.length === 0) {
    host.classList.add('hidden');
    host.innerHTML = '';
    host.setAttribute('aria-live', 'polite');
    return;
  }

  const topKind = items[0]?.kind || 'info';
  host.setAttribute('aria-live', topKind === 'error' ? 'assertive' : 'polite');

  host.classList.remove('hidden');
  host.innerHTML = items
    .map((t) => {
      const icon = t.kind === 'success' ? '✅' : t.kind === 'error' ? '❌' : t.kind === 'warning' ? '⚠️' : 'ℹ️';
      return `
        <div class="toast toast-${esc(t.kind)}" data-toast-id="${esc(t.id)}" role="status">
          <div class="toastIcon" aria-hidden="true">${icon}</div>
          <div class="toastBody">
            <strong>${esc(t.title)}</strong>
            ${t.detail ? `<span class="muted">${esc(t.detail)}</span>` : ''}
          </div>
          <button class="toastClose secondary" type="button" data-toast-close="${esc(t.id)}" aria-label="알림 닫기">✕</button>
        </div>
      `;
    })
    .join('');
}

export function dismissToast(id) {
  toastState.items = toastState.items.filter((t) => t.id !== id);
  renderToasts();
}

export function showToast(title, detail = '', { kind = 'success' } = {}) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  toastState.items = [{ id, kind, title, detail }, ...toastState.items].slice(0, 3);
  renderToasts();
  const ms = toastDurationMs(kind);
  if (ms > 0) setTimeout(() => dismissToast(id), ms);
}
