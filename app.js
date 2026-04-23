/**
 * TaskDeck — Kanban Board Application
 * ─────────────────────────────────────
 * SETUP:
 *  1. Create a Supabase project at https://supabase.com
 *  2. Run schema.sql in the Supabase SQL editor
 *  3. Replace the two constants below (Project Settings → API)
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/* ═══════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════ */

const SUPABASE_URL      = 'https://cagykqeunkljhldtkmqq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gQeFmfSyBsEsNKA8sL1X-Q_OHhaoxd6';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ═══════════════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════════════ */

const Theme = (() => {
  const STORAGE_KEY = 'taskdeck_theme';
  let currentTheme  = localStorage.getItem(STORAGE_KEY) || 'system';

  function apply(theme) {
    currentTheme = theme;
    localStorage.setItem(STORAGE_KEY, theme);

    const m = window.matchMedia?.('(prefers-color-scheme: dark)');
    const prefersDark = m ? m.matches : false;
    const useDark     = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.setAttribute('data-theme', useDark ? 'dark' : 'light');

    // Highlight active button
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }

  function init() {
    apply(currentTheme);
    const m = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handler = () => { if (currentTheme === 'system') apply('system'); };
    if (m?.addEventListener) m.addEventListener('change', handler);
    else if (m?.addListener) m.addListener(handler); // Fallback for older Safari
  }

  function get() { return currentTheme; }

  return { init, apply, get };
})();

/* ═══════════════════════════════════════════════════════════
   UI HELPERS
   ═══════════════════════════════════════════════════════════ */

const UI = {
  el(id) { return document.getElementById(id); },

  setLoading(msg, pct) {
    const t = this.el('loadingText');
    const f = this.el('loadingBarFill');
    if (t) t.textContent = msg;
    if (f) f.style.width = `${pct}%`;
  },
  showLoading() { this.el('loadingScreen')?.classList.add('visible'); },
  hideLoading() { this.el('loadingScreen')?.classList.remove('visible'); },

  showAuth()    { this.el('authOverlay')?.classList.add('visible'); },
  hideAuth()    { this.el('authOverlay')?.classList.remove('visible'); },

  showApp()     { const s = this.el('appShell'); if (s) s.style.display = 'flex'; },
  hideApp()     { const s = this.el('appShell'); if (s) s.style.display = 'none'; },

  setSyncStatus(status) {
    const dot   = this.el('syncDot');
    const label = this.el('syncLabel');
    if (!dot || !label) return;
    dot.className     = `sync-dot sync-${status}`;
    label.textContent = status === 'saving' ? 'Saving…' : status === 'error' ? 'Error' : 'Saved';
  },

  authError(msg) {
    const el = this.el('authError');
    if (!el) return;
    el.textContent   = msg;
    el.style.display = msg ? '' : 'none';
  },

  showDashboard() {
    this.el('dashboard').style.display      = '';
    this.el('boardContainer').style.display = 'none';
    this.el('boardBreadcrumb').style.display = 'none';
    this.el('addListBtn').style.display      = 'none';
    this.el('boardSettingsBtn').style.display = 'none';
    this.el('syncStatus').style.display      = 'none';
    this.el('headerTabs').style.display      = '';
  },

  showBoard() {
    this.el('dashboard').style.display      = 'none';
    this.el('boardContainer').style.display = '';
    this.el('boardBreadcrumb').style.display = '';
    this.el('addListBtn').style.display      = '';
    this.el('boardSettingsBtn').style.display = '';
    this.el('syncStatus').style.display      = '';
    this.el('headerTabs').style.display      = 'none';
  },

  setProfile(profile) {
    const initial = (profile?.display_name || profile?.email || '?').charAt(0).toUpperCase();
    const name    = profile?.display_name || '';
    const email   = profile?.email        || '';
    const phone   = profile?.phone        || '';
    const smsOn   = !!profile?.sms_enabled;

    const btn = this.el('profileBtn');
    const lg  = this.el('profileAvatarLg');
    if (btn) { btn.textContent = initial; btn.style.background = profile?.avatar_color || '#C97D4E'; }
    if (lg)  { lg.textContent  = initial; lg.style.background  = profile?.avatar_color || '#C97D4E'; }
    const n = this.el('profileName');
    const e = this.el('profileEmail');
    const i = this.el('profileNameInput');
    if (n) n.textContent = name || '(no name set)';
    if (e) e.textContent = email;
    if (i) i.value       = name;

    // Phone + SMS toggle
    const pi = this.el('profilePhoneInput');
    if (pi) pi.value = phone;
    const toggle  = this.el('smsToggle');
    const phoneWrap = this.el('profilePhoneWrap');
    if (toggle) {
      toggle.classList.toggle('on', smsOn);
      toggle.setAttribute('aria-pressed', smsOn ? 'true' : 'false');
    }
    if (phoneWrap) phoneWrap.style.display = smsOn ? '' : 'none';
  },
};

/* ═══════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════ */

