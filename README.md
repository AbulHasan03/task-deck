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
- Sort boards by most recent, oldest, alphabetical, or reverse alphabetical
- Search/filter boards by name
- Share a board from inside the board (Share button in header) or from the dashboard card

### Lists
- Add lists to any board
- Rename lists inline (click the title)
- Delete lists (via the ⋮ menu on each list)
- Clear all cards from a list

### Cards
- Add cards to any list
- Drag and drop cards between lists and within a list (mouse and touch supported)
- Edit card details in a modal: title, description, due date, due time, priority (Low / Medium / High)
- Priority color-coded: green (low), amber (medium), red (high)
- Overdue badge shown on cards past their due date
- Delete cards

### Board Sharing
- Share a board with any registered TaskDeck user by **email or friend code**
- Set permission level: View only, Edit, or Admin
- View-only users are blocked from editing at the database level (RLS enforced)
- View who a board is shared with (names + emails) and remove access
- **Shared tab** on the dashboard with two sub-filters:
  - **Shared with me** — boards others have shared with you
  - **Shared by me** — boards you own that you've shared with others

### Organization (Groups)
- Create organizations with a name and optional description
- Add members by **email or friend code**
- Full member list with roles (admin, member)
- Admins can remove members from an organization
- Any member can leave an organization
- Organizations are used to scope group messaging

### Messaging
- **Group chats** — create a named chatroom for an organization
- **Direct messages (DMs)** — message any user directly by email or friend code; each person sees the other's name as the chat title
- Messages appear as chat bubbles — your messages on the right, others on the left
- Messages appear **instantly** without waiting for a server round-trip (optimistic rendering)
- Real-time updates via Supabase Realtime — messages from others appear live
- Press Enter to send, Shift+Enter for a new line
- Add members or view members directly from the messaging screen
- Admins can rename a chat and edit its description

### Public Forum
- Community-wide public post feed visible to all signed-in users
- Post, edit, and delete your own posts
- Real-time feed — new posts appear without refreshing
- Load more pagination
- Hover any post author's name to see a **profile card** with their display name and friend code (no email or phone exposed)
- Copy friend code directly from the hover card

### AI Board Generator
- Click **AI Board** on the dashboard to open the generator
- Describe your project in plain language (e.g. "I have a machine learning final project due in 2 weeks")
- AI generates a board name, lists, and cards with priorities using Gemini
- **Preview step** — review everything before anything is created
- Uncheck individual cards or entire lists you don't need
- Click Create Board to build only what's checked, then opens the board automatically
- Powered by a Supabase Edge Function — your Gemini API key never leaves the server

### SMS Reminders *(requires Twilio setup — see below)*
- Add a phone number to your profile
- **Phone verification required** — a 6-digit code is texted to you before reminders activate
- Changing your number resets verification automatically
- Enable SMS reminders per-card when saving
- Reminders fire 1 hour before the card's due date/time
- Custom per-card reminder dates can also be set

### Profile
- Set or update your display name
- View your email
- **Friend code** — your unique UUID shown in the profile panel, one-click copy
  - Share this with others so they can add you to boards, organizations, or DMs without knowing your email
- Phone number management with verified/unverified badge
- Avatar color shown in the header and profile panel

### Theme
- Light, Dark, or System (follows your OS preference)
- Preference persisted across sessions

---

## ⚠️ Known Limitations

- **SMS**: Requires a Twilio account and a verified phone number. The free Twilio trial only sends to numbers verified in your Twilio console. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_MESSAGING_SID` as secrets in your `dynamic-responder` Edge Function.
- **AI Board Generator**: Requires a Gemini API key set as `GEMINI_API_KEY` in the `generate-board` Edge Function. Uses `gemini-2.5-flash`.
- **Board sharing**: The person you share with must already have a TaskDeck account.
- **DMs**: If a DM already exists between two users, opening a new DM with the same person reopens the existing conversation.
- **No file attachments** on cards.
- **No card assignments** — cards can't be assigned to a specific user yet.
- **No push notifications** — reminders are SMS only.

---

## Setup

### Requirements
- A [Supabase](https://supabase.com) project
- Static file hosting (GitHub Pages, Netlify, Vercel, etc.)

### Steps

1. **Run the schema** — paste `schema.sql` into the Supabase SQL editor and execute it.

2. **Run the additions** — paste `schema-additions.sql` into the SQL editor and execute it. This file is safe to re-run and covers all RPCs, RLS policies, and new tables added after the initial schema.

3. **Configure credentials** — open `app.js` and replace the two constants at the top:

```js
const SUPABASE_URL      = 'your-project-url';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

4. **Enable Google OAuth** *(optional)* — in Supabase go to Authentication → Providers → Google and follow the setup. Add your site URL to the Redirect URLs list.

5. **Deploy** — upload `index.html`, `app.js`, and `style.css` to your static host. No build step needed.

### Edge Functions

All Edge Functions live in the Supabase dashboard under **Edge Functions**. Create each function, paste in the code, add the required secrets, and turn **Verify JWT OFF** in each function's settings.

#### `dynamic-responder` — SMS Reminders (Twilio)

