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
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }

  function init() {
    apply(currentTheme);
    const m = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handler = () => { if (currentTheme === 'system') apply('system'); };
    if (m?.addEventListener) m.addEventListener('change', handler);
    else if (m?.addListener) m.addListener(handler);
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
    label.textContent = status === 'saving' ? 'Saving\u2026' : status === 'error' ? 'Error' : 'Saved';
  },

  authError(msg) {
    const el = this.el('authError');
    if (!el) return;
    el.textContent   = msg;
    el.style.display = msg ? '' : 'none';
  },

  showDashboard() {
    this.el('dashboard').style.display       = '';
    this.el('boardContainer').style.display  = 'none';
    this.el('boardBreadcrumb').style.display = 'none';
    this.el('addListBtn').style.display      = 'none';
    this.el('boardSettingsBtn').style.display = 'none';
    if (this.el('shareBoardFromBoardBtn')) this.el('shareBoardFromBoardBtn').style.display = 'none';
    this.el('syncStatus').style.display      = 'none';
    this.el('headerTabs').style.display      = '';
    this.el('messagesView').style.display    = 'none';
    const fv = this.el('forumView');   if (fv) fv.style.display = 'none';
    const gv = this.el('groupsView');  if (gv) gv.style.display = 'none';
  },

  showGroups() {
    this.el('dashboard').style.display       = 'none';
    this.el('boardContainer').style.display  = 'none';
    this.el('messagesView').style.display    = 'none';
    this.el('syncStatus').style.display      = 'none';
    this.el('headerTabs').style.display      = '';
    if (this.el('shareBoardFromBoardBtn')) this.el('shareBoardFromBoardBtn').style.display = 'none';
    const fv = this.el('forumView');   if (fv) fv.style.display = 'none';
    const gv = this.el('groupsView');  if (gv) gv.style.display = '';
  },

  showMessages() {
    this.el('dashboard').style.display      = 'none';
    this.el('messagesView').style.display   = 'flex';
    this.el('boardContainer').style.display = 'none';
    this.el('headerTabs').style.display     = '';
    this.el('syncStatus').style.display     = 'none';
    if (this.el('shareBoardFromBoardBtn')) this.el('shareBoardFromBoardBtn').style.display = 'none';
    const fv = this.el('forumView'); if (fv) fv.style.display = 'none';
    const gv = this.el('groupsView'); if (gv) gv.style.display = 'none';
  },

  showForum() {
    this.el('dashboard').style.display      = 'none';
    this.el('messagesView').style.display   = 'none';
    this.el('boardContainer').style.display = 'none';
    this.el('headerTabs').style.display     = '';
    this.el('syncStatus').style.display     = 'none';
    if (this.el('shareBoardFromBoardBtn')) this.el('shareBoardFromBoardBtn').style.display = 'none';
    const fv = this.el('forumView'); if (fv) fv.style.display = '';
    const gv = this.el('groupsView'); if (gv) gv.style.display = 'none';
  },

  showBoard() {
    this.el('dashboard').style.display       = 'none';
    this.el('boardContainer').style.display  = '';
    this.el('boardBreadcrumb').style.display = '';
    this.el('addListBtn').style.display      = '';
    this.el('boardSettingsBtn').style.display = '';
    if (this.el('shareBoardFromBoardBtn')) this.el('shareBoardFromBoardBtn').style.display = '';
    this.el('syncStatus').style.display      = '';
    this.el('messagesView').style.display    = 'none';
    this.el('headerTabs').style.display      = 'none';
    const fv = this.el('forumView'); if (fv) fv.style.display = 'none';
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

    const uid    = profile?.id || '';
    const uidEl  = this.el('profileUserId');
    if (uidEl) uidEl.textContent = uid ? uid.slice(0, 8) + '\u2026' : '';
    const uidFull = this.el('profileUserIdFull');
    if (uidFull) uidFull.value = uid;

    const pi        = this.el('profilePhoneInput');
    if (pi) pi.value = phone;
    const toggle    = this.el('smsToggle');
    const phoneWrap = this.el('profilePhoneWrap');
    if (toggle) {
      toggle.classList.toggle('on', smsOn);
      toggle.setAttribute('aria-pressed', smsOn ? 'true' : 'false');
    }
    if (phoneWrap) phoneWrap.style.display = smsOn ? '' : 'none';

    // Show verified / unverified badge next to phone input
    const verifiedBadge = document.getElementById('phoneVerifiedBadge');
    if (verifiedBadge) {
      const isVerified = !!(profile && profile.phone_verified && profile.phone);
      verifiedBadge.textContent   = isVerified ? '\u2713 Verified' : (profile && profile.phone ? 'Not verified' : '');
      verifiedBadge.className     = 'phone-verified-badge' + (isVerified ? ' verified' : ' unverified');
      verifiedBadge.style.display = (profile && profile.phone) ? '' : 'none';
    }
    const verifyBtn = document.getElementById('verifyPhoneBtn');
    if (verifyBtn) {
      const needsVerify = !!(profile && profile.phone && !profile.phone_verified);
      verifyBtn.style.display = needsVerify ? '' : 'none';
    }
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
    let handledUserId = null;

    async function handleSignIn(user) {
      if (handledUserId === user.id) return;
      handledUserId = user.id;
      currentUser   = user;
      await onSignedIn(currentUser);
    }

    const { data: { session: initialSession } } = await sb.auth.getSession();
    if (initialSession?.user) {
      await handleSignIn(initialSession.user);
    } else {
      onSignedOut();
    }

    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await handleSignIn(session.user);
      } else if (event === 'SIGNED_OUT') {
        handledUserId = null;
        currentUser   = null;
        onSignedOut();
      }
    });
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

/* ── UI helpers: custom confirm dialog + toast ── */

function showConfirm(message, confirmLabel, cancelLabel) {
  return new Promise(function(resolve) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML =
      '<div class="confirm-dialog">' +
        '<p class="confirm-message">' + Render.esc(message) + '</p>' +
        '<div class="confirm-actions">' +
          '<button class="btn-ghost confirm-cancel">' + Render.esc(cancelLabel || 'Cancel') + '</button>' +
          '<button class="btn-danger confirm-ok">' + Render.esc(confirmLabel || 'Confirm') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    function cleanup(result) {
      overlay.classList.add('confirm-fade-out');
      setTimeout(function() { overlay.remove(); }, 180);
      resolve(result);
    }
    overlay.querySelector('.confirm-ok').addEventListener('click',     function() { cleanup(true);  });
    overlay.querySelector('.confirm-cancel').addEventListener('click', function() { cleanup(false); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) cleanup(false); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', handler); }
      if (e.key === 'Enter')  { cleanup(true);  document.removeEventListener('keydown', handler); }
    });
    // Focus the confirm button so Enter works immediately
    setTimeout(function() { overlay.querySelector('.confirm-ok').focus(); }, 30);
  });
}

function showToast(message, isError) {
  const toast = document.createElement('div');
  toast.className = 'app-toast' + (isError ? ' toast-error' : '');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.classList.add('toast-visible'); }, 10);
  setTimeout(function() {
    toast.classList.remove('toast-visible');
    setTimeout(function() { toast.remove(); }, 300);
  }, 3200);
}