const Auth = (() => {
  let currentUser = null;

  function getUser()   { return currentUser; }
  function getUserId() { return currentUser?.id ?? null; }

  async function init(onSignedIn, onSignedOut) {
    // Check existing session first — this is the authoritative boot path.
    // We intentionally call onSignedIn / onSignedOut from here and let
    // onAuthStateChange only handle *subsequent* events (SIGNED_IN after
    // a login form submit, SIGNED_OUT after sign-out). This prevents the
    // double-invocation that caused the infinite loading screen.
    const { data: { session } } = await sb.auth.getSession();

    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        currentUser = session.user;
        await onSignedIn(currentUser);
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        onSignedOut();
      }
      // TOKEN_REFRESHED and INITIAL_SESSION are intentionally ignored here;
      // the initial boot is handled by the getSession() block below.
    });

    if (session?.user) {
      currentUser = session.user;
      await onSignedIn(currentUser);
    } else {
      onSignedOut();
    }
  }

  async function signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email, password, displayName) {
    const { error } = await sb.auth.signUp({
      email, password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  return { init, signIn, signUp, signOut, getUser, getUserId };
})();

/* ═══════════════════════════════════════════════════════════
   STORAGE
   ═══════════════════════════════════════════════════════════ */

const Storage = {

  /* ── Profiles ── */

  async getProfile(userId) {
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async upsertProfile(userId, fields) {
    const { error } = await sb
      .from('profiles')
      .upsert({ id: userId, ...fields, updated_at: new Date().toISOString() });
    if (error) throw error;
  },

  /* ── Boards ── */

  async getBoards(userId) {
    const { data, error } = await sb
      .from('boards')
      .select('id, title, color, created_at, updated_at, is_pinned')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async createBoard(userId, title, color) {
    const { data, error } = await sb
      .from('boards')
      .insert({ user_id: userId, title, color })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateBoardTitle(boardId, title) {
    const { error } = await sb.from('boards').update({ title, updated_at: new Date().toISOString() }).eq('id', boardId);
    if (error) throw error;
  },

  async updateBoardColor(boardId, color) {
    const { error } = await sb.from('boards').update({ color, updated_at: new Date().toISOString() }).eq('id', boardId);
    if (error) throw error;
  },

  async updateBoardPin(boardId, isPinned) {
    const { error } = await sb.from('boards').update({ is_pinned: isPinned }).eq('id', boardId);
    if (error) throw error;
  },

  async deleteBoard(boardId) {
    const { error } = await sb.from('boards').delete().eq('id', boardId);
    if (error) throw error;
  },

  /* ── Board init (single RPC) ── */

  async initBoard(boardId) {
    const { data, error } = await sb.rpc('load_board', { p_board_id: boardId });
    if (error) throw error;
    return {
      boardId:    data.board_id,
      boardTitle: data.board_title,
      boardColor: data.board_color,
      lists: (data.lists || []).map(l => ({
        ...l,
        cards: (l.cards || []).map(c => ({
          id:          c.id,
          title:       c.title,
          description: c.description || '',
          dueDate:     c.due_date    || '',
          dueTime:     c.due_time    || '',
          priority:    c.priority    || '',
          position:    c.position,
          phone:       c.phone       || '',
          reminders:   c.reminders   || [],
        })),
      })),
    };
  },

  async seedBoard(boardId) {
    const { error } = await sb.rpc('seed_board', { p_board_id: boardId });
    if (error) throw error;
  },

  /* ── Lists ── */

  async createList(boardId, title, position) {
    const { data, error } = await sb
      .from('lists')
      .insert({ board_id: boardId, title, position })
      .select().single();
    if (error) throw error;
    return data;
  },

  async updateListTitle(listId, title) {
    const { error } = await sb.from('lists').update({ title }).eq('id', listId);
    if (error) throw error;
  },

  async deleteList(listId) {
    const { error } = await sb.from('lists').delete().eq('id', listId);
    if (error) throw error;
  },

  /* ── Cards ── */

  async createCard(boardId, listId, title, position) {
    const { data, error } = await sb
      .from('cards')
      .insert({ board_id: boardId, list_id: listId, title, position })
      .select().single();
    if (error) throw error;
    return data;
  },

  async updateCard(cardId, fields) {
    const { error } = await sb.from('cards').update(fields).eq('id', cardId);
    if (error) throw error;
  },

  async moveCard(cardId, newListId, newPosition, boardId) {
    const { error } = await sb.from('cards')
      .update({ list_id: newListId, position: newPosition, board_id: boardId })
      .eq('id', cardId);
    if (error) throw error;
  },

  async reorderCards(cards) {
    await Promise.all(cards.map((c, i) => sb.from('cards').update({ position: i }).eq('id', c.id)));
  },

  async deleteCard(cardId) {
    const { error } = await sb.from('cards').delete().eq('id', cardId);
    if (error) throw error;
  },

  async clearListCards(listId) {
    const { error } = await sb.from('cards').delete().eq('list_id', listId);
    if (error) throw error;
  },

  /* ── Board Sharing ── */

  async shareBoard(boardId, userEmail, permission = 'view') {
    const { data, error } = await sb.rpc('share_board', {
      p_board_id: boardId,
      p_user_email: userEmail,
      p_permission: permission
    });
    if (error) throw error;
    return data;
  },

  async getSharedBoards() {
    const { data, error } = await sb.rpc('get_shared_boards');
    if (error) throw error;
    return data ?? [];
  },

  async getBoardShares(boardId) {
    const { data, error } = await sb
      .from('board_shares')
      .select('id, shared_with, permission_level, profiles!shared_with(display_name, email)')
      .eq('board_id', boardId);
    if (error) throw error;
    return data ?? [];
  },

  async removeShare(shareId) {
    const { error } = await sb.from('board_shares').delete().eq('id', shareId);
    if (error) throw error;
  },

  /* ── Groups ── */

  async createGroup(name, description = null) {
    const { data, error } = await sb.rpc('create_group', {
      p_name: name,
      p_description: description
    });
    if (error) throw error;
    return data;
  },

  async getUserGroups() {
    const { data, error } = await sb.rpc('get_user_groups');
    if (error) throw error;
    return data ?? [];
  },

  async addGroupMember(groupId, userEmail) {
    const { data, error } = await sb.rpc('add_group_member', {
      p_group_id: groupId,
      p_user_email: userEmail
    });
    if (error) throw error;
    return data;
  },

  /* ── Messages ── */

  async getGroupMessages(groupId, limit = 50) {
    const { data, error } = await sb.rpc('get_group_messages', {
      p_group_id: groupId,
      p_limit: limit
    });
    if (error) throw error;
    return data ?? [];
  },

  async sendMessage(groupId, content) {
    const { data, error } = await sb.rpc('send_message', {
      p_group_id: groupId,
      p_content: content
    });
    if (error) throw error;
    return data;
  },

  // Real-time message subscription
  subscribeToMessages(groupId, callback) {
    return sb
      .channel(`messages:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `group_id=eq.${groupId}`
      }, payload => {
        callback(payload.new);
      })
      .subscribe();
  }
};

/* ═══════════════════════════════════════════════════════════
   APP STATE
   ═══════════════════════════════════════════════════════════ */

const AppState = (() => {
  let state = {
    view:       'dashboard', // 'dashboard' | 'board'
    profile:    null,
    boards:     [],
    boardId:    null,
    searchQuery: '',
    sortOrder:   'recent', // 'recent' | 'oldest' | 'alpha' | 'alpha-rev'
    boardTitle: '',
    boardColor: '#C97D4E',
    lists:      [],
  };
  const subs = [];

  function getState()  { return JSON.parse(JSON.stringify(state)); }
  function setState(fn, silent = false) {
    state = fn(JSON.parse(JSON.stringify(state)));
    if (!silent) subs.forEach(f => f(state));
  }
  function subscribe(fn) { subs.push(fn); }

  return { getState, setState, subscribe };
})();

/* ═══════════════════════════════════════════════════════════
   DRAG ENGINE
   ═══════════════════════════════════════════════════════════ */

const DragEngine = (() => {
  let ds = null;

  function start(cardEl, cardId, listId) {
    const rect = cardEl.getBoundingClientRect();
    const ghost = cardEl.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.cssText = `position:fixed;width:${rect.width}px;top:${rect.top}px;left:${rect.left}px;pointer-events:none;z-index:9999;margin:0;`;
    document.body.appendChild(ghost);
    const ph = document.createElement('div');
    ph.className = 'card-drop-placeholder';
    cardEl.parentNode.insertBefore(ph, cardEl);
    cardEl.classList.add('dragging');
    ds = { cardId, listId, ghostEl: ghost, placeholder: ph };
  }

  function move(x, y) {
    if (!ds) return;
    ds.ghostEl.style.left = `${x - 20}px`;
    ds.ghostEl.style.top  = `${y - 20}px`;
  }

  function end(targetListId, targetIndex) {
    if (!ds) return null;
    const result = { cardId: ds.cardId, sourceListId: ds.listId, targetListId, targetIndex };
    ds.ghostEl.remove();
    if (ds.placeholder.parentNode) ds.placeholder.remove();
    document.querySelector(`.card[data-card-id="${ds.cardId}"]`)?.classList.remove('dragging');
    ds = null;
    return result;
  }

  function cancel() {
    if (!ds) return;
    ds.ghostEl.remove();
    if (ds.placeholder.parentNode) ds.placeholder.remove();
    document.querySelector('.card.dragging')?.classList.remove('dragging');
    ds = null;
  }

  return { start, move, end, cancel };
})();

/* ═══════════════════════════════════════════════════════════
   RENDER
   ═══════════════════════════════════════════════════════════ */

const Render = {
  esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },
  cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); },

  boardCard(board) {
    const el = document.createElement('div');
    el.className = 'board-card';
    el.dataset.boardId = board.id;
    const color = board.color || '#C97D4E';
    el.title = `Open ${board.title}`; // Simple native hover preview
    el.innerHTML = `
      <div class="board-card-color" style="background:${color};"></div>
      <div class="board-card-body">
        <div class="board-card-title">${this.esc(board.title)}</div>
        <div class="board-card-meta">${new Date(board.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      </div>
      <div class="board-card-actions">
        <button class="board-card-pin ${board.is_pinned ? 'active' : ''}" data-board-pin="${board.id}" aria-label="${board.is_pinned ? 'Unpin' : 'Pin'} board" title="${board.is_pinned ? 'Unpin' : 'Pin'} board">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M12.5 5.5l-3-3M6.5 12.5l-3-3M4 12l2-2M10 4l2-2M5 5l6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="board-card-delete" data-board-delete="${board.id}" aria-label="Delete board" title="Delete board">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4h12l-1.5 9H3.5L2 4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 2h5M1 4h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        </button>
      </div>`;
    return el;
  },

  card(card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.cardId = card.id;
    if (card.priority) el.dataset.priority = card.priority;
    el.setAttribute('role', 'listitem');
    el.setAttribute('aria-label', card.title);
    const meta = [];
    if (card.dueDate) {
      const d = new Date(card.dueDate + 'T00:00:00');
      const today = new Date(); today.setHours(0,0,0,0);
      const timeLabel = card.dueTime ? ` ${SMS.formatTime12(card.dueTime)}` : '';
      meta.push(`<span class="card-badge date ${d < today ? 'overdue' : ''}">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 1v3M11 1v3M1 7h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${timeLabel}</span>`);
    }
    if (card.description) meta.push(`<span class="card-badge desc">
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      Note</span>`);
    if (card.priority) meta.push(`<span class="card-badge priority-${card.priority}">${this.cap(card.priority)}</span>`);
    el.innerHTML = `
      <div class="card-priority-bar" aria-hidden="true"></div>
      <div class="card-title">${this.esc(card.title)}</div>
      ${meta.length ? `<div class="card-meta">${meta.join('')}</div>` : ''}`;
    return el;
  },

  list(list) {
    const el = document.createElement('div');
    el.className = 'list';
    el.dataset.listId = list.id;
    el.setAttribute('role', 'list');
    el.innerHTML = `
      <div class="list-header">
        <div class="list-menu-header-wrap" style="position:relative;display:flex;align-items:center;gap:6px;flex:1;">
          <div class="list-title" contenteditable="true" spellcheck="false" data-list-id="${list.id}">${this.esc(list.title)}</div>
        </div>
        <span class="list-card-count" data-list-count="${list.id}">${list.cards.length}</span>
        <button class="list-menu-btn" aria-label="List options" data-list-menu="${list.id}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="3" r="1.2" fill="currentColor"/>
            <circle cx="8" cy="8" r="1.2" fill="currentColor"/>
            <circle cx="8" cy="13" r="1.2" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <div class="cards-container" data-list-id="${list.id}" role="list"></div>
      <div class="list-footer">
        <button class="add-card-btn" data-add-card="${list.id}">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Add Card
        </button>
      </div>`;
    const container = el.querySelector('.cards-container');
    if (!list.cards.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◻</div><div class="empty-state-text">Drop cards here<br>or add one below</div></div>`;
    } else {
      list.cards.forEach(c => container.appendChild(this.card(c)));
    }
    return el;
  },
};

/* ═══════════════════════════════════════════════════════════
   CARD MODAL
   ═══════════════════════════════════════════════════════════ */

const CardModal = (() => {
  let currentCardId = null, currentListId = null, selectedPriority = '';

  const overlay   = document.getElementById('modalOverlay');
  const titleEl   = document.getElementById('modalCardTitle');
  const badgeEl   = document.getElementById('modalListBadge');
  const descEl    = document.getElementById('modalDesc');
  const dateEl    = document.getElementById('modalDate');
  const timeEl    = document.getElementById('modalTime');
  const prioGroup = document.getElementById('priorityGroup');
  const remList   = document.getElementById('modalReminderList');
  const addRemBtn = document.getElementById('addReminderBtn');
  const smsOpt    = document.getElementById('reminderSmsOpt');
  const smsCheck  = document.getElementById('reminderSmsCheck');
  const smsNophone= document.getElementById('reminderSmsNophone');
  const addPhoneLink = document.getElementById('reminderAddPhone');

  function open(cardId, listId) {
    const { lists, profile } = AppState.getState();
    const list = lists.find(l => l.id === listId);
    const card = list?.cards.find(c => c.id === cardId);
    if (!card) return;
    currentCardId    = cardId;
    currentListId    = listId;
    selectedPriority = card.priority || '';
    titleEl.textContent = card.title;
    badgeEl.textContent = `In: ${list.title}`;
    descEl.value        = card.description || '';
    dateEl.value        = card.dueDate     || '';
    prioGroup.querySelectorAll('.priority-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.priority === selectedPriority)
    );
    renderReminders(card.reminders || []);

    // SMS opt-in state
    const hasPhone  = !!(profile?.phone?.trim());
    const smsOn     = !!profile?.sms_enabled;
    if (smsOpt)     smsOpt.style.display     = hasPhone ? '' : 'none';
    if (smsNophone) smsNophone.style.display  = hasPhone ? 'none' : '';
    if (smsCheck)   smsCheck.checked          = smsOn && hasPhone;

    overlay.classList.add('open');
    // Populate time select (12h clock, 30-min steps)
    if (timeEl && timeEl.options.length <= 1) {
      timeEl.innerHTML = generateTimeOptions('');
    }
    timeEl.value = card.dueTime || '';
    titleEl.focus();
    document.body.style.overflow = 'hidden';
  }

  function renderReminders(reminders) {
    if (!remList) return;
    remList.innerHTML = '';
    (reminders || []).forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'reminder-row';
      row.innerHTML = `
        <input type="date" class="modal-date reminder-date" value="${r.date || ''}" data-ri="${i}" />
        <select class="modal-time-select reminder-time" data-ri="${i}">
          ${generateTimeOptions(r.time || '')}
        </select>
        <button class="reminder-remove" data-ri="${i}" aria-label="Remove reminder">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>`;
      remList.appendChild(row);
    });
  }

  function generateTimeOptions(selectedVal) {
    let html = `<option value="">No time</option>`;
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) {
        const hh   = h % 12 === 0 ? 12 : h % 12;
        const mm   = m === 0 ? '00' : '30';
        const ampm = h < 12 ? 'AM' : 'PM';
        const val  = `${String(h).padStart(2,'0')}:${mm}`;
        html += `<option value="${val}" ${selectedVal === val ? 'selected' : ''}>${hh}:${mm} ${ampm}</option>`;
      }
    }
    return html;
  }

  function collectReminders() {
    if (!remList) return [];
    return [...remList.querySelectorAll('.reminder-row')].map(row => ({
      date: row.querySelector('.reminder-date')?.value || '',
      time: row.querySelector('.reminder-time')?.value || '',
    })).filter(r => r.date);
  }

  function close() {
    overlay.classList.remove('open');
    currentCardId = null; currentListId = null;
    document.body.style.overflow = '';
  }

  async function save() {
    if (!currentCardId) return;
    const newTitle = titleEl.textContent.trim();
    if (!newTitle) return;
    const cardId = currentCardId, listId = currentListId;
    const reminders = collectReminders();
    const { profile } = AppState.getState();
    const useSms = !!(smsCheck?.checked && profile?.phone && profile?.sms_enabled);
    const fields = {
      title:       newTitle,
      description: descEl.value.trim() || null,
      due_date:    dateEl.value        || null,
      due_time:    timeEl.value        || null,
      priority:    selectedPriority    || null,
      reminders:   reminders,
    };
    AppState.setState(s => {
      const c = s.lists.find(l => l.id === listId)?.cards.find(c => c.id === cardId);
      if (c) {
        c.title       = newTitle;
        c.description = fields.description || '';
        c.dueDate     = fields.due_date    || '';
        c.dueTime     = fields.due_time    || '';
        c.priority    = fields.priority    || '';
        c.reminders   = reminders;
      }
      return s;
    });
    close();
    UI.setSyncStatus('saving');
    try {
      await Storage.updateCard(cardId, fields);
      UI.setSyncStatus('saved');
      if (useSms) {
        SMS.dispatchCardReminders({
          ...fields, title: newTitle,
          phone: profile.phone,
        }).catch(console.error);
      }
    }
    catch (e) { console.error(e); UI.setSyncStatus('error'); }
  }

  async function deleteCard() {
    if (!currentCardId) return;
    const cardId = currentCardId, listId = currentListId;
    AppState.setState(s => {
      const l = s.lists.find(x => x.id === listId);
      if (l) l.cards = l.cards.filter(c => c.id !== cardId);
      return s;
    });
    close();
    UI.setSyncStatus('saving');
    try { await Storage.deleteCard(cardId); UI.setSyncStatus('saved'); }
    catch (e) { console.error(e); UI.setSyncStatus('error'); }
  }

  async function deleteCard() {
    if (!currentCardId) return;
    const cardId = currentCardId, listId = currentListId;
    AppState.setState(s => {
      const l = s.lists.find(x => x.id === listId);
      if (l) l.cards = l.cards.filter(c => c.id !== cardId);
      return s;
    });
    close();
    UI.setSyncStatus('saving');
    try { await Storage.deleteCard(cardId); UI.setSyncStatus('saved'); }
    catch (e) { console.error(e); UI.setSyncStatus('error'); }
  }

  document.getElementById('modalClose')?.addEventListener('click', close);
  document.getElementById('saveCardBtn')?.addEventListener('click', save);
  document.getElementById('deleteCardBtn')?.addEventListener('click', deleteCard);
  overlay?.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => {
    if (!overlay?.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
  });
  prioGroup?.addEventListener('click', e => {
    const btn = e.target.closest('.priority-btn');
    if (!btn) return;
    const p = btn.dataset.priority;
    selectedPriority = selectedPriority === p ? '' : p;
    prioGroup.querySelectorAll('.priority-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.priority === selectedPriority)
    );
  });

  // Add a new reminder row
  addRemBtn?.addEventListener('click', () => {
    const current = collectReminders();
    current.push({ date: '', time: '' });
    renderReminders(current);
  });

  // Remove a reminder row
  remList?.addEventListener('click', e => {
    const btn = e.target.closest('.reminder-remove');
    if (!btn) return;
    const idx = parseInt(btn.dataset.ri, 10);
    const current = collectReminders();
    current.splice(idx, 1);
    renderReminders(current);
  });

  // "Add a phone number" link → open SMS setup modal
  addPhoneLink?.addEventListener('click', e => {
    e.preventDefault();
    close();
    SmsSetup.open();
  });

  // Populate time selects with 12h options on first use
  timeEl?.addEventListener('focus', () => {
    if (timeEl.options.length === 0) {
      timeEl.innerHTML = generateTimeOptions(timeEl.dataset.val || '');
    }
  });

  return { open, close };
})();

/* ═══════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════ */

const Dashboard = (() => {
  const grid          = document.getElementById('boardsGrid');
  const newBoardBtn   = document.getElementById('newBoardBtn');
  const newBoardOverlay = document.getElementById('newBoardOverlay');
  const newBoardClose = document.getElementById('newBoardClose');
  const newBoardCancel = document.getElementById('newBoardCancelBtn');
  const createBoardBtn = document.getElementById('createBoardBtn');
  const newBoardName  = document.getElementById('newBoardName');
  const colorPicker   = document.getElementById('boardColorPicker');
  const searchInput   = document.getElementById('boardSearch');
  const sortSelect    = document.getElementById('boardSort');
  const heading       = document.getElementById('newBoardModalHeading');
  let selectedColor   = '#C97D4E';
  let editMode        = false;
  let currentTab      = 'boards'; // Track active tab

  function render() {
    const { boards, searchQuery, sortOrder } = AppState.getState();
    
    // If grid is empty and boards exist, ensure they render
    if (grid.children.length === 0 && boards.length > 0) {
      grid.innerHTML = '';
    } else if (grid.innerHTML === '') {
      grid.innerHTML = ''; // Clear any stale content
    }

    // Filter and Sort logic
    let filtered = boards.filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()));
    
    filtered.sort((a, b) => {
      const pA = !!a.is_pinned;
      const pB = !!b.is_pinned;
      if (pA && !pB) return -1;
      if (!pA && pB) return 1;

      if (sortOrder === 'recent')    return new Date(b.updated_at) - new Date(a.updated_at);
      if (sortOrder === 'oldest')    return new Date(a.created_at) - new Date(b.created_at);
      if (sortOrder === 'alpha')     return a.title.localeCompare(b.title);
      if (sortOrder === 'alpha-rev') return b.title.localeCompare(a.title);
      return 0;
    });

    // Build the grid content
    const fragment = document.createDocumentFragment();
    
    filtered.forEach(board => {
      const card = Render.boardCard(board);
      card.addEventListener('click', e => {
        if (e.target.closest('[data-board-delete]') || e.target.closest('[data-board-pin]')) return;
        openBoard(board.id);
      });
      fragment.appendChild(card);
    });
    
    if (filtered.length === 0 && searchQuery) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.gridColumn = '1 / -1';
      empty.innerHTML = `<div class="empty-state-text">No boards found matching "${searchQuery}"</div>`;
      fragment.appendChild(empty);
    }

    // "New board" placeholder card
    const addCard = document.createElement('div');
    addCard.className = 'board-card-new';
    addCard.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none"><path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <span>New Board</span>`;
    addCard.addEventListener('click', showNewBoardModal);
    fragment.appendChild(addCard);

    // Clear and append all at once
    grid.innerHTML = '';
    grid.appendChild(fragment);
  }

  async function openBoard(boardId) {
    UI.showLoading();
    UI.setLoading('Opening board…', 40);
    try {
      // Update timestamp to support "Last Opened" sorting
      await sb.from('boards').update({ updated_at: new Date().toISOString() }).eq('id', boardId);
      
      const boardState = await Storage.initBoard(boardId);
      AppState.setState(s => {
        const b = s.boards.find(x => x.id === boardId);
        if (b) b.updated_at = new Date().toISOString();
        s.boards.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        return { ...s, view: 'board', ...boardState };
      }, true);
      UI.hideLoading();
      UI.showBoard();
      Board.render();
    } catch (err) {
      console.error('Open board error:', err);
      UI.setLoading('Failed to open board.', 100);
    }
  }

  function showNewBoardModal() {
    editMode = false;
    heading.textContent = 'New Board';
    createBoardBtn.textContent = 'Create Board';
    newBoardName.value = '';
    openModal();
  }

  function openModal() {
    newBoardOverlay.classList.add('open');
    newBoardName.focus();
    selectedColor = '#C97D4E';
    colorPicker.querySelectorAll('.color-swatch').forEach(s =>
      s.classList.toggle('active', s.dataset.color === selectedColor)
    );
    newBoardOverlay.classList.add('open');
    newBoardName.focus();
    document.body.style.overflow = 'hidden';
  }

  function showEditBoardModal() {
    const s = AppState.getState();
    editMode = true;
    heading.textContent = 'Board Settings';
    createBoardBtn.textContent = 'Save Changes';
    newBoardName.value = s.boardTitle;
    selectedColor = s.boardColor;
    openModal();
  }

  function hideNewBoardModal() {
    newBoardOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function handleBoardSubmit() {
    const title = newBoardName.value.trim();
    if (!title) { newBoardName.focus(); return; }
    hideNewBoardModal();

    if (editMode) {
      const { boardId } = AppState.getState();
      UI.setSyncStatus('saving');
      try {
        await Storage.updateBoardTitle(boardId, title);
        await Storage.updateBoardColor(boardId, selectedColor);
        AppState.setState(s => {
          s.boardTitle = title;
          s.boardColor = selectedColor;
          const b = s.boards.find(x => x.id === boardId);
          if (b) { b.title = title; b.color = selectedColor; b.updated_at = new Date().toISOString(); }
          return s;
        });
        UI.setSyncStatus('saved');
        Board.render(); // Refresh board view to show new color/title
      } catch (err) {
        console.error(err);
        UI.setSyncStatus('error');
      }
      return;
    }

    const userId = Auth.getUserId();
    UI.setSyncStatus('saving');
    try {
      const board = await Storage.createBoard(userId, title, selectedColor);
      // Seed default lists on the new board
      await Storage.seedBoard(board.id);
      // Add to state + render dashboard first so card is visually present
      AppState.setState(s => {
        s.boards.unshift(board); // put new board at top
        return s;
      });
      render(); // immediately repaint the grid
      UI.setSyncStatus('saved');
      // Then navigate into it
      await openBoard(board.id);
    } catch (err) {
      console.error('Create board error:', err);
      UI.setSyncStatus('error');
    }
  }

  async function deleteBoard(boardId) {
    if (!confirm('Delete this board and all its cards? This cannot be undone.')) return;
    AppState.setState(s => { s.boards = s.boards.filter(b => b.id !== boardId); return s; });
    UI.setSyncStatus('saving');
    try { await Storage.deleteBoard(boardId); UI.setSyncStatus('saved'); }
    catch (err) { console.error(err); UI.setSyncStatus('error'); }
  }

  // Color picker
  colorPicker?.addEventListener('click', e => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;
    selectedColor = swatch.dataset.color;
    colorPicker.querySelectorAll('.color-swatch').forEach(s =>
      s.classList.toggle('active', s.dataset.color === selectedColor)
    );
  });

  async function togglePin(boardId) {
    const board = AppState.getState().boards.find(b => b.id === boardId);
    if (!board) return;
    const newState = !board.is_pinned;
    
    AppState.setState(s => {
      const b = s.boards.find(x => x.id === boardId);
      if (b) b.is_pinned = newState;
      return s;
    });
    
    UI.setSyncStatus('saving');
    try {
      await Storage.updateBoardPin(boardId, newState);
      UI.setSyncStatus('saved');
    } catch (err) {
      console.error(err);
      UI.setSyncStatus('error');
    }
  }

  grid?.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-board-delete]');
    if (delBtn) { deleteBoard(delBtn.dataset.boardDelete); return; }
    
    const pinBtn = e.target.closest('[data-board-pin]');
    if (pinBtn) togglePin(pinBtn.dataset.boardPin);
  });

  searchInput?.addEventListener('input', e => AppState.setState(s => { s.searchQuery = e.target.value; return s; }));
  sortSelect?.addEventListener('change', e => AppState.setState(s => { s.sortOrder = e.target.value; return s; }));

  // Social tab switching
  document.getElementById('headerTabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.header-tab');
    if (!tab) return;
    currentTab = tab.dataset.tab;
    document.querySelectorAll('.header-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Update dashboard title and content based on tab
    const dashTitle = document.getElementById('dashboardTitle');
    if (dashTitle) {
      dashTitle.textContent = {
        'boards': 'My Boards',
        'shared': 'Shared with Me',
        'groups': 'Groups',
        'messages': 'Messages'
      }[currentTab] || 'My Boards';
    }
    
    // TODO: Filter/display based on selected tab
    render();
  });

  newBoardBtn?.addEventListener('click', showNewBoardModal);
  document.getElementById('boardSettingsBtn')?.addEventListener('click', showEditBoardModal);
  
  newBoardClose?.addEventListener('click', hideNewBoardModal);
  newBoardCancel?.addEventListener('click', hideNewBoardModal);
  createBoardBtn?.addEventListener('click', handleBoardSubmit);
  
  newBoardOverlay?.addEventListener('click', e => { if (e.target === newBoardOverlay) hideNewBoardModal(); });
  newBoardName?.addEventListener('keydown', e => { if (e.key === 'Enter') handleBoardSubmit(); if (e.key === 'Escape') hideNewBoardModal(); });
  
  AppState.subscribe(state => { if (state.view === 'dashboard') render(); });

  return { render, openBoard };
})();

