import { $ } from './state.js';

// Confirm modal (docs/SIGNAL-ADMIN-UIUX.md 9.3)
export const confirmState = { open: false, onConfirm: null };

export function closeConfirm() {
  confirmState.open = false;
  confirmState.onConfirm = null;
  $('confirmModal')?.classList.add('hidden');
}

export function openConfirm({ title = '확인', desc = '', body = '', okText = '확인', danger = true, onConfirm } = {}) {
  confirmState.open = true;
  confirmState.onConfirm = typeof onConfirm === 'function' ? onConfirm : null;
  if ($('confirmTitle')) $('confirmTitle').textContent = title;
  if ($('confirmDesc')) $('confirmDesc').textContent = desc;
  if ($('confirmBody')) $('confirmBody').textContent = body;
  if ($('confirmOk')) {
    $('confirmOk').textContent = okText;
    $('confirmOk').classList.toggle('danger', !!danger);
    $('confirmOk').classList.toggle('success', !danger);
  }
  $('confirmModal')?.classList.remove('hidden');
}
