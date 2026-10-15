/* ============================================================
   EduControl v3.1 — Núcleo Educativo Las Gamas
   ============================================================ */
const API_BASE = 'api/';

/** Escapa texto antes de meterlo en innerHTML (evita inyección de código). */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const ICONS = {
  clock: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg>',
  checkCircle: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
  print: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1"/><path d="M6 17v4h12v-4"/></svg>',
  history: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  trash: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13M10 11v6M14 11v6"/></svg>',
  calendar: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  award: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M9 13.5L7 21l5-3 5 3-2-7.5"/></svg>'
};

/* ============================================================
   1. COMUNICACIÓN CON EL SERVIDOR
   ============================================================ */
let currentUser = null;
let csrfToken = '';
let loginRole = null;
let courses = [];

/** fetch que añade el token CSRF a los POST y maneja sesión vencida / cambio de clave obligatorio. */
async function apiFetch(url, options = {}) {
  options.credentials = 'same-origin';
  if (options.method && options.method.toUpperCase() === 'POST') {
    options.headers = Object.assign({ 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, options.headers || {});
  }
  const res = await fetch(url, options);
  if (res.status === 401 && currentUser) handleSessionExpired();
  if (res.status === 403) {
    const copy = res.clone();
    const data = await copy.json().catch(() => ({}));
    if (data.cambiar_password) openPasswordModal(true);
  }
  return res;
}

async function postJSON(endpoint, body) {
  const res = await apiFetch(API_BASE + endpoint, { method: 'POST', body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({ error: 'Respuesta inesperada del servidor.' }));
  if (!res.ok && !data.error) data.error = 'Error del servidor (' + res.status + ').';
  return data;
}

async function getJSON(endpoint) {
  const res = await apiFetch(API_BASE + endpoint);
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function fetchIncidents() {
  const data = await getJSON('obtener_incidencias.php');
  if (data === null) { showToast('No se pudo conectar con el servidor', 'info'); return []; }
  return data;
}

/* ============================================================
   2. SESIÓN E INICIO DE SESIÓN
   ============================================================ */
const ROLE_INFO = {
  admin:   { title: 'Administración del Sistema', desc: 'Usuarios y alumnos del sistema',    label: 'Administrador' },
  docente: { title: 'Panel Docente / Directivo',  desc: 'Acceso para docentes y directivos', label: 'Docente / Directivo' },
  padre:   { title: 'Portal Padre / Apoderado',   desc: 'Acceso para padres y apoderados',   label: 'Padre / Apoderado' },
  alumno:  { title: 'Portal Alumno',              desc: 'Acceso para alumnos',               label: 'Alumno' }
};
const ALL_VIEWS = ['admin-view', 'docente-view', 'padre-view', 'alumno-view'];

function showLoginForm(role) {
  loginRole = role;
  const info = ROLE_INFO[role];
  document.getElementById('login-role-title').textContent = info.title;
  document.getElementById('login-role-desc').textContent = info.desc;
  const icon = document.getElementById('login-role-icon');
  icon.className = 'role-icon role-icon--' + role;
  icon.innerHTML = document.querySelector('.role-icon--' + role).innerHTML;
  hideLoginError();
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-step-roles').classList.add('hidden');
  document.getElementById('login-step-form').classList.remove('hidden');
  document.getElementById('login-user').focus();
}

function backToRoles() {
  loginRole = null;
  document.getElementById('login-step-form').classList.add('hidden');
  document.getElementById('login-step-roles').classList.remove('hidden');
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideLoginError() { document.getElementById('login-error').classList.add('hidden'); }

async function submitLogin(event) {
  event.preventDefault();
  hideLoginError();
  const btn = document.getElementById('login-submit');
  btn.disabled = true;
  try {
    const res = await fetch(API_BASE + 'login.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: document.getElementById('login-user').value.trim(),
        password: document.getElementById('login-pass').value,
        rol: loginRole
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      showLoginError(data.error || 'No se pudo iniciar sesión.');
      document.getElementById('login-pass').value = '';
      document.getElementById('login-pass').focus();
      return;
    }
    document.getElementById('login-pass').value = '';
    csrfToken = data.csrf;
    enterApp(data.usuario);
  } catch (e) {
    showLoginError('No se pudo conectar con el servidor. Revisa tu conexión a internet.');
  } finally {
    btn.disabled = false;
  }
}

function enterApp(user) {
  currentUser = user;
  document.getElementById('login-screen').classList.add('hidden');
  ALL_VIEWS.forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('user-display-name').textContent = user.nombre;
  document.getElementById('user-display-role').textContent = ROLE_INFO[user.rol].label;
  if (user.debe_cambiar_password) { openPasswordModal(true); return; }
  showRoleView();
}

function showRoleView() {
  const user = currentUser;
  ALL_VIEWS.forEach(id => document.getElementById(id).classList.add('hidden'));
  if (user.rol === 'admin') {
    document.getElementById('admin-view').classList.remove('hidden');
    renderAdminView();
  }
  if (user.rol === 'docente') {
    document.getElementById('docente-view').classList.remove('hidden');
    loadCourses().then(renderDocenteView);
  }
  if (user.rol === 'padre') {
    const hijos = (user.estudiantes || []).map(e => e.nombre + ' (' + e.curso + ')').join(', ');
    document.getElementById('padre-welcome').textContent = 'Bienvenido/a, ' + user.nombre;
    document.getElementById('padre-subtitle').textContent = 'Seguimiento de incidencias y citaciones' + (hijos ? ' de: ' + hijos : '');
    document.getElementById('padre-view').classList.remove('hidden');
    renderPadreView();
  }
  if (user.rol === 'alumno') {
    document.getElementById('alumno-welcome').textContent = 'Hola, ' + user.nombre.split(' ')[0];
    document.getElementById('alumno-view').classList.remove('hidden');
    renderAlumnoView();
  }
}

function showLoginScreen() {
  ALL_VIEWS.forEach(id => document.getElementById(id).classList.add('hidden'));
  ['password-modal', 'user-modal', 'cred-modal', 'import-modal', 'incident-modal', 'signature-modal', 'timeline-modal', 'firma-modal']
    .forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('login-screen').classList.remove('hidden');
  backToRoles();
}

async function logout() {
  try { await fetch(API_BASE + 'logout.php', { method: 'POST', credentials: 'same-origin' }); } catch (e) { /* sin conexión: igual salimos */ }
  currentUser = null; csrfToken = '';
  showLoginScreen();
  showToast('Sesión cerrada', 'info');
}

function handleSessionExpired() {
  currentUser = null; csrfToken = '';
  showLoginScreen();
  showToast('Tu sesión expiró. Inicia sesión de nuevo.', 'info');
}

async function restoreSession() {
  try {
    const res = await fetch(API_BASE + 'sesion.php', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.usuario) { csrfToken = data.csrf; enterApp(data.usuario); }
  } catch (e) { /* servidor no disponible: se queda en el login */ }
}

/* ---- Cambio de contraseña ---- */
let passwordForced = false;

function openPasswordModal(forced) {
  passwordForced = !!forced;
  ['pw-actual', 'pw-nueva', 'pw-repetir'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pw-error').classList.add('hidden');
  document.getElementById('password-forced-note').classList.toggle('hidden', !forced);
  document.getElementById('password-close').classList.toggle('hidden', !!forced);
  document.getElementById('password-cancel').classList.toggle('hidden', !!forced);
  document.getElementById('password-modal').classList.remove('hidden');
  document.getElementById('pw-actual').focus();
}

async function submitPassword(event) {
  event.preventDefault();
  const err = document.getElementById('pw-error');
  err.classList.add('hidden');
  const nueva = document.getElementById('pw-nueva').value;
  if (nueva !== document.getElementById('pw-repetir').value) {
    err.textContent = 'Las contraseñas nuevas no coinciden.'; err.classList.remove('hidden'); return;
  }
  const r = await postJSON('cambiar_password.php', { actual: document.getElementById('pw-actual').value, nueva });
  if (!r.success) { err.textContent = r.error || 'No se pudo cambiar la contraseña.'; err.classList.remove('hidden'); return; }
  closeModal('password-modal');
  showToast('Contraseña actualizada', 'success');
  if (passwordForced) { currentUser.debe_cambiar_password = false; passwordForced = false; showRoleView(); }
}

/* ============================================================
   3. VISTA DOCENTE
   ============================================================ */
async function loadCourses() {
  const data = await getJSON('obtener_cursos.php');
  courses = data || [];
  const filter = document.getElementById('docente-filter-course');
  const keep = filter.value;
  filter.innerHTML = '<option value="">Todos los cursos</option>' + courses.map(c => `<option value="${esc(c.nombre)}">${esc(c.nombre)}</option>`).join('');
  filter.value = keep;
  document.getElementById('modal-course').innerHTML = '<option value="">Seleccionar...</option>' +
    courses.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
}

async function renderDocenteView() {
  const all = await fetchIncidents();
  const search = document.getElementById('docente-search').value.toLowerCase();
  const courseFilter = document.getElementById('docente-filter-course').value;
  const severityFilter = document.getElementById('docente-filter-severity').value;

  const filtered = all.filter(inc => {
    const matchesSearch = !search ||
      inc.studentName.toLowerCase().includes(search) ||
      inc.id.toLowerCase().includes(search) ||
      inc.description.toLowerCase().includes(search);
    return matchesSearch && (!courseFilter || inc.course === courseFilter) && (!severityFilter || inc.severity === severityFilter);
  });

  document.getElementById('stat-total').textContent = all.length;
  document.getElementById('stat-pending').textContent = all.filter(i => i.hasCitation && !i.signed).length;
  document.getElementById('stat-citations').textContent = all.filter(i => i.hasCitation).length;
  document.getElementById('stat-signed').textContent = all.filter(i => i.signed || !i.hasCitation).length;

  const tbody = document.getElementById('docente-table-body');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No se encontraron incidencias con los filtros actuales.</td></tr>`;
  } else {
    tbody.innerHTML = filtered.slice().reverse().map(inc => {
      const badgeClass = inc.severity === 'Grave' ? 'badge--grave' : inc.severity === 'Moderada' ? 'badge--moderada' : 'badge--leve';
      const statusHtml = (!inc.hasCitation || inc.signed)
        ? `<span class="status status--signed">${ICONS.checkCircle} ${inc.signed ? 'Firmado' : 'Resuelto'}</span>`
        : `<span class="status status--pending">${ICONS.clock} Pendiente</span>`;
      const id = esc(inc.id);
      return `
        <tr>
          <td class="cell-id">${id}</td>
          <td>${esc(inc.studentName)}</td>
          <td>${esc(inc.course)}</td>
          <td>${esc(inc.category)}</td>
          <td><span class="badge ${badgeClass}">${esc(inc.severity)}</span></td>
          <td>${new Date(inc.date).toLocaleDateString('es-ES')}</td>
          <td>${statusHtml}</td>
          <td>
            <div class="cell-actions">
              ${inc.signed ? `<button class="row-icon-btn" title="Ver firma" onclick="viewSignature('${id}')">${ICONS.award}</button>` : ''}
              <button class="row-icon-btn" title="Historial" onclick="openTimeline('${id}')">${ICONS.history}</button>
              <button class="row-icon-btn" title="Imprimir" onclick="printReport('${id}')">${ICONS.print}</button>
              <button class="row-icon-btn danger" title="Anular" onclick="deleteInc('${id}')">${ICONS.trash}</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }
  renderCharts(all);
}

function renderCharts(incidents) {
  const cats = ['Conducta', 'Asistencia', 'Rendimiento', 'Uniforme', 'Respeto'];
  const catColors = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#f43f5e'];
  const catCounts = cats.map(c => incidents.filter(i => i.category === c).length);
  renderDoughnutChart('catChart', cats, catCounts, catColors);

  const sevs = ['Leve', 'Moderada', 'Grave'];
  const sevColors = ['#60a5fa', '#f59e0b', '#f43f5e'];
  const sevCounts = sevs.map(s => incidents.filter(i => i.severity === s).length);
  renderBarChart('sevChart', sevs, sevCounts, sevColors);
}

function renderDoughnutChart(containerId, labels, values, colors) {
  const el = document.getElementById(containerId);
  const total = values.reduce((a, b) => a + b, 0);
  const size = 150, stroke = 20, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let circles = '';
  if (total === 0) {
    circles = `<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${stroke}"/>`;
  } else {
    let offset = 0;
    values.forEach((v, idx) => {
      if (v === 0) return;
      const dash = (v / total) * c;
      circles += `<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${colors[idx]}" stroke-width="${stroke}" stroke-dasharray="${dash} ${c - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${size/2} ${size/2})" stroke-linecap="butt"/>`;
      offset += dash;
    });
  }
  const legend = labels.map((l, idx) =>
    `<div class="legend-item"><span class="legend-dot" style="background:${colors[idx]}"></span><span class="legend-label">${l}</span><span class="legend-value">${values[idx]}</span></div>`
  ).join('');
  el.innerHTML = `
    <div class="doughnut-wrap">
      <svg viewBox="0 0 ${size} ${size}" class="doughnut-svg">
        ${circles}
        <text x="${size/2}" y="${size/2 - 4}" text-anchor="middle" class="doughnut-total">${total}</text>
        <text x="${size/2}" y="${size/2 + 14}" text-anchor="middle" class="doughnut-total-label">casos</text>
      </svg>
      <div class="legend">${legend}</div>
    </div>`;
}

function renderBarChart(containerId, labels, values, colors) {
  const el = document.getElementById(containerId);
  const max = Math.max(1, ...values);
  const bars = labels.map((l, idx) => `
    <div class="bar-col">
      <span class="bar-value">${values[idx]}</span>
      <div class="bar-track"><div class="bar-fill" style="height:${(values[idx] / max) * 100}%;background:${colors[idx]}"></div></div>
      <span class="bar-label">${l}</span>
    </div>`).join('');
  el.innerHTML = `<div class="bar-chart">${bars}</div>`;
}


function csvCell(v) {
  let t = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;      // evita fórmulas maliciosas al abrir en Excel
  return '"' + t.replace(/"/g, '""') + '"';
}

async function exportCSV() {
  const incidents = await fetchIncidents();
  const header = 'ID,Alumno,Curso,Categoria,Gravedad,Fecha,Descripcion,Accion,Registrado por,Citacion,Firmado\n';
  const rows = incidents.map(i =>
    [i.id, i.studentName, i.course, i.category, i.severity, new Date(i.date).toLocaleDateString('es-ES'),
     i.description, i.action, i.teacher, i.hasCitation ? 'Si' : 'No', i.signed ? 'Si' : 'No'].map(csvCell).join(',')
  ).join('\n');
  downloadFile('\ufeff' + header + rows, 'educontrol_incidencias.csv', 'text/csv;charset=utf-8');
  showToast('CSV exportado correctamente', 'success');
}

async function exportJSONBackup() {
  const incidents = await fetchIncidents();
  downloadFile(JSON.stringify({ incidents }, null, 2), 'educontrol_respaldo.json', 'application/json');
  showToast('Respaldo descargado', 'success');
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ---- Crear incidencia ---- */
async function openCreateModal() {
  document.getElementById('incident-form').reset();
  document.getElementById('modal-id').value = '';
  document.getElementById('modal-title').textContent = 'Nueva Incidencia';
  document.getElementById('modal-citation-fields').classList.add('hidden');
  document.getElementById('modal-student').innerHTML = '<option value="">Seleccionar curso primero</option>';
  document.getElementById('incident-modal').classList.remove('hidden');
}

function toggleCitationFields() {
  document.getElementById('modal-citation-fields').classList.toggle('hidden', !document.getElementById('modal-citation-toggle').checked);
}

async function updateStudentsList() {
  const courseId = document.getElementById('modal-course').value;
  const select = document.getElementById('modal-student');
  if (!courseId) { select.innerHTML = '<option value="">Seleccionar curso primero</option>'; return; }
  select.innerHTML = '<option value="">Cargando...</option>';
  const students = (await getJSON('obtener_estudiantes.php?curso_id=' + encodeURIComponent(courseId))) || [];
  select.innerHTML = students.length
    ? '<option value="">Seleccionar alumno...</option>' + students.map(s => `<option value="${s.id}">${esc(s.nombre)}</option>`).join('')
    : '<option value="">Sin alumnos en este curso</option>';
}

async function saveIncidentForm(event) {
  event.preventDefault();
  const hasCitation = document.getElementById('modal-citation-toggle').checked;
  const payload = {
    studentId: parseInt(document.getElementById('modal-student').value, 10) || 0,
    category: document.getElementById('modal-category').value,
    severity: document.getElementById('modal-severity').value,
    description: document.getElementById('modal-description').value,
    action: document.getElementById('modal-action').value,
    hasCitation,
    citationDate: hasCitation ? document.getElementById('modal-citation-date').value : null,
    citationTime: hasCitation ? document.getElementById('modal-citation-time').value : null
  };
  if (!payload.studentId) { showToast('Selecciona un alumno', 'info'); return; }
  const result = await postJSON('crear_incidencia.php', payload);
  if (!result.success) { showToast(result.error || 'No se pudo guardar la incidencia', 'info'); return; }
  closeModal('incident-modal');
  await renderDocenteView();
  showToast('Incidencia ' + result.id + ' guardada', 'success');
}

async function deleteInc(id) {
  if (!confirm('¿Anular esta incidencia? Dejará de mostrarse, pero quedará registrado en el historial quién la anuló.')) return;
  const r = await postJSON('eliminar_incidencia.php', { id });
  if (!r.success) { showToast(r.error || 'No se pudo anular', 'info'); return; }
  await renderDocenteView();
  showToast('Incidencia anulada', 'info');
}

async function viewSignature(id) {
  const r = await getJSON('ver_firma.php?id=' + encodeURIComponent(id));
  if (!r || !r.firma) { showToast('No se pudo cargar la firma', 'info'); return; }
  document.getElementById('firma-img').src = r.firma;
  document.getElementById('firma-info').textContent = 'Firmado por ' + (r.firmante || 'apoderado') +
    (r.fecha ? ' el ' + new Date(r.fecha).toLocaleString('es-ES') : '') + ' · ' + id;
  document.getElementById('firma-modal').classList.remove('hidden');
}

async function openTimeline(id) {
  const all = await fetchIncidents();
  const inc = all.find(i => i.id === id);
  if (!inc) return;
  const content = document.getElementById('timeline-content');
  content.innerHTML = (inc.log || []).slice().reverse().map(entry => `
    <div class="timeline-item">
      <div class="timeline-dot">${ICONS.history}</div>
      <div>
        <strong>${esc(entry.text)}</strong>
        <p><time>${new Date(entry.date).toLocaleString('es-ES')}</time></p>
      </div>
    </div>`).join('') || '<p style="font-size:.85rem;color:var(--text-muted);">Sin registros en el historial.</p>';
  document.getElementById('timeline-modal').classList.remove('hidden');
}

async function printReport(id) {
  const all = await fetchIncidents();
  const inc = all.find(i => i.id === id);
  if (!inc) return;
  document.getElementById('print-id').textContent = inc.id;
  document.getElementById('print-date').textContent = new Date(inc.date).toLocaleDateString('es-ES');
  document.getElementById('print-student').textContent = inc.studentName;
  document.getElementById('print-course').textContent = inc.course;
  document.getElementById('print-cat').textContent = inc.category;
  document.getElementById('print-sev').textContent = inc.severity;
  document.getElementById('print-desc').textContent = inc.description;
  document.getElementById('print-act').textContent = inc.action || '-';
  window.print();
}

/* ============================================================
   4. VISTA PADRE
   ============================================================ */
async function renderPadreView() {
  const incidents = await fetchIncidents();
  const container = document.getElementById('padre-cards-container');
  if (incidents.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Sin incidencias registradas.</div>';
    return;
  }
  container.innerHTML = incidents.slice().reverse().map(inc => {
    const badgeClass = inc.severity === 'Grave' ? 'badge--grave' : inc.severity === 'Moderada' ? 'badge--moderada' : 'badge--leve';
    const citationHtml = inc.hasCitation ? `
      <div class="citation-box">
        <strong>${ICONS.calendar} Citación presencial</strong>
        ${inc.citationDate ? new Date(inc.citationDate + 'T00:00').toLocaleDateString('es-ES') : ''} ${esc((inc.citationTime || '').slice(0, 5))}
      </div>` : '';
    const signHtml = inc.hasCitation
      ? (inc.signed
          ? `<div class="info-card-action"><span class="status status--signed">${ICONS.checkCircle} Notificación firmada</span></div>`
          : `<div class="info-card-action"><button class="btn btn-success btn-sm btn-block" onclick="openSigModal('${esc(inc.id)}')">Firmar Notificación</button></div>`)
      : '';
    return `
      <div class="card info-card">
        <div class="info-card-top">
          <span class="badge ${badgeClass}">${esc(inc.severity)}</span>
          <span class="cell-id">${esc(inc.id)}</span>
        </div>
        <p style="font-weight:700;margin-top:.5rem;">${esc(inc.category)}</p>
        <div class="info-card-date">${esc(inc.studentName)} · ${new Date(inc.date).toLocaleDateString('es-ES')}</div>
        <p class="info-card-desc">${esc(inc.description)}</p>
        ${inc.action ? `<div class="info-card-action"><strong>Acción:</strong> ${esc(inc.action)}</div>` : ''}
        ${citationHtml}
        ${signHtml}
      </div>`;
  }).join('');
}

let sigCtx = null, sigDrawing = false, sigHasInk = false;

function openSigModal(id) {
  document.getElementById('sign-target-id').value = id;
  document.getElementById('signature-modal').classList.remove('hidden');
  setTimeout(setupSigCanvas, 30);
}

function setupSigCanvas() {
  const canvas = document.getElementById('sig-canvas');
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  sigCtx = canvas.getContext('2d');
  sigCtx.lineWidth = 2.2;
  sigCtx.lineCap = 'round';
  sigCtx.strokeStyle = '#1e293b';
  sigHasInk = false;

  const pos = e => {
    const rect = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  };
  const start = e => { e.preventDefault(); sigDrawing = true; const p = pos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); };
  const move = e => { if (!sigDrawing) return; e.preventDefault(); const p = pos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); sigHasInk = true; };
  const end = () => { sigDrawing = false; };

  canvas.onmousedown = start; canvas.onmousemove = move; canvas.onmouseup = end; canvas.onmouseleave = end;
  canvas.ontouchstart = start; canvas.ontouchmove = move; canvas.ontouchend = end;
}

function clearSigCanvas() {
  const canvas = document.getElementById('sig-canvas');
  sigCtx.clearRect(0, 0, canvas.width, canvas.height);
  sigHasInk = false;
}

async function saveSignatureProcess() {
  if (!sigHasInk) { showToast('Dibuja tu firma dentro del recuadro', 'info'); return; }
  const id = document.getElementById('sign-target-id').value;
  const r = await postJSON('firmar_incidencia.php', { id, signatureData: document.getElementById('sig-canvas').toDataURL('image/png') });
  if (!r.success) { showToast(r.error || 'No se pudo registrar la firma', 'info'); return; }
  closeModal('signature-modal');
  await renderPadreView();
  showToast('Firma registrada correctamente', 'success');
}

/* ============================================================
   5. VISTA ALUMNO
   ============================================================ */
async function renderAlumnoView() {
  const incidents = await fetchIncidents();
  const points = { Leve: 5, Moderada: 15, Grave: 30 };
  let score = 100;
  incidents.forEach(i => { score -= points[i.severity] || 0; });
  score = Math.max(0, score);

  const badge = score >= 90 ? 'Excelente' : score >= 70 ? 'Regular' : 'Crítico';
  document.getElementById('student-score-display').textContent = score;
  document.getElementById('student-badge-display').textContent = badge;

  const container = document.getElementById('alumno-cards-container');
  if (incidents.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">No tienes incidencias registradas. ¡Sigue así!</div>';
    return;
  }
  container.innerHTML = incidents.slice().reverse().map(inc => {
    const badgeClass = inc.severity === 'Grave' ? 'badge--grave' : inc.severity === 'Moderada' ? 'badge--moderada' : 'badge--leve';
    return `
      <div class="card info-card">
        <div class="info-card-top">
          <span class="badge ${badgeClass}">${esc(inc.severity)}</span>
          <span class="cell-id">-${points[inc.severity] || 0} pts</span>
        </div>
        <p style="font-weight:700;margin-top:.5rem;">${esc(inc.category)}</p>
        <div class="info-card-date">${new Date(inc.date).toLocaleDateString('es-ES')}</div>
        <p class="info-card-desc">${esc(inc.description)}</p>
      </div>`;
  }).join('');
}

/* ============================================================
   6. ADMINISTRACIÓN (usuarios y alumnos)
   ============================================================ */
let adminUsers = [], adminStudents = [], importKind = null, lastCreds = [], lastCredText = '';

async function renderAdminView() {
  await Promise.all([loadAdminUsers(), loadAdminStudents()]);
}

function adminTab(name) {
  document.getElementById('tab-usuarios').classList.toggle('active', name === 'usuarios');
  document.getElementById('tab-alumnos').classList.toggle('active', name === 'alumnos');
  document.getElementById('admin-panel-usuarios').classList.toggle('hidden', name !== 'usuarios');
  document.getElementById('admin-panel-alumnos').classList.toggle('hidden', name !== 'alumnos');
}

async function loadAdminUsers() {
  adminUsers = (await getJSON('admin_usuarios.php')) || [];
  renderAdminUsers();
}

async function loadAdminStudents() {
  adminStudents = (await getJSON('admin_estudiantes.php')) || [];
  renderAdminStudents();
}

function renderAdminUsers() {
  const q = document.getElementById('admin-user-search').value.toLowerCase();
  const rol = document.getElementById('admin-user-role').value;
  const list = adminUsers.filter(u => (!rol || u.rol === rol) && (!q || u.usuario.toLowerCase().includes(q) || u.nombre.toLowerCase().includes(q)));
  const tbody = document.getElementById('admin-users-body');
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay usuarios con ese filtro.</td></tr>'; return; }
  tbody.innerHTML = list.map(u => `
    <tr>
      <td class="cell-id">${esc(u.usuario)}</td>
      <td>${esc(u.nombre)}</td>
      <td><span class="badge badge--role">${esc(ROLE_INFO[u.rol].label)}</span></td>
      <td>${esc(u.vinculo) || '—'}</td>
      <td><span class="badge ${u.activo ? 'badge--on' : 'badge--off'}">${u.activo ? 'Activo' : 'Desactivado'}</span>${u.pendiente ? ' <small class="note">(clave temporal)</small>' : ''}</td>
      <td><div class="cell-actions">
        <button class="btn-text" onclick="adminReset(${u.id})">Restablecer clave</button>
        <button class="btn-text" onclick="adminToggle(${u.id}, ${u.activo ? 'false' : 'true'})">${u.activo ? 'Desactivar' : 'Activar'}</button>
      </div></td>
    </tr>`).join('');
}

function renderAdminStudents() {
  const q = document.getElementById('admin-student-search').value.toLowerCase();
  const list = adminStudents.filter(s => !q || s.nombre.toLowerCase().includes(q) || (s.ci || '').toLowerCase().includes(q) || s.curso.toLowerCase().includes(q));
  const tbody = document.getElementById('admin-students-body');
  tbody.innerHTML = list.length
    ? list.map(s => `<tr><td class="cell-id">${esc(s.ci) || '—'}</td><td>${esc(s.nombre)}</td><td>${esc(s.curso)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="empty-state">No hay alumnos cargados. Usa "Importar alumnos (CSV)".</td></tr>';
  document.getElementById('admin-students-count').textContent = adminStudents.length + ' alumnos en total.';
}

async function adminToggle(id, activar) {
  const r = await postJSON('admin_usuario_estado.php', { id, accion: activar ? 'activar' : 'desactivar' });
  if (!r.success) { showToast(r.error || 'No se pudo cambiar el estado', 'info'); return; }
  await loadAdminUsers();
  showToast(activar ? 'Usuario activado' : 'Usuario desactivado', 'info');
}

async function adminReset(id) {
  if (!confirm('¿Generar una contraseña temporal nueva para este usuario?')) return;
  const r = await postJSON('admin_usuario_estado.php', { id, accion: 'reset_password' });
  if (!r.success) { showToast(r.error || 'No se pudo restablecer', 'info'); return; }
  showCredential(r.credencial, 'Contraseña restablecida');
  await loadAdminUsers();
}

function showCredential(c, title) {
  lastCredText = 'Usuario: ' + c.usuario + '\nContraseña temporal: ' + c.password;
  document.getElementById('cred-title').textContent = title;
  document.getElementById('cred-box').innerHTML = 'Usuario: <strong>' + esc(c.usuario) + '</strong><br>Contraseña: <strong>' + esc(c.password) + '</strong>';
  document.getElementById('cred-modal').classList.remove('hidden');
}

function copyCred() {
  if (navigator.clipboard) navigator.clipboard.writeText(lastCredText).then(() => showToast('Copiado', 'success'));
}

function openUserModal() {
  ['nu-nombre', 'nu-usuario', 'nu-pass', 'nu-cis'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('nu-rol').value = 'docente';
  document.getElementById('nu-error').classList.add('hidden');
  toggleUserCis();
  document.getElementById('user-modal').classList.remove('hidden');
}

function toggleUserCis() {
  const rol = document.getElementById('nu-rol').value;
  document.getElementById('nu-cis-wrap').classList.toggle('hidden', rol !== 'alumno' && rol !== 'padre');
  document.getElementById('nu-cis-label').textContent = rol === 'padre' ? 'CI de sus hijos/as (separados por espacio)' : 'CI del alumno';
}

async function saveUserForm(event) {
  event.preventDefault();
  const err = document.getElementById('nu-error');
  err.classList.add('hidden');
  const r = await postJSON('admin_usuario_guardar.php', {
    rol: document.getElementById('nu-rol').value,
    nombre: document.getElementById('nu-nombre').value,
    usuario: document.getElementById('nu-usuario').value,
    password: document.getElementById('nu-pass').value,
    cis: document.getElementById('nu-cis').value
  });
  if (!r.success) { err.textContent = r.error || 'No se pudo crear el usuario.'; err.classList.remove('hidden'); return; }
  closeModal('user-modal');
  showCredential(r.credencial, 'Usuario creado');
  await loadAdminUsers();
}

/* ---- Importación CSV ---- */
const IMPORT_INFO = {
  estudiantes: {
    title: 'Importar alumnos',
    help: 'Columnas: ci ; nombre ; curso. Si el CI ya existe se actualiza; los cursos que no existan se crean solos. Sirve el CSV que genera Excel (separado por coma o punto y coma).',
    endpoint: 'admin_importar_estudiantes.php',
    template: 'ci;nombre;curso\n1234567;Juan Pérez Rojas;3° Sec. A\n7654321;Ana Torres Vaca;3° Sec. A\n'
  },
  usuarios: {
    title: 'Importar usuarios',
    help: 'Columnas: usuario ; nombre ; rol ; ci_estudiante. Rol: docente, padre o alumno. Para alumno/padre el usuario puede ir vacío (se usa el CI). Un apoderado con varios hijos: CI separados por espacio. Se generan contraseñas temporales que podrás descargar UNA sola vez.',
    endpoint: 'admin_importar_usuarios.php',
    template: 'usuario;nombre;rol;ci_estudiante\nprof.lopez;Lic. Ana López;docente;\n;Juan Pérez Rojas;alumno;1234567\n;María Rojas (madre de Juan);padre;1234567\n'
  }
};

function openImportModal(kind) {
  importKind = kind; lastCreds = [];
  document.getElementById('import-title').textContent = IMPORT_INFO[kind].title;
  document.getElementById('import-help').textContent = IMPORT_INFO[kind].help;
  document.getElementById('import-file').value = '';
  document.getElementById('import-result').innerHTML = '';
  document.getElementById('import-download').classList.add('hidden');
  document.getElementById('import-modal').classList.remove('hidden');
}

function downloadTemplate() {
  downloadFile('\ufeff' + IMPORT_INFO[importKind].template, 'plantilla_' + importKind + '.csv', 'text/csv;charset=utf-8');
}

/** Lee el archivo; si no es UTF-8 válido (Excel antiguo) lo interpreta como Windows-1252. */
async function readCsvFile(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch (e) { return new TextDecoder('windows-1252').decode(buf); }
}

async function runImport() {
  const file = document.getElementById('import-file').files[0];
  const out = document.getElementById('import-result');
  if (!file) { out.innerHTML = '<span class="note note--warn">Elige primero un archivo CSV.</span>'; return; }
  const btn = document.getElementById('import-run');
  btn.disabled = true;
  out.textContent = 'Importando...';
  try {
    const r = await postJSON(IMPORT_INFO[importKind].endpoint, { csv: await readCsvFile(file) });
    if (!r.success) { out.innerHTML = '<span class="note note--warn">' + esc(r.error || 'No se pudo importar.') + '</span>'; return; }
    const errs = (r.errores || []).length ? '<ul>' + r.errores.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>' : '';
    if (importKind === 'estudiantes') {
      out.innerHTML = '<strong>Listo:</strong> ' + r.nuevos + ' nuevos, ' + r.actualizados + ' actualizados.' + (errs ? '<br>Filas con problemas:' + errs : '');
      await Promise.all([loadAdminStudents(), loadCourses().catch(() => {})]);
    } else {
      lastCreds = r.creadas || [];
      let tabla = '';
      if (lastCreds.length) {
        tabla = '<table class="mini-table"><thead><tr><th>Usuario</th><th>Nombre</th><th>Perfil</th><th>Contraseña temporal</th></tr></thead><tbody>' +
          lastCreds.map(c => '<tr><td>' + esc(c.usuario) + '</td><td>' + esc(c.nombre) + '</td><td>' + esc(c.rol) + '</td><td><strong>' + esc(c.password) + '</strong></td></tr>').join('') + '</tbody></table>' +
          '<p class="note note--warn">Descarga las credenciales ahora: no se vuelven a mostrar.</p>';
        document.getElementById('import-download').classList.remove('hidden');
      }
      out.innerHTML = '<strong>Listo:</strong> ' + lastCreds.length + ' usuarios creados.' + tabla + (errs ? '<br>Filas con problemas:' + errs : '');
      await loadAdminUsers();
    }
  } catch (e) {
    out.innerHTML = '<span class="note note--warn">No se pudo leer o enviar el archivo.</span>';
  } finally {
    btn.disabled = false;
  }
}

function downloadCreds() {
  const rows = lastCreds.map(c => [c.usuario, c.nombre, c.rol, c.password].map(csvCell).join(','));
  downloadFile('\ufeff' + 'Usuario,Nombre,Perfil,Contrasena temporal\n' + rows.join('\n'), 'credenciales_educontrol.csv', 'text/csv;charset=utf-8');
}

/* ============================================================
   7. UTILIDADES (modales, toasts, tema)
   ============================================================ */
function closeModal(id) {
  if (id === 'password-modal' && passwordForced) return;
  document.getElementById(id).classList.add('hidden');
}

function showToast(message, type) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast--${type === 'success' ? 'success' : 'info'}`;
  el.innerHTML = `${type === 'success' ? ICONS.checkCircle : ICONS.clock} ${esc(message)}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function toggleDarkMode() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('educontrol_theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}

/* ============================================================
   8. INICIO
   ============================================================ */
(function init() {
  if (localStorage.getItem('educontrol_theme') === 'dark') document.documentElement.classList.add('dark');
  restoreSession();
})();