/* ═══════════════════════════════════════════════════════════
   BOARD
   ═══════════════════════════════════════════════════════════ */

const Board = (() => {
  const boardScroll   = document.getElementById('boardScroll');
  const addListBtn    = document.getElementById('addListBtn');
  const addListGhost  = document.getElementById('addListGhost');
  const boardTitleEl  = document.getElementById('boardTitle');

  let activeAddCardListId = null;
  let activeAddListForm   = null;
  let activeMenu          = null;

  function render() {
    const state = AppState.getState();

    // Update header title
    if (document.activeElement !== boardTitleEl) {
      boardTitleEl.textContent = state.boardTitle;
    }

    // Set accent color from board color
    document.documentElement.style.setProperty('--accent', state.boardColor || '#C97D4E');

    boardScroll.querySelectorAll('.list, .add-list-form').forEach(el => el.remove());
    state.lists.forEach(list => boardScroll.insertBefore(Render.list(list), addListGhost));
    attachDragListeners();
  }

  /* ── Drag ── */

  function attachDragListeners() {
    boardScroll.querySelectorAll('.card').forEach(cardEl => {
      cardEl.addEventListener('mousedown', onCardMouseDown);
      cardEl.addEventListener('touchstart', onCardTouchStart, { passive: true });
    });
  }

  function onCardMouseDown(e) {
    if (e.button !== 0 || e.target.closest('[contenteditable]')) return;
    const cardEl = e.currentTarget;
    const cardId = cardEl.dataset.cardId;
    const listId = cardEl.closest('.list')?.dataset.listId;
    let dragging = false;
    const sx = e.clientX, sy = e.clientY;

    const onMove = me => {
      if (!dragging && (Math.abs(me.clientX-sx)>5||Math.abs(me.clientY-sy)>5)) { dragging=true; DragEngine.start(cardEl,cardId,listId); }
      if (dragging) DragEngine.move(me.clientX,me.clientY);
    };
    const onUp = async me => {
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      if (!dragging) { CardModal.open(cardId,listId); return; }
      const drop = getDropTarget(me.clientX,me.clientY);
      if (drop) await handleDrop(DragEngine.end(drop.listId,drop.index));
      else { DragEngine.cancel(); render(); }
    };
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  }

  function onCardTouchStart(e) {
    const cardEl = e.currentTarget;
    const cardId = cardEl.dataset.cardId;
    const listId = cardEl.closest('.list')?.dataset.listId;
    const t0 = e.touches[0]; let dragging = false;
    const sx = t0.clientX, sy = t0.clientY;
    const onMove = te => {
      const t = te.touches[0];
      if (!dragging&&(Math.abs(t.clientX-sx)>8||Math.abs(t.clientY-sy)>8)){dragging=true;DragEngine.start(cardEl,cardId,listId);}
      if (dragging){te.preventDefault();DragEngine.move(t.clientX,t.clientY);}
    };
    const onEnd = async te => {
      document.removeEventListener('touchmove',onMove);
      document.removeEventListener('touchend',onEnd);
      if (!dragging){CardModal.open(cardId,listId);return;}
      const t=te.changedTouches[0]; const drop=getDropTarget(t.clientX,t.clientY);
      if (drop) await handleDrop(DragEngine.end(drop.listId,drop.index));
      else{DragEngine.cancel();render();}
    };
    document.addEventListener('touchmove',onMove,{passive:false});
    document.addEventListener('touchend',onEnd);
  }

  async function handleDrop({ cardId, sourceListId, targetListId, targetIndex }) {
    const state = AppState.getState();
    const srcCards = state.lists.find(l=>l.id===sourceListId)?.cards;
    const cardIdx  = srcCards?.findIndex(c=>c.id===cardId);
    if (cardIdx===undefined||cardIdx===-1){render();return;}

    AppState.setState(s => {
      const src=s.lists.find(l=>l.id===sourceListId), dest=s.lists.find(l=>l.id===targetListId);
      const [card]=src.cards.splice(cardIdx,1);
      dest.cards.splice(targetIndex??dest.cards.length,0,card);
      return s;
    });

    UI.setSyncStatus('saving');
    try {
      const ns=AppState.getState();
      const destList=ns.lists.find(l=>l.id===targetListId);
      const newPos=destList.cards.findIndex(c=>c.id===cardId);
      await Storage.moveCard(cardId,targetListId,newPos,state.boardId);
      await Storage.reorderCards(destList.cards);
      if (sourceListId!==targetListId) await Storage.reorderCards(ns.lists.find(l=>l.id===sourceListId).cards);
      UI.setSyncStatus('saved');
    } catch(err){console.error(err);UI.setSyncStatus('error');}
  }

  function getDropTarget(cx, cy) {
    for (const container of boardScroll.querySelectorAll('.cards-container')) {
      const r=container.getBoundingClientRect();
      if (cx>=r.left&&cx<=r.right&&cy>=r.top&&cy<=r.bottom) {
        const listId=container.dataset.listId;
        const cards=[...container.querySelectorAll('.card:not(.dragging)')];
        let index=cards.length;
        for(let i=0;i<cards.length;i++){const cr=cards[i].getBoundingClientRect();if(cy<cr.top+cr.height/2){index=i;break;}}
        return{listId,index};
      }
    }
    return null;
  }

  /* ── Add Card ── */

  function showAddCardForm(listId) {
    if (activeAddCardListId===listId) return;
    hideAddCardForm();
    const listEl=boardScroll.querySelector(`.list[data-list-id="${listId}"]`);
    if (!listEl) return;
    const footer=listEl.querySelector('.list-footer');
    const addBtn=listEl.querySelector('.add-card-btn');
    const form=document.getElementById('addCardFormTemplate').content.cloneNode(true).querySelector('.add-card-form');
    const input=form.querySelector('.add-card-input');
    const confirm=form.querySelector('.btn-confirm');
    const cancel=form.querySelector('.btn-cancel-form');
    addBtn.style.display='none';
    footer.insertBefore(form,footer.firstChild);
    input.focus();
    activeAddCardListId=listId;

    const doAdd=async()=>{
      const title=input.value.trim();
      hideAddCardForm();
      if(!title)return;
      const state=AppState.getState();
      const pos=state.lists.find(l=>l.id===listId)?.cards.length??0;
      UI.setSyncStatus('saving');
      try{
        const c=await Storage.createCard(state.boardId,listId,title,pos);
        AppState.setState(s=>{const l=s.lists.find(x=>x.id===listId);if(l)l.cards.push({id:c.id,title:c.title,description:'',dueDate:'',dueTime:'',priority:'',phone:'',reminders:[],position:c.position});return s;});
        UI.setSyncStatus('saved');
      }catch(err){console.error(err);UI.setSyncStatus('error');}
    };
    confirm.addEventListener('click',doAdd);
    cancel.addEventListener('click',hideAddCardForm);
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doAdd();}if(e.key==='Escape')hideAddCardForm();});
  }

  function hideAddCardForm() {
    if (!activeAddCardListId) return;
    const listEl=boardScroll.querySelector(`.list[data-list-id="${activeAddCardListId}"]`);
    if (listEl){listEl.querySelector('.add-card-form')?.remove();const b=listEl.querySelector('.add-card-btn');if(b)b.style.display='';}
    activeAddCardListId=null;
  }

  /* ── Add List ── */

  function showAddListForm() {
    if (activeAddListForm) return;
    const form=document.createElement('div');
    form.className='add-list-form';
    form.innerHTML=`<input class="add-list-input" type="text" placeholder="List title…" maxlength="60" /><div class="add-list-actions"><button class="btn-confirm">Add List</button><button class="btn-cancel-form"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>`;
    const input=form.querySelector('.add-list-input');
    const confirm=form.querySelector('.btn-confirm');
    const cancel=form.querySelector('.btn-cancel-form');
    boardScroll.insertBefore(form,addListGhost);
    input.focus();
    activeAddListForm=form;

    const doAdd=async()=>{
      const title=input.value.trim();
      hideAddListForm();
      if(!title)return;
      const state=AppState.getState();
      UI.setSyncStatus('saving');
      try{
        const l=await Storage.createList(state.boardId,title,state.lists.length);
        AppState.setState(s=>{s.lists.push({id:l.id,title:l.title,position:l.position,cards:[]});return s;});
        UI.setSyncStatus('saved');
      }catch(err){console.error(err);UI.setSyncStatus('error');}
    };
    confirm.addEventListener('click',doAdd);
    cancel.addEventListener('click',hideAddListForm);
    input.addEventListener('keydown',e=>{if(e.key==='Enter')doAdd();if(e.key==='Escape')hideAddListForm();});
  }

  function hideAddListForm(){if(activeAddListForm){activeAddListForm.remove();activeAddListForm=null;}}

  /* ── List Menu ── */

  function showListMenu(listId, btnEl) {
    closeAllMenus();
    const menu=document.createElement('div');
    menu.className='list-menu';
    menu.innerHTML=`
      <div class="list-menu-item" data-action="clear">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12l-1.5 9H3.5L2 4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 2h5M1 4h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        Clear all cards
      </div>
      <div class="list-menu-item danger" data-action="delete">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12l-1.5 9H3.5L2 4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 2h5M1 4h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        Delete list
      </div>`;
    btnEl.parentElement.style.position='relative';
    btnEl.parentElement.appendChild(menu);
    activeMenu={menu,listId};

    menu.addEventListener('click',async e=>{
      const item=e.target.closest('.list-menu-item');
      if(!item)return;
      const action=item.dataset.action;
      closeAllMenus();
      UI.setSyncStatus('saving');
      try{
        if(action==='delete'){AppState.setState(s=>{s.lists=s.lists.filter(l=>l.id!==listId);return s;});await Storage.deleteList(listId);}
        else if(action==='clear'){AppState.setState(s=>{const l=s.lists.find(x=>x.id===listId);if(l)l.cards=[];return s;});await Storage.clearListCards(listId);}
        UI.setSyncStatus('saved');
      }catch(err){console.error(err);UI.setSyncStatus('error');}
    });
  }

  function closeAllMenus(){if(activeMenu){activeMenu.menu.remove();activeMenu=null;}}

  /* ── Events ── */

  boardScroll.addEventListener('click', e=>{
    const addCardBtn=e.target.closest('[data-add-card]');
    if(addCardBtn){showAddCardForm(addCardBtn.dataset.addCard);return;}
    const menuBtn=e.target.closest('[data-list-menu]');
    if(menuBtn){const id=menuBtn.dataset.listMenu;activeMenu?.listId===id?closeAllMenus():showListMenu(id,menuBtn);return;}
    if(!e.target.closest('.list-menu'))closeAllMenus();
  });

  boardScroll.addEventListener('blur',async e=>{
    const el=e.target.closest('.list-title[data-list-id]');
    if(!el)return;
    const listId=el.dataset.listId, newTitle=el.textContent.trim();
    if(!newTitle){el.textContent=AppState.getState().lists.find(l=>l.id===listId)?.title||'Untitled';return;}
    AppState.setState(s=>{const l=s.lists.find(x=>x.id===listId);if(l)l.title=newTitle;return s;});
    UI.setSyncStatus('saving');
    try{await Storage.updateListTitle(listId,newTitle);UI.setSyncStatus('saved');}
    catch(err){console.error(err);UI.setSyncStatus('error');}
  },true);

  boardScroll.addEventListener('keydown',e=>{
    if(e.target.closest('.list-title')&&e.key==='Enter'){e.preventDefault();e.target.blur();}
  });

  boardTitleEl.addEventListener('blur',async()=>{
    const newTitle=boardTitleEl.textContent.trim();
    if(!newTitle){boardTitleEl.textContent=AppState.getState().boardTitle;return;}
    const{boardId}=AppState.getState();
    AppState.setState(s=>{
      s.boardTitle=newTitle;
      // Fix: Update the title in the boards list so Dashboard reflects the change
      const b = s.boards.find(x => x.id === boardId);
      if (b) {
        b.title = newTitle;
        b.updated_at = new Date().toISOString();
      }
      return s;
    });
    UI.setSyncStatus('saving');
    try{await Storage.updateBoardTitle(boardId,newTitle);UI.setSyncStatus('saved');}
    catch(err){console.error(err);UI.setSyncStatus('error');}
  });
  boardTitleEl.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();boardTitleEl.blur();}});

  addListBtn?.addEventListener('click',showAddListForm);
  addListGhost?.addEventListener('click',showAddListForm);

  document.addEventListener('click',e=>{
    if(activeAddCardListId&&!e.target.closest('.add-card-form')&&!e.target.closest('[data-add-card]'))hideAddCardForm();
    if(activeAddListForm&&!e.target.closest('.add-list-form')&&!e.target.closest('#addListBtn')&&!e.target.closest('#addListGhost'))hideAddListForm();
  });

  AppState.subscribe(state=>{if(state.view==='board')render();});

  return { render };
})();

