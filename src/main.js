const STORAGE_KEY = 'prompverse::workspace';
const SAVE_DELAY = 700;

let appState;
const refs = {};
let saveTimeout = null;

const ROLE_LABELS = {
  system: 'Sistema',
  user: 'Usuario',
  assistant: 'Asistente',
};

document.addEventListener('DOMContentLoaded', () => {
  appState = loadInitialState();
  buildLayout();
  renderSidebar();
  renderChat();
  updateSaveIndicator('saved');
  updateLastSavedDisplay();
});

function buildLayout() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="dashboard">
      <aside class="sidebar">
        <div class="sidebar__header">
          <h1 class="sidebar__title">PrompVerse</h1>
          <p class="sidebar__subtitle">Gestiona, refina y organiza tus prompts temáticos.</p>
        </div>
        <div class="sidebar__actions">
          <button class="button button--primary" type="button" data-action="add-group">
            + Nuevo grupo
          </button>
        </div>
        <div class="prompt-list" data-group-list></div>
      </aside>
      <section class="chat-area">
        <header class="chat-header">
          <div class="chat-header__row">
            <input
              class="chat-title-input"
              data-chat-title
              type="text"
              placeholder="Título del grupo de prompts"
              autocomplete="off"
              spellcheck="false"
            />
            <div class="chat-header__actions">
              <button class="button button--ghost button--danger" type="button" data-action="delete-group">
                Eliminar
              </button>
              <span class="save-indicator" data-save-indicator data-status="saved">
                <span class="dot"></span>
                <span data-save-text>Guardado</span>
              </span>
            </div>
          </div>
          <div class="chat-meta">
            <span class="chat-meta__item" data-message-count></span>
            <span class="chat-meta__item" data-last-saved></span>
          </div>
        </header>
        <div class="chat-body" data-message-list></div>
        <form class="add-message" data-add-message>
          <strong>Agregar mensaje al prompt</strong>
          <div class="add-message__row">
            <select name="message-role" data-message-role>
              <option value="user">Usuario</option>
              <option value="assistant">Asistente</option>
              <option value="system">Sistema</option>
            </select>
            <textarea
              name="message-content"
              data-message-content
              placeholder="Describe el mensaje que deseas incorporar..."
            ></textarea>
          </div>
          <div class="add-message__row" style="justify-content: flex-end;">
            <button class="button button--primary" type="submit">Añadir mensaje</button>
          </div>
        </form>
      </section>
    </div>
  `;

  refs.groupList = app.querySelector('[data-group-list]');
  refs.addGroupButton = app.querySelector('[data-action="add-group"]');
  refs.deleteGroupButton = app.querySelector('[data-action="delete-group"]');
  refs.titleInput = app.querySelector('[data-chat-title]');
  refs.messageList = app.querySelector('[data-message-list]');
  refs.messageCount = app.querySelector('[data-message-count]');
  refs.lastSaved = app.querySelector('[data-last-saved]');
  refs.addMessageForm = app.querySelector('[data-add-message]');
  refs.newMessageRole = app.querySelector('[data-message-role]');
  refs.newMessageContent = app.querySelector('[data-message-content]');
  refs.saveIndicator = app.querySelector('[data-save-indicator]');
  refs.saveText = app.querySelector('[data-save-text]');

  refs.addGroupButton.addEventListener('click', handleAddGroup);
  refs.deleteGroupButton.addEventListener('click', handleDeleteGroup);
  refs.titleInput.addEventListener('input', handleTitleChange);
  refs.addMessageForm.addEventListener('submit', handleAddMessage);
  refs.newMessageContent.addEventListener('input', (event) => {
    autoResizeTextarea(event.target);
  });
}

function renderSidebar() {
  if (!refs.groupList) return;
  refs.groupList.innerHTML = '';

  if (!appState.groups.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <h3>No hay grupos creados</h3>
      <p>Comienza añadiendo un grupo de prompts para organizar tus ideas.</p>
    `;
    refs.groupList.appendChild(empty);
    return;
  }

  appState.groups.forEach((group) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `prompt-card${group.id === appState.selectedGroupId ? ' is-active' : ''}`;

    const title = document.createElement('h3');
    title.className = 'prompt-card__title';
    title.textContent = group.title || 'Sin título';
    card.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'prompt-card__meta';

    const messagesMeta = document.createElement('span');
    messagesMeta.innerHTML = `${createIcon('message-circle')} ${group.messages.length} mensajes`;

    const updatedMeta = document.createElement('span');
    updatedMeta.innerHTML = `${createIcon('clock')} ${formatRelativeTime(group.updatedAt || group.createdAt)}`;

    meta.appendChild(messagesMeta);
    meta.appendChild(updatedMeta);
    card.appendChild(meta);

    card.addEventListener('click', () => {
      appState.selectedGroupId = group.id;
      renderSidebar();
      renderChat();
      scheduleSave();
    });

    refs.groupList.appendChild(card);
  });
}

