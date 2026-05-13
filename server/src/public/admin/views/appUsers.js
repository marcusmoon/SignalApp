function typeOptions(esc, selected = 'service_notice') {
  return ['service_notice', 'app_update', 'insight_signal', 'market_alert', 'earnings_reminder']
    .map((type) => `<option value="${esc(type)}" ${type === selected ? 'selected' : ''}>${esc(type)}</option>`)
    .join('');
}

function maskToken(token) {
  const text = String(token || '');
  if (text.length <= 14) return text || '-';
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
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
                <span>${esc(item.targetType || 'all')}${item.targetKey ? `:${esc(item.targetKey)}` : ''}</span>
                <span>${esc(formatDateTime(item.scheduledAt || item.createdAt))}</span>
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

function consentRows(rows, { esc, textFor, formatDateTime }) {
  if (!rows.length) return `<p class="muted">${esc(textFor('appUsersTermsEmpty'))}</p>`;
  return `
    <div class="notificationMiniList">
      ${rows
        .map(
          (item) => `
            <article class="notificationMiniCard">
              <div class="notificationMiniHead">
                <strong>${esc(item.title || item.type || '-')}</strong>
                <span class="pill">v${esc(item.version || '-')}</span>
              </div>
              <div class="row muted">
                <span>${esc(item.type || '-')}</span>
                <span>${esc(String(item.locale || '').toUpperCase())}</span>
                <span>${esc(textFor('appUsersTermsAcceptedAt'))} ${esc(formatDateTime(item.acceptedAt))}</span>
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

function identityRows(rows, { esc, textFor, formatDateTime }) {
  if (!rows.length) return `<p class="muted">${esc(textFor('appUsersIdentitiesEmpty'))}</p>`;
  return `
    <div class="notificationMiniList">
      ${rows
        .map(
          (item) => `
            <article class="notificationMiniCard">
              <div class="notificationMiniHead">
                <strong>${esc(item.provider || '-')}</strong>
                <span class="pill">${esc(textFor('statusActive'))}</span>
              </div>
              <div class="row muted">
                <span>${esc(item.email || item.displayName || item.providerUserId || '-')}</span>
                <span>${esc(textFor('appUsersIdentityLinkedAt'))} ${esc(formatDateTime(item.linkedAt || item.createdAt))}</span>
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

function deviceRows(rows, { esc, textFor, formatDateTime }) {
  if (!rows.length) return `<p class="muted">${esc(textFor('appUsersDevicesEmpty'))}</p>`;
  return `
    <div class="notificationMiniList">
      ${rows
        .map(
          (item) => `
            <article class="notificationMiniCard statusSide statusSide--${item.active ? 'sent' : 'cancelled'}">
              <div class="notificationMiniHead">
                <strong>${esc(item.deviceName || item.platform || '-')}</strong>
                <span class="pill">${item.active ? esc(textFor('statusActive')) : esc(textFor('statusInactive'))}</span>
              </div>
              <div class="row muted">
                <span>${esc(item.platform || '-')}</span>
                <span><code>${esc(maskToken(item.pushToken))}</code></span>
                <span>${esc(textFor('appUsersUpdatedAt'))} ${esc(formatDateTime(item.updatedAt || item.createdAt))}</span>
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

function sessionRows(rows, { esc, textFor, formatDateTime }) {
  if (!rows.length) return `<p class="muted">${esc(textFor('appUsersSessionsEmpty'))}</p>`;
  return `
    <div class="notificationMiniList">
      ${rows
        .map((item) => {
          const statusText = item.active
            ? textFor('appUsersSessionActive')
            : item.revokedAt
              ? textFor('appUsersSessionRevoked')
              : textFor('appUsersSessionExpired');
          return `
            <article class="notificationMiniCard statusSide statusSide--${item.active ? 'sent' : 'cancelled'}">
              <div class="notificationMiniHead">
                <strong>${esc(item.type === 'signal_refresh' ? textFor('appUsersSessionRefresh') : textFor('appUsersSessionAccess'))}</strong>
                <span class="pill">${esc(statusText)}</span>
              </div>
              <div class="row muted">
                <span>${esc(item.key || '-')}</span>
                ${item.deviceId ? `<span>${esc(textFor('appUsersSessionDevice'))} ${esc(item.deviceId)}</span>` : ''}
                <span>${esc(textFor('appUsersSessionCreatedAt'))} ${esc(formatDateTime(item.createdAt))}</span>
                <span>${esc(textFor('appUsersSessionExpiresAt'))} ${esc(formatDateTime(item.expiresAt))}</span>
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function eventRows(rows, { esc, textFor, formatDateTime }) {
  if (!rows.length) return `<p class="muted">${esc(textFor('appUsersEventsEmpty'))}</p>`;
  const eventTitle = (eventType) => {
    const key = `appUsersEvent_${String(eventType || '').replace(/[^a-zA-Z0-9]/g, '_')}`;
    const value = textFor(key);
    return value === key ? eventType || '-' : value;
  };
  return `
    <div class="notificationMiniList">
      ${rows
        .map(
          (item) => `
            <article class="notificationMiniCard">
              <div class="notificationMiniHead">
                <strong>${esc(eventTitle(item.eventType))}</strong>
                <span class="pill">${esc(item.actorType || 'user')}</span>
              </div>
              <div class="row muted">
                ${item.provider ? `<span>${esc(item.provider)}</span>` : ''}
                ${item.identityId ? `<span>${esc(item.identityId)}</span>` : ''}
                <span>${esc(formatDateTime(item.createdAt))}</span>
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

function detailTabButtons(activeTab, { esc, textFor }) {
  const tabs = [
    ['notifications', textFor('appUsersNotificationsTitle')],
    ['terms', textFor('appUsersTermsTitle')],
    ['devices', textFor('appUsersDevicesTitle')],
    ['sessions', textFor('appUsersSessionsTitle')],
    ['identities', textFor('appUsersIdentitiesTitle')],
    ['events', textFor('appUsersEventsTitle')],
  ];
  return tabs
    .map(
      ([tab, label]) => `
        <button class="segBtn ${activeTab === tab ? 'active' : ''}" data-app-user-detail-tab="${esc(tab)}">${esc(label)}</button>
      `,
    )
    .join('');
}

function detailTabPanel(activeTab, data, helpers) {
  const { esc, textFor } = helpers;
  const titleByTab = {
    notifications: textFor('appUsersNotificationsTitle'),
    terms: textFor('appUsersTermsTitle'),
    devices: textFor('appUsersDevicesTitle'),
    sessions: textFor('appUsersSessionsTitle'),
    identities: textFor('appUsersIdentitiesTitle'),
    events: textFor('appUsersEventsTitle'),
  };
  const contentByTab = {
    notifications: notificationRows(data.notifications, helpers),
    terms: consentRows(data.terms, helpers),
    devices: deviceRows(data.devices, helpers),
    sessions: sessionRows(data.sessions, helpers),
    identities: identityRows(data.identities, helpers),
    events: eventRows(data.events, helpers),
  };
  return `
    <div class="appUserDetailPanel">
      <div class="cardKicker">${esc(titleByTab[activeTab] || titleByTab.notifications)}</div>
      ${contentByTab[activeTab] || contentByTab.notifications}
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
        <button class="secondary compactBtn" data-app-user-select="${esc(user.id)}">${esc(textFor('appUsersSelectUser'))}</button>
      </div>
    </article>
  `;
}

function pager({ page, totalPages, prefix, esc }) {
  return `
    <div class="pager">
      <button class="secondary" data-${prefix}-page="prev" ${Number(page || 1) <= 1 ? 'disabled' : ''}>‹</button>
      <span class="muted">${esc(page || 1)} / ${esc(totalPages || 1)}</span>
      <button class="secondary" data-${prefix}-page="next" ${Number(page || 1) >= Number(totalPages || 1) ? 'disabled' : ''}>›</button>
    </div>
  `;
}

function renderUserManagement({
  body,
  rows,
  selected,
  notificationRowsData,
  termRowsData,
  identityRowsData,
  deviceRowsData,
  sessionRowsData,
  eventRowsData,
  detailTab,
  q,
  active,
  pageSize,
  esc,
  textFor,
  textForVars,
  formatDateTime,
}) {
  const safeDetailTab = ['notifications', 'terms', 'devices', 'sessions', 'identities', 'events'].includes(detailTab)
    ? detailTab
    : 'notifications';
  return `
    <div class="appUsersLayout appUsersLayout--users">
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
          ${rows.length === 0 ? `<p class="muted">${esc(textFor('appUsersEmpty'))}</p>` : rows.map((user) => userCard(user, { esc, textFor, formatDateTime })).join('')}
        </div>
        ${pager({ page: body.page, totalPages: body.totalPages, prefix: 'app-users', esc })}
      </section>

      <section class="card settingsControlCard appUserDetailCard">
        <div class="cardHead">
          <div class="cardHeadMain">
            <div class="cardKicker">${esc(textFor('appUsersSelectedTitle'))}</div>
            <div class="cardHint">${selected ? esc(textForVars('appUsersSelectedHint', { email: selected.email || selected.id })) : esc(textFor('appUsersSelectUserHint'))}</div>
          </div>
        </div>
        ${
          selected
            ? `
              <div class="appUserSelected">
                ${userCard(selected, { esc, textFor, formatDateTime })}
              </div>
              <div class="segmented appUserDetailTabs">
                ${detailTabButtons(safeDetailTab, { esc, textFor })}
              </div>
              ${detailTabPanel(
                safeDetailTab,
                {
                  notifications: notificationRowsData,
                  terms: termRowsData,
                  identities: identityRowsData,
                  devices: deviceRowsData,
                  sessions: sessionRowsData,
                  events: eventRowsData,
                },
                { esc, textFor, formatDateTime },
              )}
            `
            : `<p class="muted">${esc(textFor('appUsersEmpty'))}</p>`
        }
      </section>
    </div>
  `;
}

function renderDeviceManagement({ body, rows, q, active, platform, pageSize, esc, textFor, formatDateTime }) {
  return `
    <section class="card settingsControlCard">
      <div class="cardHead">
        <div class="cardHeadMain">
          <div class="cardKicker">${esc(textFor('appDevicesTitle'))}</div>
          <div class="cardHint">${esc(textFor('appDevicesHint'))}</div>
        </div>
        <div class="cardHeadActions">
          <button class="secondary" id="refreshAppUsersBtn">${esc(textFor('btnRefresh'))}</button>
        </div>
      </div>
      <div class="filterBar compactFilterBar">
        <div class="filterBarControls toolbar jobsFilterGroups">
          <input id="appDevicesQuery" value="${esc(q)}" class="wide" placeholder="${esc(textFor('appDevicesSearchPlaceholder'))}" />
          <select id="appDevicesActive">
            <option value="" ${active === '' ? 'selected' : ''}>${esc(textFor('statusAll'))}</option>
            <option value="1" ${active === '1' ? 'selected' : ''}>${esc(textFor('statusActive'))}</option>
            <option value="0" ${active === '0' ? 'selected' : ''}>${esc(textFor('statusInactive'))}</option>
          </select>
          <input id="appDevicesPlatform" value="${esc(platform)}" placeholder="${esc(textFor('appDevicesPlatformPlaceholder'))}" />
          <select id="appDevicesPageSize">
            <option value="20" ${pageSize === '20' ? 'selected' : ''}>20</option>
            <option value="30" ${pageSize === '30' ? 'selected' : ''}>30</option>
            <option value="50" ${pageSize === '50' ? 'selected' : ''}>50</option>
          </select>
          <button class="secondary" id="searchAppDevicesBtn">${esc(textFor('btnSearch'))}</button>
        </div>
      </div>
      <div class="tableScroll">
        <table>
          <thead><tr><th>${esc(textFor('appDevicesUser'))}</th><th>${esc(textFor('appDevicesDevice'))}</th><th>${esc(textFor('appDevicesToken'))}</th><th>${esc(textFor('colStatus'))}</th><th>${esc(textFor('colDate'))}</th><th>${esc(textFor('colAction'))}</th></tr></thead>
          <tbody>
            ${
              rows.length === 0
                ? `<tr><td colspan="6" class="muted">${esc(textFor('appDevicesEmpty'))}</td></tr>`
                : rows.map((row) => `
                  <tr>
                    <td><strong>${esc(row.nickname || '-')}</strong><br/><span class="muted">${esc(row.email || row.userId || '-')}</span></td>
                    <td>${esc(row.deviceName || '-')}<br/><span class="pill">${esc(row.platform || '-')}</span></td>
                    <td><code>${esc(maskToken(row.pushToken))}</code></td>
                    <td>${row.active ? esc(textFor('statusActive')) : esc(textFor('statusInactive'))}</td>
                    <td>${esc(formatDateTime(row.updatedAt || row.createdAt))}</td>
                    <td>
                      <label class="switchRow compactSwitch">
                        <input class="switchInput" type="checkbox" data-app-device-active="${esc(row.id)}" ${row.active ? 'checked' : ''}/>
                        <span class="switchUi" aria-hidden="true"></span>
                      </label>
                    </td>
                  </tr>
                `).join('')
            }
          </tbody>
        </table>
      </div>
      ${pager({ page: body.page, totalPages: body.totalPages, prefix: 'app-devices', esc })}
    </section>
  `;
}

function renderNotificationSearch({ body, rows, q, status, type, targetType, pageSize, esc, textFor, formatDateTime }) {
  return `
    <section class="card settingsControlCard">
      <div class="cardHead">
        <div class="cardHeadMain">
          <div class="cardKicker">${esc(textFor('appNotificationsTitle'))}</div>
          <div class="cardHint">${esc(textFor('appNotificationsHint'))}</div>
        </div>
        <div class="cardHeadActions">
          <button class="secondary" id="refreshAppUsersBtn">${esc(textFor('btnRefresh'))}</button>
        </div>
      </div>
      <div class="filterBar compactFilterBar">
        <div class="filterBarControls toolbar jobsFilterGroups">
          <input id="appNotificationsQuery" value="${esc(q)}" class="wide" placeholder="${esc(textFor('appNotificationsSearchPlaceholder'))}" />
          <select id="appNotificationsStatus">
            <option value="" ${status === '' ? 'selected' : ''}>${esc(textFor('statusAll'))}</option>
            <option value="queued" ${status === 'queued' ? 'selected' : ''}>queued</option>
            <option value="sent" ${status === 'sent' ? 'selected' : ''}>sent</option>
            <option value="failed" ${status === 'failed' ? 'selected' : ''}>failed</option>
            <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>cancelled</option>
          </select>
          <select id="appNotificationsType"><option value="">${esc(textFor('appNotificationsTypeAll'))}</option>${typeOptions(esc, type)}</select>
          <select id="appNotificationsTargetType">
            <option value="" ${targetType === '' ? 'selected' : ''}>${esc(textFor('appNotificationsTargetAll'))}</option>
            <option value="all" ${targetType === 'all' ? 'selected' : ''}>all</option>
            <option value="segment" ${targetType === 'segment' ? 'selected' : ''}>segment</option>
            <option value="user" ${targetType === 'user' ? 'selected' : ''}>user</option>
          </select>
          <select id="appNotificationsPageSize">
            <option value="20" ${pageSize === '20' ? 'selected' : ''}>20</option>
            <option value="30" ${pageSize === '30' ? 'selected' : ''}>30</option>
            <option value="50" ${pageSize === '50' ? 'selected' : ''}>50</option>
          </select>
          <button class="secondary" id="searchAppNotificationsBtn">${esc(textFor('btnSearch'))}</button>
        </div>
      </div>
      ${notificationRows(rows, { esc, textFor, formatDateTime })}
      ${pager({ page: body.page, totalPages: body.totalPages, prefix: 'app-notifications', esc })}
    </section>
  `;
}

function renderComposer({ rows, selected, esc, textFor }) {
  return `
    <div class="appUsersLayout appUsersLayout--composer">
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

      <section class="card settingsControlCard">
        <div class="cardHead">
          <div class="cardHeadMain">
            <div class="cardKicker">${esc(textFor('appUsersSendUserNotice'))}</div>
            <div class="cardHint">${selected ? esc(selected.email) : esc(textFor('appUsersSelectUserHint'))}</div>
          </div>
        </div>
        <div class="appUserList" style="margin-bottom:12px">
          ${rows.slice(0, 8).map((user) => userCard(user, { esc, textFor, formatDateTime: (v) => v || '-' })).join('') || `<p class="muted">${esc(textFor('appUsersEmpty'))}</p>`}
        </div>
        ${
          selected
            ? `
              <div class="settingsFormGrid appUsersNoticeForm">
                <label class="fieldLabel">${esc(textFor('colType'))}<select id="userNotificationType">${typeOptions(esc)}</select></label>
                <label class="fieldLabel appUsersWideField">${esc(textFor('colTitle'))}<input id="userNotificationTitle" placeholder="${esc(textFor('appUsersNoticeTitlePlaceholder'))}" /></label>
                <label class="fieldLabel appUsersWideField">${esc(textFor('colBody'))}<textarea id="userNotificationBody" rows="3" placeholder="${esc(textFor('appUsersNoticeBodyPlaceholder'))}"></textarea></label>
                <button class="success appUsersWideField" id="sendUserNotificationBtn">${esc(textFor('appUsersSendUserNotice'))}</button>
              </div>
            `
            : ''
        }
      </section>
    </div>
  `;
}

export async function loadAppUsersView(ctx) {
  const { api, $, state, esc, textFor, textForVars, formatDateTime } = ctx;
  if (!$('appUsers')) return;

  const tab = state.appUsersTab || 'users';
  const q = String($('appUsersQuery')?.value || state.appUsersQuery || '').trim();
  const active = String($('appUsersActive')?.value ?? state.appUsersActive ?? '');
  const pageSize = String($('appUsersPageSize')?.value || state.appUsersPageSize || '30');
  state.appUsersQuery = q;
  state.appUsersActive = active;
  state.appUsersPageSize = pageSize;

  const userParams = new URLSearchParams({ page: String(state.appUsersPage || 1), pageSize });
  if (q) userParams.set('q', q);
  if (active) userParams.set('active', active);
  const body = await api(`/admin/api/app-users?${userParams.toString()}`);
  const rows = Array.isArray(body.data) ? body.data : [];
  state.appUsers = rows;
  state.appUsersTotal = body.total || rows.length;
  state.appUsersTotalPages = body.totalPages || 1;
  if (!state.appUsersSelectedId && rows[0]?.id) state.appUsersSelectedId = rows[0].id;
  const selected = rows.find((row) => row.id === state.appUsersSelectedId) || rows[0] || null;
  state.appUsersSelectedId = selected?.id || '';

  let selectedNotifications = { data: [] };
  let selectedTerms = { data: [] };
  let selectedIdentities = { data: [] };
  let selectedDevices = { data: [] };
  let selectedSessions = { data: [] };
  let selectedEvents = { data: [] };
  if (selected?.id) {
    const userId = encodeURIComponent(selected.id);
    [selectedNotifications, selectedTerms, selectedIdentities, selectedDevices, selectedSessions, selectedEvents] = await Promise.all([
      api(`/admin/api/app-users/${userId}/notifications?pageSize=10`),
      api(`/admin/api/app-users/${userId}/terms`),
      api(`/admin/api/app-users/${userId}/identities`),
      api(`/admin/api/app-users/${userId}/devices`),
      api(`/admin/api/app-users/${userId}/sessions`),
      api(`/admin/api/app-users/${userId}/events`),
    ]);
  }

  if (tab === 'devices') {
    const deviceQ = String($('appDevicesQuery')?.value || state.appDevicesQuery || '').trim();
    const deviceActive = String($('appDevicesActive')?.value ?? state.appDevicesActive ?? '');
    const platform = String($('appDevicesPlatform')?.value || state.appDevicesPlatform || '').trim();
    const devicePageSize = String($('appDevicesPageSize')?.value || state.appDevicesPageSize || '30');
    Object.assign(state, { appDevicesQuery: deviceQ, appDevicesActive: deviceActive, appDevicesPlatform: platform, appDevicesPageSize: devicePageSize });
    const params = new URLSearchParams({ page: String(state.appDevicesPage || 1), pageSize: devicePageSize });
    if (deviceQ) params.set('q', deviceQ);
    if (deviceActive) params.set('active', deviceActive);
    if (platform) params.set('platform', platform);
    const deviceBody = await api(`/admin/api/app-user-devices?${params.toString()}`);
    $('appUsers').innerHTML = renderDeviceManagement({
      body: deviceBody,
      rows: Array.isArray(deviceBody.data) ? deviceBody.data : [],
      q: deviceQ,
      active: deviceActive,
      platform,
      pageSize: devicePageSize,
      esc,
      textFor,
      formatDateTime,
    });
    state.appDevicesTotalPages = deviceBody.totalPages || 1;
    return;
  }

  if (tab === 'notifications') {
    const nq = String($('appNotificationsQuery')?.value || state.appNotificationsQuery || '').trim();
    const status = String($('appNotificationsStatus')?.value ?? state.appNotificationsStatus ?? '');
    const type = String($('appNotificationsType')?.value ?? state.appNotificationsType ?? '');
    const targetType = String($('appNotificationsTargetType')?.value ?? state.appNotificationsTargetType ?? '');
    const nPageSize = String($('appNotificationsPageSize')?.value || state.appNotificationsPageSize || '30');
    Object.assign(state, { appNotificationsQuery: nq, appNotificationsStatus: status, appNotificationsType: type, appNotificationsTargetType: targetType, appNotificationsPageSize: nPageSize });
    const params = new URLSearchParams({ page: String(state.appNotificationsPage || 1), pageSize: nPageSize });
    if (nq) params.set('q', nq);
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (targetType) params.set('targetType', targetType);
    const notificationBody = await api(`/admin/api/notifications?${params.toString()}`);
    $('appUsers').innerHTML = renderNotificationSearch({
      body: notificationBody,
      rows: Array.isArray(notificationBody.data) ? notificationBody.data : [],
      q: nq,
      status,
      type,
      targetType,
      pageSize: nPageSize,
      esc,
      textFor,
      formatDateTime,
    });
    state.appNotificationsTotalPages = notificationBody.totalPages || 1;
    return;
  }

  if (tab === 'composer') {
    $('appUsers').innerHTML = renderComposer({ rows, selected, esc, textFor });
    return;
  }

  $('appUsers').innerHTML = renderUserManagement({
    body,
    rows,
    selected,
    notificationRowsData: Array.isArray(selectedNotifications.data) ? selectedNotifications.data : [],
    termRowsData: Array.isArray(selectedTerms.data) ? selectedTerms.data : [],
    identityRowsData: Array.isArray(selectedIdentities.data) ? selectedIdentities.data : [],
    deviceRowsData: Array.isArray(selectedDevices.data) ? selectedDevices.data : [],
    sessionRowsData: Array.isArray(selectedSessions.data) ? selectedSessions.data : [],
    eventRowsData: Array.isArray(selectedEvents.data) ? selectedEvents.data : [],
    detailTab: state.appUsersDetailTab || 'notifications',
    q,
    active,
    pageSize,
    esc,
    textFor,
    textForVars,
    formatDateTime,
  });
}
