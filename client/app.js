let socket = null;
let currentAuthTab = 'login';
let currentUser = null;
let currentToken = null;
let activeChatId = null;
let activeChatDetails = null;
let typingTimeout = null;
let searchDebounce = null;
let currentNav = 'main'; // 'main' | 'projects' | 'my-projects' | 'chats' | 'profile'
let selectedCategory = 'Все';
let searchQuery = '';
let pendingAttachmentUrl = null;

// =====================================================================
// INIT
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
  const savedToken = localStorage.getItem('messenger_token');
  const savedUser = localStorage.getItem('messenger_user');

  if (savedToken && savedUser) {
    try {
      currentToken = savedToken;
      currentUser = JSON.parse(savedUser);
      showAppScreen();
    } catch (e) {
      logout();
    }
  } else {
    showAuthScreen();
  }
});

// =====================================================================
// NAVIGATION & VIEWS
// =====================================================================
function navigate(viewName) {
  currentNav = viewName;

  // Update sidebar active buttons
  document.querySelectorAll('.mw-nav-item').forEach((btn) => btn.classList.remove('active'));
  const activeBtn = document.getElementById(
    'nav' + viewName.charAt(0).toUpperCase() + viewName.slice(1).replace('-p', 'P')
  );
  if (activeBtn) activeBtn.classList.add('active');

  const pageView = document.getElementById('pageView');
  const chatsView = document.getElementById('chatsView');
  const sectionTitle = document.getElementById('sectionTitle');

  if (viewName === 'chats') {
    pageView.classList.add('hidden');
    chatsView.classList.remove('hidden');
    loadChats();
  } else {
    chatsView.classList.add('hidden');
    pageView.classList.remove('hidden');

    if (viewName === 'main') {
      sectionTitle.innerText = 'Популярные проекты';
      selectedCategory = 'Все';
      updateCatPills();
      loadProjects();
    } else if (viewName === 'projects') {
      sectionTitle.innerText = 'Каталог всех проектов';
      loadProjects();
    } else if (viewName === 'my-projects') {
      sectionTitle.innerText = 'Мои проекты и модели';
      loadProjects({ userId: currentUser.id });
    } else if (viewName === 'profile') {
      sectionTitle.innerText = `Профиль автора: ${currentUser.username}`;
      loadProjects({ userId: currentUser.id });
    }
  }
}

function selectCategory(catName) {
  selectedCategory = catName;
  updateCatPills();
  loadProjects();
}

function updateCatPills() {
  document.querySelectorAll('.cat-pill').forEach((pill) => {
    const text = pill.innerText.replace(/^[^\s]+\s*/, '');
    if (text === selectedCategory || pill.innerText.includes(selectedCategory)) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

function handleGlobalSearch() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    searchQuery = document.getElementById('globalSearchInput').value.trim().toLowerCase();
    loadProjects();
  }, 250);
}

// =====================================================================
// AUTH
// =====================================================================
function switchAuthTab(tab) {
  currentAuthTab = tab;
  document.getElementById('loginTabBtn').classList.toggle('active', tab === 'login');
  document.getElementById('registerTabBtn').classList.toggle('active', tab === 'register');
  document.getElementById('authSubmitBtn').innerText = tab === 'login' ? 'Войти' : 'Зарегистрироваться';
  document.getElementById('authError').classList.add('hidden');
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('usernameInput').value.trim();
  const password = document.getElementById('passwordInput').value.trim();
  const errorEl = document.getElementById('authError');

  errorEl.classList.add('hidden');
  const endpoint = currentAuthTab === 'login' ? '/api/login' : '/api/register';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.innerText = data.message || 'Ошибка авторизации';
      errorEl.classList.remove('hidden');
      return;
    }
    currentToken = data.token;
    currentUser = data.user;
    localStorage.setItem('messenger_token', currentToken);
    localStorage.setItem('messenger_user', JSON.stringify(currentUser));
    showAppScreen();
  } catch (err) {
    errorEl.innerText = 'Сервер недоступен. Проверьте соединение.';
    errorEl.classList.remove('hidden');
  }
}

function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appContainer').classList.add('hidden');
}

function showAppScreen() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');

  document.getElementById('currentUsername').innerText = currentUser.username;
  document.getElementById('currentUserAvatar').innerText = currentUser.username.charAt(0).toUpperCase();

  initSocketConnection();
  navigate('main');
  loadGitActivity();
}