/* ═══════════════════════════════════════════════════════════
   SMS SETUP MODAL
   ═══════════════════════════════════════════════════════════ */

const SmsSetup = (() => {
  const overlay   = document.getElementById('smsSetupOverlay');
  const phoneEl   = document.getElementById('smsSetupPhone');
  const saveBtn   = document.getElementById('smsSetupSave');
  const skipBtn   = document.getElementById('smsSetupSkip');
  const closeBtn  = document.getElementById('smsSetupClose');

  function open() {
    if (!overlay) return;
    const profile = AppState.getState().profile;
    if (phoneEl) phoneEl.value = profile?.phone || '';
    overlay.classList.add('open');
    phoneEl?.focus();
    document.body.style.overflow = 'hidden';
  }

  function close() {
    overlay?.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function saveAndEnable() {
    const phone = phoneEl?.value.trim();
    if (!phone) { phoneEl?.focus(); return; }
    const userId = Auth.getUserId();
    saveBtn.textContent = '…';
    try {
      await Storage.upsertProfile(userId, { phone, sms_enabled: true });
      AppState.setState(s => {
        if (s.profile) { s.profile.phone = phone; s.profile.sms_enabled = true; }
        return s;
      });
      UI.setProfile(AppState.getState().profile);
      close();
    } catch (err) {
      console.error(err);
      saveBtn.textContent = 'Error';
      setTimeout(() => { saveBtn.textContent = 'Save & Enable'; }, 1800);
    }
  }

  saveBtn?.addEventListener('click', saveAndEnable);
  skipBtn?.addEventListener('click', close);
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', e => { if (e.target === overlay) close(); });
  phoneEl?.addEventListener('keydown', e => { if (e.key === 'Enter') saveAndEnable(); if (e.key === 'Escape') close(); });

  return { open, close };
})();

/* ═══════════════════════════════════════════════════════════
   PROFILE DROPDOWN
   ═══════════════════════════════════════════════════════════ */

const ProfileMenu = (() => {
  const wrap      = document.getElementById('profileWrap');
  const btn       = document.getElementById('profileBtn');
  const dropdown  = document.getElementById('profileDropdown');
  const saveBtn   = document.getElementById('saveNameBtn');
  const nameInput = document.getElementById('profileNameInput');
  const smsToggle = document.getElementById('smsToggle');
  const phoneWrap = document.getElementById('profilePhoneWrap');
  const phoneInput= document.getElementById('profilePhoneInput');
  const savePhone = document.getElementById('savePhoneBtn');
  let open = false;

  function show() {
    open = true;
    dropdown.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    Theme.apply(Theme.get());
  }

  function hide() {
    open = false;
    dropdown.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }

  function toggle() { open ? hide() : show(); }

  btn?.addEventListener('click', e => { e.stopPropagation(); toggle(); });

  document.addEventListener('click', e => {
    if (open && !wrap?.contains(e.target)) hide();
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) hide(); });

  // Theme buttons
  document.getElementById('themeOptions')?.addEventListener('click', e => {
    const tb = e.target.closest('.theme-btn');
    if (tb) Theme.apply(tb.dataset.theme);
  });

  // Save display name
  saveBtn?.addEventListener('click', async () => {
    const name = nameInput?.value.trim();
    if (!name) return;
    const userId = Auth.getUserId();
    saveBtn.textContent = '…';
    try {
      await Storage.upsertProfile(userId, { display_name: name });
      AppState.setState(s => { if (s.profile) s.profile.display_name = name; return s; });
      UI.setProfile(AppState.getState().profile);
      saveBtn.textContent = 'Saved!';
      setTimeout(() => { saveBtn.textContent = 'Save'; }, 1800);
    } catch (err) {
      console.error(err);
      saveBtn.textContent = 'Error';
      setTimeout(() => { saveBtn.textContent = 'Save'; }, 1800);
    }
  });

  nameInput?.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn?.click(); });

  // SMS toggle
  smsToggle?.addEventListener('click', async () => {
    const profile = AppState.getState().profile;
    const currentlyOn = !!profile?.sms_enabled;

    if (!currentlyOn) {
      // Turning ON — if no phone yet, show setup modal
      if (!profile?.phone?.trim()) {
        hide();
        SmsSetup.open();
        return;
      }
      // Has phone already — just enable
      await setSmsEnabled(true);
    } else {
      await setSmsEnabled(false);
    }
  });

  async function setSmsEnabled(val) {
    const userId = Auth.getUserId();
    try {
      await Storage.upsertProfile(userId, { sms_enabled: val });
      AppState.setState(s => { if (s.profile) s.profile.sms_enabled = val; return s; });
      UI.setProfile(AppState.getState().profile);
    } catch (err) { console.error(err); }
  }

  // Save phone number
  savePhone?.addEventListener('click', async () => {
    const phone = phoneInput?.value.trim();
    const userId = Auth.getUserId();
    savePhone.textContent = '…';
    try {
      await Storage.upsertProfile(userId, { phone });
      AppState.setState(s => { if (s.profile) s.profile.phone = phone; return s; });
      UI.setProfile(AppState.getState().profile);
      savePhone.textContent = 'Saved!';
      setTimeout(() => { savePhone.textContent = 'Save'; }, 1800);
    } catch (err) {
      console.error(err);
      savePhone.textContent = 'Error';
      setTimeout(() => { savePhone.textContent = 'Save'; }, 1800);
    }
  });

  phoneInput?.addEventListener('keydown', e => { if (e.key === 'Enter') savePhone?.click(); });

  // Sign out
  document.getElementById('signOutBtn')?.addEventListener('click', async () => {
    hide();
    try { await Auth.signOut(); } catch (err) { console.error(err); }
  });

  return { hide };
})();

