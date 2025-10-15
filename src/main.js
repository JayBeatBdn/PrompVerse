// Clave usada en localStorage para persistir el workspace
const STORAGE_KEY = 'prompverse::workspace';
// Tiempo de espera (ms) antes de persistir para agrupar cambios
const SAVE_DELAY = 700;

// Estado global mantenido en memoria con todo el workspace
let appState;
// Mapa de referencias a elementos del DOM reutilizados
const refs = {};
// Temporizador empleado para los guardados diferidos
let saveTimeout = null;

// Etiquetas legibles para cada rol admitido en los mensajes
const ROLE_LABELS = {
  system: 'Sistema',
  user: 'Usuario',
  assistant: 'Asistente',
};

// Punto de entrada: inicializa la interfaz cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
  appState = loadInitialState();
  buildLayout();
  renderSidebar();
  renderChat();
  updateSaveIndicator('saved');
  updateLastSavedDisplay();
});

// Construye el esqueleto visual y captura referencias a la UI
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
            <textarea
              name="message-content"
              data-message-content
              placeholder="Describe el mensaje que deseas incorporar..."
            ></textarea>
          </div>
          <div class="add-message__attachments">
            <label class="attachment-input">
              <input type="file" data-message-attachments multiple />
              <span>Adjuntar archivos</span>
            </label>
            <span class="attachment-hint">Puedes seleccionar varios archivos</span>
          </div>
          <div class="attachment-preview-list" data-attachment-preview></div>
          <div class="add-message__row add-message__row--actions">
            <span class="add-message__hint">Ctrl + Enter para enviar</span>
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
  refs.newMessageContent = app.querySelector('[data-message-content]');
  refs.attachmentInput = app.querySelector('[data-message-attachments]');
  refs.attachmentPreview = app.querySelector('[data-attachment-preview]');
  refs.saveIndicator = app.querySelector('[data-save-indicator]');
  refs.saveText = app.querySelector('[data-save-text]');
  refs.pendingAttachments = [];

  refs.addGroupButton.addEventListener('click', handleAddGroup);
  refs.deleteGroupButton.addEventListener('click', handleDeleteGroup);
  refs.titleInput.addEventListener('input', handleTitleChange);
  refs.addMessageForm.addEventListener('submit', handleAddMessage);
  refs.newMessageContent.addEventListener('input', (event) => {
    autoResizeTextarea(event.target);
  });
  refs.newMessageContent.addEventListener('keydown', handleComposerKeyDown);
  if (refs.attachmentInput) {
    refs.attachmentInput.addEventListener('change', handleAttachmentSelection);
  }
  renderPendingAttachmentPreview();
}

// Renderiza la lista de grupos en la barra lateral
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