function logout() {
  localStorage.removeItem('messenger_token');
  localStorage.removeItem('messenger_user');
  if (socket) socket.disconnect();
  currentToken = null;
  currentUser = null;
  activeChatId = null;
  activeChatDetails = null;
  showAuthScreen();
}

// =====================================================================
// SOCKET CONNECTION
// =====================================================================
function initSocketConnection() {
  if (socket) socket.disconnect();
  socket = io();

  socket.on('connect', () => {
    if (activeChatId) joinChatRoom(activeChatId);
  });

  socket.on('chat_joined', ({ chatId, history }) => {
    renderMessagesHistory(history);
  });

  socket.on('receive_message', (msg) => {
    if (Number(msg.chatId) === Number(activeChatId)) {
      appendSingleMessage(msg);
      scrollToBottom();
    }
    loadChats();
  });

  socket.on('typing_status', ({ chatId, username, isTyping }) => {
    if (Number(chatId) === Number(activeChatId)) {
      const indicator = document.getElementById('typingIndicator');
      if (isTyping) {
        indicator.innerText = `${username} набирает сообщение...`;
        indicator.classList.remove('hidden');
      } else {
        indicator.classList.add('hidden');
      }
    }
  });

  socket.on('gitea_event', (eventData) => {
    prependGitEvent(eventData);
  });
}

