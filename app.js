/**
 * TaskDeck — Kanban Board Application
 * ─────────────────────────────────
 * SETUP:
 *  1. Create a Supabase project at https://supabase.com
 *  2. Run schema.sql in the Supabase SQL editor
 *  3. Replace the two constants below (Project Settings → API)
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/* ═══════════════════════════════════════════════════════════
   ⚙️  CONFIGURATION
   ═══════════════════════════════════════════════════════════ */

const SUPABASE_URL      = 'https://cagykqeunkljhldtkmqq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gQeFmfSyBsEsNKA8sL1X-Q_OHhaoxd6';

/* ═══════════════════════════════════════════════════════════
   SUPABASE CLIENT
   ═══════════════════════════════════════════════════════════ */

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

  showLoading()  { this.el('loadingScreen')?.classList.add('visible'); },
  hideLoading()  { this.el('loadingScreen')?.classList.remove('visible'); },

  showAuth()     { this.el('authOverlay')?.classList.add('visible'); },
  hideAuth()     { this.el('authOverlay')?.classList.remove('visible'); },

  setSyncStatus(status) {
    // status: 'saving' | 'saved' | 'error'
    const dot   = this.el('syncDot');
    const label = this.el('syncLabel');
    if (!dot || !label) return;
    dot.className     = `sync-dot sync-${status}`;
    label.textContent = status === 'saving' ? 'Saving…' : status === 'error' ? 'Error' : 'Saved';
  },

  authError(msg) {
    const el = this.el('authError');
    if (!el) return;
    el.textContent    = msg;
    el.style.display  = msg ? '' : 'none';
  },

  setAvatar(email) {
    const el = this.el('userAvatar');
    if (el && email) { el.textContent = email.charAt(0).toUpperCase(); el.title = email; }
  },
};

/* ═══════════════════════════════════════════════════════════
   AUTH CONTROLLER
   ═══════════════════════════════════════════════════════════ */

const Auth = (() => {
  let currentUser = null;

  function getUser()   { return currentUser; }
  function getUserId() { return currentUser?.id ?? null; }

  async function init(onSignedIn, onSignedOut) {
    // React to future auth changes (login, logout, token refresh)
    sb.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        currentUser = session.user;
        UI.setAvatar(currentUser.email);
        await onSignedIn(currentUser);
      } else {
        currentUser = null;
        onSignedOut();
      }
    });

    // Check for an existing session on page load
    const { data: { session } } = await sb.auth.getSession();
    if (!session) onSignedOut();
  }

  async function signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email, password) {
    const { error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  return { init, signIn, signUp, signOut, getUser, getUserId };
})();

/* ═══════════════════════════════════════════════════════════
   STORAGE — Supabase DB adapter
   ─────────────────────────────────────────────────────────
   All database interactions live here. To switch to a
   different backend (REST API, Firebase, etc.) only this
   module needs to change. AppState and Board never call
   Supabase directly.
   ═══════════════════════════════════════════════════════════ */

