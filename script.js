const STORAGE_KEY = 'todo_tasks_v2';
const LEGACY_STORAGE_KEY = 'todo_tasks_v1';

const els = {
  form: document.getElementById('task-form'),
  input: document.getElementById('task-input'),
  category: document.getElementById('task-category'),
  subcategory: document.getElementById('task-subcategory'),
  timer: document.getElementById('task-timer'),
  pendingList: document.getElementById('pending-list'),
  completedList: document.getElementById('completed-list'),
  loginBtn: document.getElementById('login-btn'),
  loginModal: document.getElementById('login-modal'),
  loginClose: document.getElementById('login-close'),
  loginForm: document.getElementById('login-form'),
  loginBackdrop: document.getElementById('login-backdrop'),
  showSignup: document.getElementById('show-signup'),
  showLogin: document.getElementById('show-login'),
  signupModal: document.getElementById('signup-modal'),
  signupClose: document.getElementById('signup-close'),
  signupForm: document.getElementById('signup-form'),
  signupBackdrop: document.getElementById('signup-backdrop'),
};

let tasks = [];
let editingTaskId = null;
let lastFocusedElement = null;
let countdownIntervalId = null;

const authModals = {
  login: {
    modal: els.loginModal,
    form: els.loginForm,
    initialInputId: 'login-email',
  },
  signup: {
    modal: els.signupModal,
    form: els.signupForm,
    initialInputId: 'signup-name',
  },
};

const CATEGORY_OPTIONS = {
  work: {
    label: 'Work',
    logo: 'W',
    subcategories: ['Meeting', 'Project', 'Email', 'Research', 'Deadline'],
  },
  exercise: {
    label: 'Exercise',
    logo: 'EX',
    subcategories: ['Cardio', 'Strength', 'Yoga', 'Stretching', 'Walk'],
  },
  athletic: {
    label: 'Athletic',
    logo: 'AT',
    subcategories: ['Running', 'Cycling', 'Swimming', 'Football', 'Basketball'],
  },
};

function createId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getClockParts(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours,
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
}

function nextFrame(callback) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTasks(nextTasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
}

function setTasks(nextTasks) {
  tasks = Array.isArray(nextTasks)
    ? nextTasks.map((task) => ({
        id: task.id || createId(),
        text: String(task.text || '').trim(),
        createdAt: task.createdAt || Date.now(),
        completed: Boolean(task.completed),
        completedAt: task.completedAt || null,
        dueAt: task.dueAt || null,
        timeLimitMs: task.timeLimitMs || null,
        category: task.category || '',
        subcategory: task.subcategory || '',
      }))
    : [];
}

function getTasks() {
  return tasks;
}

function addTask(text, timeLimitMs = null, category = '', subcategory = '') {
  const createdAt = Date.now();
  const task = {
    id: createId(),
    text: text.trim(),
    createdAt,
    completed: false,
    completedAt: null,
    dueAt: timeLimitMs ? createdAt + timeLimitMs : null,
    timeLimitMs,
    category,
    subcategory,
  };

  tasks = [task, ...tasks];
  return task;
}

function toggleTask(id) {
  tasks = tasks.map((task) => {
    if (task.id !== id) return task;

    const completed = !task.completed;
    return {
      ...task,
      completed,
      completedAt: completed ? Date.now() : null,
    };
  });
}

function deleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  if (editingTaskId === id) {
    editingTaskId = null;
  }
}

function updateTask(id, text) {
  const value = text.trim();
  if (!value) return false;

  tasks = tasks.map((task) => {
    if (task.id !== id) return task;
    return { ...task, text: value };
  });

  return true;
}

function createEmptyState(label) {
  const li = document.createElement('li');
  li.className = 'empty';
  li.textContent = label;
  return li;
}

function createTextBlock(task) {
  const wrapper = document.createElement('div');
  wrapper.className = 'task-copy';

  const text = document.createElement('span');
  text.className = 'task-text';
  text.textContent = task.text;

  const meta = document.createElement('small');
  meta.className = 'meta';
  meta.textContent =
    `Added: ${formatDate(task.createdAt)}` +
    (task.completed ? ` - Completed: ${formatDate(task.completedAt)}` : '');

  const timer = createTimerBadge(task);
  const category = createCategoryBadge(task);

  wrapper.appendChild(text);
  if (category) {
    wrapper.appendChild(category);
  }
  wrapper.appendChild(meta);
  if (timer) {
    wrapper.appendChild(timer);
  }
  return wrapper;
}

