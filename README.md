# TaskDeck

A visual kanban board application built with vanilla JavaScript and Supabase. No build step required — deploy as static files.

---

## ✅ What Works

### Authentication
- Email/password sign-in and sign-up
- Google OAuth sign-in
- Auto-profile creation on first sign-up (via database trigger)
- Persistent sessions — page reloads keep you logged in
- Sign out

### Boards
- Create boards with a custom name and color
- New users automatically get a "My First Board" with default lists
- Pin boards to keep them at the top of the dashboard
- Edit board name and color from inside the board (Settings button)
- Delete boards
- Boards sort by most recent, oldest, alphabetical, or reverse alphabetical
- Search/filter boards by name
- Share a board directly from the board view (Share button in header) or from the dashboard card (hover to reveal)

### Lists
- Add lists to any board
- Rename lists inline (click the title)
- Delete lists (via the ⋮ menu on each list)
- Clear all cards from a list

### Cards
- Add cards to any list
- Drag and drop cards between lists and within a list (mouse and touch)
- Edit card details in a modal: title, description, due date, due time, priority (Low / Medium / High)
- Priority color-coded: green (low), amber (medium), red (high)
- Overdue badge shown on cards past their due date
- Delete cards

### Sharing
- Share a board with any registered TaskDeck user by email
- Set permission level: View only, Edit, or Admin
- View who a board is shared with (names + emails)
- Remove a share
- "Shared with me" tab shows boards others have shared with you

### Groups
- Create groups with a name and optional description
- Add members to a group by email
- View the members list of any group (toggle open)
- Groups are used to scope group messaging

### Messaging
- Group-based messaging (select a group in the sidebar to open a chat)
- Messages appear as chat bubbles — your messages on the right, others on the left
- Real-time updates via Supabase Realtime — new messages appear without refreshing
- Press Enter to send, Shift+Enter for a new line

### Profile
- Set or update your display name
- View your email
- Your unique TaskDeck ID with a one-click Copy button — share this with others so they can add you to groups
- Avatar color shown in the header and profile panel

### Theme
- Light, Dark, or System (follows your OS preference)
- Preference persisted across sessions

### SMS Reminders *(requires Edge Function setup)*
- Add a phone number to your profile
- Enable SMS reminders per-card when saving
- Reminders fire 1 hour before the card's due date/time
- Custom per-card reminder dates can also be added

---

## ⚠️ Known Limitations / Not Yet Implemented

- **SMS**: Requires a working Supabase Edge Function (`send-sms`) with a RapidAPI key configured as a secret. CORS errors will appear in the console if the function isn't deployed — this does not affect any other feature.
- **Group messaging**: You must be a member of a group to send or read messages. Groups must be created first before messaging is available.
- **Board sharing**: The person you share with must already have a TaskDeck account. Sharing with an unregistered email will show an error.
- **No file attachments** on cards.
- **No card assignments** — cards can't be assigned to a specific user.
- **No notifications** outside of SMS reminders.
- **No board templates** beyond the default three-list seed.

---

## Setup

### Requirements
- A [Supabase](https://supabase.com) project
- Static file hosting (GitHub Pages, Netlify, Vercel, etc.)

### Steps

1. **Run the schema** — paste the contents of `schema.sql` into the Supabase SQL editor and execute it.

2. **Run the RPC additions** — paste and run the following in the SQL editor:

```sql
-- Required for group member display
CREATE OR REPLACE FUNCTION public.get_group_members(p_group_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result json;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'Not a member of this group'; END IF;
  SELECT json_agg(json_build_object('user_id', gm.user_id, 'role', gm.role,
    'display_name', COALESCE(p.display_name, ''), 'email', COALESCE(p.email, ''))
    ORDER BY gm.joined_at ASC)
  INTO v_result FROM public.group_members gm
  LEFT JOIN public.profiles p ON p.id = gm.user_id
  WHERE gm.group_id = p_group_id;
  RETURN COALESCE(v_result, '[]'::json);
END; $$;

-- Required for board share display
CREATE OR REPLACE FUNCTION public.get_board_shares(p_board_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result json;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.boards WHERE id = p_board_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'You do not own this board'; END IF;
  SELECT json_agg(json_build_object('id', bs.id, 'shared_with', bs.shared_with,
    'permission_level', bs.permission_level,
    'display_name', COALESCE(p.display_name, ''), 'email', COALESCE(p.email, '')))
  INTO v_result FROM public.board_shares bs
  LEFT JOIN public.profiles p ON p.id = bs.shared_with
  WHERE bs.board_id = p_board_id;
  RETURN COALESCE(v_result, '[]'::json);
END; $$;
```

3. **Configure credentials** — open `app.js` and replace the two constants at the top:

```js
const SUPABASE_URL      = 'your-project-url';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

4. **Enable Google OAuth** *(optional)* — in Supabase go to Authentication → Providers → Google and follow the setup. Add your site URL to the Redirect URLs list.

5. **Deploy** — upload `index.html`, `app.js`, and `style.css` to your static host. No build step needed.

### SMS Setup *(optional)*

1. Create a Supabase Edge Function named `send-sms`
2. Add your RapidAPI key as a secret: `RAPIDAPI_KEY`
3. In the Supabase dashboard go to Edge Functions → `send-sms` → add the CORS header for your domain

---

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES modules), no framework
- **Backend**: Supabase (PostgreSQL + RLS + Realtime + Edge Functions)
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **Hosting**: Any static file host