const Storage = {

  async getProfile(userId) {
    const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async upsertProfile(userId, fields) {
    const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    const { error } = await sb.from('profiles')
      .upsert({ id: userId, ...clean, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw error;
  },

  async getBoards(userId) {
    const { data, error } = await sb.from('boards')
      .select('id, title, color, created_at, updated_at, is_pinned')
      .eq('user_id', userId).order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async createBoard(userId, title, color) {
    const { data, error } = await sb.from('boards')
      .insert({ user_id: userId, title, color }).select().single();
    if (error) throw error;
    return data;
  },

  async updateBoardTitle(boardId, title) {
    const { error } = await sb.from('boards')
      .update({ title, updated_at: new Date().toISOString() }).eq('id', boardId);
    if (error) throw error;
  },

  async updateBoardColor(boardId, color) {
    const { error } = await sb.from('boards')
      .update({ color, updated_at: new Date().toISOString() }).eq('id', boardId);
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

  async createList(boardId, title, position) {
    const { data, error } = await sb.from('lists')
      .insert({ board_id: boardId, title, position }).select().single();
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

  async createCard(boardId, listId, title, position) {
    const { data, error } = await sb.from('cards')
      .insert({ board_id: boardId, list_id: listId, title, position }).select().single();
    if (error) throw error;
    return data;
  },

  async updateCard(cardId, fields) {
    const { error } = await sb.from('cards').update(fields).eq('id', cardId);
    if (error) throw error;
  },

  async moveCard(cardId, newListId, newPosition, boardId) {
    const { error } = await sb.from('cards')
      .update({ list_id: newListId, position: newPosition, board_id: boardId }).eq('id', cardId);
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

  // Board sharing — accepts email OR friend-code UUID (share_board_flex RPC)
  async shareBoard(boardId, identifier, permission) {
    permission = permission || 'view';
    const { error } = await sb.rpc('share_board_flex', {
      p_board_id:   boardId,
      p_identifier: identifier.trim(),
      p_permission: permission,
    });
    if (error) throw error;
  },

  async getSharedBoards() {
    const { data, error } = await sb.rpc('get_shared_boards');
    if (error) throw error;
    return data ?? [];
  },

  async getBoardShares(boardId) {
    const { data, error } = await sb.rpc('get_board_shares', { p_board_id: boardId });
    if (error) throw error;
    return data ?? [];
  },

  async removeShare(shareId) {
    const { error } = await sb.from('board_shares').delete().eq('id', shareId);
    if (error) throw error;
  },

  async createGroup(name, description) {
    description = description || null;
    const { data, error } = await sb.rpc('create_group', { p_name: name, p_description: description });
    if (error) throw error;
    return data;
  },

  async getUserGroups() {
    const { data, error } = await sb.rpc('get_user_groups');
    if (error) throw error;
    return data ?? [];
  },

  // Accepts email OR friend-code UUID (add_group_member_flex RPC)
  async addGroupMember(groupId, identifier) {
    const { data, error } = await sb.rpc('add_group_member_flex', {
      p_group_id:   groupId,
      p_identifier: identifier.trim(),
    });
    if (error) throw error;
    return data;
  },

  async getGroupMembers(groupId) {
    const { data, error } = await sb.rpc('get_group_members', { p_group_id: groupId });
    if (error) throw error;
    return data ?? [];
  },

  async getGroupMessages(groupId, limit) {
    limit = limit || 50;
    const { data, error } = await sb.rpc('get_group_messages', { p_group_id: groupId, p_limit: limit });
    if (error) throw error;
    return data ?? [];
  },

  async sendMessage(groupId, content) {
    const { data, error } = await sb.rpc('send_message', { p_group_id: groupId, p_content: content });
    if (error) throw error;
    return data;
  },

  subscribeToMessages(groupId, callback) {
    return sb.channel('messages:' + groupId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'group_id=eq.' + groupId,
      }, function(payload) { callback(payload.new); })
      .subscribe();
  },

  async getForumPosts(page, pageSize) {
    page     = page     || 0;
    pageSize = pageSize || 20;
    const { data, error } = await sb.from('forum_posts')
      .select('id, content, created_at, user_id, profiles!user_id(display_name, avatar_color)')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    return data ?? [];
  },

  async createForumPost(content, userId) {
    const { error } = await sb.from('forum_posts').insert({ content: content, user_id: userId });
    if (error) throw error;
  },

  async updateForumPost(postId, content) {
    // RLS policy ensures only the owner can update; don't double-filter
    // as Auth.getUserId() might be stale in some edge cases
    const { data, error } = await sb.from('forum_posts')
      .update({ content: content })
      .eq('id', postId)
      .select('id, content');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Could not save — you may not own this post.');
  },

  async deleteForumPost(postId) {
    const { error } = await sb.from('forum_posts')
      .delete().eq('id', postId).eq('user_id', Auth.getUserId());
    if (error) throw error;
  },

  // Boards I shared with others — query board_shares where shared_by = me,
  // joining boards so we get the board details
  async getBoardsSharedByMe() {
    const userId = Auth.getUserId();
    const { data, error } = await sb
      .from('board_shares')
      .select('id, permission_level, shared_with, boards!board_id(id, title, color, updated_at, is_pinned, user_id), profiles!shared_with(display_name, email)')
      .eq('shared_by', userId);
    if (error) throw error;
    // Normalise into the same shape as getSharedBoards() returns
    return (data || []).map(function(row) {
      const b = row.boards || {};
      return {
        id:               b.id,
        title:            b.title || '(untitled)',
        color:            b.color || '#C97D4E',
        updated_at:       b.updated_at,
        is_pinned:        b.is_pinned,
        permission_level: row.permission_level,
        shared_with_name: (row.profiles && (row.profiles.display_name || row.profiles.email)) || '',
        _sharedByMe:      true,
      };
    }).filter(function(b) { return b.id; });
  },

  async removeGroupMember(groupId, userId) {
    const { error } = await sb.from('group_members')
      .delete().eq('group_id', groupId).eq('user_id', userId);
    if (error) throw error;
  },

  async leaveGroup(groupId) {
    const userId = Auth.getUserId();
    const { error } = await sb.from('group_members')
      .delete().eq('group_id', groupId).eq('user_id', userId);
    if (error) throw error;
  },

  async createOrGetDM(identifier) {
    const { data, error } = await sb.rpc('create_or_get_dm', { p_other_identifier: identifier.trim() });
    if (error) throw error;
    return data;
  },

  async updateGroupInfo(groupId, name, description) {
    const { error } = await sb.rpc('update_group_info', {
      p_group_id:    groupId,
      p_name:        name,
      p_description: description || null,
    });
    if (error) throw error;
  },

  async getForumUserProfile(userId) {
    const { data, error } = await sb
      .from('profiles')
      .select('id, display_name')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },
};

/* ═══════════════════════════════════════════════════════════
   APP STATE
   ═══════════════════════════════════════════════════════════ */

const AppState = (() => {
  let state = {
    view:         'dashboard',
    tab:          'boards',
    profile:      null,
    boards:       [],
    sharedBoards: [],
    groups:       [],
    boardId:      null,
    searchQuery:  '',
    sortOrder:    'recent',
    boardTitle:   '',
    boardColor:   '#C97D4E',
    lists:        [],
  };
  const subs = [];

  function getState()  { return JSON.parse(JSON.stringify(state)); }
  function setState(fn, silent) {
    silent = silent || false;
    state  = fn(JSON.parse(JSON.stringify(state)));
    if (!silent) subs.forEach(function(f) { f(state); });
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
    const rect  = cardEl.getBoundingClientRect();
    const ghost = cardEl.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.cssText = 'position:fixed;width:' + rect.width + 'px;top:' + rect.top + 'px;left:' + rect.left + 'px;pointer-events:none;z-index:9999;margin:0;';
    document.body.appendChild(ghost);
    const ph = document.createElement('div');
    ph.className = 'card-drop-placeholder';
    cardEl.parentNode.insertBefore(ph, cardEl);
    cardEl.classList.add('dragging');
    ds = { cardId: cardId, listId: listId, ghostEl: ghost, placeholder: ph };
  }

  function move(x, y) {
    if (!ds) return;
    ds.ghostEl.style.left = (x - 20) + 'px';
    ds.ghostEl.style.top  = (y - 20) + 'px';
  }

  function end(targetListId, targetIndex) {
    if (!ds) return null;
    const result = { cardId: ds.cardId, sourceListId: ds.listId, targetListId: targetListId, targetIndex: targetIndex };
    ds.ghostEl.remove();
    if (ds.placeholder.parentNode) ds.placeholder.remove();
    document.querySelector('.card[data-card-id="' + ds.cardId + '"]')?.classList.remove('dragging');
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
    const color    = board.color || '#C97D4E';
    const isShared = !!board.permission_level;
    el.title = 'Open ' + board.title;
    el.innerHTML =
      '<div class="board-card-color" style="background:' + color + ';"></div>' +
      '<div class="board-card-body">' +
        '<div class="board-card-title">' + this.esc(board.title) + '</div>' +
        '<div class="board-card-meta">' + new Date(board.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '</div>' +
        (isShared ? '<div class="board-card-perm">' + board.permission_level + ' access</div>' : '') +
      '</div>' +
      '<div class="board-card-actions">' +
        '<button class="board-card-pin ' + (board.is_pinned ? 'active' : '') + '" data-board-pin="' + board.id + '" aria-label="' + (board.is_pinned ? 'Unpin' : 'Pin') + ' board">' +
          '<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M12.5 5.5l-3-3M6.5 12.5l-3-3M4 12l2-2M10 4l2-2M5 5l6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
        (!isShared ?
          '<button class="board-card-share" data-board-share="' + board.id + '" aria-label="Share board">' +
            '<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="13" cy="3" r="1.8" stroke="currentColor" stroke-width="1.4"/><circle cx="3" cy="8" r="1.8" stroke="currentColor" stroke-width="1.4"/><circle cx="13" cy="13" r="1.8" stroke="currentColor" stroke-width="1.4"/><path d="M4.7 7.1l6.6-3M4.7 9l6.6 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
          '</button>' +
          '<button class="board-card-delete" data-board-delete="' + board.id + '" aria-label="Delete board">' +
            '<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4h12l-1.5 9H3.5L2 4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 2h5M1 4h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
          '</button>'
        : '') +
      '</div>';
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
      const d     = new Date(card.dueDate + 'T00:00:00');
      const today = new Date(); today.setHours(0,0,0,0);
      const timeLabel = card.dueTime ? ' ' + SMS.formatTime12(card.dueTime) : '';
      meta.push('<span class="card-badge date ' + (d < today ? 'overdue' : '') + '">' +
        '<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 1v3M11 1v3M1 7h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + timeLabel +
        '</span>');
    }
    if (card.description) {
      meta.push('<span class="card-badge desc">' +
        '<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
        'Note</span>');
    }
    if (card.priority) {
      meta.push('<span class="card-badge priority-' + card.priority + '">' + this.cap(card.priority) + '</span>');
    }
    el.innerHTML =
      '<div class="card-priority-bar" aria-hidden="true"></div>' +
      '<div class="card-title">' + this.esc(card.title) + '</div>' +
      (meta.length ? '<div class="card-meta">' + meta.join('') + '</div>' : '');
    return el;
  },

  list(list) {
    const el = document.createElement('div');
    el.className = 'list';
    el.dataset.listId = list.id;
    el.setAttribute('role', 'list');
    el.innerHTML =
      '<div class="list-header">' +
        '<div class="list-menu-header-wrap" style="position:relative;display:flex;align-items:center;gap:6px;flex:1;">' +
          '<div class="list-title" contenteditable="true" spellcheck="false" data-list-id="' + list.id + '">' + this.esc(list.title) + '</div>' +
        '</div>' +
        '<span class="list-card-count" data-list-count="' + list.id + '">' + list.cards.length + '</span>' +
        '<button class="list-menu-btn" aria-label="List options" data-list-menu="' + list.id + '">' +
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none">' +
            '<circle cx="8" cy="3" r="1.2" fill="currentColor"/>' +
            '<circle cx="8" cy="8" r="1.2" fill="currentColor"/>' +
            '<circle cx="8" cy="13" r="1.2" fill="currentColor"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
      '<div class="cards-container" data-list-id="' + list.id + '" role="list"></div>' +
      '<div class="list-footer">' +
        '<button class="add-card-btn" data-add-card="' + list.id + '">' +
          '<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
          ' Add Card' +
        '</button>' +
      '</div>';
    const container = el.querySelector('.cards-container');
    if (!list.cards.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">\u25FB</div><div class="empty-state-text">Drop cards here<br>or add one below</div></div>';
    } else {
      list.cards.forEach(function(c) { container.appendChild(Render.card(c)); });
    }
    return el;
  },
};

/* ═══════════════════════════════════════════════════════════
   CARD MODAL
   ═══════════════════════════════════════════════════════════ */

const CardModal = (() => {
  let currentCardId = null, currentListId = null, selectedPriority = '';

  const overlay      = document.getElementById('modalOverlay');
  const titleEl      = document.getElementById('modalCardTitle');
  const badgeEl      = document.getElementById('modalListBadge');
  const descEl       = document.getElementById('modalDesc');
  const dateEl       = document.getElementById('modalDate');
  const timeEl       = document.getElementById('modalTime');
  const prioGroup    = document.getElementById('priorityGroup');
  const remList      = document.getElementById('modalReminderList');
  const addRemBtn    = document.getElementById('addReminderBtn');
  const smsOpt       = document.getElementById('reminderSmsOpt');
  const smsCheck     = document.getElementById('reminderSmsCheck');
  const smsNophone   = document.getElementById('reminderSmsNophone');
  const addPhoneLink = document.getElementById('reminderAddPhone');

  function open(cardId, listId) {
    const state = AppState.getState();
    const list  = state.lists.find(function(l) { return l.id === listId; });
    const card  = list && list.cards.find(function(c) { return c.id === cardId; });
    if (!card) return;
    currentCardId    = cardId;
    currentListId    = listId;
    selectedPriority = card.priority || '';
    titleEl.textContent = card.title;
    badgeEl.textContent = 'In: ' + list.title;
    descEl.value        = card.description || '';
    dateEl.value        = card.dueDate     || '';
    prioGroup.querySelectorAll('.priority-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.priority === selectedPriority);
    });
    renderReminders(card.reminders || []);

    const profile  = state.profile;
    const hasPhone = !!(profile && profile.phone && profile.phone.trim());
    const smsOn    = !!(profile && profile.sms_enabled);
    if (smsOpt)     smsOpt.style.display    = hasPhone ? '' : 'none';
    if (smsNophone) smsNophone.style.display = hasPhone ? 'none' : '';
    if (smsCheck)   smsCheck.checked         = smsOn && hasPhone;

    overlay.classList.add('open');
    if (timeEl && timeEl.options.length <= 1) timeEl.innerHTML = generateTimeOptions('');
    timeEl.value = card.dueTime || '';
    titleEl.focus();
    document.body.style.overflow = 'hidden';
  }

  function renderReminders(reminders) {
    if (!remList) return;
    remList.innerHTML = '';
    (reminders || []).forEach(function(r, i) {
      const row = document.createElement('div');
      row.className = 'reminder-row';
      row.innerHTML =
        '<input type="date" class="modal-date reminder-date" value="' + (r.date || '') + '" data-ri="' + i + '" />' +
        '<select class="modal-time-select reminder-time" data-ri="' + i + '">' + generateTimeOptions(r.time || '') + '</select>' +
        '<button class="reminder-remove" data-ri="' + i + '" aria-label="Remove reminder">' +
          '<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
        '</button>';
      remList.appendChild(row);
    });
  }

  function generateTimeOptions(selectedVal) {
    let html = '<option value="">No time</option>';
    for (let h = 0; h < 24; h++) {
      for (let mi = 0; mi < 2; mi++) {
        const m    = mi === 0 ? 0 : 30;
        const hh   = h % 12 === 0 ? 12 : h % 12;
        const mm   = m === 0 ? '00' : '30';
        const ampm = h < 12 ? 'AM' : 'PM';
        const val  = (h < 10 ? '0' + h : '' + h) + ':' + mm;
        html += '<option value="' + val + '"' + (selectedVal === val ? ' selected' : '') + '>' + hh + ':' + mm + ' ' + ampm + '</option>';
      }
    }
    return html;
  }

  function collectReminders() {
    if (!remList) return [];
    const rows = remList.querySelectorAll('.reminder-row');
    const out  = [];
    rows.forEach(function(row) {
      const d = row.querySelector('.reminder-date');
      const t = row.querySelector('.reminder-time');
      if (d && d.value) out.push({ date: d.value, time: t ? t.value : '' });
    });
    return out;
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
    const cardId    = currentCardId;
    const listId    = currentListId;
    const reminders = collectReminders();
    const profile   = AppState.getState().profile;
    const useSms    = !!(smsCheck && smsCheck.checked && profile && profile.phone && profile.sms_enabled);
    const fields = {
      title:       newTitle,
      description: descEl.value.trim() || null,
      due_date:    dateEl.value        || null,
      due_time:    timeEl.value        || null,
      priority:    selectedPriority    || null,
      reminders:   reminders,
    };
    AppState.setState(function(s) {
      const l = s.lists.find(function(x) { return x.id === listId; });
      const c = l && l.cards.find(function(x) { return x.id === cardId; });
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
        SMS.dispatchCardReminders(Object.assign({}, fields, { title: newTitle, phone: profile.phone })).catch(console.error);
      }
    } catch (e) { console.error(e); UI.setSyncStatus('error'); }
  }

  async function deleteCard() {
    if (!currentCardId) return;
    const cardId = currentCardId;
    const listId = currentListId;
    AppState.setState(function(s) {
      const l = s.lists.find(function(x) { return x.id === listId; });
      if (l) l.cards = l.cards.filter(function(c) { return c.id !== cardId; });
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
  overlay?.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function(e) {
    if (!overlay?.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
  });
  prioGroup?.addEventListener('click', function(e) {
    const btn = e.target.closest('.priority-btn');
    if (!btn) return;
    const p = btn.dataset.priority;
    selectedPriority = selectedPriority === p ? '' : p;
    prioGroup.querySelectorAll('.priority-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.priority === selectedPriority);
    });
  });
  addRemBtn?.addEventListener('click', function() {
    const cur = collectReminders();
    cur.push({ date: '', time: '' });
    renderReminders(cur);
  });
  remList?.addEventListener('click', function(e) {
    const btn = e.target.closest('.reminder-remove');
    if (!btn) return;
    const idx = parseInt(btn.dataset.ri, 10);
    const cur = collectReminders();
    cur.splice(idx, 1);
    renderReminders(cur);
  });
  addPhoneLink?.addEventListener('click', function(e) {
    e.preventDefault();
    close();
    SmsSetup.open();
  });
  timeEl?.addEventListener('focus', function() {
    if (timeEl.options.length === 0) timeEl.innerHTML = generateTimeOptions('');
  });

  return { open, close };
})();

/* ═══════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════ */

const Dashboard = (() => {
  const grid            = document.getElementById('boardsGrid');
  const newBoardBtn     = document.getElementById('newBoardBtn');
  const newBoardOverlay = document.getElementById('newBoardOverlay');
  const newBoardClose   = document.getElementById('newBoardClose');
  const newBoardCancel  = document.getElementById('newBoardCancelBtn');
  const createBoardBtn  = document.getElementById('createBoardBtn');
  const newBoardName    = document.getElementById('newBoardName');
  const colorPicker     = document.getElementById('boardColorPicker');
  const searchInput     = document.getElementById('boardSearch');
  const sortSelect      = document.getElementById('boardSort');
  const heading         = document.getElementById('newBoardModalHeading');
  let selectedColor     = '#C97D4E';
  let editMode          = false;

  function render() {
    const state = AppState.getState();
    const tab   = state.tab;

    // These views manage themselves; don't let the subscribe callback override them
    if (tab === 'messages' || tab === 'forum' || tab === 'organization') return;

    UI.showDashboard();

    const isSharedTab = tab === 'shared';
    const source   = isSharedTab ? (state.sharedBoards || []) : (state.boards || []);
    const query    = (state.searchQuery || '').toLowerCase();
    let filtered   = source.filter(function(b) { return b.title && b.title.toLowerCase().includes(query); });

    filtered.sort(function(a, b) {
      const pA = !!a.is_pinned, pB = !!b.is_pinned;
      if (pA && !pB) return -1;
      if (!pA && pB) return 1;
      if (state.sortOrder === 'recent')    return new Date(b.updated_at) - new Date(a.updated_at);
      if (state.sortOrder === 'oldest')    return new Date(a.created_at) - new Date(b.created_at);
      if (state.sortOrder === 'alpha')     return a.title.localeCompare(b.title);
      if (state.sortOrder === 'alpha-rev') return b.title.localeCompare(a.title);
      return 0;
    });

    const fragment = document.createDocumentFragment();

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.gridColumn = '1 / -1';
      if (isSharedTab && query) {
        empty.innerHTML = '<div class="empty-state-text">No boards found matching "' + query + '"</div>';
      } else if (isSharedTab) {
        const subFilter = state.sharedSubFilter || 'received';
        empty.innerHTML = subFilter === 'received'
          ? '<div class="empty-state-text">No boards have been shared with you yet.</div>'
          : '<div class="empty-state-text">You haven\'t shared any boards yet.<br>Open a board and click Share.</div>';
      } else if (query) {
        empty.innerHTML = '<div class="empty-state-text">No boards found matching "' + query + '"</div>';
      }
      if (isSharedTab || query) fragment.appendChild(empty);
    } else {
      filtered.forEach(function(board) {
        const card = Render.boardCard(board);
        card.addEventListener('click', function(e) {
          if (e.target.closest('[data-board-delete]') || e.target.closest('[data-board-pin]') || e.target.closest('[data-board-share]')) return;
          openBoard(board.id);
        });
        fragment.appendChild(card);
      });
    }

    if (!isSharedTab) {
      const addCard = document.createElement('div');
      addCard.className = 'board-card-new';
      addCard.innerHTML = '<svg width="22" height="22" viewBox="0 0 16 16" fill="none"><path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>New Board</span>';
      addCard.addEventListener('click', showNewBoardModal);
      fragment.appendChild(addCard);
    }

    grid.innerHTML = '';
    grid.appendChild(fragment);
  }

  async function openBoard(boardId) {
    UI.showLoading();
    UI.setLoading('Opening board\u2026', 40);
    try {
      await sb.from('boards').update({ updated_at: new Date().toISOString() }).eq('id', boardId);
      const boardState = await Storage.initBoard(boardId);
      AppState.setState(function(s) {
        const b = s.boards.find(function(x) { return x.id === boardId; });
        if (b) b.updated_at = new Date().toISOString();
        s.boards.sort(function(a, b) { return new Date(b.updated_at) - new Date(a.updated_at); });
        return Object.assign({}, s, { view: 'board' }, boardState);
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
    colorPicker.querySelectorAll('.color-swatch').forEach(function(s) {
      s.classList.toggle('active', s.dataset.color === selectedColor);
    });
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
      const boardId = AppState.getState().boardId;
      UI.setSyncStatus('saving');
      try {
        await Storage.updateBoardTitle(boardId, title);
        await Storage.updateBoardColor(boardId, selectedColor);
        AppState.setState(function(s) {
          s.boardTitle = title;
          s.boardColor = selectedColor;
          const b = s.boards.find(function(x) { return x.id === boardId; });
          if (b) { b.title = title; b.color = selectedColor; b.updated_at = new Date().toISOString(); }
          return s;
        });
        UI.setSyncStatus('saved');
        Board.render();
      } catch (err) { console.error(err); UI.setSyncStatus('error'); }
      return;
    }

    const userId = Auth.getUserId();
    UI.setSyncStatus('saving');
    try {
      const board = await Storage.createBoard(userId, title, selectedColor);
      await Storage.seedBoard(board.id);
      AppState.setState(function(s) { s.boards.unshift(board); return s; });
      render();
      UI.setSyncStatus('saved');
      await openBoard(board.id);
    } catch (err) { console.error('Create board error:', err); UI.setSyncStatus('error'); }
  }

  async function deleteBoard(boardId) {
    if (!confirm('Delete this board and all its cards? This cannot be undone.')) return;
    AppState.setState(function(s) { s.boards = s.boards.filter(function(b) { return b.id !== boardId; }); return s; });
    UI.setSyncStatus('saving');
    try { await Storage.deleteBoard(boardId); UI.setSyncStatus('saved'); }
    catch (err) { console.error(err); UI.setSyncStatus('error'); }
  }

  colorPicker?.addEventListener('click', function(e) {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;
    selectedColor = swatch.dataset.color;
    colorPicker.querySelectorAll('.color-swatch').forEach(function(s) {
      s.classList.toggle('active', s.dataset.color === selectedColor);
    });
  });

  async function togglePin(boardId) {
    const board = AppState.getState().boards.find(function(b) { return b.id === boardId; });
    if (!board) return;
    const newState = !board.is_pinned;
    AppState.setState(function(s) {
      const b = s.boards.find(function(x) { return x.id === boardId; });
      if (b) b.is_pinned = newState;
      return s;
    });
    UI.setSyncStatus('saving');
    try { await Storage.updateBoardPin(boardId, newState); UI.setSyncStatus('saved'); }
    catch (err) { console.error(err); UI.setSyncStatus('error'); }
  }

  grid?.addEventListener('click', function(e) {
    const delBtn   = e.target.closest('[data-board-delete]');
    if (delBtn)   { deleteBoard(delBtn.dataset.boardDelete); return; }
    const pinBtn   = e.target.closest('[data-board-pin]');
    if (pinBtn)   { togglePin(pinBtn.dataset.boardPin); return; }
    const shareBtn = e.target.closest('[data-board-share]');
    if (shareBtn) { BoardSharing.open(shareBtn.dataset.boardShare); return; }
  });

  searchInput?.addEventListener('input', function(e) {
    AppState.setState(function(s) { s.searchQuery = e.target.value; return s; });
  });
  sortSelect?.addEventListener('change', function(e) {
    AppState.setState(function(s) { s.sortOrder = e.target.value; return s; });
  });

  // Shared sub-filter: 'received' (boards shared to me) | 'sent' (boards I shared)
  let sharedSubFilter = 'received';

  document.getElementById('sharedSubFilter')?.addEventListener('click', async function(e) {
    const btn = e.target.closest('.shared-filter-btn');
    if (!btn) return;
    sharedSubFilter = btn.dataset.sharedFilter;
    document.querySelectorAll('.shared-filter-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.sharedFilter === sharedSubFilter);
    });
    await refreshSharedBoards();
  });

  async function refreshSharedBoards() {
    try {
      let boards = [];
      if (sharedSubFilter === 'received') {
        boards = await Storage.getSharedBoards();
      } else {
        boards = await Storage.getBoardsSharedByMe();
      }
      AppState.setState(function(s) { return Object.assign({}, s, { sharedBoards: boards, sharedSubFilter: sharedSubFilter }); });
    } catch (err) { console.error('Shared boards error:', err); }
  }

  document.getElementById('headerTabs')?.addEventListener('click', async function(e) {
    const tab = e.target.closest('.header-tab');
    if (!tab) return;
    const tabKey = tab.dataset.tab;
    document.querySelectorAll('.header-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    const titleEl = UI.el('dashboardTitle');
    if (titleEl) titleEl.textContent = tab.textContent.trim();
    // Show/hide shared sub-filter bar
    const subFilter = UI.el('sharedSubFilter');
    if (subFilter) subFilter.style.display = tabKey === 'shared' ? '' : 'none';

    if (tabKey === 'shared') {
      sharedSubFilter = 'received';
      document.querySelectorAll('.shared-filter-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.sharedFilter === 'received');
      });
      // Show dashboard shell immediately — don't wait for async fetch
      AppState.setState(function(s) { return Object.assign({}, s, { tab: tabKey, sharedBoards: [] }); }, true);
      UI.showDashboard();
      const subFilter = UI.el('sharedSubFilter');
      if (subFilter) subFilter.style.display = '';
      grid.innerHTML = '<div class="boards-grid-loading"><div class="ai-loading-spinner" style="margin:40px auto;display:block;"></div></div>';
      await refreshSharedBoards();
    } else if (tabKey === 'organization') {
      const groups = await Storage.getUserGroups();
      AppState.setState(function(s) { return Object.assign({}, s, { tab: tabKey, orgs: groups }); });
      UI.showGroups();
      GroupsView.renderInline();
      return; // renderInline handles state
    } else if (tabKey === 'messages') {
      const groups = await Storage.getUserGroups();
      AppState.setState(function(s) { return Object.assign({}, s, { tab: tabKey, orgs: groups }); }, true);
      UI.showMessages();
      MessagesView.render();
      MessagesView.init();
    } else if (tabKey === 'forum') {
      AppState.setState(function(s) { return Object.assign({}, s, { tab: tabKey }); }, true);
      UI.showForum();
      Forum.render();
    } else {
      // boards tab — show dashboard immediately
      AppState.setState(function(s) { return Object.assign({}, s, { tab: tabKey }); });
      UI.showDashboard();
      const subFilter = UI.el('sharedSubFilter');
      if (subFilter) subFilter.style.display = 'none';
    }
    // Ensure the clicked tab stays highlighted after any async operations
    document.querySelectorAll('.header-tab').forEach(function(t) {
      t.classList.toggle('active', t.dataset.tab === tabKey);
    });
  });

  newBoardBtn?.addEventListener('click', showNewBoardModal);
  document.getElementById('boardSettingsBtn')?.addEventListener('click', showEditBoardModal);
  document.getElementById('shareBoardFromBoardBtn')?.addEventListener('click', function() {
    const boardId = AppState.getState().boardId;
    if (boardId) BoardSharing.open(boardId);
  });
  newBoardClose?.addEventListener('click', hideNewBoardModal);
  newBoardCancel?.addEventListener('click', hideNewBoardModal);
  createBoardBtn?.addEventListener('click', handleBoardSubmit);
  newBoardOverlay?.addEventListener('click', function(e) { if (e.target === newBoardOverlay) hideNewBoardModal(); });
  newBoardName?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') handleBoardSubmit();
    if (e.key === 'Escape') hideNewBoardModal();
  });

  AppState.subscribe(function(state) {
    if (state.view === 'dashboard' || state.view === 'messages' || state.view === 'forum') render();
  });

  return { render, openBoard };
})();

/* ═══════════════════════════════════════════════════════════
   MESSAGES VIEW
   (in-app group chat — separate from SMS phone reminders)
   ═══════════════════════════════════════════════════════════ */

const MessagesView = (() => {
  let activeGroupId   = null;
  let activeGroupName = null;
  let activeGroupRole = null;
  let activeIsDm      = false;
  let subscription    = null;
  const renderedIds   = new Set();
  let initDone        = false;

  function init() {
    if (initDone) return;
    initDone = true;
    const sendBtn = UI.el('sendMessageBtn');
    const input   = UI.el('messageInput');
    if (sendBtn) {
      sendBtn.onclick = async function() {
        const content = input ? input.value.trim() : '';
        if (!content || !activeGroupId) return;
        if (input) input.value = '';
        const state  = AppState.getState();
        const myId   = (state.profile && state.profile.id) || Auth.getUserId();
        const myName = (state.profile && state.profile.display_name) || 'You';
        const tempId = 'temp-' + Date.now();
        appendMessageEl({ id: tempId, sender_id: myId, sender_name: myName, content: content, created_at: new Date().toISOString() }, myId);
        renderedIds.add(tempId);
        try { await Storage.sendMessage(activeGroupId, content); }
        catch (err) { console.error('Send message error:', err); }
      };
    }
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (sendBtn) sendBtn.click(); }
      });
    }
    // New Chat button
    const newChatBtn = UI.el('createGroupFromMessagesBtn');
    if (newChatBtn) {
      newChatBtn.onclick = function() { openNewChatModal(); };
    }
  }

  function openNewChatModal() {
    const overlay = UI.el('newChatOverlay');
    if (!overlay) return;
    const tabGroup = UI.el('newChatTabGroup');
    const tabDm    = UI.el('newChatTabDm');
    if (tabGroup) tabGroup.classList.add('active');
    if (tabDm)    tabDm.classList.remove('active');
    showNewChatPanel('group');
    UI.el('newChatGroupName')  && (UI.el('newChatGroupName').value = '');
    UI.el('newChatGroupDesc')  && (UI.el('newChatGroupDesc').value = '');
    UI.el('newChatDmTarget')   && (UI.el('newChatDmTarget').value = '');
    UI.el('newChatError')      && (UI.el('newChatError').style.display = 'none');
    overlay.classList.add('open');
    setTimeout(function() { UI.el('newChatGroupName')?.focus(); }, 60);
  }

  function showNewChatPanel(type) {
    const groupPanel = UI.el('newChatGroupPanel');
    const dmPanel    = UI.el('newChatDmPanel');
    if (groupPanel) groupPanel.style.display = type === 'group' ? '' : 'none';
    if (dmPanel)    dmPanel.style.display    = type === 'dm'    ? '' : 'none';
  }

  async function selectGroup(groupId, groupName, role, isDm) {
    activeGroupId   = groupId;
    activeGroupName = groupName;
    activeGroupRole = role || '';
    activeIsDm      = !!isDm;
    renderedIds.clear();

    const titleEl   = UI.el('messagesGroupTitle');
    const areaEl    = UI.el('messagesInputArea');
    const feedEl    = UI.el('messagesFeed');
    const actionsEl = UI.el('messagesHeaderActions');
    const panelEl   = UI.el('msgMembersPanel');
    const editBtn   = UI.el('msgEditNameBtn');

    if (titleEl)   titleEl.textContent = groupName;
    if (areaEl)    areaEl.style.display = 'flex';
    if (actionsEl) actionsEl.style.display = 'flex';
    if (panelEl)   panelEl.style.display = 'none';
    // Only show edit button for non-DM groups where user is admin/owner
    if (editBtn)   editBtn.style.display = (!isDm && (role === 'admin' || role === 'owner')) ? '' : 'none';
    if (feedEl)    feedEl.innerHTML = '<p class="loading-text">Loading messages…</p>';

    // Wire add member button (hidden for DMs)
    const addBtn = UI.el('msgAddMemberBtn');
    if (addBtn) {
      addBtn.style.display = isDm ? 'none' : '';
      addBtn.onclick = function() { GroupsView.openAddMemberModal(groupId, groupName); };
    }

    // Wire members toggle
    const membersBtn = UI.el('msgViewMembersBtn');
    if (membersBtn) {
      membersBtn.style.display = isDm ? 'none' : '';
      membersBtn.onclick = async function() {
        if (!panelEl) return;
        if (panelEl.style.display !== 'none') { panelEl.style.display = 'none'; return; }
        panelEl.style.display = '';
        panelEl.innerHTML = '<div class="members-loading">Loading…</div>';
        await GroupsView.loadDetailMembers(groupId, role);
        const detailMembers = UI.el('groupsDetailMembers');
        if (detailMembers) panelEl.innerHTML = detailMembers.innerHTML;
        else panelEl.innerHTML = '<div class="members-empty">No members found.</div>';
      };
    }

    // Wire edit name button
    const editNameBtn = UI.el('msgEditNameBtn');
    if (editNameBtn) {
      editNameBtn.onclick = function() { openEditNameModal(groupId, groupName, activeGroupName); };
    }

    const msgs = await Storage.getGroupMessages(groupId);
    if (feedEl) feedEl.innerHTML = '';
    const state = AppState.getState();
    const myId  = (state.profile && state.profile.id) || Auth.getUserId();
    msgs.reverse().forEach(function(m) { appendMessageEl(m, myId); renderedIds.add(m.id); });

    if (subscription) subscription.unsubscribe();
    subscription = Storage.subscribeToMessages(groupId, function(newMsg) {
      if (renderedIds.has(newMsg.id)) return;
      renderedIds.add(newMsg.id);
      const st   = AppState.getState();
      const myId = (st.profile && st.profile.id) || Auth.getUserId();
      if (newMsg.sender_id === myId) {
        const feed = UI.el('messagesFeed');
        if (feed) {
          feed.querySelectorAll('[data-temp]').forEach(function(t) {
            if (t.querySelector('.message-bubble') &&
                t.querySelector('.message-bubble').textContent === newMsg.content) t.remove();
          });
        }
      }
      appendMessageEl(newMsg, myId);
    });
  }

  function openEditNameModal(groupId, currentName, currentDesc) {
    const overlay = UI.el('editChatNameOverlay');
    if (!overlay) return;
    UI.el('editChatNameInput')  && (UI.el('editChatNameInput').value  = currentName || '');
    UI.el('editChatDescInput')  && (UI.el('editChatDescInput').value  = currentDesc || '');
    UI.el('editChatNameError')  && (UI.el('editChatNameError').style.display = 'none');
    overlay.dataset.groupId = groupId;
    overlay.classList.add('open');
    setTimeout(function() { UI.el('editChatNameInput')?.focus(); }, 60);
  }

  // Wire edit name confirm
  UI.el('confirmEditChatNameBtn')?.addEventListener('click', async function() {
    const overlay = UI.el('editChatNameOverlay');
    const groupId = overlay?.dataset.groupId;
    const name    = UI.el('editChatNameInput')?.value.trim();
    const desc    = UI.el('editChatDescInput')?.value.trim() || null;
    if (!name) { UI.el('editChatNameInput')?.focus(); return; }
    const btn  = UI.el('confirmEditChatNameBtn');
    const errEl = UI.el('editChatNameError');
    btn.textContent = '…';
    btn.disabled    = true;
    try {
      await Storage.updateGroupInfo(groupId, name, desc);
      // Update sidebar label
      const sidebarBtns = document.querySelectorAll('.message-group-btn[data-id="' + groupId + '"]');
      sidebarBtns.forEach(function(b) {
        const span = b.querySelector('span:last-child');
        if (span) span.textContent = name;
      });
      // Update header
      const titleEl = UI.el('messagesGroupTitle');
      if (titleEl) titleEl.textContent = name;
      activeGroupName = name;
      overlay.classList.remove('open');
      showToast('Chat renamed');
    } catch (err) {
      if (errEl) { errEl.textContent = err.message; errEl.style.display = ''; }
    }
    btn.textContent = 'Save';
    btn.disabled    = false;
  });
  UI.el('editChatNameOverlay')?.addEventListener('click', function(e) {
    if (e.target === UI.el('editChatNameOverlay')) UI.el('editChatNameOverlay').classList.remove('open');
  });
  UI.el('cancelEditChatNameBtn')?.addEventListener('click', function() { UI.el('editChatNameOverlay')?.classList.remove('open'); });

  // Wire New Chat modal
  UI.el('newChatTabGroup')?.addEventListener('click', function() {
    UI.el('newChatTabGroup').classList.add('active');
    UI.el('newChatTabDm')?.classList.remove('active');
    showNewChatPanel('group');
  });
  UI.el('newChatTabDm')?.addEventListener('click', function() {
    UI.el('newChatTabDm').classList.add('active');
    UI.el('newChatTabGroup')?.classList.remove('active');
    showNewChatPanel('dm');
    setTimeout(function() { UI.el('newChatDmTarget')?.focus(); }, 60);
  });
  UI.el('newChatClose')?.addEventListener('click', function() { UI.el('newChatOverlay')?.classList.remove('open'); });
  UI.el('newChatCancelBtn')?.addEventListener('click', function() { UI.el('newChatOverlay')?.classList.remove('open'); });
  UI.el('newChatOverlay')?.addEventListener('click', function(e) {
    if (e.target === UI.el('newChatOverlay')) UI.el('newChatOverlay').classList.remove('open');
  });

  UI.el('newChatCreateBtn')?.addEventListener('click', async function() {
    const isDmPanel = UI.el('newChatDmPanel')?.style.display !== 'none';
    const btn       = UI.el('newChatCreateBtn');
    const errEl     = UI.el('newChatError');
    if (errEl) errEl.style.display = 'none';
    btn.textContent = '…'; btn.disabled = true;

    try {
      if (isDmPanel) {
        // DM flow
        const target = UI.el('newChatDmTarget')?.value.trim();
        if (!target) { UI.el('newChatDmTarget')?.focus(); btn.textContent = 'Create'; btn.disabled = false; return; }
        const dm = await Storage.createOrGetDM(target);
        UI.el('newChatOverlay')?.classList.remove('open');
        // Refresh org list and open the DM
        const groups = await Storage.getUserGroups();
        AppState.setState(function(s) { return Object.assign({}, s, { orgs: groups }); }, true);
        render();
        await selectGroup(dm.group_id, dm.other_name, 'member', true);
      } else {
        // Group (chatroom) flow
        const name = UI.el('newChatGroupName')?.value.trim();
        const desc = UI.el('newChatGroupDesc')?.value.trim() || null;
        if (!name) { UI.el('newChatGroupName')?.focus(); btn.textContent = 'Create'; btn.disabled = false; return; }
        await Storage.createGroup(name, desc);
        UI.el('newChatOverlay')?.classList.remove('open');
        const groups = await Storage.getUserGroups();
        AppState.setState(function(s) { return Object.assign({}, s, { orgs: groups }); }, true);
        render();
      }
    } catch (err) {
      if (errEl) { errEl.textContent = err.message || 'Could not create.'; errEl.style.display = ''; }
    }
    btn.textContent = 'Create'; btn.disabled = false;
  });

  function appendMessageEl(m, myId) {
    const feed = UI.el('messagesFeed');
    if (!feed) return;
    const isMe    = m.sender_id === myId;
    const initial = (m.sender_name || '?').charAt(0).toUpperCase();
    const el = document.createElement('div');
    el.className = 'message' + (isMe ? ' message-mine' : '');
    if (m.id && String(m.id).startsWith('temp-')) el.dataset.temp = '1';
    el.innerHTML =
      (!isMe ? '<div class="message-avatar" title="' + Render.esc(m.sender_name || '') + '">' + Render.esc(initial) + '</div>' : '') +
      '<div class="message-bubble-wrap">' +
        (!isMe ? '<div class="message-meta">' + Render.esc(m.sender_name || 'Unknown') + '</div>' : '') +
        '<div class="message-bubble">' + Render.esc(m.content) + '</div>' +
        '<div class="message-time">' + new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</div>' +
      '</div>' +
      (isMe ? '<div class="message-avatar message-avatar-mine" title="You">' + Render.esc(initial) + '</div>' : '');
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
  }

  function render() {
    const state  = AppState.getState();
    const groups = state.orgs || [];
    const list   = UI.el('messageGroupsList');
    if (!list) return;
    const myId = (state.profile && state.profile.id) || Auth.getUserId();
    list.innerHTML = groups.map(function(g) {
      const isDm      = !!g.is_dm;
      // For DMs show the other person's name; for groups show group name
      const label     = isDm ? (g.dm_other_name || g.name) : g.name;
      const initial   = (label || '?').charAt(0).toUpperCase();
      const isActive  = activeGroupId === g.id;
      return '<button class="message-group-btn ' + (isActive ? 'active' : '') + '" data-id="' + g.id + '" data-name="' + Render.esc(label) + '" data-role="' + Render.esc(g.role || '') + '" data-isdm="' + (isDm ? '1' : '0') + '">' +
        '<span class="msg-group-avatar' + (isDm ? ' msg-dm-avatar' : '') + '">' + Render.esc(initial) + '</span>' +
        '<span class="msg-group-label">' +
          '<span class="msg-group-name">' + Render.esc(label) + '</span>' +
          (isDm ? '<span class="msg-group-dm-badge">DM</span>' : '') +
        '</span>' +
        '</button>';
    }).join('');
    list.querySelectorAll('.message-group-btn').forEach(function(btn) {
      btn.onclick = function() {
        selectGroup(btn.dataset.id, btn.dataset.name, btn.dataset.role, btn.dataset.isdm === '1');
      };
    });
  }

  return { init, render, selectGroup, openNewChatModal };
})();


/* ═══════════════════════════════════════════════════════════
   BOARD SHARING MODAL
   Accepts email OR friend-code (profile UUID)
   ═══════════════════════════════════════════════════════════ */

const BoardSharing = (() => {
  const overlay    = UI.el('shareBoardOverlay');
  const identInput = UI.el('shareIdentifier');
  const permIn     = UI.el('sharePermission');
  const shareList  = UI.el('shareList');
  const errorEl    = UI.el('shareBoardError');
  let activeBoardId = null;

  function setError(msg) {
    if (!errorEl) return;
    errorEl.textContent   = msg;
    errorEl.style.display = msg ? '' : 'none';
  }

  async function open(boardId) {
    activeBoardId = boardId;
    setError('');
    if (identInput) identInput.value = '';
    if (overlay) overlay.classList.add('open');
    if (identInput) identInput.focus();
    await loadShares();
  }

  async function loadShares() {
    if (!shareList) return;
    shareList.innerHTML = '<div style="font-size:0.82rem;color:var(--ink-soft);padding:8px 0;">Loading\u2026</div>';
    try {
      const shares = await Storage.getBoardShares(activeBoardId);
      if (!shares || shares.length === 0) {
        shareList.innerHTML = '<div style="font-size:0.82rem;color:var(--ink-soft);padding:8px 0;">Not shared with anyone yet.</div>';
        return;
      }
      shareList.innerHTML = shares.map(function(s) {
        return '<div class="share-item">' +
          '<div>' +
            '<div class="share-item-email">' + Render.esc(s.display_name || s.email || 'Unknown') + '</div>' +
            '<div class="share-item-perm">' + Render.esc(s.email || '') + ' \u00b7 ' + s.permission_level + '</div>' +
          '</div>' +
          '<button class="share-item-remove" data-share-id="' + s.id + '" title="Remove access">\u2715</button>' +
          '</div>';
      }).join('');
      shareList.querySelectorAll('[data-share-id]').forEach(function(btn) {
        btn.onclick = async function() {
          btn.textContent = '\u2026';
          try { await Storage.removeShare(btn.dataset.shareId); await loadShares(); }
          catch (err) { setError(err.message); btn.textContent = '\u2715'; }
        };
      });
    } catch (err) {
      shareList.innerHTML = '<div style="font-size:0.82rem;color:var(--red);padding:8px 0;">' + Render.esc(err.message) + '</div>';
    }
  }

  UI.el('shareBoardBtn')?.addEventListener('click', async function() {
    const identifier = identInput ? identInput.value.trim() : '';
    if (!identifier) { if (identInput) identInput.focus(); return; }
    setError('');
    const btn = UI.el('shareBoardBtn');
    btn.textContent = '\u2026';
    btn.disabled = true;
    try {
      await Storage.shareBoard(activeBoardId, identifier, permIn ? permIn.value : 'view');
      if (identInput) identInput.value = '';
      await loadShares();
      btn.textContent = 'Share';
    } catch (err) {
      setError(err.message || 'Could not share \u2014 check the email or friend code.');
      btn.textContent = 'Share';
    }
    btn.disabled = false;
  });

  UI.el('shareBoardClose')?.addEventListener('click', function() { if (overlay) overlay.classList.remove('open'); });
  overlay?.addEventListener('click', function(e) { if (e.target === overlay) overlay.classList.remove('open'); });
  identInput?.addEventListener('keydown', function(e) { if (e.key === 'Enter') UI.el('shareBoardBtn')?.click(); });

  return { open };
})();
window.BoardSharing = BoardSharing;

/* ═══════════════════════════════════════════════════════════
   GROUPS VIEW
   ═══════════════════════════════════════════════════════════ */

const GroupsView = (() => {
  let selectedGroup = null; // { id, name, description, role }

  // ── Inline page renderer ─────────────────────────────────────
  function renderInline() {
    const groups = AppState.getState().orgs || [];
    renderSidebar(groups);
    clearDetail();
  }

  function renderSidebar(groups) {
    const list = UI.el('groupsSidebarList');
    if (!list) return;
    if (!groups.length) {
      list.innerHTML = '<div class="empty-state" style="padding:24px 16px;"><div class="empty-state-text">No organizations yet.<br>Create one to start.</div></div>';
      return;
    }
    list.innerHTML = groups.map(function(g) {
      const active = selectedGroup && selectedGroup.id === g.id;
      return '<button class="groups-sidebar-item' + (active ? ' active' : '') + '" data-gid="' + g.id + '">' +
        '<span class="groups-sidebar-avatar">' + Render.esc((g.name||'?').charAt(0).toUpperCase()) + '</span>' +
        '<span class="groups-sidebar-info">' +
          '<span class="groups-sidebar-name">' + Render.esc(g.name) + '</span>' +
          '<span class="groups-sidebar-role">' + Render.esc(g.role || '') + '</span>' +
        '</span>' +
        '</button>';
    }).join('');
    list.querySelectorAll('.groups-sidebar-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const gid  = btn.dataset.gid;
        const g    = (AppState.getState().orgs || []).find(function(x) { return x.id === gid; });
        if (!g) return;
        selectedGroup = g;
        list.querySelectorAll('.groups-sidebar-item').forEach(function(b) {
          b.classList.toggle('active', b.dataset.gid === gid);
        });
        showDetail(g);
      });
    });
  }

  function clearDetail() {
    const empty  = UI.el('groupsDetailEmpty');
    const panel  = UI.el('groupsDetailPanel');
    if (empty) empty.style.display = '';
    if (panel) panel.style.display = 'none';
  }

  async function showDetail(g) {
    const empty  = UI.el('groupsDetailEmpty');
    const panel  = UI.el('groupsDetailPanel');
    const nameEl = UI.el('groupsDetailName');
    const descEl = UI.el('groupsDetailDesc');
    if (empty) empty.style.display = 'none';
    if (panel) panel.style.display = '';
    if (nameEl) nameEl.textContent = g.name;
    if (descEl) descEl.textContent = g.description || '';

    // Wire add-member button
    const addBtn = UI.el('groupsDetailAddMemberBtn');
    if (addBtn) {
      addBtn.onclick = function() { openAddMemberModal(g.id, g.name); };
    }

    // Wire leave group button
    const leaveBtn = UI.el('groupsDetailLeaveBtn');
    if (leaveBtn) {
      leaveBtn.style.display = g.role !== 'owner' ? '' : 'none';
      leaveBtn.onclick = async function() {
        const confirmed = await showConfirm('Leave "' + g.name + '"? You will lose access.', 'Leave Group', 'Cancel');
        if (!confirmed) return;
        leaveBtn.textContent = '…';
        try {
          await Storage.leaveGroup(g.id);
          const groups = await Storage.getUserGroups();
          AppState.setState(function(s) { return Object.assign({}, s, { orgs: groups }); });
          selectedGroup = null;
          renderInline();
          showToast('Left "' + g.name + '"');
        } catch (err) {
          leaveBtn.textContent = 'Leave Group';
          showToast('Error: ' + err.message, true);
        }
      };
    }

    await loadDetailMembers(g.id, g.role);
  }

  async function loadDetailMembers(groupId, myRole) {
    const membersEl = UI.el('groupsDetailMembers');
    if (!membersEl) return;
    membersEl.innerHTML = '<div class="members-loading">Loading…</div>';
    try {
      const members = await Storage.getGroupMembers(groupId);
      const myId    = (AppState.getState().profile || {}).id || Auth.getUserId();
      const canRemove = myRole === 'admin' || myRole === 'owner';
      if (!members || !members.length) {
        membersEl.innerHTML = '<div class="members-empty">No members yet.</div>';
        return;
      }
      membersEl.innerHTML = '';
      members.forEach(function(m) {
        const isSelf = m.user_id === myId;
        const row = document.createElement('div');
        row.className = 'member-row';
        row.innerHTML =
          '<div class="member-avatar">' + Render.esc((m.display_name || m.email || '?').charAt(0).toUpperCase()) + '</div>' +
          '<div class="member-info">' +
            '<div class="member-name">' + Render.esc(m.display_name || m.email || 'Unknown') + '</div>' +
            '<div class="member-meta">' + Render.esc(m.email || '') + ' · ' + Render.esc(m.role) + '</div>' +
          '</div>' +
          (canRemove && !isSelf ?
            '<button class="member-remove btn-ghost" data-uid="' + m.user_id + '" title="Remove from group">✕ Remove</button>' : '');
        if (canRemove && !isSelf) {
          row.querySelector('.member-remove').addEventListener('click', async function(e) {
            e.stopPropagation();
            const removeBtn = e.currentTarget;
            if (removeBtn.dataset.pending) return; // prevent double-click recursion
            removeBtn.dataset.pending = '1';
            const displayName = m.display_name || m.email || 'this member';
            // Use custom confirm modal instead of browser confirm()
            const confirmed = await showConfirm('Remove ' + displayName + ' from this group?', 'Remove', 'Cancel');
            if (!confirmed) { delete removeBtn.dataset.pending; return; }
            removeBtn.textContent = '…';
            try {
              await Storage.removeGroupMember(groupId, m.user_id);
              // Replace row with fade-out instead of full reload to avoid recursion
              row.style.transition = 'opacity 0.2s';
              row.style.opacity = '0';
              setTimeout(function() {
                row.remove();
                // If membersEl is now empty, show empty state
                const remaining = membersEl.querySelectorAll('.member-row');
                if (!remaining.length) {
                  membersEl.innerHTML = '<div class="members-empty">No members yet.</div>';
                }
              }, 220);
            } catch (err) {
              delete removeBtn.dataset.pending;
              removeBtn.textContent = '✕ Remove';
              showToast('Error: ' + err.message, true);
            }
          });
        }
        membersEl.appendChild(row);
      });
    } catch (err) {
      membersEl.innerHTML = '<div class="members-empty" style="color:var(--red);">Error: ' + Render.esc(err.message) + '</div>';
    }
  }

  // ── Add member modal ─────────────────────────────────────────
  function openAddMemberModal(groupId, groupName) {
    const overlay = UI.el('addMemberOverlay');
    if (!overlay) return;
    const nameEl = UI.el('addMemberGroupName');
    if (nameEl) nameEl.textContent = groupName || '';
    overlay.dataset.groupId = groupId;
    const inputEl = UI.el('addMemberInput');
    if (inputEl) inputEl.value = '';
    const errEl = UI.el('addMemberError');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    overlay.classList.add('open');
    if (inputEl) inputEl.focus();
  }

  UI.el('confirmAddMemberBtn')?.addEventListener('click', async function() {
    const overlay    = UI.el('addMemberOverlay');
    const groupId    = overlay ? overlay.dataset.groupId : null;
    const inputEl    = UI.el('addMemberInput');
    const identifier = inputEl ? inputEl.value.trim() : '';
    if (!identifier) { if (inputEl) inputEl.focus(); return; }
    const btn = UI.el('confirmAddMemberBtn');
    btn.textContent = '…';
    const errEl = UI.el('addMemberError');
    try {
      await Storage.addGroupMember(groupId, identifier);
      if (overlay) overlay.classList.remove('open');
      btn.textContent = 'Add';
      // Refresh detail if this is the selected group
      if (selectedGroup && selectedGroup.id === groupId) {
        await loadDetailMembers(groupId, selectedGroup.role);
      }
    } catch (err) {
      if (errEl) { errEl.textContent = err.message || 'Could not add member.'; errEl.style.display = ''; }
      btn.textContent = 'Add';
    }
  });

  document.getElementById('addMemberOverlay')?.addEventListener('click', function(e) {
    if (e.target === UI.el('addMemberOverlay')) UI.el('addMemberOverlay')?.classList.remove('open');
  });
  document.getElementById('cancelAddMemberBtn')?.addEventListener('click',  function() { UI.el('addMemberOverlay')?.classList.remove('open'); });
  document.getElementById('cancelAddMemberBtn2')?.addEventListener('click', function() { UI.el('addMemberOverlay')?.classList.remove('open'); });

  // ── Create group ─────────────────────────────────────────────
  document.getElementById('createGroupInlineBtn')?.addEventListener('click', function() {
    UI.el('createGroupOverlay')?.classList.add('open');
  });

  document.getElementById('createGroupBtn')?.addEventListener('click', function() {
    UI.el('groupsOverlay')?.classList.remove('open');
    UI.el('createGroupOverlay')?.classList.add('open');
  });

  document.getElementById('confirmCreateGroupBtn')?.addEventListener('click', async function() {
    const nameEl = UI.el('groupName');
    const descEl = UI.el('groupDescription');
    const name   = nameEl ? nameEl.value.trim() : '';
    const desc   = (descEl && descEl.value.trim()) || null;
    if (!name) { if (nameEl) nameEl.focus(); return; }
    const btn = UI.el('confirmCreateGroupBtn');
    btn.textContent = '…';
    try {
      await Storage.createGroup(name, desc);
      const groups = await Storage.getUserGroups();
      AppState.setState(function(s) { return Object.assign({}, s, { orgs: groups }); });
      UI.el('createGroupOverlay')?.classList.remove('open');
      if (nameEl) nameEl.value = '';
      if (descEl) descEl.value = '';
      btn.textContent = 'Create';
      renderInline();
    } catch (err) {
      console.error(err);
      btn.textContent = 'Error';
      setTimeout(function() { btn.textContent = 'Create'; }, 1800);
    }
  });

  document.getElementById('createGroupClose')?.addEventListener('click',     function() { UI.el('createGroupOverlay')?.classList.remove('open'); });
  document.getElementById('createGroupCancelBtn')?.addEventListener('click', function() { UI.el('createGroupOverlay')?.classList.remove('open'); });
  document.getElementById('createGroupOverlay')?.addEventListener('click', function(e) {
    if (e.target === UI.el('createGroupOverlay')) UI.el('createGroupOverlay').classList.remove('open');
  });

  // ── Legacy modal (organization tab used to open a modal) ───────────
  document.getElementById('groupsClose')?.addEventListener('click', function() { UI.el('groupsOverlay')?.classList.remove('open'); });
  document.getElementById('groupsOverlay')?.addEventListener('click', function(e) {
    if (e.target === UI.el('groupsOverlay')) UI.el('groupsOverlay').classList.remove('open');
  });

  // ── Expose render for old modal-based GroupsView callers ─────
  function render() { renderInline(); }

  return { render, renderInline, openAddMemberModal, loadDetailMembers };
})();
window.GroupsView = GroupsView;