function createCategoryBadge(task) {
  if (!task.category || !CATEGORY_OPTIONS[task.category]) return null;

  const category = CATEGORY_OPTIONS[task.category];
  const badge = document.createElement('span');
  badge.className = `category-badge ${task.category}`;

  const logo = document.createElement('span');
  logo.className = 'category-logo';
  logo.textContent = category.logo;

  const label = document.createElement('span');
  label.textContent = task.subcategory
    ? `${category.label} / ${task.subcategory}`
    : category.label;

  badge.appendChild(logo);
  badge.appendChild(label);
  return badge;
}

function createTimerBadge(task) {
  if (!task.dueAt) return null;

  const timer = document.createElement('small');
  timer.dataset.taskId = task.id;
  updateTimerBadge(timer, task);

  return timer;
}

function updateTimerBadge(timer, task) {
  const remainingMs = task.dueAt - Date.now();
  const isExpired = remainingMs <= 0 && !task.completed;
  const clock = getClockParts(remainingMs);
  const clockText = clock.hours > 0
    ? `${clock.hours}:${clock.minutes}:${clock.seconds}`
    : `${clock.minutes}:${clock.seconds}`;

  timer.className = `task-timer${isExpired ? ' expired' : ''}${task.completed ? ' complete' : ''}`;
  if (task.completed) {
    timer.innerHTML = `<span class="mini-clock" aria-hidden="true">${clockText}</span><span>Timer was ${formatDuration(task.timeLimitMs || 0)}</span>`;
  } else if (isExpired) {
    timer.innerHTML = '<span class="mini-clock" aria-hidden="true">00:00</span><span>Expired</span>';
  } else {
    timer.innerHTML = `<span class="mini-clock" aria-hidden="true">${clockText}</span><span>Time left: ${formatDuration(remainingMs)}</span>`;
  }
}

function createStaticTaskItem(task, index) {
  const li = document.createElement('li');
  const isExpired = task.dueAt && task.dueAt <= Date.now() && !task.completed;
  li.className = `task-item${task.completed ? ' done' : ''}${isExpired ? ' overdue' : ''}`;
  li.style.setProperty('--stagger', `${index * 45}ms`);
  li.classList.add('is-entering');

  const left = document.createElement('div');
  left.className = 'task-left';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.completed;
  checkbox.setAttribute('aria-label', task.completed ? 'Mark task as pending' : 'Mark task as complete');
  checkbox.addEventListener('change', () => handleToggleTask(task.id));

  left.appendChild(checkbox);
  left.appendChild(createTextBlock(task));

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'icon-btn';
  editBtn.title = 'Edit task';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => handleEditStart(task.id));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'icon-btn danger';
  deleteBtn.title = 'Delete task';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => handleDeleteTask(task.id));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  li.appendChild(left);
  li.appendChild(actions);

  nextFrame(() => li.classList.remove('is-entering'));
  return li;
}

function createEditingTaskItem(task, index) {
  const li = document.createElement('li');
  li.className = `task-item editing${task.completed ? ' done' : ''}`;
  li.style.setProperty('--stagger', `${index * 45}ms`);
  li.classList.add('is-entering');

  const form = document.createElement('form');
  form.className = 'task-edit-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = task.text;
  input.className = 'task-edit-input';
  input.setAttribute('aria-label', 'Edit task text');

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'icon-btn primary';
  saveBtn.textContent = 'Save';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'icon-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', handleEditCancel);

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  form.appendChild(input);
  form.appendChild(actions);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleEditSave(task.id, input.value);
  });

  li.appendChild(form);

  nextFrame(() => {
    li.classList.remove('is-entering');
    input.focus();
    input.select();
  });

  return li;
}

function renderList(listElement, listTasks, emptyLabel) {
  listElement.replaceChildren();

  if (!listTasks.length) {
    listElement.appendChild(createEmptyState(emptyLabel));
    return;
  }

  const fragment = document.createDocumentFragment();
  listTasks.forEach((task, index) => {
    const item = editingTaskId === task.id
      ? createEditingTaskItem(task, index)
      : createStaticTaskItem(task, index);
    fragment.appendChild(item);
  });

  listElement.appendChild(fragment);
}

function renderTaskLists() {
  const pendingTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);

  renderList(els.pendingList, pendingTasks, 'No pending tasks');
  renderList(els.completedList, completedTasks, 'No completed tasks');
}

function rerender() {
  renderTaskLists();
}

function handleAddTask(text, timeLimitMs, category, subcategory) {
  addTask(text, timeLimitMs, category, subcategory);
  saveTasks(getTasks());
  rerender();
}

function handleToggleTask(id) {
  toggleTask(id);
  saveTasks(getTasks());
  rerender();
}

function handleDeleteTask(id) {
  deleteTask(id);
  saveTasks(getTasks());
  rerender();
}

function handleEditStart(id) {
  editingTaskId = id;
  rerender();
}

