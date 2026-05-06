function typeOptions(esc, selected = 'service_notice') {
  return ['service_notice', 'app_update', 'insight_signal', 'market_alert', 'earnings_reminder']
    .map((type) => `<option value="${esc(type)}" ${type === selected ? 'selected' : ''}>${esc(type)}</option>`)
    .join('');
}

function notificationRows(rows, { esc, textFor, formatDateTime }) {
  if (!rows.length) return `<p class="muted">${esc(textFor('appUsersNotificationsEmpty'))}</p>`;
  return `
    <div class="notificationMiniList">
      ${rows
        .map(
          (item) => `
            <article class="notificationMiniCard statusSide statusSide--${esc(item.status || 'queued')}">
              <div class="notificationMiniHead">
                <strong>${esc(item.title || '-')}</strong>
                <span class="pill">${esc(item.status || 'queued')}</span>
              </div>
              <p class="summary">${esc(item.body || '')}</p>
              <div class="row muted">
                <span>${esc(item.type || '-')}</span>
                <span>${esc(item.channel || 'push')}</span>
                <span>${esc(formatDateTime(item.scheduledAt || item.createdAt))}</span>
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

function userCard(user, { esc, textFor, formatDateTime }) {
  return `
    <article class="appUserCard" data-app-user-card="${esc(user.id)}">
      <div class="appUserAvatar">${esc((user.nickname || user.email || '?').slice(0, 1).toUpperCase())}</div>
      <div class="appUserMain">
        <strong>${esc(user.nickname || '-')}</strong>
        <span class="muted">${esc(user.email || user.id)}</span>
        <div class="appUserMeta">
          <span class="pill">${user.active ? esc(textFor('statusActive')) : esc(textFor('statusInactive'))}</span>
          <span class="pill">${esc(textFor('appUsersSessionsShort'))} ${user.activeSessionCount || 0}</span>
          <span class="pill">${esc(textFor('appUsersDevicesShort'))} ${user.deviceCount || 0}</span>
          <span class="pill">${esc(textFor('appUsersQueuedShort'))} ${user.queuedNotificationCount || 0}</span>
        </div>
        <span class="muted">${esc(textFor('colDate'))}: ${esc(formatDateTime(user.createdAt))}</span>
      </div>
      <div class="appUserActions">
        <label class="switchRow compactSwitch">
          <input class="switchInput" type="checkbox" data-app-user-active="${esc(user.id)}" ${user.active ? 'checked' : ''}/>
          <span class="switchUi" aria-hidden="true"></span>
        </label>
        <button class="secondary compactBtn" data-app-user-select="${esc(user.id)}">${esc(textFor('appUsersOpenNotifications'))}</button>
      </div>
    </article>
  `;
}

export async function loadAppUsersView(ctx) {
  const { api, $, state, esc, textFor, textForVars, formatDateTime } = ctx;
  if (!$('appUsers')) return;
  const q = String($('appUsersQuery')?.value || '').trim();
  const active = String($('appUsersActive')?.value || '');
  const pageSize = String($('appUsersPageSize')?.value || '30');
  const params = new URLSearchParams({
    page: String(state.appUsersPage || 1),
    pageSize,
  });
  if (q) params.set('q', q);
  if (active) params.set('active', active);
  const body = await api(`/admin/api/app-users?${params.toString()}`);
  const rows = Array.isArray(body.data) ? body.data : [];
  state.appUsers = rows;
  state.appUsersTotal = body.total || rows.length;
  state.appUsersTotalPages = body.totalPages || 1;
  if (!state.appUsersSelectedId && rows[0]?.id) state.appUsersSelectedId = rows[0].id;
  const selected = rows.find((row) => row.id === state.appUsersSelectedId) || rows[0] || null;
  state.appUsersSelectedId = selected?.id || '';
  let notificationBody = { data: [] };
  if (selected?.id) {
    notificationBody = await api(`/admin/api/app-users/${encodeURIComponent(selected.id)}/notifications?pageSize=10`);
  }
  const notificationRowsData = Array.isArray(notificationBody.data) ? notificationBody.data : [];
  state.appUsersNotificationRows = notificationRowsData;

  $('appUsers').innerHTML = `
    <div class="appUsersLayout">
      <section class="card settingsControlCard">
        <div class="cardHead">
          <div class="cardHeadMain">
            <div class="cardKicker">${esc(textFor('appUsersTitle'))}</div>
            <div class="cardHint">${esc(textForVars('appUsersListHint', { count: body.total || rows.length }))}</div>
          </div>
          <div class="cardHeadActions">
            <button class="secondary" id="refreshAppUsersBtn">${esc(textFor('btnRefresh'))}</button>
          </div>
        </div>
        <div class="filterBar compactFilterBar">
          <div class="filterBarControls toolbar jobsFilterGroups">
            <input id="appUsersQuery" value="${esc(q)}" class="wide" placeholder="${esc(textFor('appUsersSearchPlaceholder'))}" />
            <select id="appUsersActive">
              <option value="" ${active === '' ? 'selected' : ''}>${esc(textFor('statusAll'))}</option>
              <option value="1" ${active === '1' ? 'selected' : ''}>${esc(textFor('statusActive'))}</option>
              <option value="0" ${active === '0' ? 'selected' : ''}>${esc(textFor('statusInactive'))}</option>
            </select>
            <select id="appUsersPageSize">
              <option value="20" ${pageSize === '20' ? 'selected' : ''}>20</option>
              <option value="30" ${pageSize === '30' ? 'selected' : ''}>30</option>
              <option value="50" ${pageSize === '50' ? 'selected' : ''}>50</option>
            </select>
            <button class="secondary" id="searchAppUsersBtn">${esc(textFor('btnSearch'))}</button>
          </div>
        </div>
        <div class="appUserList">
          ${
            rows.length === 0
              ? `<p class="muted">${esc(textFor('appUsersEmpty'))}</p>`
              : rows.map((user) => userCard(user, { esc, textFor, formatDateTime })).join('')
          }
        </div>
        <div class="pager">
          <button class="secondary" data-app-users-page="prev" ${Number(body.page || 1) <= 1 ? 'disabled' : ''}>‹</button>
          <span class="muted">${esc(body.page || 1)} / ${esc(body.totalPages || 1)}</span>
          <button class="secondary" data-app-users-page="next" ${Number(body.page || 1) >= Number(body.totalPages || 1) ? 'disabled' : ''}>›</button>
        </div>
      </section>

      <section class="card settingsControlCard">
        <div class="cardHead">
          <div class="cardHeadMain">
            <div class="cardKicker">${esc(textFor('appUsersBroadcastTitle'))}</div>
            <div class="cardHint">${esc(textFor('appUsersBroadcastHint'))}</div>
          </div>
        </div>
        <div class="settingsFormGrid appUsersNoticeForm">
          <label class="fieldLabel">${esc(textFor('colType'))}<select id="broadcastNotificationType">${typeOptions(esc)}</select></label>
          <label class="fieldLabel">${esc(textFor('colTarget'))}<select id="broadcastTargetType"><option value="all">${esc(textFor('targetAll'))}</option><option value="segment">${esc(textFor('targetSegment'))}</option></select></label>
          <label class="fieldLabel">${esc(textFor('targetKey'))}<input id="broadcastTargetKey" placeholder="${esc(textFor('appUsersTargetKeyPlaceholder'))}" /></label>
          <label class="fieldLabel appUsersWideField">${esc(textFor('colTitle'))}<input id="broadcastTitle" placeholder="${esc(textFor('appUsersNoticeTitlePlaceholder'))}" /></label>
          <label class="fieldLabel appUsersWideField">${esc(textFor('colBody'))}<textarea id="broadcastBody" rows="3" placeholder="${esc(textFor('appUsersNoticeBodyPlaceholder'))}"></textarea></label>
          <button class="success appUsersWideField" id="sendBroadcastNotificationBtn">${esc(textFor('appUsersSendBroadcast'))}</button>
        </div>
      </section>

      <section class="card settingsControlCard appUserDetailCard">
        <div class="cardHead">
          <div class="cardHeadMain">
            <div class="cardKicker">${esc(textFor('appUsersSelectedTitle'))}</div>
            <div class="cardHint">${selected ? esc(selected.email) : esc(textFor('appUsersSelectUserHint'))}</div>
          </div>
        </div>
        ${
          selected
            ? `
              <div class="appUserSelected">
                ${userCard(selected, { esc, textFor, formatDateTime })}
              </div>
              <div class="settingsFormGrid appUsersNoticeForm" style="margin-top:12px">
                <label class="fieldLabel">${esc(textFor('colType'))}<select id="userNotificationType">${typeOptions(esc)}</select></label>
                <label class="fieldLabel appUsersWideField">${esc(textFor('colTitle'))}<input id="userNotificationTitle" placeholder="${esc(textFor('appUsersNoticeTitlePlaceholder'))}" /></label>
                <label class="fieldLabel appUsersWideField">${esc(textFor('colBody'))}<textarea id="userNotificationBody" rows="3" placeholder="${esc(textFor('appUsersNoticeBodyPlaceholder'))}"></textarea></label>
                <button class="success appUsersWideField" id="sendUserNotificationBtn">${esc(textFor('appUsersSendUserNotice'))}</button>
              </div>
              <div class="appUsersNotifications">
                <div class="cardKicker" style="margin-bottom:8px">${esc(textFor('appUsersNotificationsTitle'))}</div>
                ${notificationRows(notificationRowsData, { esc, textFor, formatDateTime })}
              </div>
            `
            : `<p class="muted">${esc(textFor('appUsersEmpty'))}</p>`
        }
      </section>
    </div>
  `;
}