// Actualiza el panel principal según el grupo seleccionado
function renderChat() {
  const group = getSelectedGroup();

  clearPendingAttachments();
  if (refs.newMessageContent) {
    refs.newMessageContent.value = '';
    refs.newMessageContent.style.height = '';
    autoResizeTextarea(refs.newMessageContent);
  }

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

// Pinta cada mensaje del grupo activo dentro del chat

function renderMessages(group) {
  refs.messageList.innerHTML = '';

  if (!group.messages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <h3>No hay mensajes todavía</h3>
      <p>Redacta un mensaje del usuario y agrega adjuntos si lo necesitas.</p>
    `;
    refs.messageList.appendChild(empty);
    return;
  }

  group.messages.forEach((message) => {
    if (!Array.isArray(message.attachments)) {
      message.attachments = [];
    }

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
    let textareaRef = null;

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.innerHTML = createIcon('copy') + ' Copiar';
    copyButton.addEventListener('click', () => {
      const value = (textareaRef && textareaRef.value) || message.content || '';
      if (!value) return;
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(value).catch((error) => {
          console.warn('No se pudo copiar el mensaje al portapapeles', error);
        });
      } else {
        try {
          const temp = document.createElement('textarea');
          temp.value = value;
          temp.setAttribute('readonly', '');
          temp.style.position = 'absolute';
          temp.style.left = '-9999px';
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          document.body.removeChild(temp);
        } catch (error) {
          console.warn('No se pudo copiar el mensaje al portapapeles', error);
        }
      }
    });
    actions.appendChild(copyButton);

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
    textareaRef = textarea;
    textarea.value = message.content;
    textarea.placeholder = 'Escribe el contenido de este mensaje...';
    textarea.addEventListener('input', (event) => {
      message.content = event.target.value;
      markGroupAsUpdated(group);
      autoResizeTextarea(event.target);
      scheduleSave();
    });
    messageWrapper.appendChild(textarea);

    renderMessageAttachments(message, messageWrapper, group);

    refs.messageList.appendChild(messageWrapper);
    autoResizeTextarea(textarea);
  });
}


function renderMessageAttachments(message, wrapper, group) {
  if (!Array.isArray(message.attachments) || !message.attachments.length) return;

  const list = document.createElement('div');
  list.className = 'message-attachments';

  message.attachments.forEach((attachment) => {
    const item = document.createElement('div');
    item.className = 'message-attachment';

    const fileName = attachment.name || 'Archivo adjunto';
    const fileSize = typeof attachment.size === 'number' ? attachment.size : 0;
    const hasInlineData = Boolean(attachment.dataUrl);
    const isImage = Boolean(attachment.type && attachment.type.startsWith('image/'));

    if (isImage && hasInlineData) {
      const preview = document.createElement('a');
      preview.href = attachment.dataUrl;
      preview.target = '_blank';
      preview.rel = 'noopener noreferrer';
      preview.download = fileName;
      preview.className = 'message-attachment__image';

      const img = document.createElement('img');
      img.src = attachment.dataUrl;
      img.alt = fileName;
      img.loading = 'lazy';
      preview.appendChild(img);

      item.appendChild(preview);
    } else {
      const icon = document.createElement('span');
      icon.className = 'message-attachment__icon';
      icon.textContent = getFileExtension(fileName);
      item.appendChild(icon);
    }

    const details = document.createElement('div');
    details.className = 'message-attachment__details';

    const link = document.createElement('a');
    link.className = 'message-attachment__link';
    if (hasInlineData) {
      link.href = attachment.dataUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = fileName;
    } else {
      link.href = '#';
      link.setAttribute('aria-disabled', 'true');
      link.title = 'Este adjunto se almacena solo como referencia';
    }
    link.textContent = fileName;
    details.appendChild(link);

    const size = document.createElement('span');
    size.className = 'message-attachment__size';
    size.textContent = formatFileSize(fileSize);
    details.appendChild(size);

    if (!hasInlineData) {
      const note = document.createElement('span');
      note.className = 'message-attachment__note';
      note.textContent = 'Solo referencia';
      details.appendChild(note);
    }

    item.appendChild(details);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'message-attachment__remove';
    removeButton.setAttribute('aria-label', `Eliminar adjunto ${fileName}`);
    removeButton.textContent = 'Eliminar adjunto';
    removeButton.addEventListener('click', () => {
      message.attachments = message.attachments.filter((item) => item.id !== attachment.id);
      markGroupAsUpdated(group);
      renderMessages(group);
      updateMessageMeta(group);
      scheduleSave();
    });
    item.appendChild(removeButton);

    list.appendChild(item);
  });

  wrapper.appendChild(list);
}


// Refresca contadores y fechas relacionados al grupo

function updateMessageMeta(group) {
  const total = group.messages.length;
  const messageLabel = total === 1 ? 'mensaje' : 'mensajes';
  refs.messageCount.textContent = `${total} ${messageLabel} en este prompt`;
}

// Crea un nuevo grupo y cambia el foco al recién creado
function handleAddGroup() {
  const newGroup = createDefaultGroup();
  appState.groups.unshift(newGroup);
  appState.selectedGroupId = newGroup.id;
  renderSidebar();
  renderChat();
  scheduleSave();
}

// Elimina el grupo activo y reubica la selección
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

// Sincroniza el título editado con el estado del grupo
function handleTitleChange(event) {
  const group = getSelectedGroup();
  if (!group) return;
  group.title = event.target.value;
  markGroupAsUpdated(group);
  renderSidebar();
  scheduleSave();
}

// Inserta un nuevo mensaje en el grupo seleccionado
async function handleAddMessage(event) {
  event.preventDefault();
  const group = getSelectedGroup();
  if (!group) return;

  const content = refs.newMessageContent.value.trim();
  const pending = refs.pendingAttachments || [];
  if (!content && !pending.length) {
    refs.newMessageContent.focus();
    return;
  }

  let attachments = [];
  if (pending.length) {
    try {
      attachments = await Promise.all(pending.map((item) => convertFileToAttachment(item.file)));
    } catch (error) {
      console.error('No se pudieron procesar los adjuntos del mensaje', error);
      attachments = [];
    }
  }

  group.messages.push({
    id: createId('msg'),
    role: 'user',
    content,
    attachments,
  });

  refs.newMessageContent.value = '';
  refs.newMessageContent.style.height = '';
  autoResizeTextarea(refs.newMessageContent);
  clearPendingAttachments();
  markGroupAsUpdated(group);
  renderMessages(group);
  updateMessageMeta(group);
  scheduleSave();
}
function handleComposerKeyDown(event) {
  if (event.key !== 'Enter') return;
  if (!(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  if (refs.addMessageForm) {
    if (typeof refs.addMessageForm.requestSubmit === 'function') {
      refs.addMessageForm.requestSubmit();
    } else {
      refs.addMessageForm.submit();
    }
  }
}

function handleAttachmentSelection(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  if (!Array.isArray(refs.pendingAttachments)) {
    refs.pendingAttachments = [];
  }

  const newItems = files.map((file) => ({
    id: createId('att'),
    file,
    previewUrl: file.type && file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
  }));

  refs.pendingAttachments = refs.pendingAttachments.concat(newItems);
  renderPendingAttachmentPreview();
  event.target.value = '';
}

function removePendingAttachment(attachmentId) {
  if (!Array.isArray(refs.pendingAttachments) || !refs.pendingAttachments.length) return;
  const index = refs.pendingAttachments.findIndex((item) => item.id === attachmentId);
  if (index === -1) return;
  const [removed] = refs.pendingAttachments.splice(index, 1);
  if (removed && removed.previewUrl) {
    URL.revokeObjectURL(removed.previewUrl);
  }
  renderPendingAttachmentPreview();
}


function renderPendingAttachmentPreview() {
  if (!refs.attachmentPreview) return;
  const container = refs.attachmentPreview;
  container.innerHTML = '';
  const items = Array.isArray(refs.pendingAttachments) ? refs.pendingAttachments : [];
  if (!items.length) {
    container.classList.remove('has-items');
    return;
  }
  container.classList.add('has-items');

  items.forEach((item) => {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';

    const fileEntry = item.file || {};
    const fileName = fileEntry.name || 'archivo';
    const fileSize = typeof fileEntry.size === 'number' ? fileEntry.size : 0;

    if (item.previewUrl) {
      const thumb = document.createElement('img');
      thumb.className = 'attachment-chip__thumb';
      thumb.src = item.previewUrl;
      thumb.alt = fileName;
      thumb.loading = 'lazy';
      chip.appendChild(thumb);
    } else {
      const icon = document.createElement('span');
      icon.className = 'attachment-chip__icon';
      icon.textContent = getFileExtension(fileName);
      chip.appendChild(icon);
    }

    const meta = document.createElement('div');
    meta.className = 'attachment-chip__meta';

    const name = document.createElement('span');
    name.className = 'attachment-chip__name';
    name.textContent = fileName;
    meta.appendChild(name);

    const size = document.createElement('span');
    size.className = 'attachment-chip__size';
    size.textContent = formatFileSize(fileSize);
    meta.appendChild(size);

    chip.appendChild(meta);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'attachment-chip__remove';
    removeButton.setAttribute('aria-label', `Eliminar adjunto ${fileName}`);
    removeButton.textContent = 'Quitar';
    removeButton.addEventListener('click', () => {
      removePendingAttachment(item.id);
    });
    chip.appendChild(removeButton);

    container.appendChild(chip);
  });
}

function clearPendingAttachments() {
  if (!Array.isArray(refs.pendingAttachments)) {
    refs.pendingAttachments = [];
  }
  refs.pendingAttachments.forEach((item) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
  refs.pendingAttachments = [];
  if (refs.attachmentInput) {
    refs.attachmentInput.value = '';
  }
  renderPendingAttachmentPreview();
}

const MAX_INLINE_ATTACHMENT_BYTES = 1024 * 1024 * 10;

async function convertFileToAttachment(file) {
  const isImage = Boolean(file.type && file.type.startsWith('image/'));
  const canInline = typeof file.size === 'number' ? file.size <= MAX_INLINE_ATTACHMENT_BYTES : false;
  let dataUrl = '';

  if (canInline) {
    try {
      dataUrl = await readFileAsDataUrl(file);
    } catch (error) {
      console.warn('No se pudo procesar el adjunto para guardarlo en memoria', error);
    }
  } else if (isImage) {
    console.warn('La imagen adjunta supera el tamano maximo inline; se almacenara solo como referencia');
  }

  return {
    id: createId('att'),
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: typeof file.size === 'number' ? file.size : 0,
    dataUrl,
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo adjunto'));
    reader.readAsDataURL(file);
  });
}

function getFileExtension(filename) {
  if (typeof filename !== 'string') return 'FILE';
  const parts = filename.split('.');
  if (parts.length <= 1) return 'FILE';
  const ext = parts.pop() || '';
  return ext.slice(0, 4).toUpperCase() || 'FILE';
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB';
  }

  const units = ['bytes', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${Math.round(size)} bytes`;
  }

  const decimals = size < 10 && unitIndex < units.length - 1 ? 1 : 0;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}

// Actualiza marcas de tiempo de un grupo modificado
function markGroupAsUpdated(group) {
  const now = new Date().toISOString();
  group.updatedAt = now;
}

// Ajusta dinámicamente la altura del textarea según su contenido
function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

// Programa un guardado diferido para evitar operaciones excesivas
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

// Persiste el estado actual en localStorage con manejo de errores
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

// Obtiene el estado inicial desde almacenamiento o crea uno nuevo
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

// Garantiza que un grupo tenga las propiedades necesarias
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
          attachments: Array.isArray(message.attachments)
            ? message.attachments.map(normalizeAttachment)
            : [],
        }))
      : [],
  };
}
function normalizeAttachment(attachment) {
  if (!attachment) {
    return {
      id: createId('att'),
      name: 'Archivo adjunto',
      type: 'application/octet-stream',
      size: 0,
      dataUrl: '',
    };
  }

  return {
    id: attachment.id || createId('att'),
    name: attachment.name || 'Archivo adjunto',
    type: typeof attachment.type === 'string' && attachment.type ? attachment.type : 'application/octet-stream',
    size: typeof attachment.size === 'number' ? attachment.size : 0,
    dataUrl: typeof attachment.dataUrl === 'string' ? attachment.dataUrl : '',
  };
}