function handleEditCancel() {
  editingTaskId = null;
  rerender();
}

function handleEditSave(id, text) {
  const updated = updateTask(id, text);
  if (!updated) return;

  editingTaskId = null;
  saveTasks(getTasks());
  rerender();
}

function getOpenModal() {
  return Object.values(authModals).find(({ modal }) => modal?.getAttribute('aria-hidden') === 'false');
}

function openAuthModal(name) {
  const target = authModals[name];
  if (!target?.modal) return;

  if (!lastFocusedElement) {
    lastFocusedElement = document.activeElement;
  }

  Object.entries(authModals).forEach(([modalName, { modal }]) => {
    modal?.setAttribute('aria-hidden', modalName === name ? 'false' : 'true');
  });

  const initialInput = document.getElementById(target.initialInputId);
  if (initialInput) {
    requestAnimationFrame(() => initialInput.focus());
  }
}

function closeAuthModals() {
  Object.values(authModals).forEach(({ modal, form }) => {
    modal?.setAttribute('aria-hidden', 'true');
    form?.reset();
  });

  if (lastFocusedElement instanceof HTMLElement) {
    requestAnimationFrame(() => lastFocusedElement.focus());
  }

  lastFocusedElement = null;
}

function bindSharedCloseActions() {
  els.loginClose?.addEventListener('click', closeAuthModals);
  els.signupClose?.addEventListener('click', closeAuthModals);
  els.loginBackdrop?.addEventListener('click', closeAuthModals);
  els.signupBackdrop?.addEventListener('click', closeAuthModals);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && getOpenModal()) {
      closeAuthModals();
    }
  });
}

function bindAuthSwitching() {
  els.loginBtn?.addEventListener('click', () => openAuthModal('login'));
  els.showSignup?.addEventListener('click', () => openAuthModal('signup'));
  els.showLogin?.addEventListener('click', () => openAuthModal('login'));
}

function bindAuthForms() {
  els.loginForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const email = document.getElementById('login-email')?.value || '';
    const password = document.getElementById('login-password')?.value || '';

    console.log('Login attempt:', { email, password: password ? '******' : '' });
    alert(`Signed in (demo): ${email}`);
    closeAuthModals();
  });

  els.signupForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const name = document.getElementById('signup-name')?.value || '';
    const email = document.getElementById('signup-email')?.value || '';
    const age = document.getElementById('signup-age')?.value || '';
    const password = document.getElementById('signup-password')?.value || '';

    console.log('Sign-up attempt:', {
      name,
      email,
      age,
      password: password ? '******' : '',
    });
    alert(`Account created (demo): ${name}`);
    closeAuthModals();
  });
}

function bindAuthModals() {
  bindAuthSwitching();
  bindSharedCloseActions();
  bindAuthForms();
}

function populateSubcategories(categoryValue) {
  const category = CATEGORY_OPTIONS[categoryValue];
  els.subcategory.replaceChildren();

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Subcategory';
  els.subcategory.appendChild(placeholder);

  if (!category) {
    els.subcategory.disabled = true;
    return;
  }

  category.subcategories.forEach((subcategory) => {
    const option = document.createElement('option');
    option.value = subcategory;
    option.textContent = subcategory;
    els.subcategory.appendChild(option);
  });

  els.subcategory.disabled = false;
}

function bindTaskCategoryControls() {
  els.category.addEventListener('change', () => {
    populateSubcategories(els.category.value);
  });
}

function startCountdown() {
  if (countdownIntervalId) {
    clearInterval(countdownIntervalId);
  }

  countdownIntervalId = setInterval(() => {
    if (editingTaskId) return;

    if (tasks.some((task) => task.dueAt && !task.completed)) {
      updateLiveTimers();
    }
  }, 1000);
}

function updateLiveTimers() {
  tasks.forEach((task) => {
    if (!task.dueAt) return;

    const timer = document.querySelector(`[data-task-id="${task.id}"]`);
    const item = timer?.closest('.task-item');
    if (!timer || !item) return;

    const isExpired = task.dueAt <= Date.now() && !task.completed;
    item.classList.toggle('overdue', isExpired);
    updateTimerBadge(timer, task);
  });
}

function bootstrap() {
  setTasks(loadTasks());
  saveTasks(getTasks());

  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = els.input.value.trim();
    if (!value) return;

    const timeLimitMs = Number(els.timer.value) || null;
    handleAddTask(value, timeLimitMs, els.category.value, els.subcategory.value);
    els.input.value = '';
    els.category.value = '';
    populateSubcategories('');
    els.timer.value = '';
    els.input.focus();
  });

  bindTaskCategoryControls();
  bindAuthModals();
  startCountdown();
  rerender();
}

bootstrap();