/* ═══════════════════════════════════════════════════════════
   FORUM  (public community feed)
   ═══════════════════════════════════════════════════════════ */

const Forum = (() => {
  let currentPage = 0;
  const PAGE_SIZE = 20;
  let wired       = false;

  async function loadPosts(reset) {
    if (reset) currentPage = 0;
    const feed = UI.el('forumFeed');
    if (!feed) return;
    if (reset) feed.innerHTML = '<p class="loading-text">Loading\u2026</p>';

    try {
      const posts = await Storage.getForumPosts(currentPage, PAGE_SIZE);
      if (reset) feed.innerHTML = '';

      if (!posts || posts.length === 0) {
        if (reset) feed.innerHTML = '<p class="loading-text" style="opacity:.5;">No posts yet \u2014 be the first!</p>';
        const lb = UI.el('forumLoadMore');
        if (lb) lb.style.display = 'none';
        return;
      }

      const state = AppState.getState();
      const myId  = (state.profile && state.profile.id) || Auth.getUserId();
      posts.forEach(function(post) {
        feed.appendChild(buildPostEl(post, myId));
      });

      currentPage++;
      const lb = UI.el('forumLoadMore');
      if (lb) lb.style.display = posts.length < PAGE_SIZE ? 'none' : '';
    } catch (err) {
      if (reset) feed.innerHTML = '<p class="loading-text" style="color:var(--red);">Error loading posts.</p>';
      console.error('Forum load error:', err);
    }
  }

  function buildPostEl(post, myId) {
    const el      = document.createElement('div');
    el.className  = 'forum-post';
    el.dataset.postId = post.id;
    const name    = (post.profiles && post.profiles.display_name) || 'Anonymous';
    const initial = name.charAt(0).toUpperCase();
    const color   = (post.profiles && post.profiles.avatar_color) || 'var(--accent)';
    const ts      = new Date(post.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const isOwner = post.user_id === myId;
    el.innerHTML =
      '<div class="forum-post-avatar" style="background:' + color + ';">' + Render.esc(initial) + '</div>' +
      '<div class="forum-post-body">' +
        '<div class="forum-post-meta">' +
          '<span class="forum-post-name forum-author-hover" data-uid="' + Render.esc(post.user_id) + '" data-name="' + Render.esc(name) + '" data-uid-full="' + Render.esc(post.user_id) + '">' + Render.esc(name) + '</span>' +
          '<span class="forum-post-time">' + ts + '</span>' +
          (isOwner ?
            '<span class="forum-post-actions">' +
              '<button class="forum-post-edit" title="Edit">Edit</button>' +
              '<button class="forum-post-delete" title="Delete">Delete</button>' +
            '</span>' : '') +
        '</div>' +
        '<div class="forum-post-content">' + Render.esc(post.content) + '</div>' +
      '</div>';
    if (isOwner) {
      el.querySelector('.forum-post-edit').addEventListener('click', function() { startEdit(el, post); });
      el.querySelector('.forum-post-delete').addEventListener('click', function() { deletePost(el, post.id); });
    }
    // Author hover card
    const authorEl = el.querySelector('.forum-author-hover');
    if (authorEl) {
      authorEl.addEventListener('mouseenter', function(e) { showAuthorCard(e.currentTarget); });
      authorEl.addEventListener('mouseleave', function() { scheduleHideAuthorCard(); });
    }
    return el;
  }

  function startEdit(el, post) {
    const contentEl = el.querySelector('.forum-post-content');
    if (!contentEl) return;
    const original = post.content;
    const ta = document.createElement('textarea');
    ta.className = 'forum-edit-input';
    ta.value     = original;
    ta.rows       = 3;
    ta.maxLength  = 1000;
    const actions = document.createElement('div');
    actions.className = 'forum-edit-actions';
    const saveBtn   = document.createElement('button');
    saveBtn.className = 'btn-primary';
    saveBtn.textContent = 'Save';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-ghost';
    cancelBtn.textContent = 'Cancel';
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    contentEl.replaceWith(ta);
    ta.after(actions);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    cancelBtn.addEventListener('click', function() {
      const newContentEl = document.createElement('div');
      newContentEl.className = 'forum-post-content';
      newContentEl.textContent = original;
      ta.replaceWith(newContentEl);
      actions.remove();
    });
    saveBtn.addEventListener('click', async function() {
      const newContent = ta.value.trim();
      if (!newContent) return;
      saveBtn.textContent = '\u2026';
      saveBtn.disabled = true;
      try {
        await Storage.updateForumPost(post.id, newContent);
        post.content = newContent;
        const newContentEl = document.createElement('div');
        newContentEl.className = 'forum-post-content';
        newContentEl.textContent = newContent;
        ta.replaceWith(newContentEl);
        actions.remove();
      } catch (err) {
        console.error('Edit error:', err);
        saveBtn.textContent = 'Error';
        setTimeout(function() { saveBtn.textContent = 'Save'; saveBtn.disabled = false; }, 1800);
      }
    });
  }

  async function deletePost(el, postId) {
    if (!confirm('Delete this post?')) return;
    try {
      await Storage.deleteForumPost(postId);
      el.classList.add('forum-post-deleting');
      setTimeout(function() { el.remove(); }, 260);
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  /* ── Author hover card ── */
  let authorCardEl   = null;
  let authorHideTimer = null;

  function showAuthorCard(anchorEl) {
    if (authorHideTimer) { clearTimeout(authorHideTimer); authorHideTimer = null; }
    if (authorCardEl) authorCardEl.remove();

    const uid  = anchorEl.dataset.uid;
    const name = anchorEl.dataset.name || 'Unknown';

    authorCardEl = document.createElement('div');
    authorCardEl.className = 'author-hover-card';
    authorCardEl.innerHTML =
      '<div class="author-card-name">' + Render.esc(name) + '</div>' +
      '<div class="author-card-label">Friend Code</div>' +
      '<div class="author-card-code-row">' +
        '<code class="author-card-code" id="authorCardCode">' + Render.esc(uid) + '</code>' +
        '<button class="author-card-copy" id="authorCardCopyBtn" title="Copy friend code">Copy</button>' +
      '</div>';

    document.body.appendChild(authorCardEl);

    // Position below the anchor
    const rect = anchorEl.getBoundingClientRect();
    const cardW = 280;
    let left = rect.left;
    if (left + cardW > window.innerWidth - 8) left = window.innerWidth - cardW - 8;
    authorCardEl.style.top  = (rect.bottom + window.scrollY + 6) + 'px';
    authorCardEl.style.left = left + 'px';

    authorCardEl.querySelector('#authorCardCopyBtn').addEventListener('click', async function() {
      const copyBtn = authorCardEl.querySelector('#authorCardCopyBtn');
      try {
        await navigator.clipboard.writeText(uid);
        copyBtn.textContent = 'Copied!';
      } catch (_) {
        const ta = document.createElement('textarea');
        ta.value = uid; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
        copyBtn.textContent = 'Copied!';
      }
      setTimeout(function() { copyBtn.textContent = 'Copy'; }, 2000);
    });

    authorCardEl.addEventListener('mouseenter', function() {
      if (authorHideTimer) { clearTimeout(authorHideTimer); authorHideTimer = null; }
    });
    authorCardEl.addEventListener('mouseleave', function() { scheduleHideAuthorCard(); });
  }

  function scheduleHideAuthorCard() {
    authorHideTimer = setTimeout(function() {
      if (authorCardEl) { authorCardEl.remove(); authorCardEl = null; }
      authorHideTimer = null;
    }, 200);
  }

  // Hide card on scroll
  window.addEventListener('scroll', function() {
    if (authorCardEl) { authorCardEl.remove(); authorCardEl = null; }
  }, { passive: true });

  async function submitPost() {
    const input   = UI.el('forumInput');
    const content = input ? input.value.trim() : '';
    if (!content) { if (input) input.focus(); return; }
    const btn = UI.el('forumSubmitBtn');
    if (btn) { btn.textContent = '\u2026'; btn.disabled = true; }
    try {
      const state = AppState.getState();
      const uid   = (state.profile && state.profile.id) || Auth.getUserId();
      await Storage.createForumPost(content, uid);
      if (input) input.value = '';
      const countEl = UI.el('forumCharCount');
      if (countEl) countEl.textContent = '';
      await loadPosts(true);
    } catch (err) {
      console.error('Forum post error:', err);
    }
    if (btn) { btn.textContent = 'Post'; btn.disabled = false; }
  }

  function render() {
    if (!wired) {
      UI.el('forumSubmitBtn')?.addEventListener('click', submitPost);
      UI.el('forumInput')?.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitPost();
      });
      UI.el('forumInput')?.addEventListener('input', function() {
        const len     = UI.el('forumInput') ? UI.el('forumInput').value.length : 0;
        const countEl = UI.el('forumCharCount');
        if (countEl) {
          countEl.textContent = len > 0 ? len + '/1000' : '';
          countEl.style.color = len > 900 ? 'var(--red)' : '';
        }
      });
      UI.el('forumLoadMore')?.addEventListener('click', function() { loadPosts(false); });
      sb.channel('forum_feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_posts' }, function() {
          if (AppState.getState().tab === 'forum') loadPosts(true);
        })
        .subscribe();
      wired = true;
    }
    loadPosts(true);
  }

  return { render };
})();