const Storage = {

  /* ── Boards ── */

  async updateBoardTitle(boardId, title) {
    const { error } = await sb
      .from('boards')
      .update({ title })
      .eq('id', boardId);
    if (error) throw error;
  },

  /* ── Lists ── */

  async createList(boardId, title, position) {
    const { data, error } = await sb
      .from('lists')
      .insert({ board_id: boardId, title, position })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateListTitle(listId, title) {
    const { error } = await sb
      .from('lists')
      .update({ title })
      .eq('id', listId);
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
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateCard(cardId, fields) {
    const { error } = await sb
      .from('cards')
      .update(fields)
      .eq('id', cardId);
    if (error) throw error;
  },

  async moveCard(cardId, newListId, newPosition, boardId) {
    const { error } = await sb
      .from('cards')
      .update({ list_id: newListId, position: newPosition, board_id: boardId })
      .eq('id', cardId);
    if (error) throw error;
  },

  async reorderCards(cards) {
    await Promise.all(
      cards.map((c, i) => sb.from('cards').update({ position: i }).eq('id', c.id))
    );
  },

  async deleteCard(cardId) {
    const { error } = await sb.from('cards').delete().eq('id', cardId);
    if (error) throw error;
  },

  async clearListCards(listId) {
    const { error } = await sb.from('cards').delete().eq('list_id', listId);
    if (error) throw error;
  },

  /* ── Single-call board init via Postgres function ──
     Replaces 4 sequential round trips with one RPC call.
     The function lives in schema.sql as get_or_init_board().  */

  async initBoard(userId) {
    const { data, error } = await sb.rpc('get_or_init_board', { p_user_id: userId });
    if (error) throw error;

    // data is { board_id, board_title, lists: [{id,title,position,cards:[...]}] }
    return {
      boardId:    data.board_id,
      boardTitle: data.board_title,
      lists: data.lists.map(l => ({
        ...l,
        cards: l.cards.map(c => ({
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
};

/* ═══════════════════════════════════════════════════════════
   APP STATE — in-memory source of truth
   ═══════════════════════════════════════════════════════════ */

const AppState = (() => {
  let state = { boardId: null, boardTitle: '', lists: [] };
  const subscribers = [];

  function getState()  { return JSON.parse(JSON.stringify(state)); }

  function setState(updater, skipNotify = false) {
    state = updater(JSON.parse(JSON.stringify(state)));
    if (!skipNotify) subscribers.forEach(fn => fn(state));
  }

  function subscribe(fn) { subscribers.push(fn); }

  return { getState, setState, subscribe };
})();

/* ═══════════════════════════════════════════════════════════
   DRAG & DROP ENGINE
   ═══════════════════════════════════════════════════════════ */

const DragEngine = (() => {
  let ds = null; // drag state

  function start(cardEl, cardId, listId) {
    const rect = cardEl.getBoundingClientRect();

    const ghost = cardEl.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.cssText = `position:fixed;width:${rect.width}px;top:${rect.top}px;left:${rect.left}px;pointer-events:none;z-index:9999;margin:0;`;
    document.body.appendChild(ghost);

    const placeholder = document.createElement('div');
    placeholder.className = 'card-drop-placeholder';
    cardEl.parentNode.insertBefore(placeholder, cardEl);
    cardEl.classList.add('dragging');

    ds = { cardId, listId, ghostEl: ghost, placeholder };
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
    const el = document.querySelector(`.card[data-card-id="${ds.cardId}"]`);
    if (el) el.classList.remove('dragging');
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

  return { start, move, end, cancel, getState: () => ds };
})();

/* ═══════════════════════════════════════════════════════════
   RENDER LAYER — pure functions, no side effects
   ═══════════════════════════════════════════════════════════ */

const Render = {
  esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },
  cap(str) { return str.charAt(0).toUpperCase() + str.slice(1); },

  card(card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.cardId = card.id;
    if (card.priority) el.dataset.priority = card.priority;
    el.setAttribute('role', 'listitem');
    el.setAttribute('aria-label', card.title);

    const meta = [];
    if (card.dueDate) {
      const date   = new Date(card.dueDate + 'T00:00:00');
      const today  = new Date(); today.setHours(0,0,0,0);
      const over   = date < today;
      const fmt    = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      meta.push(`<span class="card-badge date ${over ? 'overdue' : ''}">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 1v3M11 1v3M1 7h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        ${fmt}</span>`);
    }
    if (card.description) {
      meta.push(`<span class="card-badge desc">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Note</span>`);
    }
    if (card.priority) {
      meta.push(`<span class="card-badge priority-${card.priority}">${this.cap(card.priority)}</span>`);
    }

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
          <div class="list-title" contenteditable="true" spellcheck="false"
               data-list-id="${list.id}">${this.esc(list.title)}</div>
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
        <button class="add-card-btn" data-add-card="${list.id}" aria-label="Add card to ${this.esc(list.title)}">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Add Card
        </button>
      </div>`;

    const container = el.querySelector('.cards-container');
    if (!list.cards.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">◻</div>
          <div class="empty-state-text">Drop cards here<br>or add one below</div>
        </div>`;
    } else {
      list.cards.forEach(c => container.appendChild(this.card(c)));
    }

    return el;
  },
};

/* ═══════════════════════════════════════════════════════════
   MODAL CONTROLLER
   ═══════════════════════════════════════════════════════════ */

const Modal = (() => {
  let currentCardId    = null;
  let currentListId    = null;
  let selectedPriority = '';

  const overlay   = document.getElementById('modalOverlay');
  const titleEl   = document.getElementById('modalCardTitle');
  const badgeEl   = document.getElementById('modalListBadge');
  const descEl    = document.getElementById('modalDesc');
  const dateEl    = document.getElementById('modalDate');
  const closeBtn  = document.getElementById('modalClose');
  const saveBtn   = document.getElementById('saveCardBtn');
  const deleteBtn = document.getElementById('deleteCardBtn');
  const prioGroup = document.getElementById('priorityGroup');

  function open(cardId, listId) {
    const state = AppState.getState();
    const list  = state.lists.find(l => l.id === listId);
    const card  = list?.cards.find(c => c.id === cardId);
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
    currentCardId = null;
    currentListId = null;
    document.body.style.overflow = '';
  }

  async function save() {
    if (!currentCardId) return;
    const newTitle = titleEl.textContent.trim();
    if (!newTitle) return;

    const cardId = currentCardId;
    const listId = currentListId;

    const fields = {
      title:       newTitle,
      description: descEl.value.trim() || null,
      due_date:    dateEl.value        || null,
      priority:    selectedPriority    || null,
    };

    // Optimistic update
    AppState.setState(s => {
      const l = s.lists.find(x => x.id === listId);
      const c = l?.cards.find(x => x.id === cardId);
      if (c) {
        c.title       = newTitle;
        c.description = fields.description || '';
        c.dueDate     = fields.due_date    || '';
        c.priority    = fields.priority    || '';
      }
      return s;
    });

    close();

    UI.setSyncStatus('saving');
    try {
      await Storage.updateCard(cardId, fields);
      UI.setSyncStatus('saved');
    } catch (err) {
      console.error('Save card error:', err);
      UI.setSyncStatus('error');
    }
  }

  async function deleteCard() {
    if (!currentCardId) return;
    const cardId = currentCardId;
    const listId = currentListId;

    AppState.setState(s => {
      const l = s.lists.find(x => x.id === listId);
      if (l) l.cards = l.cards.filter(c => c.id !== cardId);
      return s;
    });

    close();

    UI.setSyncStatus('saving');
    try {
      await Storage.deleteCard(cardId);
      UI.setSyncStatus('saved');
    } catch (err) {
      console.error('Delete card error:', err);
      UI.setSyncStatus('error');
    }
  }

  closeBtn?.addEventListener('click', close);
  saveBtn?.addEventListener('click', save);
  deleteBtn?.addEventListener('click', deleteCard);
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
   BOARD CONTROLLER
   ═══════════════════════════════════════════════════════════ */

const Board = (() => {
  const boardScroll  = document.getElementById('boardScroll');
  const addListBtn   = document.getElementById('addListBtn');
  const addListGhost = document.getElementById('addListGhost');
  const boardTitleEl = document.getElementById('boardTitle');

  let activeAddCardListId = null;
  let activeAddListForm   = null;
  let activeMenu          = null;

  /* ── Full Render ── */
  function render() {
    const state = AppState.getState();
    if (document.activeElement !== boardTitleEl) {
      boardTitleEl.textContent = state.boardTitle;
    }

    boardScroll.querySelectorAll('.list, .add-list-form').forEach(el => el.remove());
    state.lists.forEach(list => boardScroll.insertBefore(Render.list(list), addListGhost));
    attachDragListeners();
  }

  /* ── Drag Listeners ── */
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
      if (!dragging && (Math.abs(me.clientX - sx) > 5 || Math.abs(me.clientY - sy) > 5)) {
        dragging = true;
        DragEngine.start(cardEl, cardId, listId);
      }
      if (dragging) DragEngine.move(me.clientX, me.clientY);
    };

    const onUp = async me => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!dragging) { Modal.open(cardId, listId); return; }
      const drop = getDropTarget(me.clientX, me.clientY);
      if (drop) await handleDrop(DragEngine.end(drop.listId, drop.index));
      else { DragEngine.cancel(); render(); }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onCardTouchStart(e) {
    const cardEl = e.currentTarget;
    const cardId = cardEl.dataset.cardId;
    const listId = cardEl.closest('.list')?.dataset.listId;
    const t0 = e.touches[0];
    let dragging = false;
    const sx = t0.clientX, sy = t0.clientY;

    const onMove = te => {
      const t = te.touches[0];
      if (!dragging && (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8)) {
        dragging = true;
        DragEngine.start(cardEl, cardId, listId);
      }
      if (dragging) { te.preventDefault(); DragEngine.move(t.clientX, t.clientY); }
    };

    const onEnd = async te => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      if (!dragging) { Modal.open(cardId, listId); return; }
      const t    = te.changedTouches[0];
      const drop = getDropTarget(t.clientX, t.clientY);
      if (drop) await handleDrop(DragEngine.end(drop.listId, drop.index));
      else { DragEngine.cancel(); render(); }
    };

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  async function handleDrop({ cardId, sourceListId, targetListId, targetIndex }) {
    const state      = AppState.getState();
    const sourceList = state.lists.find(l => l.id === sourceListId);
    const cardIdx    = sourceList?.cards.findIndex(c => c.id === cardId);
    if (cardIdx === undefined || cardIdx === -1) { render(); return; }

    // Optimistic update
    AppState.setState(s => {
      const src  = s.lists.find(l => l.id === sourceListId);
      const dest = s.lists.find(l => l.id === targetListId);
      const [card] = src.cards.splice(cardIdx, 1);
      dest.cards.splice(targetIndex ?? dest.cards.length, 0, card);
      return s;
    });

    UI.setSyncStatus('saving');
    try {
      const newState    = AppState.getState();
      const destListNew = newState.lists.find(l => l.id === targetListId);
      const newPos      = destListNew.cards.findIndex(c => c.id === cardId);

      await Storage.moveCard(cardId, targetListId, newPos, state.boardId);
      await Storage.reorderCards(destListNew.cards);

      if (sourceListId !== targetListId) {
        const srcListNew = newState.lists.find(l => l.id === sourceListId);
        await Storage.reorderCards(srcListNew.cards);
      }

      UI.setSyncStatus('saved');
    } catch (err) {
      console.error('Move card error:', err);
      UI.setSyncStatus('error');
    }
  }

  function getDropTarget(clientX, clientY) {
    for (const container of boardScroll.querySelectorAll('.cards-container')) {
      const r = container.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        const listId = container.dataset.listId;
        const cards  = [...container.querySelectorAll('.card:not(.dragging)')];
        let index    = cards.length;
        for (let i = 0; i < cards.length; i++) {
          const cr = cards[i].getBoundingClientRect();
          if (clientY < cr.top + cr.height / 2) { index = i; break; }
        }
        return { listId, index };
      }
    }
    return null;
  }

  /* ── Add Card ── */
  function showAddCardForm(listId) {
    if (activeAddCardListId === listId) return;
    hideAddCardForm();

    const listEl = boardScroll.querySelector(`.list[data-list-id="${listId}"]`);
    if (!listEl) return;

    const footer  = listEl.querySelector('.list-footer');
    const addBtn  = listEl.querySelector('.add-card-btn');
    const tmpl    = document.getElementById('addCardFormTemplate');
    const form    = tmpl.content.cloneNode(true).querySelector('.add-card-form');
    const input   = form.querySelector('.add-card-input');
    const confirm = form.querySelector('.btn-confirm');
    const cancel  = form.querySelector('.btn-cancel-form');

    addBtn.style.display = 'none';
    footer.insertBefore(form, footer.firstChild);
    input.focus();
    activeAddCardListId = listId;

    const doAdd = async () => {
      const title = input.value.trim();
      hideAddCardForm();
      if (!title) return;

      const state    = AppState.getState();
      const list     = state.lists.find(l => l.id === listId);
      const position = list?.cards.length ?? 0;

      UI.setSyncStatus('saving');
      try {
        const newCard = await Storage.createCard(state.boardId, listId, title, position);
        AppState.setState(s => {
          const l = s.lists.find(x => x.id === listId);
          if (l) l.cards.push({
            id: newCard.id, title: newCard.title,
            description: '', dueDate: '', priority: '', position: newCard.position,
          });
          return s;
        });
        UI.setSyncStatus('saved');
      } catch (err) {
        console.error('Create card error:', err);
        UI.setSyncStatus('error');
      }
    };

    confirm.addEventListener('click', doAdd);
    cancel.addEventListener('click', hideAddCardForm);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doAdd(); }
      if (e.key === 'Escape') hideAddCardForm();
    });
  }

  function hideAddCardForm() {
    if (!activeAddCardListId) return;
    const listEl = boardScroll.querySelector(`.list[data-list-id="${activeAddCardListId}"]`);
    if (listEl) {
      listEl.querySelector('.add-card-form')?.remove();
      const btn = listEl.querySelector('.add-card-btn');
      if (btn) btn.style.display = '';
    }
    activeAddCardListId = null;
  }

  /* ── Add List ── */
  function showAddListForm() {
    if (activeAddListForm) return;

    const form = document.createElement('div');
    form.className = 'add-list-form';
    form.innerHTML = `
      <input class="add-list-input" type="text" placeholder="List title…" maxlength="60" />
      <div class="add-list-actions">
        <button class="btn-confirm">Add List</button>
        <button class="btn-cancel-form">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>`;

    const input   = form.querySelector('.add-list-input');
    const confirm = form.querySelector('.btn-confirm');
    const cancel  = form.querySelector('.btn-cancel-form');
    boardScroll.insertBefore(form, addListGhost);
    input.focus();
    activeAddListForm = form;

    const doAdd = async () => {
      const title = input.value.trim();
      hideAddListForm();
      if (!title) return;

      const state    = AppState.getState();
      const position = state.lists.length;

      UI.setSyncStatus('saving');
      try {
        const newList = await Storage.createList(state.boardId, title, position);
        AppState.setState(s => {
          s.lists.push({ id: newList.id, title: newList.title, position: newList.position, cards: [] });
          return s;
        });
        UI.setSyncStatus('saved');
      } catch (err) {
        console.error('Create list error:', err);
        UI.setSyncStatus('error');
      }
    };

    confirm.addEventListener('click', doAdd);
    cancel.addEventListener('click', hideAddListForm);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') doAdd();
      if (e.key === 'Escape') hideAddListForm();
    });
  }

  function hideAddListForm() {
    if (activeAddListForm) { activeAddListForm.remove(); activeAddListForm = null; }
  }

  /* ── List Menu ── */
  function showListMenu(listId, btnEl) {
    closeAllMenus();
    const menu = document.createElement('div');
    menu.className = 'list-menu';
    menu.innerHTML = `
      <div class="list-menu-item" data-action="clear">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12l-1.5 9H3.5L2 4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 2h5M1 4h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        Clear all cards
      </div>
      <div class="list-menu-item danger" data-action="delete">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12l-1.5 9H3.5L2 4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 2h5M1 4h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        Delete list
      </div>`;

    btnEl.parentElement.style.position = 'relative';
    btnEl.parentElement.appendChild(menu);
    activeMenu = { menu, listId };

    menu.addEventListener('click', async e => {
      const item = e.target.closest('.list-menu-item');
      if (!item) return;
      const action = item.dataset.action;
      closeAllMenus();

      UI.setSyncStatus('saving');
      try {
        if (action === 'delete') {
          AppState.setState(s => { s.lists = s.lists.filter(l => l.id !== listId); return s; });
          await Storage.deleteList(listId);
        } else if (action === 'clear') {
          AppState.setState(s => {
            const l = s.lists.find(x => x.id === listId);
            if (l) l.cards = [];
            return s;
          });
          await Storage.clearListCards(listId);
        }
        UI.setSyncStatus('saved');
      } catch (err) {
        console.error('List action error:', err);
        UI.setSyncStatus('error');
      }
    });
  }

  function closeAllMenus() {
    if (activeMenu) { activeMenu.menu.remove(); activeMenu = null; }
  }

  /* ── Delegated Events ── */
  boardScroll.addEventListener('click', e => {
    const addCardBtn = e.target.closest('[data-add-card]');
    if (addCardBtn) { showAddCardForm(addCardBtn.dataset.addCard); return; }

    const menuBtn = e.target.closest('[data-list-menu]');
    if (menuBtn) {
      const id = menuBtn.dataset.listMenu;
      activeMenu?.listId === id ? closeAllMenus() : showListMenu(id, menuBtn);
      return;
    }

    if (!e.target.closest('.list-menu')) closeAllMenus();
  });

  // List title inline edit → persist on blur
  boardScroll.addEventListener('blur', async e => {
    const titleEl = e.target.closest('.list-title[data-list-id]');
    if (!titleEl) return;
    const listId   = titleEl.dataset.listId;
    const newTitle = titleEl.textContent.trim();
    if (!newTitle) {
      const l = AppState.getState().lists.find(x => x.id === listId);
      titleEl.textContent = l?.title || 'Untitled';
      return;
    }
    AppState.setState(s => {
      const l = s.lists.find(x => x.id === listId);
      if (l) l.title = newTitle;
      return s;
    });
    UI.setSyncStatus('saving');
    try { await Storage.updateListTitle(listId, newTitle); UI.setSyncStatus('saved'); }
    catch (err) { console.error(err); UI.setSyncStatus('error'); }
  }, true);

  boardScroll.addEventListener('keydown', e => {
    if (e.target.closest('.list-title') && e.key === 'Enter') {
      e.preventDefault(); e.target.blur();
    }
  });

  // Board title inline edit → persist on blur
  boardTitleEl.addEventListener('blur', async () => {
    const newTitle = boardTitleEl.textContent.trim();
    if (!newTitle) { boardTitleEl.textContent = AppState.getState().boardTitle; return; }
    const { boardId } = AppState.getState();
    AppState.setState(s => { s.boardTitle = newTitle; return s; });
    UI.setSyncStatus('saving');
    try { await Storage.updateBoardTitle(boardId, newTitle); UI.setSyncStatus('saved'); }
    catch (err) { console.error(err); UI.setSyncStatus('error'); }
  });

  boardTitleEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); boardTitleEl.blur(); }
  });

  addListBtn?.addEventListener('click', showAddListForm);
  addListGhost?.addEventListener('click', showAddListForm);

  document.addEventListener('click', e => {
    if (activeAddCardListId && !e.target.closest('.add-card-form') && !e.target.closest('[data-add-card]'))
      hideAddCardForm();
    if (activeAddListForm && !e.target.closest('.add-list-form') && !e.target.closest('#addListBtn') && !e.target.closest('#addListGhost'))
      hideAddListForm();
  });

  AppState.subscribe(() => render());

  /* ── Init (called after sign-in) ── */
  async function init(user) {
    UI.showLoading();
    UI.setLoading('Loading your board…', 30);

    try {
      // One RPC call → board + lists + cards in a single round trip
      const boardState = await Storage.initBoard(user.id);

      UI.setLoading('', 100);

      AppState.setState(() => boardState, true); // skipNotify
      UI.hideLoading();
      UI.setSyncStatus('saved');
      render();
    } catch (err) {
      console.error('Board init error:', err);
      UI.setLoading('Failed to load. Check your Supabase config.', 100);
    }
  }

  return { init };
})();

