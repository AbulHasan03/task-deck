/**
 * TaskDeck — Board Sharing Module
 * ─────────────────────────────────────────────────────────────
 * Handles sharing boards with other users by email or friend
 * code (their profile UUID, shown in the profile dropdown).
 *
 * SQL required (run once in Supabase SQL editor):
 *
 *   CREATE OR REPLACE FUNCTION public.share_board_flex(
 *     p_board_id   uuid,
 *     p_identifier text,          -- email OR full UUID friend-code
 *     p_permission text DEFAULT 'view'
 *   ) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
 *   DECLARE v_target uuid;
 *   BEGIN
 *     -- Try to match as UUID (friend code) first, then fall back to email
 *     BEGIN
 *       v_target := p_identifier::uuid;
 *       SELECT id INTO v_target FROM public.profiles WHERE id = v_target LIMIT 1;
 *     EXCEPTION WHEN invalid_text_representation THEN
 *       SELECT id INTO v_target FROM public.profiles WHERE email = lower(trim(p_identifier)) LIMIT 1;
 *     END;
 *     IF v_target IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
 *     IF v_target = auth.uid() THEN RAISE EXCEPTION 'Cannot share with yourself'; END IF;
 *     INSERT INTO public.board_shares (board_id, shared_with, permission_level)
 *     VALUES (p_board_id, v_target, p_permission)
 *     ON CONFLICT (board_id, shared_with) DO UPDATE SET permission_level = EXCLUDED.permission_level;
 *   END; $$;
 *
 * Exports: createSharingModule(sb, AppState, Render, UI)
 */

window.createSharingModule = function(sb, AppState, Render, UI) {

  /* ── Storage helpers (sharing-specific) ── */
  const Storage = {
    /** Share by email OR friend code UUID */
    async shareBoard(boardId, identifier, permission = 'view') {
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
  };

  /* ── BoardSharing Modal ── */
  const BoardSharing = (() => {
    const overlay    = UI.el('shareBoardOverlay');
    const identInput = UI.el('shareIdentifier');  // unified input: email or friend code
    const permIn     = UI.el('sharePermission');
    const shareList  = UI.el('shareList');
    const errorEl    = UI.el('shareBoardError');
    let activeBoardId = null;

    function setError(msg) {
      if (!errorEl) return;
      errorEl.textContent = msg;
      errorEl.style.display = msg ? '' : 'none';
    }

    async function open(boardId) {
      activeBoardId = boardId;
      setError('');
      if (identInput) identInput.value = '';
      overlay?.classList.add('open');
      identInput?.focus();
      await loadShares();
    }

    async function loadShares() {
      if (!shareList) return;
      shareList.innerHTML = '<div style="font-size:0.82rem;color:var(--ink-soft);padding:8px 0;">Loading…</div>';
      try {
        const shares = await Storage.getBoardShares(activeBoardId);
        if (!shares || shares.length === 0) {
          shareList.innerHTML = `<div style="font-size:0.82rem;color:var(--ink-soft);padding:8px 0;">Not shared with anyone yet.</div>`;
          return;
        }
        shareList.innerHTML = shares.map(s => `
          <div class="share-item">
            <div>
              <div class="share-item-email">${Render.esc(s.display_name || s.email || 'Unknown')}</div>
              <div class="share-item-perm">${Render.esc(s.email || '')} · ${s.permission_level}</div>
            </div>
            <button class="share-item-remove" data-share-id="${s.id}" title="Remove access">✕</button>
          </div>`).join('');
        shareList.querySelectorAll('[data-share-id]').forEach(btn => {
          btn.onclick = async () => {
            btn.textContent = '…';
            await Storage.removeShare(btn.dataset.shareId);
            await loadShares();
          };
        });
      } catch (err) {
        shareList.innerHTML = `<div style="font-size:0.82rem;color:var(--red);padding:8px 0;">${Render.esc(err.message)}</div>`;
      }
    }

    UI.el('shareBoardBtn')?.addEventListener('click', async () => {
      const identifier = identInput?.value.trim();
      if (!identifier) { identInput?.focus(); return; }
      setError('');
      const btn = UI.el('shareBoardBtn');
      btn.textContent = '…';
      btn.disabled = true;
      try {
        await Storage.shareBoard(activeBoardId, identifier, permIn?.value || 'view');
        if (identInput) identInput.value = '';
        await loadShares();
        btn.textContent = 'Share';
      } catch (err) {
        setError(err.message || 'Could not share. Make sure the email or friend code is correct.');
        btn.textContent = 'Share';
      }
      btn.disabled = false;
    });

    UI.el('shareBoardClose')?.addEventListener('click', () => overlay?.classList.remove('open'));
    overlay?.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
    identInput?.addEventListener('keydown', e => { if (e.key === 'Enter') UI.el('shareBoardBtn')?.click(); });

    return { open };
  })();

  return { BoardSharing, Storage };
}