/* ═══════════════════════════════════════════════════════════
   BOARD
   ═══════════════════════════════════════════════════════════ */

const Board = (() => {
  const boardScroll  = document.getElementById('boardScroll');
  const addListBtn   = document.getElementById('addListBtn');
  const addListGhost = document.getElementById('addListGhost');
  const boardTitleEl = document.getElementById('boardTitle');

  let activeAddCardListId = null;
  let activeAddListForm   = null;
  let activeMenu          = null;

  function render() {
    const state = AppState.getState();
    if (document.activeElement !== boardTitleEl) boardTitleEl.textContent = state.boardTitle;
    document.documentElement.style.setProperty('--accent', state.boardColor || '#C97D4E');
    boardScroll.querySelectorAll('.list, .add-list-form').forEach(function(el) { el.remove(); });
    state.lists.forEach(function(list) { boardScroll.insertBefore(Render.list(list), addListGhost); });
    attachDragListeners();
  }

  function attachDragListeners() {
    boardScroll.querySelectorAll('.card').forEach(function(cardEl) {
      cardEl.addEventListener('mousedown', onCardMouseDown);
      cardEl.addEventListener('touchstart', onCardTouchStart, { passive: true });
    });
  }

  function onCardMouseDown(e) {
    if (e.button !== 0 || e.target.closest('[contenteditable]')) return;
    const cardEl = e.currentTarget;
    const cardId = cardEl.dataset.cardId;
    const listEl = cardEl.closest('.list');
    const listId = listEl ? listEl.dataset.listId : null;
    let dragging = false;
    const sx = e.clientX, sy = e.clientY;
    function onMove(me) {
      if (!dragging && (Math.abs(me.clientX-sx)>5||Math.abs(me.clientY-sy)>5)) { dragging=true; DragEngine.start(cardEl,cardId,listId); }
      if (dragging) DragEngine.move(me.clientX,me.clientY);
    }
    async function onUp(me) {
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      if (!dragging) { CardModal.open(cardId,listId); return; }
      const drop = getDropTarget(me.clientX,me.clientY);
      if (drop) await handleDrop(DragEngine.end(drop.listId,drop.index));
      else { DragEngine.cancel(); render(); }
    }
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  }

  function onCardTouchStart(e) {
    const cardEl = e.currentTarget;
    const cardId = cardEl.dataset.cardId;
    const listEl = cardEl.closest('.list');
    const listId = listEl ? listEl.dataset.listId : null;
    const t0 = e.touches[0]; let dragging = false;
    const sx = t0.clientX, sy = t0.clientY;
    function onMove(te) {
      const t = te.touches[0];
      if (!dragging&&(Math.abs(t.clientX-sx)>8||Math.abs(t.clientY-sy)>8)){dragging=true;DragEngine.start(cardEl,cardId,listId);}
      if (dragging){te.preventDefault();DragEngine.move(t.clientX,t.clientY);}
    }
    async function onEnd(te) {
      document.removeEventListener('touchmove',onMove);
      document.removeEventListener('touchend',onEnd);
      if (!dragging){CardModal.open(cardId,listId);return;}
      const t=te.changedTouches[0]; const drop=getDropTarget(t.clientX,t.clientY);
      if (drop) await handleDrop(DragEngine.end(drop.listId,drop.index));
      else{DragEngine.cancel();render();}
    }
    document.addEventListener('touchmove',onMove,{passive:false});
    document.addEventListener('touchend',onEnd);
  }

  async function handleDrop(result) {
    const cardId = result.cardId, sourceListId = result.sourceListId, targetListId = result.targetListId, targetIndex = result.targetIndex;
    const state    = AppState.getState();
    const srcCards = state.lists.find(function(l){return l.id===sourceListId;})?.cards;
    const cardIdx  = srcCards ? srcCards.findIndex(function(c){return c.id===cardId;}) : -1;
    if (cardIdx===-1){render();return;}
    AppState.setState(function(s) {
      const src=s.lists.find(function(l){return l.id===sourceListId;});
      const dest=s.lists.find(function(l){return l.id===targetListId;});
      const card=src.cards.splice(cardIdx,1)[0];
      dest.cards.splice(targetIndex!=null?targetIndex:dest.cards.length,0,card);
      return s;
    });
    UI.setSyncStatus('saving');
    try {
      const ns       = AppState.getState();
      const destList = ns.lists.find(function(l){return l.id===targetListId;});
      const newPos   = destList.cards.findIndex(function(c){return c.id===cardId;});
      await Storage.moveCard(cardId,targetListId,newPos,state.boardId);
      await Storage.reorderCards(destList.cards);
      if (sourceListId!==targetListId) await Storage.reorderCards(ns.lists.find(function(l){return l.id===sourceListId;}).cards);
      UI.setSyncStatus('saved');
    } catch(err){console.error(err);UI.setSyncStatus('error');}
  }

  function getDropTarget(cx, cy) {
    const containers = boardScroll.querySelectorAll('.cards-container');
    for (let i = 0; i < containers.length; i++) {
      const container = containers[i];
      const r = container.getBoundingClientRect();
      if (cx>=r.left&&cx<=r.right&&cy>=r.top&&cy<=r.bottom) {
        const listId = container.dataset.listId;
        const cards  = Array.from(container.querySelectorAll('.card:not(.dragging)'));
        let index    = cards.length;
        for (let j=0;j<cards.length;j++){const cr=cards[j].getBoundingClientRect();if(cy<cr.top+cr.height/2){index=j;break;}}
        return { listId: listId, index: index };
      }
    }
    return null;
  }

  function showAddCardForm(listId) {
    if (activeAddCardListId===listId) return;
    hideAddCardForm();
    const listEl = boardScroll.querySelector('.list[data-list-id="' + listId + '"]');
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
    async function doAdd() {
      const title = input.value.trim();
      hideAddCardForm();
      if (!title) return;
      const state = AppState.getState();
      const pos   = (state.lists.find(function(l){return l.id===listId;}) || {cards:[]}).cards.length;
      UI.setSyncStatus('saving');
      try {
        const c = await Storage.createCard(state.boardId, listId, title, pos);
        AppState.setState(function(s) {
          const l = s.lists.find(function(x){return x.id===listId;});
          if (l) l.cards.push({ id:c.id, title:c.title, description:'', dueDate:'', dueTime:'', priority:'', phone:'', reminders:[], position:c.position });
          return s;
        });
        UI.setSyncStatus('saved');
      } catch(err) { console.error(err); UI.setSyncStatus('error'); }
    }
    confirm.addEventListener('click', doAdd);
    cancel.addEventListener('click', hideAddCardForm);
    input.addEventListener('keydown', function(e) {
      if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();doAdd();}
      if (e.key==='Escape') hideAddCardForm();
    });
  }

  function hideAddCardForm() {
    if (!activeAddCardListId) return;
    const listEl = boardScroll.querySelector('.list[data-list-id="' + activeAddCardListId + '"]');
    if (listEl) {
      const f = listEl.querySelector('.add-card-form');
      if (f) f.remove();
      const b = listEl.querySelector('.add-card-btn');
      if (b) b.style.display = '';
    }
    activeAddCardListId = null;
  }

  function showAddListForm() {
    if (activeAddListForm) return;
    const form    = document.createElement('div');
    form.className = 'add-list-form';
    form.innerHTML = '<input class="add-list-input" type="text" placeholder="List title\u2026" maxlength="60" />' +
      '<div class="add-list-actions"><button class="btn-confirm">Add List</button>' +
      '<button class="btn-cancel-form"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>';
    const input   = form.querySelector('.add-list-input');
    const confirm = form.querySelector('.btn-confirm');
    const cancel  = form.querySelector('.btn-cancel-form');
    boardScroll.insertBefore(form, addListGhost);
    input.focus();
    activeAddListForm = form;
    async function doAdd() {
      const title = input.value.trim();
      hideAddListForm();
      if (!title) return;
      const state = AppState.getState();
      UI.setSyncStatus('saving');
      try {
        const l = await Storage.createList(state.boardId, title, state.lists.length);
        AppState.setState(function(s) { s.lists.push({ id:l.id, title:l.title, position:l.position, cards:[] }); return s; });
        UI.setSyncStatus('saved');
      } catch(err) { console.error(err); UI.setSyncStatus('error'); }
    }
    confirm.addEventListener('click', doAdd);
    cancel.addEventListener('click', hideAddListForm);
    input.addEventListener('keydown', function(e) {
      if (e.key==='Enter') doAdd();
      if (e.key==='Escape') hideAddListForm();
    });
  }

  function hideAddListForm() {
    if (activeAddListForm) { activeAddListForm.remove(); activeAddListForm = null; }
  }

  function showListMenu(listId, btnEl) {
    closeAllMenus();
    const menu = document.createElement('div');
    menu.className = 'list-menu';
    menu.innerHTML =
      '<div class="list-menu-item" data-action="clear">' +
        '<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12l-1.5 9H3.5L2 4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 2h5M1 4h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
        ' Clear all cards</div>' +
      '<div class="list-menu-item danger" data-action="delete">' +
        '<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12l-1.5 9H3.5L2 4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 2h5M1 4h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
        ' Delete list</div>';
    btnEl.parentElement.style.position = 'relative';
    btnEl.parentElement.appendChild(menu);
    activeMenu = { menu: menu, listId: listId };
    menu.addEventListener('click', async function(e) {
      const item = e.target.closest('.list-menu-item');
      if (!item) return;
      const action = item.dataset.action;
      closeAllMenus();
      UI.setSyncStatus('saving');
      try {
        if (action==='delete') {
          AppState.setState(function(s){ s.lists=s.lists.filter(function(l){return l.id!==listId;}); return s; });
          await Storage.deleteList(listId);
        } else if (action==='clear') {
          AppState.setState(function(s){ const l=s.lists.find(function(x){return x.id===listId;}); if(l) l.cards=[]; return s; });
          await Storage.clearListCards(listId);
        }
        UI.setSyncStatus('saved');
      } catch(err) { console.error(err); UI.setSyncStatus('error'); }
    });
  }

  function closeAllMenus() { if (activeMenu) { activeMenu.menu.remove(); activeMenu = null; } }

  boardScroll.addEventListener('click', function(e) {
    const addCardBtn = e.target.closest('[data-add-card]');
    if (addCardBtn) { showAddCardForm(addCardBtn.dataset.addCard); return; }
    const menuBtn = e.target.closest('[data-list-menu]');
    if (menuBtn) {
      const id = menuBtn.dataset.listMenu;
      if (activeMenu && activeMenu.listId === id) closeAllMenus(); else showListMenu(id, menuBtn);
      return;
    }
    if (!e.target.closest('.list-menu')) closeAllMenus();
  });

  boardScroll.addEventListener('blur', async function(e) {
    const el = e.target.closest('.list-title[data-list-id]');
    if (!el) return;
    const listId   = el.dataset.listId;
    const newTitle = el.textContent.trim();
    if (!newTitle) {
      const l = AppState.getState().lists.find(function(x){return x.id===listId;});
      el.textContent = (l && l.title) || 'Untitled';
      return;
    }
    AppState.setState(function(s) {
      const l = s.lists.find(function(x){return x.id===listId;});
      if (l) l.title = newTitle;
      return s;
    });
    UI.setSyncStatus('saving');
    try { await Storage.updateListTitle(listId, newTitle); UI.setSyncStatus('saved'); }
    catch(err) { console.error(err); UI.setSyncStatus('error'); }
  }, true);

  boardScroll.addEventListener('keydown', function(e) {
    if (e.target.closest('.list-title') && e.key==='Enter') { e.preventDefault(); e.target.blur(); }
  });

  boardTitleEl.addEventListener('blur', async function() {
    const newTitle = boardTitleEl.textContent.trim();
    if (!newTitle) { boardTitleEl.textContent = AppState.getState().boardTitle; return; }
    const boardId = AppState.getState().boardId;
    AppState.setState(function(s) {
      s.boardTitle = newTitle;
      const b = s.boards.find(function(x){return x.id===boardId;});
      if (b) { b.title = newTitle; b.updated_at = new Date().toISOString(); }
      return s;
    });
    UI.setSyncStatus('saving');
    try { await Storage.updateBoardTitle(boardId, newTitle); UI.setSyncStatus('saved'); }
    catch(err) { console.error(err); UI.setSyncStatus('error'); }
  });
  boardTitleEl.addEventListener('keydown', function(e) {
    if (e.key==='Enter') { e.preventDefault(); boardTitleEl.blur(); }
  });

  addListBtn?.addEventListener('click', showAddListForm);
  addListGhost?.addEventListener('click', showAddListForm);

  document.addEventListener('click', function(e) {
    if (activeAddCardListId && !e.target.closest('.add-card-form') && !e.target.closest('[data-add-card]')) hideAddCardForm();
    if (activeAddListForm  && !e.target.closest('.add-list-form')  && !e.target.closest('#addListBtn') && !e.target.closest('#addListGhost')) hideAddListForm();
  });

  AppState.subscribe(function(state) { if (state.view==='board') render(); });

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
  const verifyRow = document.getElementById('smsVerifyRow');
  const codeEl    = document.getElementById('smsVerifyCode');
  const verifyBtn = document.getElementById('smsVerifyBtn');
  const statusEl  = document.getElementById('smsSetupStatus');

  let pendingPhone = null;
  let pendingCode  = null;

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent   = msg;
    statusEl.style.display = msg ? '' : 'none';
    statusEl.style.color   = isError ? 'var(--red)' : 'var(--green)';
  }

  function open() {
    if (!overlay) return;
    const profile = AppState.getState().profile;
    if (phoneEl) phoneEl.value = (profile && profile.phone) || '';
    if (verifyRow) verifyRow.style.display = 'none';
    if (codeEl) codeEl.value = '';
    setStatus('', false);
    pendingPhone = null; pendingCode = null;
    // Show verified badge if already verified
    const verified = profile && profile.phone_verified;
    if (statusEl && verified) {
      setStatus('\u2713 Phone verified — reminders are active', false);
    }
    overlay.classList.add('open');
    if (phoneEl) phoneEl.focus();
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    pendingPhone = null; pendingCode = null;
  }

  // Step 1: send a verification SMS with a random 6-digit code
  async function sendCode() {
    const raw   = phoneEl ? phoneEl.value.trim() : '';
    const phone = SMS.normalizeUS(raw);
    if (!raw) { if (phoneEl) phoneEl.focus(); return; }
    if (!phone) {
      setStatus('Invalid number. Use format +12125551234', true);
      return;
    }
    if (saveBtn) { saveBtn.textContent = 'Sending\u2026'; saveBtn.disabled = true; }
    setStatus('', false);
    // Generate 6-digit code
    pendingCode  = String(Math.floor(100000 + Math.random() * 900000));
    pendingPhone = phone;
    const msg = 'TaskDeck verification code: ' + pendingCode;
    try {
      const result = await SMS.send(phone, msg);
      if (result.ok === false && result.reason !== 'network_error') {
        setStatus('Could not send SMS. Check the number and try again.', true);
        pendingCode = null; pendingPhone = null;
        if (saveBtn) { saveBtn.textContent = 'Send Code'; saveBtn.disabled = false; }
        return;
      }
      // Show verify step
      if (verifyRow) verifyRow.style.display = '';
      if (codeEl) { codeEl.value = ''; codeEl.focus(); }
      setStatus('Code sent! Check your messages and enter it below.', false);
      if (saveBtn) { saveBtn.textContent = 'Resend Code'; saveBtn.disabled = false; }
    } catch (err) {
      console.error(err);
      setStatus('SMS send failed.', true);
      pendingCode = null;
      if (saveBtn) { saveBtn.textContent = 'Send Code'; saveBtn.disabled = false; }
    }
  }

  // Step 2: confirm the code
  async function confirmCode() {
    const entered = codeEl ? codeEl.value.trim() : '';
    if (!entered || !pendingCode) return;
    if (entered !== pendingCode) {
      setStatus('Wrong code. Try again or resend.', true);
      if (codeEl) { codeEl.value = ''; codeEl.focus(); }
      return;
    }
    // Code matches — save phone + verified flag
    const userId = Auth.getUserId();
    if (verifyBtn) { verifyBtn.textContent = '\u2026'; verifyBtn.disabled = true; }
    try {
      await Storage.upsertProfile(userId, { phone: pendingPhone, sms_enabled: true, phone_verified: true });
      AppState.setState(function(s) {
        if (s.profile) { s.profile.phone = pendingPhone; s.profile.sms_enabled = true; s.profile.phone_verified = true; }
        return s;
      });
      if (phoneEl) phoneEl.value = pendingPhone;
      UI.setProfile(AppState.getState().profile);
      setStatus('\u2713 Phone verified! SMS reminders are now active.', false);
      if (verifyRow) verifyRow.style.display = 'none';
      pendingCode = null; pendingPhone = null;
      if (verifyBtn) { verifyBtn.textContent = 'Confirm'; verifyBtn.disabled = false; }
      setTimeout(close, 2000);
    } catch (err) {
      console.error(err);
      setStatus('Could not save. Try again.', true);
      if (verifyBtn) { verifyBtn.textContent = 'Confirm'; verifyBtn.disabled = false; }
    }
  }

  if (saveBtn)  saveBtn.addEventListener('click', sendCode);
  if (verifyBtn) verifyBtn.addEventListener('click', confirmCode);
  if (skipBtn)  skipBtn.addEventListener('click', close);
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (overlay)  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  if (phoneEl)  phoneEl.addEventListener('keydown', function(e) { if (e.key==='Enter') sendCode(); if (e.key==='Escape') close(); });
  if (codeEl)   codeEl.addEventListener('keydown', function(e) { if (e.key==='Enter') confirmCode(); });

  return { open, close };
})();