function renderChat() {
  const group = getSelectedGroup();

  if (!group) {
    refs.titleInput.value = '';
    refs.titleInput.disabled = true;
    refs.deleteGroupButton.disabled = true;
    refs.deleteGroupButton.classList.add('is-hidden');
    refs.addMessageForm.classList.add('is-hidden');
    refs.messageList.innerHTML = '';

    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <h3>Selecciona o crea un grupo</h3>
      <p>Podrás redactar el contexto del prompt como una conversación y se guardará automáticamente.</p>
    `;
    refs.messageList.appendChild(empty);
    refs.messageCount.textContent = 'Sin mensajes';
    return;
  }

  refs.titleInput.disabled = false;
  refs.titleInput.value = group.title;
  refs.deleteGroupButton.disabled = false;
  refs.deleteGroupButton.classList.remove('is-hidden');
  refs.addMessageForm.classList.remove('is-hidden');

  renderMessages(group);
  updateMessageMeta(group);
}

function renderMessages(group) {
  refs.messageList.innerHTML = '';

  if (!group.messages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <h3>No hay mensajes todavía</h3>
      <p>Añade mensajes del sistema, usuario o asistente para construir tu prompt.</p>
    `;
    refs.messageList.appendChild(empty);
    return;
  }

  group.messages.forEach((message) => {
    const messageWrapper = document.createElement('article');
    messageWrapper.className = `message message--${message.role}`;

    const header = document.createElement('div');
    header.className = 'message__header';

    const role = document.createElement('span');
    role.className = 'message__role';
    role.textContent = ROLE_LABELS[message.role] || 'Mensaje';
    header.appendChild(role);

    const actions = document.createElement('div');
    actions.className = 'message__actions';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.innerHTML = `${createIcon('trash')} Eliminar`;
    deleteButton.addEventListener('click', () => {
      group.messages = group.messages.filter((item) => item.id !== message.id);
      markGroupAsUpdated(group);
      renderMessages(group);
      updateMessageMeta(group);
      scheduleSave();
    });
    actions.appendChild(deleteButton);

    header.appendChild(actions);
    messageWrapper.appendChild(header);

    const textarea = document.createElement('textarea');
    textarea.value = message.content;
    textarea.placeholder = 'Escribe el contenido de este mensaje...';
    textarea.addEventListener('input', (event) => {
      message.content = event.target.value;
      markGroupAsUpdated(group);
      autoResizeTextarea(event.target);
      scheduleSave();
    });
    autoResizeTextarea(textarea);
    messageWrapper.appendChild(textarea);

    refs.messageList.appendChild(messageWrapper);
  });
}

function updateMessageMeta(group) {
  const total = group.messages.length;
  const messageLabel = total === 1 ? 'mensaje' : 'mensajes';
  refs.messageCount.textContent = `${total} ${messageLabel} en este prompt`;
}

function handleAddGroup() {
  const newGroup = createDefaultGroup();
  appState.groups.unshift(newGroup);
  appState.selectedGroupId = newGroup.id;
  renderSidebar();
  renderChat();
  scheduleSave();
}