// =====================================================================
// MAKERWORLD PROJECTS CATALOG & GRID
// =====================================================================
async function loadProjects(filters = {}) {
  const grid = document.getElementById('projectsGrid');
  grid.innerHTML = '<div class="mw-loading-skeleton">Загрузка проектов...</div>';

  try {
    let url = '/api/posts?';
    if (selectedCategory && selectedCategory !== 'Все') {
      url += `category=${encodeURIComponent(selectedCategory)}&`;
    }
    if (filters.userId) {
      url += `userId=${encodeURIComponent(filters.userId)}&`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${currentToken}` },
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    let posts = data.posts || [];

    // Filter by search query if typed
    if (searchQuery) {
      posts = posts.filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery) ||
          p.description.toLowerCase().includes(searchQuery) ||
          p.author.toLowerCase().includes(searchQuery)
      );
    }

    document.getElementById('projectsCount').innerText = `${posts.length} проектов`;
    renderProjectsGrid(posts);
  } catch (err) {
    grid.innerHTML = '<div class="mw-loading-skeleton" style="color:#ff4d4f;">Ошибка загрузки каталога</div>';
    console.error('loadProjects error:', err);
  }
}

function renderProjectsGrid(posts) {
  const grid = document.getElementById('projectsGrid');
  grid.innerHTML = '';

  if (posts.length === 0) {
    grid.innerHTML = '<div class="mw-loading-skeleton">Проектов пока нет. Опубликуйте первый! 🚀</div>';
    return;
  }

  posts.forEach((post) => {
    const card = buildProjectCard(post);
    grid.appendChild(card);
  });
}

function buildProjectCard(post) {
  const card = document.createElement('div');
  card.className = 'mw-card';
  card.onclick = () => openProjectDetailModal(post.id);

  const coverHtml = post.image_url
    ? `<img src="${escapeHtml(post.image_url)}" alt="${escapeHtml(post.title)}" />`
    : `<div class="mw-card-fallback">⚙️</div>`;

  const category = post.category || 'Учёба & Доклады';

  card.innerHTML = `
    <div class="mw-card-cover">
      <span class="mw-card-cat-badge">${escapeHtml(category)}</span>
      ${coverHtml}
    </div>
    <div class="mw-card-body">
      <div class="mw-card-title">${escapeHtml(post.title)}</div>
      <div class="mw-card-desc">${escapeHtml(post.description)}</div>
      <div class="mw-card-footer">
        <div class="mw-author-inline">
          <div class="mw-author-avatar-sm">${escapeHtml(post.author.charAt(0).toUpperCase())}</div>
          <span class="mw-author-name-sm">${escapeHtml(post.author)}</span>
        </div>
        <div class="mw-stats-group">
          <span class="stat-item" title="Лайков">❤️ ${post.like_count || 0}</span>
          <span class="stat-item" title="Коммитов в Git">📦 ${post.commit_count || 0}</span>
          <span class="stat-item" title="Просмотров">👁 ${post.views || 0}</span>
        </div>
      </div>
    </div>
  `;

  return card;
}

// =====================================================================
// PROJECT DETAIL MODAL + OLX "CONTACT AUTHOR" ACTION
// =====================================================================
async function openProjectDetailModal(postId) {
  const modal = document.getElementById('projectDetailModal');
  const body = document.getElementById('projectDetailBody');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Загрузка деталей проекта...</div>';
  modal.classList.remove('hidden');

  try {
    const res = await fetch(`/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${currentToken}` },
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const post = data.post;

    renderProjectDetailBody(post);
  } catch (err) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:#ff4d4f;">Ошибка получения данных о проекте</div>';
  }
}

function closeProjectDetailModal() {
  document.getElementById('projectDetailModal').classList.add('hidden');
}

function renderProjectDetailBody(post) {
  const body = document.getElementById('projectDetailBody');

  const heroHtml = post.image_url
    ? `<div class="pd-hero"><img src="${escapeHtml(post.image_url)}" alt="${escapeHtml(post.title)}" /></div>`
    : `<div class="pd-hero"><span style="font-size:64px;opacity:0.4;">⚙️</span></div>`;

  const date = new Date(post.created_at).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const isOwner = post.user_id === currentUser.id;
  const contactBtnHtml = isOwner
    ? `<button class="mw-btn mw-btn-secondary" disabled>Это ваш проект</button>`
    : `<button class="mw-btn mw-btn-primary pd-contact-btn" onclick="contactAuthor(${post.user_id}, '${escapeHtml(post.author)}', ${post.id}, '${escapeHtml(post.title)}')">
        💬 Написать автору (Заказать / Обсудить)
       </button>`;

  const repoHtml = post.repo_url
    ? `<div class="pd-repo-box">
         <a href="${escapeHtml(post.repo_url)}" target="_blank" rel="noopener" class="mw-btn mw-btn-secondary">
           🔗 Git Репозиторий (${escapeHtml(post.repo_url)})
         </a>
       </div>`
    : '';

  body.innerHTML = `
    ${heroHtml}
    
    <div class="pd-title-row">
      <div>
        <h1 class="pd-title">${escapeHtml(post.title)}</h1>
        <span class="pd-category-pill">${escapeHtml(post.category || 'Учёба & Доклады')}</span>
      </div>
      <div>
        ${contactBtnHtml}
      </div>
    </div>

    <div class="pd-author-box">
      <div class="mw-avatar-circle">${escapeHtml(post.author.charAt(0).toUpperCase())}</div>
      <div>
        <div style="font-weight:700;font-size:14px;color:var(--text-main);">${escapeHtml(post.author)}</div>
        <div style="font-size:11px;color:var(--text-muted);">Опубликовано: ${date}</div>
      </div>
      <button class="mw-btn mw-btn-secondary" style="margin-left:auto;" id="likeBtn-${post.id}" onclick="toggleLike(${post.id})">
        ${post.is_liked ? '❤️ Понравилось' : '🤍 Лайк'} (${post.like_count || 0})
      </button>
    </div>

    <div class="pd-stats-bar">
      <div>Просмотров: <span class="pd-stat-num">${post.views || 0}</span></div>
      <div>Лайков: <span class="pd-stat-num" id="likeCountNum-${post.id}">${post.like_count || 0}</span></div>
      <div>Git Коммитов: <span class="pd-stat-num">${post.commit_count || 0}</span></div>
      <div>Комментариев: <span class="pd-stat-num" id="pdCommentCount">${post.comment_count || 0}</span></div>
    </div>

    <div class="pd-description">${escapeHtml(post.description)}</div>

    ${repoHtml}

    <!-- COMMENTS SECTION -->
    <div style="margin-top:30px;border-top:1px solid var(--border-color);padding-top:20px;">
      <h3 style="margin-bottom:16px;">Обсуждение и комментарии</h3>
      <div id="modalCommentsList">
        <div style="color:var(--text-muted);">Загрузка комментариев...</div>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px;">
        <textarea id="modalCommentInput" class="mw-textarea" rows="2" placeholder="Оставить отзыв или вопрос по проекту..."></textarea>
        <button class="mw-btn mw-btn-primary" onclick="submitModalComment(${post.id})">Отправить</button>
      </div>
    </div>
  `;

  loadModalComments(post.id);
}

async function toggleLike(postId) {
  try {
    const res = await fetch(`/api/posts/${postId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentToken}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    const btn = document.getElementById(`likeBtn-${postId}`);
    const num = document.getElementById(`likeCountNum-${postId}`);
    if (btn) btn.innerText = `${data.isLiked ? '❤️ Понравилось' : '🤍 Лайк'} (${data.likeCount})`;
    if (num) num.innerText = data.likeCount;
  } catch (err) {
    console.error('toggleLike error:', err);
  }
}

async function loadModalComments(postId) {
  const container = document.getElementById('modalCommentsList');
  try {
    const res = await fetch(`/api/posts/${postId}/comments`, {
      headers: { Authorization: `Bearer ${currentToken}` },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const comments = data.comments || [];
    container.innerHTML = '';
    if (comments.length === 0) {
      container.innerHTML = '<div style="color:var(--text-dim);font-size:12px;">Пока нет комментариев</div>';
      return;
    }
    comments.forEach((c) => {
      const time = new Date(c.created_at).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      });
      const item = document.createElement('div');
      item.style.cssText = 'padding:10px 0;border-bottom:1px solid var(--border-color);display:flex;gap:10px;';
      item.innerHTML = `
        <div class="mw-author-avatar-sm">${escapeHtml(c.author.charAt(0).toUpperCase())}</div>
        <div style="flex:1;">
          <div style="font-weight:600;font-size:12px;color:var(--text-main);">${escapeHtml(c.author)} <span style="font-size:10px;color:var(--text-dim);margin-left:8px;">${time}</span></div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${escapeHtml(c.text)}</div>
        </div>
      `;
      container.appendChild(item);
    });
  } catch (err) {
    container.innerHTML = '<div style="color:#ff4d4f;">Ошибка загрузки</div>';
  }
}

async function submitModalComment(postId) {
  const input = document.getElementById('modalCommentInput');
  const text = input.value.trim();
  if (!text) return;

  try {
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    input.value = '';
    await loadModalComments(postId);
  } catch (err) {
    console.error('submitModalComment error:', err);
  }
}

// =====================================================================
// OLX-STYLE DIRECT MESSAGES LINKED TO PROJECT
// =====================================================================
async function contactAuthor(targetUserId, authorName, projectId, projectTitle) {
  closeProjectDetailModal();

  try {
    const res = await fetch('/api/chats/direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ targetUserId }),
    });

    if (res.ok) {
      const data = await res.json();
      navigate('chats');
      await loadChats();
      await selectChat(data.chat);

      // Pre-fill initial context message if empty
      const msgInput = document.getElementById('messageInput');
      if (msgInput) {
        msgInput.value = `Здравствуйте, ${authorName}! Я по поводу вашего проекта "${projectTitle}".`;
        msgInput.focus();
      }
    }
  } catch (err) {
    console.error('contactAuthor error:', err);
  }
}

