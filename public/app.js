const STORAGE_KEY = 'eisenhower_tasks_v1';
const SETTINGS_KEY = 'eisenhower_settings_v1';

const quadrantMeta = {
  Q1: '중요+긴급',
  Q2: '중요+비긴급',
  Q3: '비중요+긴급',
  Q4: '비중요+비긴급'
};

const quadrantDotColors = {
  Q1: '#2dd4bf',
  Q2: '#818cf8',
  Q3: '#f87171',
  Q4: '#f43f5e'
};

let tasks = load(STORAGE_KEY, []);
const defaultSettings = {
  hideCompletedTasks: false,
  appTitle: '🤢 군생활 플래너',
  quadrantLabels: { ...quadrantMeta }
};

let settings = normalizeSettings(load(SETTINGS_KEY, defaultSettings));
const timers = new Map();

const quadrantsEl = document.getElementById('quadrants');
const taskDialog = document.getElementById('task-dialog');
const settingsDialog = document.getElementById('settings-dialog');
const form = document.getElementById('task-form');
const statusEl = document.getElementById('status');

const showToast = (msg) => {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { el.style.display = 'none'; }, 1600);
};

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}


function normalizeSettings(raw) {
  const source = raw || {};
  return {
    hideCompletedTasks: !!source.hideCompletedTasks,
    appTitle: (source.appTitle || defaultSettings.appTitle).trim() || defaultSettings.appTitle,
    quadrantLabels: {
      Q1: source.quadrantLabels?.Q1?.trim() || quadrantMeta.Q1,
      Q2: source.quadrantLabels?.Q2?.trim() || quadrantMeta.Q2,
      Q3: source.quadrantLabels?.Q3?.trim() || quadrantMeta.Q3,
      Q4: source.quadrantLabels?.Q4?.trim() || quadrantMeta.Q4
    }
  };
}

function getQuadrantLabel(code) {
  return settings.quadrantLabels?.[code] || quadrantMeta[code];
}

function syncLabelsToUI() {
  const titleEl = document.getElementById('app-title-display');
  if (titleEl) titleEl.textContent = settings.appTitle;

  const select = document.getElementById('quadrant');
  if (!select) return;
  [...select.options].forEach((option) => {
    const code = option.value;
    if (quadrantMeta[code]) option.textContent = `${code} ${getQuadrantLabel(code)}`;
  });
}

  modeBtn.textContent = isEditMode ? '✓' : '‹';
  modeBtn.setAttribute('aria-label', isEditMode ? '보기 모드로 전환' : '편집 모드로 전환');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function nowIso() { return new Date().toISOString(); }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()); }

function getNotificationEligibility(task) {
  return task.notificationEnabled && task.date && task.time;
}

function requestNotificationPermissionIfNeeded() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission();
}

function scheduleNotification(task) {
  if (!('Notification' in window)) return;
  clearNotification(task.id);
  if (!getNotificationEligibility(task)) return;
  if (Notification.permission !== 'granted') return;

  const when = new Date(`${task.date}T${task.time}:00`).getTime();
  const delay = when - Date.now();
  if (delay <= 0 || delay > 2147483647) return;

  const id = setTimeout(() => {
    new Notification(`할 일 알림: ${task.title}`, { body: task.description || '일정 시간이 되었습니다.' });
  }, delay);
  timers.set(task.id, id);
}

function clearNotification(taskId) {
  if (timers.has(taskId)) {
    clearTimeout(timers.get(taskId));
    timers.delete(taskId);
  }
}

function repeatText(task) {
  if (task.repeatType === 'weekly') return `매주 (${(task.repeatDaysOfWeek || []).join(',')})`;
  if (task.repeatType === 'monthly') return `매월 ${task.repeatDayOfMonth || '-'}일`;
  return ({ none: '반복없음', daily: '매일' })[task.repeatType] || '반복없음';
}