function handleDeleteGroup() {
  const group = getSelectedGroup();
  if (!group) return;

  const confirmation = window.confirm(
    `¿Seguro que deseas eliminar "${group.title || 'este grupo'}"? Esta acción no se puede deshacer.`
  );

  if (!confirmation) return;

  appState.groups = appState.groups.filter((item) => item.id !== group.id);
  if (appState.groups.length) {
    appState.selectedGroupId = appState.groups[0].id;
  } else {
    appState.selectedGroupId = null;
  }
  renderSidebar();
  renderChat();
  scheduleSave();
}

function handleTitleChange(event) {
  const group = getSelectedGroup();
  if (!group) return;
  group.title = event.target.value;
  markGroupAsUpdated(group);
  renderSidebar();
  scheduleSave();
}

function handleAddMessage(event) {
  event.preventDefault();
  const group = getSelectedGroup();
  if (!group) return;

  const role = refs.newMessageRole.value;
  const content = refs.newMessageContent.value.trim();
  if (!content) {
    refs.newMessageContent.focus();
    return;
  }

  group.messages.push({
    id: createId('msg'),
    role,
    content,
  });

  refs.newMessageContent.value = '';
  refs.newMessageContent.style.height = '';
  markGroupAsUpdated(group);
  renderMessages(group);
  updateMessageMeta(group);
  scheduleSave();
}

function markGroupAsUpdated(group) {
  const now = new Date().toISOString();
  group.updatedAt = now;
}

function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function scheduleSave() {
  updateSaveIndicator('saving');
  if (saveTimeout) {
    window.clearTimeout(saveTimeout);
  }
  saveTimeout = window.setTimeout(() => {
    persistState();
    saveTimeout = null;
  }, SAVE_DELAY);
}

function persistState() {
  try {
    const payload = {
      groups: appState.groups,
      selectedGroupId: appState.selectedGroupId,
      lastSavedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    appState.lastSavedAt = payload.lastSavedAt;
    updateSaveIndicator('saved');
    updateLastSavedDisplay();
  } catch (error) {
    console.error('No se pudo guardar el estado de PrompVerse', error);
    updateSaveIndicator('error');
  }
}

function loadInitialState() {
  const fallback = createDefaultState();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return fallback;
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed.groups)) {
      return fallback;
    }
    return {
      groups: parsed.groups.map(normalizeGroup),
      selectedGroupId: parsed.selectedGroupId || fallback.selectedGroupId,
      lastSavedAt: parsed.lastSavedAt || fallback.lastSavedAt,
    };
  } catch (error) {
    console.warn('No se pudo cargar la información guardada, se usará el estado inicial.', error);
    return fallback;
  }
}

function normalizeGroup(group) {
  return {
    id: group.id || createId('group'),
    title: group.title || 'Nuevo grupo',
    createdAt: group.createdAt || new Date().toISOString(),
    updatedAt: group.updatedAt || group.createdAt || new Date().toISOString(),
    messages: Array.isArray(group.messages)
      ? group.messages.map((message) => ({
          id: message.id || createId('msg'),
          role: ['user', 'assistant', 'system'].includes(message.role)
            ? message.role
            : 'user',
          content: message.content || '',
        }))
      : [],
  };
}

function createDefaultState() {
  const groups = buildDefaultGroups();
  return {
    groups,
    selectedGroupId: groups.length ? groups[0].id : null,
    lastSavedAt: null,
  };
}

