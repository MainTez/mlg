# LoL Tracker

Minimal Riot API tracker scaffold. This starts with a summoner lookup and is ready to expand into ranked stats, match history, and champion insights.

## Setup

1. Copy env file and add your Riot API key:

```bash
cp .env.example .env.local
```

2. Install dependencies:

```bash
npm install
```

3. Run the dev server:

```bash
npm run dev
```

Open http://localhost:3000.

## Optional Redis cache (production)

Set `REDIS_URL` to enable shared caching across instances:

```
REDIS_URL=redis://localhost:6379
```

## Supabase setup (dashboard data)

1. Create a Supabase project and open the SQL editor.
2. Run `supabase/schema.sql`.
3. Add env vars:

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEWS_FEED_URL=your_rss_feed_url
X_BEARER_TOKEN=your_x_bearer_token
X_USERNAME=leagueofleaks
```

Admin page: http://localhost:3000/admin

Note: Re-run the schema when adding new tables (chat, tournaments, schedule, drafts, opponents, patch digest).

## Next steps

- Add ranked stats via `/lol/league/v4/entries/by-summoner/{summonerId}`.
- Add match history via the match-v5 endpoints (regional routing).
- Store profiles in a database for caching.