// =====================================================================
// CHATS VIEW
// =====================================================================
async function loadChats() {
  try {
    const res = await fetch('/api/chats', {
      headers: { Authorization: `Bearer ${currentToken}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    renderChatsList(data.chats || []);
  } catch (err) {
    console.error('Failed to load chats:', err);
  }
}

function renderChatsList(chats) {
  const container = document.getElementById('chatsList');
  container.innerHTML = '';

  if (chats.length === 0) {
    container.innerHTML = '<div style="padding: 20px; color: var(--text-dim); text-align: center;">Нет диалогов</div>';
    return;
  }

  chats.forEach((chat) => {
    const div = document.createElement('div');
    div.className = `chat-item ${chat.id === activeChatId ? 'active' : ''}`;
    div.onclick = () => selectChat(chat);

    const isDirect = chat.type === 'direct';
    const avatarChar = isDirect ? '👤' : '👥';
    const preview = chat.last_message ? `${chat.last_sender || ''}: ${chat.last_message}` : 'Сообщений нет';

    div.innerHTML = `
      <div class="mw-avatar-circle" style="width:30px;height:30px;font-size:12px;">${avatarChar}</div>
      <div class="chat-meta">
        <div class="chat-title">${escapeHtml(chat.name)}</div>
        <div class="chat-preview">${escapeHtml(preview)}</div>
      </div>
    `;
    container.appendChild(div);
  });
}

async function selectChat(chat) {
  activeChatId = chat.id;
  document.querySelectorAll('.chat-item').forEach((item) => item.classList.remove('active'));
  document.getElementById('messageForm').classList.remove('hidden');

  try {
    const res = await fetch(`/api/chats/${chat.id}/messages`, {
      headers: { Authorization: `Bearer ${currentToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      activeChatDetails = data.chat;
      const isDirect = data.chat.type === 'direct';
      document.getElementById('activeChatAvatar').innerText = isDirect ? '👤' : '👥';
      document.getElementById('activeChatTitle').innerText = data.chat.name;
      document.getElementById('chatSubInfo').innerText = isDirect
        ? 'Личный диалог'
        : `${data.chat.memberCount || 1} участников`;
      renderMessagesHistory(data.messages || []);
    }
  } catch (err) {
    console.error('Failed to load chat details:', err);
  }

  loadChats();
  joinChatRoom(chat.id);
}

function joinChatRoom(chatId) {
  if (!socket || !socket.connected) return;
  socket.emit('join_chat', { chatId, token: currentToken, userId: currentUser.id });
}

function renderMessagesHistory(history) {
  const container = document.getElementById('messagesContainer');
  container.innerHTML = '';
  if (!history || history.length === 0) {
    container.innerHTML = '<div class="empty-messages-placeholder">Обсудите детали или закажите сборку проекта!</div>';
    return;
  }
  history.forEach((msg) => appendSingleMessage(msg));
  scrollToBottom();
}

function appendSingleMessage(msg) {
  const container = document.getElementById('messagesContainer');
  const placeholder = container.querySelector('.empty-messages-placeholder');
  if (placeholder) placeholder.remove();

  const isMe = msg.userId === currentUser.id;
  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${isMe ? 'my-message' : 'other-message'}`;

  const formattedTime = new Date(msg.createdAt || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const attachmentHtml = msg.attachmentUrl
    ? `<a href="${escapeHtml(msg.attachmentUrl)}" target="_blank" rel="noopener">
         <img style="max-width:200px;max-height:160px;border-radius:6px;margin-bottom:4px;display:block;" src="${escapeHtml(msg.attachmentUrl)}" alt="фото" />
       </a>`
    : '';

  const textHtml = msg.content ? `<span>${escapeHtml(msg.content)}</span>` : '';

  bubble.innerHTML = `
    <div class="message-sender">${escapeHtml(msg.username)}</div>
    <div class="message-content">
      ${attachmentHtml}
      ${textHtml}
      <span class="message-time">${formattedTime}</span>
    </div>
  `;
  container.appendChild(bubble);
}

function handleKeyDown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage(event);
  }
}

function sendMessage(event) {
  if (event) event.preventDefault();
  const input = document.getElementById('messageInput');
  const content = input.value.trim();

  if (!content && !pendingAttachmentUrl) return;
  if (!activeChatId || !socket) return;

  socket.emit('send_message', {
    chatId: activeChatId,
    content: content || '',
    attachmentUrl: pendingAttachmentUrl || undefined,
    userId: currentUser.id,
    username: currentUser.username,
    token: currentToken,
  });

  input.value = '';
  removeChatAttach();
  sendTypingStatus(false);
}

function handleTyping() {
  sendTypingStatus(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => sendTypingStatus(false), 2000);
}

function sendTypingStatus(isTyping) {
  if (!socket || !activeChatId) return;
  socket.emit('typing_status', {
    chatId: activeChatId,
    userId: currentUser.id,
    username: currentUser.username,
    isTyping,
  });
}

function scrollToBottom() {
  setTimeout(() => {
    const container = document.getElementById('messagesContainer');
    if (container) container.scrollTop = container.scrollHeight;
  }, 50);
}

// =====================================================================
// FILE UPLOAD HELPER & CHAT ATTACH
// =====================================================================
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${currentToken}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Ошибка загрузки файла');
  }

  const data = await res.json();
  return data.url;
}

async function handleChatFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const url = await uploadFile(file);
    pendingAttachmentUrl = url;

    const preview = document.getElementById('chatAttachPreview');
    const img = document.getElementById('chatAttachImg');
    img.src = url;
    preview.classList.remove('hidden');
  } catch (err) {
    alert('Не удалось загрузить фото: ' + err.message);
  }
  event.target.value = '';
}

function removeChatAttach() {
  pendingAttachmentUrl = null;
  const preview = document.getElementById('chatAttachPreview');
  const img = document.getElementById('chatAttachImg');
  if (preview) preview.classList.add('hidden');
  if (img) img.src = '';
}

// =====================================================================
// PUBLISH MODAL & SUBMIT
// =====================================================================
function openPublishModal() {
  document.getElementById('publishModal').classList.remove('hidden');
  document.getElementById('postTitle').value = '';
  document.getElementById('postDesc').value = '';
  document.getElementById('postRepo').value = '';
  document.getElementById('postImageInput').value = '';
  document.getElementById('publishError').classList.add('hidden');
}

function closePublishModal() {
  document.getElementById('publishModal').classList.add('hidden');
}

async function handlePublishSubmit(event) {
  event.preventDefault();
  const title = document.getElementById('postTitle').value.trim();
  const category = document.getElementById('postCategory').value;
  const description = document.getElementById('postDesc').value.trim();
  const repo_url = document.getElementById('postRepo').value.trim();
  const imageFileInput = document.getElementById('postImageInput');
  const errorEl = document.getElementById('publishError');
  const btn = document.getElementById('publishBtn');

  errorEl.classList.add('hidden');

  if (!title || !description) {
    errorEl.innerText = 'Заполните название и описание проекта.';
    errorEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.innerText = 'Публикую...';

  try {
    let image_url = null;
    if (imageFileInput && imageFileInput.files[0]) {
      try {
        image_url = await uploadFile(imageFileInput.files[0]);
      } catch (uploadErr) {
        errorEl.innerText = 'Ошибка загрузки обложки: ' + uploadErr.message;
        errorEl.classList.remove('hidden');
        return;
      }
    }

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({
        title,
        description,
        category,
        repo_url: repo_url || undefined,
        image_url,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.innerText = data.message || data.error || `Ошибка сервера (${res.status})`;
      errorEl.classList.remove('hidden');
      return;
    }

    closePublishModal();
    loadProjects();
  } catch (err) {
    errorEl.innerText = 'Ошибка соединения с сервером.';
    errorEl.classList.remove('hidden');
    console.error('handlePublishSubmit error:', err);
  } finally {
    btn.disabled = false;
    btn.innerText = 'Опубликовать';
  }
}

// =====================================================================
// GIT ACTIVITY WIDGET
// =====================================================================
async function loadGitActivity() {
  const container = document.getElementById('gitActivityList');
  container.innerHTML = '<div class="git-empty">Загрузка событий...</div>';

  try {
    const res = await fetch('/api/webhooks/events', {
      headers: { Authorization: `Bearer ${currentToken}` },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const events = data.events || [];

    container.innerHTML = '';
    if (events.length === 0) {
      container.innerHTML = '<div class="git-empty">Нет событий.<br>Настройте вебхуки в Gitea.</div>';
      return;
    }
    events.forEach((ev) => container.appendChild(buildGitEventEl(ev)));
  } catch (err) {
    container.innerHTML = '<div class="git-empty" style="color:#ff4d4f;">Ошибка загрузки</div>';
  }
}

function buildGitEventEl(ev) {
  const el = document.createElement('div');
  el.className = 'git-event-item';

  const time = new Date(ev.created_at).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  const typeClass = (ev.event_type || '').toLowerCase().replace(/_/g, '_');

  el.innerHTML = `
    <div><span class="git-event-type ${typeClass}">${escapeHtml(ev.event_type || 'event')}</span></div>
    <div class="git-event-summary">${escapeHtml(ev.summary)}</div>
    <div class="git-event-time">${time}</div>
  `;
  return el;
}

function prependGitEvent(ev) {
  const container = document.getElementById('gitActivityList');
  if (!container) return;
  const empty = container.querySelector('.git-empty');
  if (empty) empty.remove();
  container.insertBefore(buildGitEventEl(ev), container.firstChild);
}

// UTILS
function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