/* ═══════════════════════════════════════════════════════════
   PROFILE DROPDOWN
   ═══════════════════════════════════════════════════════════ */

const ProfileMenu = (() => {
  const wrap       = document.getElementById('profileWrap');
  const btn        = document.getElementById('profileBtn');
  const dropdown   = document.getElementById('profileDropdown');
  const saveBtn    = document.getElementById('saveNameBtn');
  const nameInput  = document.getElementById('profileNameInput');
  const smsToggle  = document.getElementById('smsToggle');
  const phoneInput = document.getElementById('profilePhoneInput');
  const savePhone  = document.getElementById('savePhoneBtn');
  let isOpen = false;

  function show() {
    isOpen = true;
    if (dropdown) dropdown.classList.add('open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    Theme.apply(Theme.get());
  }
  function hide() {
    isOpen = false;
    if (dropdown) dropdown.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  function toggle() { isOpen ? hide() : show(); }

  if (btn) btn.addEventListener('click', function(e) { e.stopPropagation(); toggle(); });
  document.addEventListener('click', function(e) { if (isOpen && wrap && !wrap.contains(e.target)) hide(); });
  document.addEventListener('keydown', function(e) { if (e.key==='Escape' && isOpen) hide(); });

  document.getElementById('themeOptions')?.addEventListener('click', function(e) {
    const tb = e.target.closest('.theme-btn');
    if (tb) Theme.apply(tb.dataset.theme);
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', async function() {
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name) return;
      const userId = Auth.getUserId();
      saveBtn.textContent = '\u2026';
      try {
        await Storage.upsertProfile(userId, { display_name: name });
        AppState.setState(function(s) { if (s.profile) s.profile.display_name = name; return s; });
        UI.setProfile(AppState.getState().profile);
        saveBtn.textContent = 'Saved!';
        setTimeout(function() { saveBtn.textContent = 'Save'; }, 1800);
      } catch (err) {
        console.error(err);
        saveBtn.textContent = 'Error';
        setTimeout(function() { saveBtn.textContent = 'Save'; }, 1800);
      }
    });
  }
  if (nameInput) nameInput.addEventListener('keydown', function(e) { if (e.key==='Enter' && saveBtn) saveBtn.click(); });

  if (smsToggle) {
    smsToggle.addEventListener('click', async function() {
      const profile     = AppState.getState().profile;
      const currentlyOn = !!(profile && profile.sms_enabled);
      if (!currentlyOn) {
        // Must have a verified phone to enable
        if (!(profile && profile.phone && profile.phone.trim() && profile.phone_verified)) {
          hide(); SmsSetup.open(); return;
        }
        await setSmsEnabled(true);
      } else {
        await setSmsEnabled(false);
      }
    });
  }

  async function setSmsEnabled(val) {
    const userId = Auth.getUserId();
    try {
      await Storage.upsertProfile(userId, { sms_enabled: val });
      AppState.setState(function(s) { if (s.profile) s.profile.sms_enabled = val; return s; });
      UI.setProfile(AppState.getState().profile);
    } catch (err) { console.error(err); }
  }

  if (savePhone) {
    savePhone.addEventListener('click', async function() {
      const raw    = phoneInput ? phoneInput.value.trim() : '';
      const userId = Auth.getUserId();
      const phone  = SMS.normalizeUS(raw);
      if (raw && !phone) {
        savePhone.textContent = 'Bad #';
        if (phoneInput) phoneInput.style.borderColor = 'var(--red, #e55)';
        setTimeout(function() { savePhone.textContent = 'Save'; if (phoneInput) phoneInput.style.borderColor = ''; }, 2000);
        return;
      }
      savePhone.textContent = '\u2026';
      try {
        // Changing the number resets verification — user must re-verify
        await Storage.upsertProfile(userId, { phone: phone || null, phone_verified: false, sms_enabled: false });
        AppState.setState(function(s) {
          if (s.profile) { s.profile.phone = phone || null; s.profile.phone_verified = false; s.profile.sms_enabled = false; }
          return s;
        });
        if (phoneInput && phone) phoneInput.value = phone;
        UI.setProfile(AppState.getState().profile);
        savePhone.textContent = 'Saved — verify to enable SMS';
        setTimeout(function() { savePhone.textContent = 'Save'; }, 2400);
        if (phone) SmsSetup.open();
      } catch (err) {
        console.error(err);
        savePhone.textContent = 'Error';
        setTimeout(function() { savePhone.textContent = 'Save'; }, 1800);
      }
    });
  }
  if (phoneInput) phoneInput.addEventListener('keydown', function(e) { if (e.key==='Enter' && savePhone) savePhone.click(); });

  document.getElementById('verifyPhoneBtn')?.addEventListener('click', function() {
    hide();
    SmsSetup.open();
  });

  document.getElementById('copyUserIdBtn')?.addEventListener('click', async function() {
    const uidInput = document.getElementById('profileUserIdFull');
    const uid      = uidInput ? uidInput.value : '';
    if (!uid) return;
    const copyBtn = document.getElementById('copyUserIdBtn');
    try {
      await navigator.clipboard.writeText(uid);
      copyBtn.textContent = 'Copied!';
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = uid; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyBtn.textContent = 'Copied!';
    }
    setTimeout(function() { copyBtn.textContent = 'Copy'; }, 2000);
  });

  document.getElementById('signOutBtn')?.addEventListener('click', async function() {
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

  document.getElementById('showSignUp')?.addEventListener('click', function(e) {
    e.preventDefault(); signInForm.style.display='none'; signUpForm.style.display=''; UI.authError('');
  });
  document.getElementById('showSignIn')?.addEventListener('click', function(e) {
    e.preventDefault(); signUpForm.style.display='none'; signInForm.style.display=''; UI.authError('');
  });

  document.getElementById('signInBtn')?.addEventListener('click', async function() {
    const emailEl = document.getElementById('signInEmail');
    const passEl  = document.getElementById('signInPassword');
    UI.authError('');
    try { await Auth.signIn(emailEl ? emailEl.value.trim() : '', passEl ? passEl.value : ''); }
    catch (err) { UI.authError(err.message || 'Sign in failed.'); }
  });

  document.getElementById('signInGoogleBtn')?.addEventListener('click', async function() {
    UI.authError('');
    try {
      const redirectTo = window.location.href.split('?')[0].split('#')[0];
      const result = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo, queryParams: { access_type: 'offline', prompt: 'consent' } },
      });
      if (result.error) throw result.error;
    } catch (err) {
      UI.authError(err.message || 'Google sign in failed. Make sure Google OAuth is configured in Supabase.');
    }
  });

  document.getElementById('signUpBtn')?.addEventListener('click', async function() {
    const emailEl = document.getElementById('signUpEmail');
    const nameEl  = document.getElementById('signUpName');
    const passEl  = document.getElementById('signUpPassword');
    UI.authError('');
    try {
      await Auth.signUp(
        emailEl ? emailEl.value.trim() : '',
        passEl  ? passEl.value : '',
        nameEl  ? nameEl.value.trim() : ''
      );
      signUpForm.innerHTML =
        '<div style="text-align:center;padding:12px 0;color:var(--green);">' +
          '<div style="font-size:2rem;margin-bottom:8px;">\u2713</div>' +
          '<p style="font-weight:500;line-height:1.5;">Account created!<br>Check your email to confirm, then sign in.</p>' +
        '</div>' +
        '<p class="auth-switch" style="margin-top:16px;"><a href="#" id="backToSignIn">Back to sign in</a></p>';
      document.getElementById('backToSignIn')?.addEventListener('click', function(e) {
        e.preventDefault(); signUpForm.style.display='none'; signInForm.style.display='';
      });
    } catch (err) { UI.authError(err.message || 'Sign up failed.'); }
  });

  ['signInEmail','signInPassword'].forEach(function(id) {
    document.getElementById(id)?.addEventListener('keydown', function(e) {
      if (e.key==='Enter') document.getElementById('signInBtn')?.click();
    });
  });
  ['signUpEmail','signUpName','signUpPassword'].forEach(function(id) {
    document.getElementById(id)?.addEventListener('keydown', function(e) {
      if (e.key==='Enter') document.getElementById('signUpBtn')?.click();
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   AI BOARD GENERATOR
   Calls Gemini via Supabase Edge Function (generate-board).
   Gemini only returns JSON — it never touches the database.
   Board creation uses the same Storage calls as normal boards.
   ═══════════════════════════════════════════════════════════ */

const AIBoard = (() => {
  const overlay      = UI.el('aiBoardOverlay');
  const step1        = UI.el('aiStep1');
  const step2        = UI.el('aiStep2');
  const step3        = UI.el('aiStep3');
  const promptInput  = UI.el('aiPromptInput');
  const errorEl      = UI.el('aiPromptError');
  const loadingText  = UI.el('aiLoadingText');
  const previewName  = UI.el('aiPreviewBoardName');
  const previewLists = UI.el('aiPreviewLists');

  let pendingBoard = null; // parsed JSON from Gemini

  const LOADING_MESSAGES = [
    'Thinking\u2026',
    'Planning your project\u2026',
    'Organizing tasks\u2026',
    'Almost ready\u2026',
  ];
  let loadingInterval = null;

  function setError(msg) {
    if (!errorEl) return;
    errorEl.textContent   = msg;
    errorEl.style.display = msg ? '' : 'none';
  }

  function showStep(n) {
    if (step1) step1.style.display = n === 1 ? '' : 'none';
    if (step2) step2.style.display = n === 2 ? '' : 'none';
    if (step3) step3.style.display = n === 3 ? '' : 'none';
  }

  function open() {
    if (!overlay) return;
    showStep(1);
    if (promptInput) promptInput.value = '';
    setError('');
    pendingBoard = null;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(function() { if (promptInput) promptInput.focus(); }, 60);
  }

  function close() {
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (loadingInterval) { clearInterval(loadingInterval); loadingInterval = null; }
    pendingBoard = null;
  }

  function startLoadingAnimation() {
    let i = 0;
    if (loadingText) loadingText.textContent = LOADING_MESSAGES[0];
    loadingInterval = setInterval(function() {
      i = (i + 1) % LOADING_MESSAGES.length;
      if (loadingText) loadingText.textContent = LOADING_MESSAGES[i];
    }, 1400);
  }

  async function generate() {
    const prompt = promptInput ? promptInput.value.trim() : '';
    if (!prompt) { if (promptInput) promptInput.focus(); return; }
    setError('');
    showStep(2);
    startLoadingAnimation();

    try {
      const result = await sb.auth.getSession();
      const session = result.data && result.data.session;
      if (!session) throw new Error('Not signed in.');

      const resp = await fetch(SUPABASE_URL + '/functions/v1/generate-board', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + session.access_token,
          'apikey':        SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ prompt: prompt }),
      });

      const data = await resp.json().catch(function() { return {}; });

      if (!resp.ok) {
        throw new Error((data && data.error) || 'Generation failed. Try again.');
      }

      // Validate structure
      if (!data.board_title || !Array.isArray(data.lists) || data.lists.length === 0) {
        throw new Error('Unexpected response from AI. Please try a different prompt.');
      }

      pendingBoard = data;
      renderPreview(data);
      if (loadingInterval) { clearInterval(loadingInterval); loadingInterval = null; }
      showStep(3);

    } catch (err) {
      if (loadingInterval) { clearInterval(loadingInterval); loadingInterval = null; }
      showStep(1);
      setError(err.message || 'Something went wrong. Please try again.');
    }
  }

  function renderPreview(data) {
    if (previewName) previewName.textContent = data.board_title;
    if (!previewLists) return;
    // Build with checkboxes — all checked by default, user can uncheck to exclude
    previewLists.innerHTML = data.lists.map(function(list, li) {
      const cards = (list.cards || []).map(function(card, ci) {
        const pri = card.priority ? '<span class="ai-preview-priority ai-pri-' + card.priority + '">' + card.priority + '</span>' : '';
        const cbId = 'ai-card-' + li + '-' + ci;
        return '<label class="ai-preview-card ai-preview-card-check" for="' + cbId + '">' +
          '<input type="checkbox" id="' + cbId + '" data-li="' + li + '" data-ci="' + ci + '" checked />' +
          '<span class="ai-card-title">' + Render.esc(card.title) + '</span>' +
          pri +
          '</label>';
      }).join('');
      const listCbId = 'ai-list-' + li;
      return '<div class="ai-preview-list">' +
        '<label class="ai-preview-list-name" for="' + listCbId + '">' +
          '<input type="checkbox" id="' + listCbId + '" class="ai-list-toggle" data-li="' + li + '" checked />' +
          '<span>' + Render.esc(list.title) + '</span>' +
          '<span class="ai-preview-list-count">' + (list.cards || []).length + '</span>' +
        '</label>' +
        '<div class="ai-preview-cards">' + cards + '</div>' +
        '</div>';
    }).join('');

    // List toggle — checking/unchecking a list checks/unchecks all its cards
    previewLists.querySelectorAll('.ai-list-toggle').forEach(function(listCb) {
      listCb.addEventListener('change', function() {
        const li = listCb.dataset.li;
        previewLists.querySelectorAll('input[data-li="' + li + '"]').forEach(function(cb) {
          cb.checked = listCb.checked;
        });
        updateApproveBtn();
      });
    });
    previewLists.querySelectorAll('input[type="checkbox"]:not(.ai-list-toggle)').forEach(function(cb) {
      cb.addEventListener('change', updateApproveBtn);
    });
    updateApproveBtn();
  }

  function updateApproveBtn() {
    const btn = UI.el('aiApproveBtn');
    if (!btn || !previewLists) return;
    const anyChecked = previewLists.querySelector('input[type="checkbox"]:not(.ai-list-toggle):checked');
    btn.disabled = !anyChecked;
    btn.title = anyChecked ? '' : 'Select at least one card to create';
  }

  function getCheckedSelection() {
    if (!pendingBoard || !previewLists) return null;
    const result = { board_title: pendingBoard.board_title, lists: [] };
    pendingBoard.lists.forEach(function(list, li) {
      const checkedCards = (list.cards || []).filter(function(card, ci) {
        const cb = previewLists.querySelector('input[data-li="' + li + '"][data-ci="' + ci + '"]');
        return cb && cb.checked;
      });
      if (checkedCards.length > 0) {
        result.lists.push({ title: list.title, cards: checkedCards });
      }
    });
    return result;
  }

  async function approve() {
    const selection = getCheckedSelection();
    if (!selection || !selection.lists.length) return;
    const btn = UI.el('aiApproveBtn');
    if (btn) { btn.textContent = 'Creating\u2026'; btn.disabled = true; }

    const userId = Auth.getUserId();
    // Pick a color from the palette based on board title hash
    const colors = ['#C97D4E','#4E7FC9','#4E9B6F','#9B4EC9','#C94E7F','#5A5248'];
    const colorIdx = selection.board_title.length % colors.length;
    const color = colors[colorIdx];

    UI.setSyncStatus('saving');
    try {
      // Create board
      const board = await Storage.createBoard(userId, selection.board_title, color);

      // Create only the checked lists and cards
      for (let li = 0; li < selection.lists.length; li++) {
        const listDef = selection.lists[li];
        const list    = await Storage.createList(board.id, listDef.title, li);
        const cards   = listDef.cards || [];
        for (let ci = 0; ci < cards.length; ci++) {
          const cardDef = cards[ci];
          const created = await Storage.createCard(board.id, list.id, cardDef.title, ci);
          // If description or priority, update immediately
          if (cardDef.description || cardDef.priority) {
            await Storage.updateCard(created.id, {
              description: cardDef.description || null,
              priority:    cardDef.priority    || null,
            });
          }
        }
      }

      // Add to local boards state
      AppState.setState(function(s) { s.boards.unshift(board); return s; });
      UI.setSyncStatus('saved');
      close();

      // Open the new board
      await Dashboard.openBoard(board.id);

    } catch (err) {
      console.error('AI board creation error:', err);
      UI.setSyncStatus('error');
      if (btn) { btn.textContent = 'Create Board'; btn.disabled = false; }
      showStep(3);
    }
  }

  // Wire buttons
  UI.el('aiBoardBtn')?.addEventListener('click', open);
  UI.el('aiBoardClose')?.addEventListener('click', close);
  UI.el('aiBoardClose2')?.addEventListener('click', close);
  UI.el('aiBoardCancelBtn')?.addEventListener('click', close);
  UI.el('aiGenerateBtn')?.addEventListener('click', generate);
  UI.el('aiApproveBtn')?.addEventListener('click', approve);
  UI.el('aiRegenerateBtn')?.addEventListener('click', function() {
    pendingBoard = null;
    showStep(1);
    if (promptInput) promptInput.focus();
  });
  overlay?.addEventListener('click', function(e) {
    if (e.target === overlay) close();
  });
  promptInput?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate();
    if (e.key === 'Escape') close();
  });

  return { open, close };
})();

