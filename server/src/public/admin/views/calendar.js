function pad2(n) {
  return String(Math.max(0, Number(n) || 0)).padStart(2, '0');
}

function ymdFromParts(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

export function calendarMonthMeta(ym) {
  const parts = String(ym || '').split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  const first = ymdFromParts(y, m, 1);
  const last = ymdFromParts(y, m, daysInMonth(y, m));
  return { y, m, first, last };
}

export function shiftCalendarMonth(ym, delta) {
  const meta = calendarMonthMeta(ym);
  if (!meta) return ym;
  let { y, m } = meta;
  m += delta;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${pad2(m)}`;
}

export function initCalendarMonthIfNeeded({ state, ymd }) {
  if (state.calendarMonthYm) return;
  const t = new Date();
  state.calendarMonthYm = `${t.getFullYear()}-${pad2(t.getMonth() + 1)}`;
  state.calendarSelectedYmd = ymd(t);
}

function adminBcp47() {
  const lang = localStorage.getItem('signalAdminLanguage') || 'ko';
  if (lang === 'en') return 'en-US';
  if (lang === 'ja') return 'ja-JP';
  return 'ko-KR';
}

function formatAdminCalendarDayHeading(ymdValue) {
  try {
    const v = String(ymdValue || '').slice(0, 10);
    const [y, m, d] = v.split('-').map((x) => Number(x));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return v;
    return new Date(y, m - 1, d).toLocaleDateString(adminBcp47(), { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(ymdValue || '');
  }
}

export function renderAdminCalendarGrid({ state, $, esc, textFor, ymd }) {
  const host = $('calendarGrid');
  if (!host) return;
  const meta = calendarMonthMeta(state.calendarMonthYm);
  if (!meta) return;
  const { y, m } = meta;
  const first = new Date(y, m - 1, 1);
  const startWeekday = first.getDay();
  const dim = daysInMonth(y, m);
  const eventDates = new Set((state.calendarMonthRows || []).map((r) => String(r.date || '').slice(0, 10)));
  const sel = state.calendarSelectedYmd;
  const todayYmd = ymd(new Date());
  const weekHtml = [0, 1, 2, 3, 4, 5, 6].map((w) => `<div class="calWeekday" aria-hidden="true">${esc(textFor(`calWeek${w}`))}</div>`).join('');
  let cells = '';
  for (let i = 0; i < startWeekday; i += 1) cells += '<div class="calCell calCell--pad" aria-hidden="true"></div>';
  for (let d = 1; d <= dim; d += 1) {
    const ymdStr = ymdFromParts(y, m, d);
    const has = eventDates.has(ymdStr);
    const isSel = sel === ymdStr;
    const isToday = ymdStr === todayYmd;
    cells += `<button type="button" class="calCell ${has ? 'calCell--has' : 'calCell--muted'} ${isSel ? 'calCell--selected' : ''} ${isToday ? 'calCell--today' : ''}" data-cal-day="${esc(ymdStr)}" aria-pressed="${isSel ? 'true' : 'false'}">${d}</button>`;
  }
  host.innerHTML = `
    <div class="calendarMonthWrap">
      <div class="calWeekdays">${weekHtml}</div>
      <div class="calendarGrid" role="grid" aria-label="${esc(textFor('pageCalendarTitle'))}">${cells}</div>
    </div>`;
}

export function renderCalendarDayTable({ state, $, esc, textFor, textForVars }) {
  const host = $('calendarDayList') || $('calendar');
  if (!host) return;
  const sel = state.calendarSelectedYmd;
  const headEl = $('calendarDayHeadingText');
  if (headEl) headEl.textContent = textForVars('calendarEventsForDayOn', { date: formatAdminCalendarDayHeading(sel) });
  const rows = (state.calendarMonthRows || []).filter((r) => String(r.date || '').slice(0, 10) === sel);
  host.innerHTML =
    rows.length === 0
      ? `<p class="muted">${esc(textFor('calendarEmptyDay'))}</p>`
      : `
        <table>
          <thead>
            <tr>
              <th>${esc(textFor('colDate'))}</th>
              <th>${esc(textFor('colType'))}</th>
              <th>${esc(textFor('colTitle'))}</th>
              <th>${esc(textFor('colMeta'))}</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (item) => `
              <tr>
                <td class="muted">${esc(item.date || '-')}</td>
                <td><span class="pill">${esc(item.type || '-')}</span></td>
                <td><strong>${esc(item.title || '-')}</strong></td>
                <td class="muted">${esc(item.country || item.symbol || '-')}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      `;
}

export async function loadCalendarView(ctx) {
  const { api, $, state, esc, textFor, ymd } = ctx;
  const host = $('calendarDayList') || $('calendar');
  if (!host) return;
  initCalendarMonthIfNeeded({ state, ymd });
  if ($('calendarMonthPick')) $('calendarMonthPick').value = state.calendarMonthYm;
  const meta = calendarMonthMeta(state.calendarMonthYm);
  if (!meta) return;
  if ($('calendarFrom')) $('calendarFrom').value = meta.first;
  if ($('calendarTo')) $('calendarTo').value = meta.last;
  const params = new URLSearchParams({ page: '1', pageSize: '500', from: meta.first, to: meta.last });
  const ty = $('calendarType')?.value?.trim();
  if (ty) params.set('type', ty);
  const cq = $('calendarQuery')?.value?.trim();
  if (cq) params.set('q', cq);
  const sym = $('calendarSymbol')?.value?.trim();
  if (sym) params.set('symbol', sym.toUpperCase());
  const body = await api(`/admin/api/calendar?${params.toString()}`);
  state.calendarMonthRows = Array.isArray(body.data) ? body.data : [];
  state.calendarTotal = body.total;
  state.calendarPage = body.page;
  state.calendarTotalPages = body.totalPages;
  if (!state.calendarSelectedYmd) state.calendarSelectedYmd = ymd(new Date());
  if (!state.calendarMonthRows.some((r) => String(r.date || '').slice(0, 10) === state.calendarSelectedYmd)) {
    const prefix = `${meta.y}-${pad2(meta.m)}`;
    const firstHit = state.calendarMonthRows.find((r) => String(r.date || '').startsWith(prefix));
    state.calendarSelectedYmd = firstHit ? String(firstHit.date).slice(0, 10) : meta.first;
  }
  renderAdminCalendarGrid({ state, $, esc, textFor, ymd });
  renderCalendarDayTable({ state, $, esc, textFor, textForVars: ctx.textForVars });
}