function sortTasks(list) {
  return [...list].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    if (!!a.date !== !!b.date) return a.date ? -1 : 1;
    const ad = new Date(`${a.date || '9999-12-31'}T${a.time || '23:59'}:00`).getTime();
    const bd = new Date(`${b.date || '9999-12-31'}T${b.time || '23:59'}:00`).getTime();
    if (ad !== bd) return ad - bd;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function render() {
  const visible = settings.hideCompletedTasks ? tasks.filter((t) => !t.isCompleted) : tasks;
  quadrantsEl.innerHTML = '';

  Object.entries(quadrantMeta).forEach(([code]) => {
    const label = getQuadrantLabel(code);
    const section = document.createElement('section');
    section.className = 'quadrant';
    section.innerHTML = `
      <div class="quadrant-head">
        <div class="quadrant-title">
          <span class="quadrant-dot" style="background:${quadrantDotColors[code]}"></span>
          <h2>${label}</h2>
        </div>
        <button class="icon-btn" data-action="quick-add" data-quadrant="${code}" aria-label="${label}에 일정 추가">+</button>
      </div>
    `;

    const list = sortTasks(visible.filter((t) => t.quadrant === code));
    if (list.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = '일정 없음';
      section.appendChild(empty);
    }

    list.forEach((task) => {
      const card = document.createElement('article');
      card.className = `task-card ${task.isCompleted ? 'completed' : ''}`;
      const subDone = task.subtasks.filter((s) => s.isCompleted).length;
      card.innerHTML = `
        <div class="task-head">
          <input type="checkbox" ${task.isCompleted ? 'checked' : ''} data-action="toggle" data-id="${task.id}" />
          <span class="task-title">${escapeHtml(task.title)}</span>
          <button data-action="edit" data-id="${task.id}" class="edit-btn">수정</button>
        </div>
        ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
        <p class="task-meta">${task.date || '날짜없음'} ${task.time || ''} · ${repeatText(task)} · 체크리스트 ${subDone}/${task.subtasks.length}</p>
        ${task.subtasks.length ? `<ul class="subtask-list">${task.subtasks.map((s)=>`<li style="text-decoration:${s.isCompleted?'line-through':'none'}">${escapeHtml(s.text)}</li>`).join('')}</ul>` : ''}
      `;
      section.appendChild(card);
    });

    quadrantsEl.appendChild(section);
  });

  statusEl.textContent = `전체 ${tasks.length}개 · 완료 ${tasks.filter((t) => t.isCompleted).length}개 · 진행중 ${tasks.filter((t) => !t.isCompleted).length}개`;
}

function escapeHtml(str) {
  return str.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function openTaskDialog(task, presetQuadrant) {
  form.reset();
  document.getElementById('subtask-editor').innerHTML = '';
  document.getElementById('weekly-days').innerHTML = '';
  ['일','월','화','수','목','금','토'].forEach((d, i) => {
    const id = `day-${i}`;
    const row = document.createElement('label');
    row.className = 'row';
    row.innerHTML = `<input type="checkbox" value="${i}" id="${id}" />${d}`;
    document.getElementById('weekly-days').appendChild(row);
  });

  const editing = !!task;
  document.getElementById('form-title').textContent = editing ? '일정 수정' : '일정 추가';
  document.getElementById('btn-delete').style.display = editing ? 'inline-block' : 'none';

  if (editing) {
    document.getElementById('task-id').value = task.id;
    document.getElementById('title').value = task.title;
    document.getElementById('description').value = task.description || '';
    document.getElementById('quadrant').value = task.quadrant;
    document.getElementById('date').value = task.date || '';
    document.getElementById('time').value = task.time || '';
    document.getElementById('repeatType').value = task.repeatType;
    document.getElementById('monthly-day').value = task.repeatDayOfMonth || '';
    document.getElementById('notificationEnabled').checked = task.notificationEnabled;
    (task.repeatDaysOfWeek || []).forEach((d) => {
      const el = document.querySelector(`#weekly-days input[value="${d}"]`);
      if (el) el.checked = true;
    });
    task.subtasks.forEach(addSubtaskInput);
  } else if (presetQuadrant) {
    document.getElementById('quadrant').value = presetQuadrant;
  }

  updateRepeatVisibility();
  taskDialog.showModal();
}

function addSubtaskInput(subtask) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `
    <input type="checkbox" ${subtask?.isCompleted ? 'checked' : ''} />
    <input type="text" placeholder="세부 항목" value="${escapeHtml(subtask?.text || '')}" />
    <button type="button" class="danger">삭제</button>
  `;
  row.querySelector('button').addEventListener('click', () => row.remove());
  document.getElementById('subtask-editor').appendChild(row);
}

function updateRepeatVisibility() {
  const repeatType = document.getElementById('repeatType').value;
  document.getElementById('weekly-wrap').style.display = repeatType === 'weekly' ? 'block' : 'none';
  document.getElementById('monthly-wrap').style.display = repeatType === 'monthly' ? 'block' : 'none';
}

function collectSubtasks() {
  return [...document.querySelectorAll('#subtask-editor .row')]
    .map((row) => {
      const [check, text] = row.querySelectorAll('input');
      return {
        id: uid(),
        text: text.value.trim(),
        isCompleted: check.checked,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
    })
    .filter((s) => s.text);
}

function validateForm(task) {
  if (!task.title.trim()) return '제목을 입력해주세요.';
  if (task.repeatType === 'weekly' && task.repeatDaysOfWeek.length === 0) return '반복할 요일을 1개 이상 선택해주세요.';
  if (task.repeatType === 'monthly' && !(task.repeatDayOfMonth >= 1 && task.repeatDayOfMonth <= 31)) return '반복할 날짜를 선택해주세요.';
  if (task.notificationEnabled && !(task.date && task.time)) {
    task.notificationEnabled = false;
    showToast('알림은 날짜와 시간이 모두 필요하여 자동 OFF 되었습니다.');
  }
  return null;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const repeatType = document.getElementById('repeatType').value;
  const task = {
    id: id || uid(),
    title: document.getElementById('title').value.trim(),
    description: document.getElementById('description').value.trim(),
    quadrant: document.getElementById('quadrant').value,
    date: document.getElementById('date').value || undefined,
    time: document.getElementById('time').value || undefined,
    isCompleted: false,
    completedAt: null,
    notificationEnabled: document.getElementById('notificationEnabled').checked,
    repeatType,
    repeatDaysOfWeek: repeatType === 'weekly' ? [...document.querySelectorAll('#weekly-days input:checked')].map((el) => Number(el.value)) : [],
    repeatDayOfMonth: repeatType === 'monthly' ? Number(document.getElementById('monthly-day').value) : undefined,
    subtasks: collectSubtasks(),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  const existing = tasks.find((t) => t.id === task.id);
  if (existing) {
    task.isCompleted = existing.isCompleted;
    task.completedAt = existing.completedAt;
    task.createdAt = existing.createdAt;
  }

  const error = validateForm(task);
  if (error) return showToast(error);

  tasks = tasks.filter((t) => t.id !== task.id).concat(task);
  saveAll();
  scheduleNotification(task);
  render();
  taskDialog.close();
});

document.getElementById('btn-add').addEventListener('click', () => openTaskDialog());
document.getElementById('btn-cancel').addEventListener('click', () => taskDialog.close());
document.getElementById('btn-delete').addEventListener('click', () => {
  const id = document.getElementById('task-id').value;
  tasks = tasks.filter((t) => t.id !== id);
  clearNotification(id);
  saveAll();
  render();
  taskDialog.close();
});
document.getElementById('btn-add-subtask').addEventListener('click', () => addSubtaskInput());
document.getElementById('repeatType').addEventListener('change', updateRepeatVisibility);

document.getElementById('btn-settings').addEventListener('click', () => {
  document.getElementById('hideCompletedTasks').checked = settings.hideCompletedTasks;
  document.getElementById('appTitleInput').value = settings.appTitle;
  document.getElementById('labelQ1').value = getQuadrantLabel('Q1');
  document.getElementById('labelQ2').value = getQuadrantLabel('Q2');
  document.getElementById('labelQ3').value = getQuadrantLabel('Q3');
  document.getElementById('labelQ4').value = getQuadrantLabel('Q4');
  document.getElementById('permission-status').textContent = `알림 권한 상태: ${('Notification' in window) ? Notification.permission : '지원 안 함'}`;
  settingsDialog.showModal();
});

document.getElementById('btn-close-settings').addEventListener('click', (e) => {
  e.preventDefault();
  settings.hideCompletedTasks = document.getElementById('hideCompletedTasks').checked;
  settings.appTitle = document.getElementById('appTitleInput').value.trim() || defaultSettings.appTitle;
  settings.quadrantLabels = {
    Q1: document.getElementById('labelQ1').value.trim() || quadrantMeta.Q1,
    Q2: document.getElementById('labelQ2').value.trim() || quadrantMeta.Q2,
    Q3: document.getElementById('labelQ3').value.trim() || quadrantMeta.Q3,
    Q4: document.getElementById('labelQ4').value.trim() || quadrantMeta.Q4
  };
  syncLabelsToUI();
  saveAll();
  render();
  settingsDialog.close();
});

quadrantsEl.addEventListener('click', (e) => {
  const target = e.target;
  if (target.dataset.action === 'quick-add') {
    openTaskDialog(null, target.dataset.quadrant);
    return;
  }
  const id = target.dataset.id;
  const action = target.dataset.action;
  if (!id || !action) return;
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  if (action === 'edit') openTaskDialog(task);
});

quadrantsEl.addEventListener('change', (e) => {
  const target = e.target;
  if (target.dataset.action !== 'toggle') return;
  const id = target.dataset.id;
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.isCompleted = target.checked;
  task.completedAt = target.checked ? nowIso() : null;
  task.updatedAt = nowIso();
  if (task.isCompleted) {
    clearNotification(task.id);
    if (settings.hideCompletedTasks) showToast('일정이 완료되어 숨김 처리되었습니다.');
  } else {
    scheduleNotification(task);
  }
  saveAll();
  render();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    statusEl.textContent = 'Service Worker 등록 실패';
  });
}

syncLabelsToUI();
requestNotificationPermissionIfNeeded();
tasks.forEach(scheduleNotification);
render();