/* ═══════════════════════════════════════════════════════════
   SMS REMINDERS
   API key stored in Supabase Edge Function secrets only.
   ═══════════════════════════════════════════════════════════ */

const SMS = (() => {
  function normalizeUS(raw) {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits[0] === '1') return '+' + digits;
    if (raw.startsWith('+') && digits.length === 11) return '+' + digits;
    return null;
  }

  async function send(to, text) {
    if (!to || !text) return { ok: false, reason: 'missing_args' };
    const normalized = normalizeUS(to);
    if (!normalized) {
      console.warn('SMS: could not normalize "' + to + '" \u2014 skipping');
      return { ok: false, reason: 'bad_number' };
    }
    let session;
    try { const result = await sb.auth.getSession(); session = result.data && result.data.session; } catch (_) {}
    if (!session) {
      console.warn('SMS: no active session \u2014 skipping');
      return { ok: false, reason: 'no_session' };
    }
    try {
      const resp = await fetch(SUPABASE_URL + '/functions/v1/dynamic-responder', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + session.access_token,
          'apikey':        SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ to: normalized, text: text }),
      });
      const payload = await resp.json().catch(function() { return {}; });
      if (!resp.ok) {
        console.warn('SMS Edge Function error:', resp.status, payload);
        return { ok: false, reason: 'edge_error', status: resp.status };
      }
      console.log('SMS sent OK \u2192', normalized);
      return payload;
    } catch (err) {
      console.warn('SMS send skipped (network/CORS):', err.message);
      return { ok: false, reason: 'network_error' };
    }
  }

  async function dispatchCardReminders(card) {
    // Only send reminders if the phone number has been verified
    const profile = AppState.getState().profile;
    if (!profile || !profile.phone_verified) return;
    const phone = card.phone ? card.phone.trim() : '';
    if (!phone) return;
    const now = Date.now();
    if (card.dueDate) {
      const timeStr   = card.dueTime || '09:00';
      const deadline  = new Date(card.dueDate + 'T' + timeStr).getTime();
      const triggerAt = deadline - 60 * 60 * 1000;
      if (triggerAt > now) {
        const delay = triggerAt - now;
        const msg   = 'TaskDeck: "' + card.title + '" is due at ' + formatTime12(timeStr) + ' on ' + card.dueDate + '.';
        console.log('SMS scheduled in ' + Math.round(delay / 60000) + ' min \u2192 "' + card.title + '"');
        setTimeout(function() { send(phone, msg).catch(console.error); }, delay);
      }
    }
    (card.reminders || []).forEach(function(r) {
      if (!r.date) return;
      const t = new Date(r.date + 'T' + (r.time || '09:00')).getTime();
      if (t > now) {
        const delay = t - now;
        const msg   = 'TaskDeck reminder: "' + card.title + '"' + (card.dueDate ? ' (due ' + card.dueDate + ')' : '') + '.';
        setTimeout(function() { send(phone, msg).catch(console.error); }, delay);
      }
    });
  }

  function formatTime12(val) {
    if (!val) return '';
    const parts = val.split(':').map(Number);
    const h = parts[0], m = parts[1];
    const ampm = h < 12 ? 'AM' : 'PM';
    const hh   = h % 12 === 0 ? 12 : h % 12;
    return hh + ':' + (m < 10 ? '0' + m : '' + m) + ' ' + ampm;
  }

  return { send, normalizeUS, dispatchCardReminders, formatTime12 };
})();