Secrets required:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SID`

Code:

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { to, text } = await req.json();

    if (!to || !text) {
      return new Response(JSON.stringify({ error: 'Missing to or text' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const ACCOUNT_SID     = Deno.env.get('TWILIO_ACCOUNT_SID');
    const AUTH_TOKEN      = Deno.env.get('TWILIO_AUTH_TOKEN');
    const MESSAGING_SID   = Deno.env.get('TWILIO_MESSAGING_SID');

    if (!ACCOUNT_SID || !AUTH_TOKEN || !MESSAGING_SID) {
      return new Response(JSON.stringify({ error: 'Twilio secrets not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Twilio expects form-encoded body, not JSON
    const body = new URLSearchParams({
      To:                  to,
      MessagingServiceSid: MESSAGING_SID,
      Body:                text,
    });

    // Basic auth: Account SID as username, Auth Token as password
    const credentials = btoa(ACCOUNT_SID + ':' + AUTH_TOKEN);

    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + credentials,
        },
        body: body.toString(),
      }
    );

    const payload = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error('Twilio error:', resp.status, JSON.stringify(payload));
      return new Response(JSON.stringify({ error: 'SMS failed', detail: payload }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    console.log('SMS sent OK to', to, '| SID:', payload.sid);
    return new Response(JSON.stringify({ ok: true, sid: payload.sid }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Edge function error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});


#### `generate-board` — AI Board Generator (Gemini)

Secrets required:
- `GEMINI_API_KEY` — get one at [aistudio.google.com](https://aistudio.google.com)

Code: 

/**
 * Supabase Edge Function: generate-board
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

const SYSTEM_PROMPT = `You are a kanban board planner for TaskDeck.
The user describes a project or goal. Respond with JSON only.

Rules:
- Maximum 4 lists.
- Maximum 5 cards per list.
- Card titles: 3 to 8 words, action verbs (e.g. "Set up GitHub repo", "Write landing page copy").
- Be minimal — starting-point tasks only, not an exhaustive plan.
- Assign priority honestly: high = urgent/blocking, medium = important soon, low = nice to have.`;

// Minimal schema — no nullable fields, no optional complexity.
// description is intentionally omitted; we set it to null server-side.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    board_title: {
      type: 'string',
    },
    lists: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          cards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title:    { type: 'string' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'] },
              },
              required: ['title', 'priority'],
            },
          },
        },
        required: ['title', 'cards'],
      },
    },
  },
  required: ['board_title', 'lists'],
};

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const prompt = (body.prompt || '').trim();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (prompt.length > 500) {
      return new Response(JSON.stringify({ error: 'Prompt too long (max 500 chars)' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const geminiPayload = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature:      0.5,
        maxOutputTokens:  2048,
        responseMimeType: 'application/json',
        responseSchema:   RESPONSE_SCHEMA,
      },
    };

    // Log payload for debugging (remove once stable)
    console.log('Sending to Gemini:', JSON.stringify(geminiPayload));

    const geminiResp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(geminiPayload),
      }
    );

    // Always log the raw Gemini response for debugging
    const geminiRaw = await geminiResp.text();
    console.log('Gemini status:', geminiResp.status);
    console.log('Gemini raw response:', geminiRaw);

    if (!geminiResp.ok) {
      console.error('Gemini API error:', geminiResp.status, geminiRaw);
      return new Response(JSON.stringify({ error: 'AI service error (' + geminiResp.status + '). Try again.' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    let geminiData;
    try {
      geminiData = JSON.parse(geminiRaw);
    } catch (e) {
      console.error('Could not parse Gemini response as JSON:', geminiRaw);
      return new Response(JSON.stringify({ error: 'Unexpected response from AI. Try again.' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    const rawText = parts.find(p => p.text && !p.thought)?.text || parts[0]?.text || '';

    if (!rawText) {
      console.error('Empty text in Gemini response:', JSON.stringify(geminiData));
      return new Response(JSON.stringify({ error: 'AI returned an empty response. Try again.' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse error. Raw text:', cleaned);
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON. Try a different prompt.' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!parsed.board_title || !Array.isArray(parsed.lists)) {
      console.error('Unexpected structure:', JSON.stringify(parsed));
      return new Response(JSON.stringify({ error: 'AI returned unexpected structure. Try again.' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Enforce limits and strip descriptions server-side
    parsed.board_title = String(parsed.board_title).slice(0, 40);
    parsed.lists = parsed.lists.slice(0, 4).map(function(list) {
      return {
        title: String(list.title || 'List').slice(0, 30),
        cards: (Array.isArray(list.cards) ? list.cards : []).slice(0, 5).map(function(card) {
          return {
            title:       String(card.title || 'Task').slice(0, 60),
            description: null,
            priority:    ['low', 'medium', 'high'].includes(card.priority) ? card.priority : 'medium',
          };
        }),
      };
    });

    console.log('Board generated OK:', parsed.board_title, '|', parsed.lists.length, 'lists');

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('generate-board unhandled error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});


---

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES modules), no framework
- **Backend**: Supabase (PostgreSQL + RLS + Realtime + Edge Functions)
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **AI**: Google Gemini 2.5 Flash via Supabase Edge Function
- **SMS**: Twilio via Supabase Edge Function
- **Hosting**: Any static file host (currently deployed on GitHub Pages)

---

## File Reference

| File | Purpose |
|------|---------|
| `index.html` | App shell, all modals and views |
| `app.js` | All client-side logic |
| `style.css` | All styles |
| `schema.sql` | Initial database schema |
| `schema-additions.sql` | All RPCs, RLS policies, and tables added post-launch — run after schema.sql |
| `send-sms-index.ts` | Twilio Edge Function code (paste into `dynamic-responder`) |
| `generate-board.ts` | Gemini Edge Function code (paste into `generate-board`) |