/* ═══════════════════════════════════════════════════════════
   AUTH UI
   ═══════════════════════════════════════════════════════════ */

function initAuthUI() {
  const signInForm = document.getElementById('signInForm');
  const signUpForm = document.getElementById('signUpForm');

  document.getElementById('showSignUp')?.addEventListener('click', e => {
    e.preventDefault(); signInForm.style.display='none'; signUpForm.style.display=''; UI.authError('');
  });
  document.getElementById('showSignIn')?.addEventListener('click', e => {
    e.preventDefault(); signUpForm.style.display='none'; signInForm.style.display=''; UI.authError('');
  });

  document.getElementById('signInBtn')?.addEventListener('click', async () => {
    const email    = document.getElementById('signInEmail')?.value.trim();
    const password = document.getElementById('signInPassword')?.value;
    UI.authError('');
    try { await Auth.signIn(email, password); }
    catch (err) { UI.authError(err.message || 'Sign in failed.'); }
  });

  // Google Sign-In
  document.getElementById('signInGoogleBtn')?.addEventListener('click', async () => {
    UI.authError('');
    try {
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (err) { 
      UI.authError(err.message || 'Google sign in failed. Make sure Google OAuth is configured in Supabase.'); 
    }
  });

  document.getElementById('signUpBtn')?.addEventListener('click', async () => {
    const email    = document.getElementById('signUpEmail')?.value.trim();
    const name     = document.getElementById('signUpName')?.value.trim();
    const password = document.getElementById('signUpPassword')?.value;
    UI.authError('');
    try {
      await Auth.signUp(email, password, name);
      signUpForm.innerHTML = `
        <div style="text-align:center;padding:12px 0;color:var(--green);">
          <div style="font-size:2rem;margin-bottom:8px;">✓</div>
          <p style="font-weight:500;line-height:1.5;">Account created!<br>Check your email to confirm, then sign in.</p>
        </div>
        <p class="auth-switch" style="margin-top:16px;"><a href="#" id="backToSignIn">Back to sign in</a></p>`;
      document.getElementById('backToSignIn')?.addEventListener('click', e => {
        e.preventDefault(); signUpForm.style.display='none'; signInForm.style.display='';
      });
    } catch (err) { UI.authError(err.message || 'Sign up failed.'); }
  });

  ['signInEmail','signInPassword'].forEach(id =>
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('signInBtn')?.click(); })
  );
  ['signUpEmail','signUpName','signUpPassword'].forEach(id =>
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('signUpBtn')?.click(); })
  );
}

