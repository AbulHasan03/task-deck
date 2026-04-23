-- ============================================================
--  TASKDECK — Migration v3
--  Adds Sharing, Groups & Messaging features
--  Run AFTER migration v2.
--  All statements are guarded — safe to re-run.
-- ============================================================

-- ── 1. BOARD SHARING TABLE ──────────────────────────────────
create table if not exists public.board_shares (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete cascade,
  shared_with uuid not null references auth.users(id) on delete cascade,
  permission_level text not null default 'view' check (permission_level in ('view', 'edit', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(board_id, shared_with)
);

-- ── 2. GROUPS TABLE ──────────────────────────────────────────
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ── 3. GROUP MEMBERS TABLE ──────────────────────────────────
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(group_id, user_id)
);

-- ── 4. MESSAGES TABLE (site-only, stored in DB) ─────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ── 5. INDEXES FOR PERFORMANCE ──────────────────────────────
create index if not exists idx_board_shares_board_id on public.board_shares(board_id);
create index if not exists idx_board_shares_shared_with on public.board_shares(shared_with);
create index if not exists idx_group_members_group_id on public.group_members(group_id);
create index if not exists idx_group_members_user_id on public.group_members(user_id);
create index if not exists idx_messages_group_id on public.messages(group_id);
create index if not exists idx_messages_created_at on public.messages(created_at);

-- ── 6. RLS POLICIES ─────────────────────────────────────────

-- Board shares
alter table public.board_shares enable row level security;

create policy if not exists "Users can view shares of their boards"
  on public.board_shares for select using (
    auth.uid() = shared_by or auth.uid() = shared_with
  );

create policy if not exists "Users can share their boards"
  on public.board_shares for insert with check (
    auth.uid() = shared_by and
    exists(select 1 from public.boards where id = board_id and user_id = auth.uid())
  );

create policy if not exists "Users can remove shares of their boards"
  on public.board_shares for delete using (
    auth.uid() = shared_by
  );

-- Groups
alter table public.groups enable row level security;

create policy if not exists "Users can view their groups"
  on public.groups for select using (
    auth.uid() = owner_id or
    exists(select 1 from public.group_members where group_id = id and user_id = auth.uid())
  );

create policy if not exists "Users can create groups"
  on public.groups for insert with check (
    auth.uid() = owner_id
  );

create policy if not exists "Owners can update their groups"
  on public.groups for update using (
    auth.uid() = owner_id
  );

-- Group members
alter table public.group_members enable row level security;

create policy if not exists "Users can view group members"
  on public.group_members for select using (
    exists(select 1 from public.group_members gm where gm.group_id = group_id and gm.user_id = auth.uid())
  );

create policy if not exists "Owners can add members"
  on public.group_members for insert with check (
    exists(select 1 from public.groups where id = group_id and owner_id = auth.uid())
  );

-- Messages
alter table public.messages enable row level security;

create policy if not exists "Group members can view messages"
  on public.messages for select using (
    exists(select 1 from public.group_members where group_id = group_id and user_id = auth.uid())
  );

create policy if not exists "Group members can send messages"
  on public.messages for insert with check (
    exists(select 1 from public.group_members where group_id = group_id and user_id = auth.uid())
    and auth.uid() = sender_id
  );

-- ── 7. RPC FUNCTIONS ────────────────────────────────────────

-- Share board with user
create or replace function public.share_board(
  p_board_id uuid,
  p_user_email text,
  p_permission text default 'view'
)
returns jsonb language plpgsql security definer as $$
declare
  v_target_user_id uuid;
  v_result jsonb;
begin
  -- Find user by email
  select id into v_target_user_id
  from auth.users
  where email = p_user_email;

  if v_target_user_id is null then
    return jsonb_build_object('error', 'User not found');
  end if;

  -- Check board ownership
  if not exists(select 1 from public.boards where id = p_board_id and user_id = auth.uid()) then
    return jsonb_build_object('error', 'Not authorized to share this board');
  end if;

  -- Insert share
  insert into public.board_shares (board_id, shared_by, shared_with, permission_level)
  values (p_board_id, auth.uid(), v_target_user_id, p_permission)
  on conflict(board_id, shared_with) do update
  set permission_level = p_permission;

  return jsonb_build_object('success', true, 'shared_with', v_target_user_id);
end; $$;

grant execute on function public.share_board(uuid, text, text) to authenticated;

-- Get shared boards
create or replace function public.get_shared_boards()
returns table (
  id uuid,
  title text,
  color text,
  owner_id uuid,
  permission_level text,
  created_at timestamp with time zone
) language plpgsql security definer as $$
begin
  return query
  select b.id, b.title, b.color, b.user_id, bs.permission_level, b.created_at
  from public.boards b
  join public.board_shares bs on bs.board_id = b.id
  where bs.shared_with = auth.uid()
  order by b.updated_at desc;
end; $$;

grant execute on function public.get_shared_boards() to authenticated;

-- Create group
create or replace function public.create_group(p_name text, p_description text default null)
returns jsonb language plpgsql security definer as $$
declare
  v_group_id uuid;
begin
  insert into public.groups (name, description, owner_id)
  values (p_name, p_description, auth.uid())
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, auth.uid(), 'owner');

  return jsonb_build_object('success', true, 'group_id', v_group_id);