// Construye la estructura base cuando no hay datos guardados
function createDefaultState() {
  const groups = buildDefaultGroups();
  return {
    groups,
    selectedGroupId: groups.length ? groups[0].id : null,
    lastSavedAt: null,
  };
}

// Prepara ejemplos iniciales para la experiencia de primera ejecución
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

// Genera un grupo vacío con valores por defecto
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
        attachments: [],
      },
    ],
  };
}

// Recupera el grupo actualmente seleccionado del estado
function getSelectedGroup() {
  if (!appState.selectedGroupId) return null;
  return appState.groups.find((group) => group.id === appState.selectedGroupId) || null;
}

// Cambia el indicador visual según el estado de guardado
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

// Muestra el instante exacto del último guardado exitoso
function updateLastSavedDisplay() {
  if (!refs.lastSaved) return;
  refs.lastSaved.textContent = appState.lastSavedAt
    ? `Último guardado · ${formatExactTimestamp(appState.lastSavedAt)}`
    : 'Sin guardados todavía';
}

// Convierte fechas ISO en descripciones relativas legibles
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

// Devuelve una marca temporal humanamente legible
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

// Genera identificadores únicos con un prefijo dado
function createId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Devuelve el SVG incrustado para los iconos usados en la interfaz
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
  if (name === 'copy') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5v12a.75.75 0 00.75.75h9.75a.75.75 0 00.75-.75V9.75L16.5 6.75h-7.5a.75.75 0 00-.75.75z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 6.75V4.5a.75.75 0 00-.75-.75h-9a.75.75 0 00-.75.75V16.5a.75.75 0 00.75.75H6" />
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

