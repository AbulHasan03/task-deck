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

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark     = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.setAttribute('data-theme', useDark ? 'dark' : 'light');

    // Highlight active button
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }

  function init() {
    apply(currentTheme);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentTheme === 'system') apply('system');
    });
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
    this.el('syncStatus').style.display      = 'none';
  },

  showBoard() {
    this.el('dashboard').style.display      = 'none';
    this.el('boardContainer').style.display = '';
    this.el('boardBreadcrumb').style.display = '';
    this.el('addListBtn').style.display      = '';
    this.el('syncStatus').style.display      = '';
  },

  setProfile(profile) {
    const initial = (profile?.display_name || profile?.email || '?').charAt(0).toUpperCase();
    const name    = profile?.display_name || '';
    const email   = profile?.email        || '';

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
    sb.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        currentUser = session.user;
        await onSignedIn(currentUser);
      } else {
        currentUser = null;
        onSignedOut();
      }
    });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) onSignedOut();
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
      .select('id, title, color, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
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
    const { error } = await sb.from('boards').update({ title }).eq('id', boardId);
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
          priority:    c.priority    || '',
          position:    c.position,
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
    el.innerHTML = `
      <div class="board-card-color" style="background:${color};"></div>
      <div class="board-card-body">
        <div class="board-card-title">${this.esc(board.title)}</div>
        <div class="board-card-meta">${new Date(board.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      </div>
      <div class="board-card-actions">
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
      meta.push(`<span class="card-badge date ${d < today ? 'overdue' : ''}">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 1v3M11 1v3M1 7h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>`);
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
  const prioGroup = document.getElementById('priorityGroup');

  function open(cardId, listId) {
    const { lists } = AppState.getState();
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
    overlay.classList.add('open');
    titleEl.focus();
    document.body.style.overflow = 'hidden';
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
    const fields = {
      title:       newTitle,
      description: descEl.value.trim() || null,
      due_date:    dateEl.value        || null,
      priority:    selectedPriority    || null,
    };
    AppState.setState(s => {
      const c = s.lists.find(l => l.id === listId)?.cards.find(c => c.id === cardId);
      if (c) { c.title = newTitle; c.description = fields.description||''; c.dueDate = fields.due_date||''; c.priority = fields.priority||''; }
      return s;
    });
    close();
    UI.setSyncStatus('saving');
    try { await Storage.updateCard(cardId, fields); UI.setSyncStatus('saved'); }
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
  let selectedColor   = '#C97D4E';

  function render() {
    const { boards } = AppState.getState();
    grid.innerHTML = '';

    boards.forEach(board => {
      const card = Render.boardCard(board);
      card.addEventListener('click', e => {
        if (e.target.closest('[data-board-delete]')) return;
        openBoard(board.id);
      });
      grid.appendChild(card);
    });

    // "New board" placeholder card
    const addCard = document.createElement('div');
    addCard.className = 'board-card board-card-new';
    addCard.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none"><path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <span>New Board</span>`;
    addCard.addEventListener('click', showNewBoardModal);
    grid.appendChild(addCard);
  }

  async function openBoard(boardId) {
    UI.showLoading();
    UI.setLoading('Opening board…', 40);
    try {
      const boardState = await Storage.initBoard(boardId);
      AppState.setState(s => ({ ...s, view: 'board', ...boardState }), true);
      UI.hideLoading();
      UI.showBoard();
      Board.render();
    } catch (err) {
      console.error('Open board error:', err);
      UI.setLoading('Failed to open board.', 100);
    }
  }

  function showNewBoardModal() {
    newBoardName.value = '';
    selectedColor = '#C97D4E';
    colorPicker.querySelectorAll('.color-swatch').forEach(s =>
      s.classList.toggle('active', s.dataset.color === selectedColor)
    );
    newBoardOverlay.classList.add('open');
    newBoardName.focus();
    document.body.style.overflow = 'hidden';
  }

  function hideNewBoardModal() {
    newBoardOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function createBoard() {
    const title = newBoardName.value.trim();
    if (!title) { newBoardName.focus(); return; }
    hideNewBoardModal();

    const userId = Auth.getUserId();
    UI.setSyncStatus('saving');
    try {
      const board = await Storage.createBoard(userId, title, selectedColor);
      // Seed default lists on the new board
      await Storage.seedBoard(board.id);
      AppState.setState(s => { s.boards.push(board); return s; });
      UI.setSyncStatus('saved');
      // Navigate directly into the new board
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

  // Delete board button (delegated)
  grid?.addEventListener('click', e => {
    const btn = e.target.closest('[data-board-delete]');
    if (btn) deleteBoard(btn.dataset.boardDelete);
  });

  newBoardBtn?.addEventListener('click', showNewBoardModal);
  newBoardClose?.addEventListener('click', hideNewBoardModal);
  newBoardCancel?.addEventListener('click', hideNewBoardModal);
  createBoardBtn?.addEventListener('click', createBoard);
  newBoardOverlay?.addEventListener('click', e => { if (e.target === newBoardOverlay) hideNewBoardModal(); });
  newBoardName?.addEventListener('keydown', e => { if (e.key === 'Enter') createBoard(); if (e.key === 'Escape') hideNewBoardModal(); });

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
        AppState.setState(s=>{const l=s.lists.find(x=>x.id===listId);if(l)l.cards.push({id:c.id,title:c.title,description:'',dueDate:'',priority:'',position:c.position});return s;});
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
    AppState.setState(s=>{s.boardTitle=newTitle;return s;});
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
   PROFILE DROPDOWN
   ═══════════════════════════════════════════════════════════ */

const ProfileMenu = (() => {
  const wrap     = document.getElementById('profileWrap');
  const btn      = document.getElementById('profileBtn');
  const dropdown = document.getElementById('profileDropdown');
  const saveBtn  = document.getElementById('saveNameBtn');
  const nameInput = document.getElementById('profileNameInput');
  let open = false;

  function show() {
    open = true;
    dropdown.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    // Sync theme buttons
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
   BOOT
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  Theme.init();
  initAuthUI();

  // Home button → back to dashboard
  document.getElementById('logoHomeBtn')?.addEventListener('click', () => {
    AppState.setState(s => ({ ...s, view: 'dashboard' }));
    UI.showDashboard();
    Dashboard.render();
  });

  await Auth.init(
    async user => {
      UI.hideAuth();

      UI.showLoading();
      UI.setLoading('Loading your boards…', 30);

      try {
        // Load profile
        let profile = await Storage.getProfile(user.id);
        if (!profile) {
          const displayName = user.user_metadata?.display_name || '';
          await Storage.upsertProfile(user.id, { display_name: displayName, email: user.email });
          profile = { id: user.id, display_name: displayName, email: user.email };
        } else {
          profile.email = user.email;
        }

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
        UI.setLoading('', 100);
        UI.hideLoading();
        UI.showApp();
        UI.showDashboard();
        Dashboard.render();
      } catch (err) {
        console.error('Boot error:', err);
        UI.setLoading('Failed to load. Check your Supabase config.', 100);
      }
    },
    () => {
      UI.hideLoading();
      UI.hideApp();
      UI.showAuth();
    }
  );
});