end; $$;

grant execute on function public.create_group(text, text) to authenticated;

-- Add member to group
create or replace function public.add_group_member(p_group_id uuid, p_user_email text)
returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = p_user_email;

  if v_user_id is null then
    return jsonb_build_object('error', 'User not found');
  end if;

  if not exists(select 1 from public.groups where id = p_group_id and owner_id = auth.uid()) then
    return jsonb_build_object('error', 'Not authorized');
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (p_group_id, v_user_id, 'member')
  on conflict(group_id, user_id) do nothing;

  return jsonb_build_object('success', true);
end; $$;

grant execute on function public.add_group_member(uuid, text) to authenticated;

-- Get groups for user
create or replace function public.get_user_groups()
returns table (
  id uuid,
  name text,
  description text,
  owner_id uuid,
  member_count bigint,
  role text
) language plpgsql security definer as $$
begin
  return query
  select g.id, g.name, g.description, g.owner_id,
    (select count(*) from public.group_members where group_id = g.id),
    gm.role
  from public.groups g
  join public.group_members gm on gm.group_id = g.id
  where gm.user_id = auth.uid()
  order by g.updated_at desc;
end; $$;

grant execute on function public.get_user_groups() to authenticated;

-- Get messages for group
create or replace function public.get_group_messages(p_group_id uuid, p_limit int default 50)
returns table (
  id uuid,
  sender_id uuid,
  sender_email text,
  sender_name text,
  content text,
  created_at timestamp with time zone
) language plpgsql security definer as $$
begin
  return query
  select m.id, m.sender_id, u.email, 
    (p.display_name || ' (' || u.email || ')')::text as sender_name,
    m.content, m.created_at
  from public.messages m
  join auth.users u on u.id = m.sender_id
  left join public.profiles p on p.id = m.sender_id
  where m.group_id = p_group_id
    and exists(select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid())
  order by m.created_at desc
  limit p_limit;
end; $$;

grant execute on function public.get_group_messages(uuid, int) to authenticated;

-- Send message
create or replace function public.send_message(p_group_id uuid, p_content text)
returns jsonb language plpgsql security definer as $$
declare
  v_message_id uuid;
begin
  if not exists(select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid()) then
    return jsonb_build_object('error', 'Not a member of this group');
  end if;

  insert into public.messages (group_id, sender_id, content)
  values (p_group_id, auth.uid(), p_content)
  returning id into v_message_id;

  return jsonb_build_object('success', true, 'message_id', v_message_id);
end; $$;

grant execute on function public.send_message(uuid, text) to authenticated;

-- ── 8. VERIFY ───────────────────────────────────────────────
select tablename from pg.tables
where schemaname = 'public'
  and tablename in ('board_shares', 'groups', 'group_members', 'messages')
order by tablename;
