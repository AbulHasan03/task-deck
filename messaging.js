/**
 * TaskDeck — Messaging Module
 * ──────────────────────────────────────────────────────────────
 * Handles all in-app group messaging (DMs/group chat via friend
 * codes or email).  SMS phone-reminder logic lives separately in
 * app.js → SMS module and the Supabase Edge Function `send-sms`.
 *
 * Exports: MessagingModule  (consumed by app.js)
 */

export function createMessagingModule(sb, AppState, Auth, Render, UI) {

  /* ── Storage helpers (messaging-specific) ── */
  const Storage = {
    async getUserGroups() {
      const { data, error } = await sb.rpc('get_user_groups');
      if (error) throw error;
      return data ?? [];
    },

    async createGroup(name, description = null) {
      const { data, error } = await sb.rpc('create_group', {
        p_name: name,
        p_description: description,
      });
      if (error) throw error;
      return data;
    },

    async getGroupMembers(groupId) {
      const { data, error } = await sb.rpc('get_group_members', { p_group_id: groupId });
      if (error) throw error;
      return data ?? [];
    },

    /**
     * Add a member by email OR by friend code (UUID).
     * The RPC on the server looks up profiles.id when input looks like a UUID,
     * otherwise falls back to profiles.email.
     */
    async addGroupMember(groupId, emailOrCode) {
      const { data, error } = await sb.rpc('add_group_member_flex', {
        p_group_id: groupId,
        p_identifier: emailOrCode.trim(),
      });
      if (error) throw error;
      return data;
    },

    async getGroupMessages(groupId, limit = 50) {
      const { data, error } = await sb.rpc('get_group_messages', {
        p_group_id: groupId,
        p_limit: limit,
      });
      if (error) throw error;
      return data ?? [];
    },

    async sendMessage(groupId, content) {
      const { data, error } = await sb.rpc('send_message', {
        p_group_id: groupId,
        p_content: content,
      });
      if (error) throw error;
      return data;
    },

    subscribeToMessages(groupId, callback) {
      return sb
        .channel(`messages:${groupId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        }, payload => callback(payload.new))
        .subscribe();
    },
  };

  /* ── MessagesView ── */
  const MessagesView = (() => {
    let activeGroupId = null;
    let subscription  = null;

    function init() {
      const sendBtn = UI.el('sendMessageBtn');
      const input   = UI.el('messageInput');

      if (sendBtn) {
        sendBtn.onclick = async () => {
          const content = input?.value.trim();
          if (!content || !activeGroupId) return;
          input.value = '';
          try { await Storage.sendMessage(activeGroupId, content); }
          catch (err) { console.error('Send message error:', err); }
        };
      }

      input?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn?.click(); }
      });

      UI.el('createGroupFromMessagesBtn')?.addEventListener('click', () => {
        UI.el('createGroupOverlay')?.classList.add('open');
      });
    }

    async function selectGroup(groupId, groupName) {
      activeGroupId = groupId;
      UI.el('messagesGroupTitle').textContent = groupName;
      UI.el('messagesInputArea').style.display = 'flex';

      UI.el('messagesFeed').innerHTML = '<p class="loading-text">Loading messages…</p>';
      const msgs = await Storage.getGroupMessages(groupId);
      renderMessages(msgs.reverse());

      if (subscription) subscription.unsubscribe();
      subscription = Storage.subscribeToMessages(groupId, async () => {
        const updated = await Storage.getGroupMessages(groupId);
        renderMessages(updated.reverse());
      });
    }

    function renderMessages(msgs) {
      const feed = UI.el('messagesFeed');
      const { profile } = AppState.getState();
      const myId = profile?.id || Auth.getUserId();
      feed.innerHTML = msgs.map(m => {
        const isMe    = m.sender_id === myId;
        const initial = (m.sender_name || '?').charAt(0).toUpperCase();
        return `
          <div class="message ${isMe ? 'message-mine' : ''}">
            ${!isMe ? `<div class="message-avatar" title="${Render.esc(m.sender_name || '')}">${Render.esc(initial)}</div>` : ''}
            <div class="message-bubble-wrap">
              ${!isMe ? `<div class="message-meta">${Render.esc(m.sender_name || 'Unknown')}</div>` : ''}
              <div class="message-bubble">${Render.esc(m.content)}</div>
              <div class="message-time">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            ${isMe ? `<div class="message-avatar message-avatar-mine" title="You">${Render.esc(initial)}</div>` : ''}
          </div>`;
      }).join('');
      feed.scrollTop = feed.scrollHeight;
    }

    function render() {
      const { groups } = AppState.getState();
      const list = UI.el('messageGroupsList');
      if (!list) return;
      list.innerHTML = (groups || []).map(g => `
        <button class="message-group-btn ${activeGroupId === g.id ? 'active' : ''}" data-id="${g.id}" data-name="${Render.esc(g.name)}">
          <span class="msg-group-initial">${Render.esc((g.name || '?').charAt(0).toUpperCase())}</span>
          <span class="msg-group-name">${Render.esc(g.name)}</span>
        </button>`).join('');
      list.querySelectorAll('.message-group-btn').forEach(btn => {
        btn.onclick = () => selectGroup(btn.dataset.id, btn.dataset.name);
      });
    }

    return { init, render };
  })();

  /* ── GroupsView ── */
  const GroupsView = (() => {
    function render() {
      const { groups } = AppState.getState();
      const list = UI.el('groupsList');
      if (!list) return;

      if (!groups || groups.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-text">No groups yet.<br>Create one to collaborate with others.</div></div>`;
        return;
      }

      list.innerHTML = groups.map(g => `
        <div class="group-item" data-group-id="${g.id}">
          <div class="group-item-header">
            <div>
              <div class="share-item-email" style="font-weight:600;">${Render.esc(g.name)}</div>
              <div class="share-item-perm">${g.description ? Render.esc(g.description) + ' · ' : ''}${g.role}</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn-ghost" style="font-size:12px;" data-group-add-member="${g.id}" data-group-name="${Render.esc(g.name)}">+ Member</button>
              <button class="btn-ghost" style="font-size:12px;" data-group-show-members="${g.id}">Members ▾</button>
            </div>
          </div>
          <div class="group-members-list" id="members-${g.id}" style="display:none;margin-top:8px;padding:8px;background:var(--canvas);border-radius:var(--radius-sm);"></div>
        </div>`).join('');

      list.querySelectorAll('[data-group-add-member]').forEach(btn =>
        btn.addEventListener('click', () => openAddMemberModal(btn.dataset.groupAddMember, btn.dataset.groupName))
      );
      list.querySelectorAll('[data-group-show-members]').forEach(btn =>
        btn.addEventListener('click', () => toggleMembers(btn.dataset.groupShowMembers, btn))
      );
    }

    async function toggleMembers(groupId, btn) {
      const panel = UI.el(`members-${groupId}`);
      if (!panel) return;
      const isOpen = panel.style.display !== 'none';
      if (isOpen) { panel.style.display = 'none'; btn.textContent = 'Members ▾'; return; }
      panel.style.display = 'block';
      btn.textContent = 'Members ▴';
      panel.innerHTML = '<div style="font-size:0.8rem;color:var(--ink-soft);">Loading…</div>';
      try {
        const members = await Storage.getGroupMembers(groupId);
        if (!members || members.length === 0) {
          panel.innerHTML = '<div style="font-size:0.8rem;color:var(--ink-soft);">No members yet.</div>';
          return;
        }
        panel.innerHTML = members.map(m => `
          <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--ink-faint);">
            <div style="width:26px;height:26px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:0.75rem;color:#fff;font-weight:600;">
              ${(m.display_name || m.email || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-size:0.83rem;font-weight:500;">${Render.esc(m.display_name || m.email || 'Unknown')}</div>
              <div style="font-size:0.73rem;color:var(--ink-soft);">${Render.esc(m.email || '')} · ${m.role}</div>
            </div>
          </div>`).join('');
      } catch (err) {
        panel.innerHTML = `<div style="font-size:0.8rem;color:var(--red);">Error: ${err.message}</div>`;
      }
    }

    /* Modal-based add member (replaces prompt()) */
    function openAddMemberModal(groupId, groupName) {
      const overlay = UI.el('addMemberOverlay');
      if (!overlay) return;
      UI.el('addMemberGroupName').textContent = groupName || '';
      overlay.dataset.groupId = groupId;
      UI.el('addMemberInput').value = '';
      UI.el('addMemberError').textContent = '';
      overlay.classList.add('open');
      UI.el('addMemberInput')?.focus();
    }

    // Wire "Add Member" confirm
    UI.el('confirmAddMemberBtn')?.addEventListener('click', async () => {
      const overlay    = UI.el('addMemberOverlay');
      const groupId    = overlay?.dataset.groupId;
      const identifier = UI.el('addMemberInput')?.value.trim();
      if (!identifier) { UI.el('addMemberInput')?.focus(); return; }
      const btn = UI.el('confirmAddMemberBtn');
      btn.textContent = '…';
      try {
        await Storage.addGroupMember(groupId, identifier);
        overlay?.classList.remove('open');
        btn.textContent = 'Add';
        // Refresh members panel if open
        const panel = UI.el(`members-${groupId}`);
        const toggle = document.querySelector(`[data-group-show-members="${groupId}"]`);
        if (panel && panel.style.display !== 'none' && toggle) {
          await toggleMembers(groupId, toggle);
        }
      } catch (err) {
        UI.el('addMemberError').textContent = err.message || 'Could not add member.';
        btn.textContent = 'Add';
      }
    });
    UI.el('addMemberOverlay')?.addEventListener('click', e => {
      if (e.target === UI.el('addMemberOverlay')) UI.el('addMemberOverlay')?.classList.remove('open');
    });
    UI.el('cancelAddMemberBtn')?.addEventListener('click',  () => UI.el('addMemberOverlay')?.classList.remove('open'));
    UI.el('cancelAddMemberBtn2')?.addEventListener('click', () => UI.el('addMemberOverlay')?.classList.remove('open'));

    // Wire Create Group buttons
    UI.el('createGroupBtn')?.addEventListener('click', () => {
      UI.el('groupsOverlay')?.classList.remove('open');
      UI.el('createGroupOverlay')?.classList.add('open');
    });

    UI.el('confirmCreateGroupBtn')?.addEventListener('click', async () => {
      const name = UI.el('groupName')?.value.trim();
      const desc = UI.el('groupDescription')?.value.trim() || null;
      if (!name) { UI.el('groupName')?.focus(); return; }
      const btn = UI.el('confirmCreateGroupBtn');
      btn.textContent = '…';
      try {
        await Storage.createGroup(name, desc);
        const groups = await Storage.getUserGroups();
        AppState.setState(s => ({ ...s, groups }));
        UI.el('createGroupOverlay')?.classList.remove('open');
        UI.el('groupsOverlay')?.classList.add('open');
        UI.el('groupName').value = '';
        if (UI.el('groupDescription')) UI.el('groupDescription').value = '';
        btn.textContent = 'Create';
        render();
      } catch (err) {
        console.error(err);
        btn.textContent = 'Error';
        setTimeout(() => { btn.textContent = 'Create'; }, 1800);
      }
    });

    UI.el('groupsClose')?.addEventListener('click',        () => UI.el('groupsOverlay')?.classList.remove('open'));
    UI.el('createGroupClose')?.addEventListener('click',   () => UI.el('createGroupOverlay')?.classList.remove('open'));
    UI.el('createGroupCancelBtn')?.addEventListener('click',() => UI.el('createGroupOverlay')?.classList.remove('open'));
    UI.el('groupsOverlay')?.addEventListener('click', e => {
      if (e.target === UI.el('groupsOverlay')) UI.el('groupsOverlay').classList.remove('open');
    });
    UI.el('createGroupOverlay')?.addEventListener('click', e => {
      if (e.target === UI.el('createGroupOverlay')) UI.el('createGroupOverlay').classList.remove('open');
    });

    return { render, openAddMemberModal };
  })();

  /* ── Forum (public posts) ── */
  const Forum = (() => {
    let page = 0;
    const PAGE_SIZE = 20;

    async function loadPosts(reset = false) {
      if (reset) page = 0;
      const feed = UI.el('forumFeed');
      if (!feed) return;
      if (reset) feed.innerHTML = '<p class="loading-text">Loading…</p>';

      const { data, error } = await sb
        .from('forum_posts')
        .select('id, content, created_at, user_id, profiles!user_id(display_name, avatar_color)')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) { feed.innerHTML = `<p class="loading-text" style="color:var(--red);">Error loading posts.</p>`; return; }

      if (reset) feed.innerHTML = '';
      if (!data || data.length === 0) {
        if (reset) feed.innerHTML = '<p class="loading-text" style="opacity:.5;">No posts yet — be the first!</p>';
        return;
      }

      const { profile } = AppState.getState();
      const myId = profile?.id || Auth.getUserId();

      data.forEach(post => {
        const el = document.createElement('div');
        el.className = 'forum-post';
        const name    = post.profiles?.display_name || 'Anonymous';
        const initial = name.charAt(0).toUpperCase();
        const color   = post.profiles?.avatar_color || 'var(--accent)';
        const ts      = new Date(post.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        el.innerHTML = `
          <div class="forum-post-avatar" style="background:${color};">${Render.esc(initial)}</div>
          <div class="forum-post-body">
            <div class="forum-post-meta"><span class="forum-post-name">${Render.esc(name)}</span><span class="forum-post-time">${ts}</span></div>
            <div class="forum-post-content">${Render.esc(post.content)}</div>
          </div>`;
        feed.appendChild(el);
      });

      page++;
      const loadMore = UI.el('forumLoadMore');
      if (loadMore) loadMore.style.display = data.length < PAGE_SIZE ? 'none' : '';
    }

    async function submitPost() {
      const input = UI.el('forumInput');
      const content = input?.value.trim();
      if (!content) { input?.focus(); return; }
      const btn = UI.el('forumSubmitBtn');
      btn.textContent = '…';
      btn.disabled = true;
      const { profile } = AppState.getState();
      const userId = profile?.id || Auth.getUserId();
      const { error } = await sb.from('forum_posts').insert({ content, user_id: userId });
      btn.textContent = 'Post';
      btn.disabled = false;
      if (error) { console.error('Forum post error:', error); return; }
      input.value = '';
      loadPosts(true);
    }

    function init() {
      UI.el('forumSubmitBtn')?.addEventListener('click', submitPost);
      UI.el('forumInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitPost();
      });
      UI.el('forumLoadMore')?.addEventListener('click', () => loadPosts(false));

      // Real-time subscription for new forum posts
      sb.channel('forum_posts_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_posts' }, () => {
          // Only auto-refresh if forum is visible
          if (UI.el('forumView')?.style.display !== 'none') loadPosts(true);
        })
        .subscribe();
    }

    return { init, loadPosts };
  })();

  return { MessagesView, GroupsView, Forum, Storage };
}