/* ═══════════════════════════════════════════════════════════
   AUTH UI — sign-in / sign-up forms
   ═══════════════════════════════════════════════════════════ */

function initAuthUI() {
  const showSignUp = document.getElementById('showSignUp');
  const showSignIn = document.getElementById('showSignIn');
  const signInForm = document.getElementById('signInForm');
  const signUpForm = document.getElementById('signUpForm');

  showSignUp?.addEventListener('click', e => {
    e.preventDefault();
    signInForm.style.display = 'none';
    signUpForm.style.display = '';
    UI.authError('');
  });

  showSignIn?.addEventListener('click', e => {
    e.preventDefault();
    signUpForm.style.display  = 'none';
    signInForm.style.display  = '';
    UI.authError('');
  });

  document.getElementById('signInBtn')?.addEventListener('click', async () => {
    const email    = document.getElementById('signInEmail')?.value.trim();
    const password = document.getElementById('signInPassword')?.value;
    UI.authError('');
    try { await Auth.signIn(email, password); }
    catch (err) { UI.authError(err.message || 'Sign in failed. Check your email and password.'); }
  });

  document.getElementById('signUpBtn')?.addEventListener('click', async () => {
    const email    = document.getElementById('signUpEmail')?.value.trim();
    const password = document.getElementById('signUpPassword')?.value;
    UI.authError('');
    try {
      await Auth.signUp(email, password);
      if (signUpForm) {
        signUpForm.innerHTML = `
          <div style="text-align:center;padding:12px 0;color:var(--green);">
            <div style="font-size:2rem;margin-bottom:8px;">✓</div>
            <p style="font-weight:500;line-height:1.5;">Account created!<br>Check your email to confirm, then sign in.</p>
          </div>
          <p class="auth-switch" style="margin-top:16px;">
            <a href="#" id="backToSignIn">Back to sign in</a>
          </p>`;
        document.getElementById('backToSignIn')?.addEventListener('click', e => {
          e.preventDefault();
          signUpForm.style.display  = 'none';
          signInForm.style.display  = '';
        });
      }
    } catch (err) { UI.authError(err.message || 'Sign up failed. Try a different email or longer password.'); }
  });

  // Enter-key submit
  ['signInEmail', 'signInPassword'].forEach(id =>
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('signInBtn')?.click();
    })
  );
  ['signUpEmail', 'signUpPassword'].forEach(id =>
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('signUpBtn')?.click();
    })
  );

  document.getElementById('signOutBtn')?.addEventListener('click', async () => {
    try { await Auth.signOut(); }
    catch (err) { console.error('Sign out error:', err); }
  });
}

/* ═══════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  initAuthUI();

  // Hide the app shell until we know the user is signed in
  document.getElementById('boardContainer').style.display = 'none';
  document.querySelector('.app-header').style.display = 'none';

  await Auth.init(
    // onSignedIn: user object from Supabase
    async user => {
      UI.hideAuth();
      document.getElementById('boardContainer').style.display = '';
      document.querySelector('.app-header').style.display = '';
      await Board.init(user);
    },
    // onSignedOut
    () => {
      UI.hideLoading();
      document.getElementById('boardContainer').style.display = 'none';
      document.querySelector('.app-header').style.display = 'none';
      UI.showAuth();
    }
  );
});