function buildDefaultGroups() {
  const now = new Date();
  return [
    {
      id: createId('group'),
      title: 'Estrategia de lanzamiento IA',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      messages: [
        {
          id: createId('msg'),
          role: 'system',
          content:
            'Eres un estratega de marketing especializado en lanzamientos de productos digitales potenciados por IA. Tu objetivo es ofrecer planes accionables y medibles.',
        },
        {
          id: createId('msg'),
          role: 'user',
          content:
            'Estoy preparando el lanzamiento de una plataforma SaaS que recomienda prompts personalizados. Necesito un plan de lanzamiento para las primeras 4 semanas.',
        },
        {
          id: createId('msg'),
          role: 'assistant',
          content:
            'Claro. Primero validaré el público objetivo y canales clave. Luego diseñaré mensajes diferenciadores para cada etapa, incluyendo preventa, lanzamiento y seguimiento.',
        },
      ],
    },
    {
      id: createId('group'),
      title: 'Narrativas para storytelling',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 4).toISOString(),
      messages: [
        {
          id: createId('msg'),
          role: 'system',
          content:
            'Actúa como un copywriter experto en storytelling que adapta historias de producto a diferentes plataformas y públicos.',
        },
        {
          id: createId('msg'),
          role: 'user',
          content:
            'Necesito una narrativa aspiracional para presentar una herramienta de IA que ayuda a guionistas a iterar ideas en minutos.',
        },
      ],
    },
    {
      id: createId('group'),
      title: 'Prompts para UX writing',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
      messages: [
        {
          id: createId('msg'),
          role: 'system',
          content:
            'Eres un UX writer que crea microcopys claros, empáticos y orientados a la acción para productos digitales.',
        },
        {
          id: createId('msg'),
          role: 'assistant',
          content:
            'Para cada microcopy, solicito tono, contexto y límite de caracteres. Devuelve tres variantes y recomendaciones de prueba A/B.',
        },
      ],
    },
  ];
}

function createDefaultGroup() {
  const now = new Date().toISOString();
  return {
    id: createId('group'),
    title: 'Nuevo grupo de prompts',
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: createId('msg'),
        role: 'system',
        content:
          'Describe el rol de la IA, el objetivo del prompt y los entregables esperados. Añade luego mensajes de usuario y asistente para completar el contexto.',
      },
    ],
  };
}

function getSelectedGroup() {
  if (!appState.selectedGroupId) return null;
  return appState.groups.find((group) => group.id === appState.selectedGroupId) || null;
}

function updateSaveIndicator(status) {
  if (!refs.saveIndicator || !refs.saveText) return;
  refs.saveIndicator.dataset.status = status;

  if (status === 'saving') {
    refs.saveText.textContent = 'Guardando cambios...';
  } else if (status === 'saved') {
    if (appState?.lastSavedAt) {
      refs.saveText.textContent = `Guardado ${formatRelativeTime(appState.lastSavedAt)}`;
    } else {
      refs.saveText.textContent = 'Cambios guardados';
    }
    refs.saveIndicator.dataset.status = 'saved';
  } else if (status === 'error') {
    refs.saveText.textContent = 'Error al guardar';
    refs.saveIndicator.dataset.status = 'error';
  }
}

function updateLastSavedDisplay() {
  if (!refs.lastSaved) return;
  refs.lastSaved.textContent = appState.lastSavedAt
    ? `Último guardado · ${formatExactTimestamp(appState.lastSavedAt)}`
    : 'Sin guardados todavía';
}

function formatRelativeTime(isoDate) {
  if (!isoDate) return 'Sin actividad';
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return 'Sin actividad';
  const diff = Date.now() - target.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'hace instantes';
  if (diff < hour) {
    const value = Math.max(1, Math.round(diff / minute));
    return `hace ${value} min`;
  }
  if (diff < day) {
    const value = Math.max(1, Math.round(diff / hour));
    return `hace ${value} h`;
  }
  if (diff < day * 7) {
    const value = Math.max(1, Math.round(diff / day));
    return `hace ${value} d`;
  }
  return target.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

function formatExactTimestamp(isoDate) {
  if (!isoDate) return '';
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return '';
  return `${target.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })} · ${target.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function createId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createIcon(name) {
  if (name === 'message-circle') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3h5.25M21 12a9 9 0 11-17.578 3.422c-.138.494-.206.742-.195.91.01.15.058.297.138.42.09.137.237.25.53.476C5.356 17.732 6.617 18.75 9 18.75c.684 0 1.343-.072 1.968-.208A9 9 0 0121 12z" />
      </svg>
    `;
  }
  if (name === 'clock') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    `;
  }
  if (name === 'trash') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.02-2.09 2.2v.917m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    `;
  }
  return '';
}