/* ═══════════════════════════════════════════════════════════
   SMS REMINDERS (RapidAPI)
   ═══════════════════════════════════════════════════════════
   Replace RAPIDAPI_KEY with your key from rapidapi.com.
   The default host targets the "sms77" (now "seven") API which
   is widely available on RapidAPI. Swap host + endpoint for any
   other SMS provider on the platform — the shape stays the same.
   ═══════════════════════════════════════════════════════════ */

const SMS = (() => {
  // ── Configure these two constants ──
  const RAPIDAPI_KEY  = 'YOUR_RAPIDAPI_KEY_HERE';
  const RAPIDAPI_HOST = 'sms77io.p.rapidapi.com'; // swap for any RapidAPI SMS provider

  /**
   * Send a single SMS.
   * @param {string} to    – E.164 format, e.g. "+12125551234"
   * @param {string} text  – Message body (max ~160 chars for a single segment)
   */
  async function send(to, text) {
    if (!to || !text) throw new Error('SMS: missing "to" or "text"');
    if (RAPIDAPI_KEY === 'YOUR_RAPIDAPI_KEY_HERE') {
      console.warn('SMS: set your RAPIDAPI_KEY in app.js to enable real sending.');
      return { ok: false, reason: 'no_key' };
    }

    const resp = await fetch('https://sms77io.p.rapidapi.com/sms', {
      method: 'POST',
      headers: {
        'content-type':    'application/json',
        'X-RapidAPI-Key':  RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
      body: JSON.stringify({ to, text, from: 'TaskDeck' }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`SMS send failed: ${resp.status} ${err}`);
    }
    return resp.json();
  }

  /**
   * Compute and dispatch all due reminders for the given card.
   * Called on page load and whenever a card is saved.
   * Skips reminders that are in the past or have no phone number.
   * @param {object} card – card object with dueDate, dueTime, phone, reminders[]
   */
  async function dispatchCardReminders(card) {
    const phone = card.phone?.trim();
    if (!phone) return;

    const now = Date.now();

    // Main due-date reminder (1 hour before deadline)
    if (card.dueDate) {
      const timeStr = card.dueTime || '09:00';
      const deadline = new Date(`${card.dueDate}T${timeStr}`).getTime();
      const triggerAt = deadline - 60 * 60 * 1000; // 1 h before
      if (triggerAt > now) {
        const delay = triggerAt - now;
        const msg = `TaskDeck reminder: "${card.title}" is due at ${formatTime12(timeStr)} on ${card.dueDate}.`;
        setTimeout(() => send(phone, msg).catch(console.error), delay);
      }
    }

    // Custom per-card reminders
    (card.reminders || []).forEach(r => {
      if (!r.date) return;
      const t = new Date(`${r.date}T${r.time || '09:00'}`).getTime();
      if (t > now) {
        const delay = t - now;
        const msg = `TaskDeck reminder: "${card.title}"${card.dueDate ? ` is due ${card.dueDate}` : ''}.`;
        setTimeout(() => send(phone, msg).catch(console.error), delay);
      }
    });
  }

  function formatTime12(val) {
    if (!val) return '';
    const [h, m] = val.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    const hh   = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2,'0')} ${ampm}`;
  }

  return { send, dispatchCardReminders, formatTime12 };
})();



let bootTimer = null;

function startBootTimer(isDataSync = false) {
  if (bootTimer) clearTimeout(bootTimer);
  const recovery = document.getElementById('loadingRecovery');
  if (recovery) recovery.style.display = 'none';
  
  const msg = isDataSync ? 'Data sync is taking longer than usual...' : 'App startup is taking longer than usual...';

  bootTimer = setTimeout(() => {
    const rec = document.getElementById('loadingRecovery');
    if (rec) {
      rec.style.display = 'flex';
      UI.setLoading(msg, 100);
    }
  }, 7000);
}

document.addEventListener('DOMContentLoaded', async () => {
  Theme.init();
  initAuthUI();

  // Show loading immediately to provide visual feedback and prevent "black screen"
  UI.showLoading();
  UI.setLoading('Starting TaskDeck…', 10);
  startBootTimer();

  // Home button → back to dashboard
  document.getElementById('logoHomeBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    AppState.setState(s => ({ ...s, view: 'dashboard' }));
    UI.showDashboard();
    Dashboard.render();
  });

  // Force Reset functionality
  document.getElementById('forceResetBtn')?.addEventListener('click', () => {
    localStorage.clear();
    Auth.signOut().finally(() => window.location.reload());
  });

  await Auth.init(
    async user => {
      UI.hideAuth();
      startBootTimer(true);

      try {
        UI.setLoading('Fetching profile…', 40);
        // Load profile
        let profile = await Storage.getProfile(user.id);
        if (!profile) {
          UI.setLoading('Creating profile…', 50);
          const displayName = user.user_metadata?.display_name || '';
          await Storage.upsertProfile(user.id, { display_name: displayName, email: user.email });
          profile = { id: user.id, display_name: displayName, email: user.email };
        } else {
          profile.email = user.email;
        }

        UI.setLoading('Syncing boards…', 70);
        // Load boards
        const boards = await Storage.getBoards(user.id);

        AppState.setState(() => ({
          view: 'dashboard',
          profile,
          boards,
          boardId: null,
          boardTitle: '',
          boardColor: '#C97D4E',
          lists: [],
        }), true);

        UI.setProfile(profile);
        UI.setLoading('Success', 100);
        
        clearTimeout(bootTimer);
        UI.hideLoading();
        UI.showApp();
        UI.showDashboard();
        Dashboard.render();
      } catch (err) {
        console.error('Boot error:', err);
        UI.setLoading('Data sync failed.', 100);
        clearTimeout(bootTimer);
        document.getElementById('loadingRecovery').style.display = 'flex';
      }
    },
    () => {
      clearTimeout(bootTimer);
      UI.hideLoading();
      UI.hideApp();
      UI.showAuth();
    }
  );
});