/* ═══════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════ */

let isAppInitialized = false;

document.addEventListener('DOMContentLoaded', async function() {
  Theme.init();
  initAuthUI();
  UI.showLoading();
  UI.setLoading('Starting TaskDeck\u2026', 10);

  document.getElementById('logoHomeBtn')?.addEventListener('click', function(e) {
    e.preventDefault();
    AppState.setState(function(s) { return Object.assign({}, s, { view: 'dashboard', tab: 'boards' }); });
    document.querySelectorAll('.header-tab').forEach(function(t) {
      t.classList.toggle('active', t.dataset.tab === 'boards');
    });
    const titleEl = UI.el('dashboardTitle');
    if (titleEl) titleEl.textContent = 'My Boards';
    UI.showDashboard();
    Dashboard.render();
  });

  await Auth.init(
    async function(user) {
      if (isAppInitialized) return;
      isAppInitialized = true;
      UI.hideAuth();

      async function withRetry(label, pct, fn, retries) {
        retries = retries || 3;
        for (let i = 0; i < retries; i++) {
          try {
            UI.setLoading(label, pct);
            return await fn();
          } catch (err) {
            if (i === retries - 1) throw err;
            UI.setLoading(label + ' (retrying\u2026)', pct);
            await new Promise(function(r) { setTimeout(r, 1000 * (i + 1)); });
          }
        }
      }

      try {
        await withRetry('Syncing profile\u2026', 40, function() {
          const meta        = user.user_metadata || {};
          const displayName = meta.display_name || meta.full_name || meta.name || '';
          return Storage.upsertProfile(user.id, {
            display_name: displayName || undefined,
            email:        user.email,
          });
        });

        const profileRow = await withRetry('Loading profile\u2026', 55, function() {
          return Storage.getProfile(user.id);
        });
        const profile = profileRow
          ? Object.assign({}, profileRow, { email: user.email })
          : { id: user.id, email: user.email, display_name: '' };

        const boards = await withRetry('Syncing boards\u2026', 75, function() {
          return Storage.getBoards(user.id);
        });

        if (boards.length === 0) {
          try {
            UI.setLoading('Creating your first board\u2026', 82);
            const defaultBoard = await Storage.createBoard(user.id, 'My First Board', '#C97D4E');
            await Storage.seedBoard(defaultBoard.id);
            boards.push(Object.assign({}, defaultBoard, { is_pinned: false }));
          } catch (e) { console.warn('Could not create default board:', e); }
        }

        let sharedBoards = [];
        try { sharedBoards = await Storage.getSharedBoards(); } catch (_) {}

        AppState.setState(function() {
          return {
            view:         'dashboard',
            tab:          'boards',
            profile:      profile,
            boards:       boards,
            sharedBoards: sharedBoards,
            groups:       [],
            boardId:      null,
            boardTitle:   '',
            boardColor:   '#C97D4E',
            lists:        [],
            searchQuery:  '',
            sortOrder:    'recent',
          };
        }, true);

        UI.setProfile(profile);
        UI.setLoading('Ready!', 100);
        UI.hideLoading();
        UI.showApp();
        UI.showDashboard();
        Dashboard.render();

      } catch (err) {
        console.error('Boot error:', err);
        isAppInitialized = false;
        UI.setLoading('Could not load your data.', 100);
        const loadingInner = document.querySelector('.loading-inner');
        if (loadingInner) {
          const retryBtn = document.createElement('button');
          retryBtn.textContent   = 'Retry';
          retryBtn.className     = 'btn-primary';
          retryBtn.style.cssText = 'margin-top:16px;';
          retryBtn.onclick = function() { window.location.reload(); };
          const existing = loadingInner.querySelector('.btn-primary');
          if (existing) existing.remove();
          loadingInner.appendChild(retryBtn);
        }
      }
    },
    function() {
      isAppInitialized = false;
      AppState.setState(function() {
        return {
          view:        'dashboard',
          tab:         'boards',
          profile:     null,
          boards:      [],
          groups:      [],
          boardId:     null,
          searchQuery: '',
          sortOrder:   'recent',
          boardTitle:  '',
          boardColor:  '#C97D4E',
          lists:       [],
        };
      }, true);
      UI.hideLoading();
      UI.hideApp();
      UI.showAuth();
    }
  );
});