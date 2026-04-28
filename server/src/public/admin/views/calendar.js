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
  const headEl = $('calendarDayHeadingText');
  const sel = String(state.calendarSelectedYmd || '').slice(0, 10);
  const rangeFrom = String(state.calendarRangeFrom || '').slice(0, 10);
  const rangeTo = String(state.calendarRangeTo || '').slice(0, 10);

  // Range mode: show all fetched rows in the selected date range.
  if (!sel) {
    const rowsAll = [...(state.calendarMonthRows || [])].sort(
      (a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.title || '').localeCompare(String(b.title || '')),
    );
    const dates = [...new Set(rowsAll.map((r) => String(r.date || '').slice(0, 10)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const focus = state.calendarRangeFocusYmd || (dates[0] || '__all__');
    const focusIdx = dates.indexOf(focus);
    const canPrev = focus !== '__all__' && focusIdx > 0;
    const canNext = focus !== '__all__' && focusIdx >= 0 && focusIdx < dates.length - 1;

    if (headEl) {
      headEl.textContent =
        focus === '__all__'
          ? textForVars('calendarEventsForRange', { from: rangeFrom || '-', to: rangeTo || '-' })
          : textForVars('calendarEventsForDayOn', { date: focus });
    }

    const rows =
      focus === '__all__' ? rowsAll : rowsAll.filter((r) => String(r.date || '').slice(0, 10) === focus);

    host.innerHTML =
      dates.length === 0
        ? `<p class="muted">${esc(textFor('calendarEmptyDay'))}</p>`
        : `
          <div class="pager" style="margin-bottom:10px">
            <div class="muted">${esc(textForVars('calendarEventsForRange', { from: rangeFrom || '-', to: rangeTo || '-' }))}</div>
            <div class="row">
              <button class="secondary" data-calendar-range-prev="1" ${canPrev ? '' : 'disabled'}>${esc(textFor('btnPrevious'))}</button>
              <select data-calendar-range-day="pick">
                <option value="__all__"${focus === '__all__' ? ' selected' : ''}>${esc(textFor('tabAll'))}</option>
                ${dates.map((d) => `<option value="${esc(d)}"${d === focus ? ' selected' : ''}>${esc(d)}</option>`).join('')}
              </select>
              <button class="secondary" data-calendar-range-next="1" ${canNext ? '' : 'disabled'}>${esc(textFor('btnNext'))}</button>
            </div>
          </div>
          ${
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
              `
          }
        `;
    return;
  }

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

  // Prefer explicit range (news-like) when inputs exist.
  const fromValue = $('calendarFrom')?.value?.slice(0, 10) || '';
  const toValue = $('calendarTo')?.value?.slice(0, 10) || '';
  const from = fromValue || calendarMonthMeta(state.calendarMonthYm)?.first || '';
  const to = toValue || calendarMonthMeta(state.calendarMonthYm)?.last || '';
  if (!from || !to) return;

  // Drive the month grid by the "from" month.
  state.calendarMonthYm = from.slice(0, 7);
  const meta = calendarMonthMeta(state.calendarMonthYm);
  if (!meta) return;

  const params = new URLSearchParams({ page: '1', pageSize: '500', from, to });
  state.calendarRangeFrom = from;
  state.calendarRangeTo = to;
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
  // If a specific day is selected (via grid click), keep it; otherwise show range mode.
  if (state.calendarSelectedYmd) {
    const sel = String(state.calendarSelectedYmd).slice(0, 10);
    if (!state.calendarMonthRows.some((r) => String(r.date || '').slice(0, 10) === sel)) {
      state.calendarSelectedYmd = '';
    }
  }
  // Reset range navigator when query changes
  if (!state.calendarSelectedYmd) {
    const allDates = [...new Set((state.calendarMonthRows || []).map((r) => String(r.date || '').slice(0, 10)).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
    if (!state.calendarRangeFocusYmd || (state.calendarRangeFocusYmd !== '__all__' && !allDates.includes(state.calendarRangeFocusYmd))) {
      state.calendarRangeFocusYmd = allDates[0] || '__all__';
    }
  }
  renderAdminCalendarGrid({ state, $, esc, textFor, ymd });
  renderCalendarDayTable({ state, $, esc, textFor, textForVars: ctx.textForVars });
}

