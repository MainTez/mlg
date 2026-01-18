import { NextResponse } from "next/server";
import { createClient } from "redis";

export const runtime = "nodejs";

const DEFAULT_REGION = "euw1";
const REGION_TO_ROUTE = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  oc1: "sea",
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  kr: "asia"
};
const RANKED_QUEUE_IDS = new Set([420, 440]);
const MAX_MATCHES = 20;
const MATCH_LOOKBACK = 30;
const RIOT_CACHE_TTL_MS = 30 * 1000;
const MATCH_CACHE_TTL_MS = 5 * 60 * 1000;
const TIMELINE_CACHE_TTL_MS = 10 * 60 * 1000;
const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";
const DDRAGON_TTL_MS = 6 * 60 * 60 * 1000;
const EARLY_WINDOW_MS = 10 * 60 * 1000;

const riotCache = new Map();
const redisUrl = process.env.REDIS_URL;
let redisClientPromise = null;
const ddragonCache = {
  version: null,
  championsById: null,
  spellsById: null,
  fetchedAt: 0
};

const getRedisClient = async () => {
  if (!redisUrl) {
    return null;
  }
  if (!redisClientPromise) {
    const client = createClient({ url: redisUrl });
    client.on("error", () => {});
    redisClientPromise = client
      .connect()
      .then(() => client)
      .catch(() => null);
  }
  return redisClientPromise;
};

const riotFetch = async (endpoint, apiKey, stage, options = {}) => {
  const { allow404 = false, cacheTtlMs = 0 } = options;
  const now = Date.now();
  if (cacheTtlMs > 0) {
    const redisClient = await getRedisClient();
    if (redisClient) {
      const cached = await redisClient
        .get(`riotcache:${endpoint}`)
        .catch(() => null);
      if (cached) {
        return { ok: true, data: JSON.parse(cached) };
      }
    }
    const cached = riotCache.get(endpoint);
    if (cached && cached.expiresAt > now) {
      return { ok: true, data: cached.data };
    }
  }

  const response = await fetch(endpoint, {
    headers: { "X-Riot-Token": apiKey },
    cache: "no-store"
  });
  const data = await response.json();

  if (allow404 && response.status === 404) {
    return { ok: true, data: null, cacheable: false };
  }

  if (!response.ok) {
    const message = data?.status?.message || "Riot API error.";
    return {
      ok: false,
      status: response.status,
      error: `${stage}: ${message}`
    };
  }

  if (cacheTtlMs > 0 && data !== null) {
    const redisClient = await getRedisClient();
    if (redisClient) {
      await redisClient
        .set(`riotcache:${endpoint}`, JSON.stringify(data), {
          EX: Math.max(1, Math.floor(cacheTtlMs / 1000))
        })
        .catch(() => null);
    }
    riotCache.set(endpoint, {
      data,
      expiresAt: now + cacheTtlMs
    });
  }

  return { ok: true, data };
};

const getDdragonData = async () => {
  const now = Date.now();
  if (
    ddragonCache.version &&
    ddragonCache.championsById &&
    ddragonCache.spellsById &&
    now - ddragonCache.fetchedAt < DDRAGON_TTL_MS
  ) {
    return ddragonCache;
  }

  const versionRes = await fetch(`${DDRAGON_BASE}/api/versions.json`, {
    cache: "no-store"
  });
  if (!versionRes.ok) {
    throw new Error("Failed to fetch Data Dragon version.");
  }
  const versions = await versionRes.json();
  const version = versions?.[0];
  if (!version) {
    throw new Error("No Data Dragon version found.");
  }
  const champsRes = await fetch(
    `${DDRAGON_BASE}/cdn/${version}/data/en_US/champion.json`,
    { cache: "no-store" }
  );
  if (!champsRes.ok) {
    throw new Error("Failed to load Data Dragon champions.");
  }
  const champsPayload = await champsRes.json();
  const championsById = {};
  Object.values(champsPayload.data || {}).forEach((champ) => {
    championsById[Number(champ.key)] = {
      name: champ.name,
      image: champ.image?.full || null
    };
  });

  const summonerRes = await fetch(
    `${DDRAGON_BASE}/cdn/${version}/data/en_US/summoner.json`,
    { cache: "no-store" }
  );
  if (!summonerRes.ok) {
    throw new Error("Failed to load Data Dragon summoners.");
  }
  const summonerPayload = await summonerRes.json();
  const spellsById = {};
  Object.values(summonerPayload.data || {}).forEach((spell) => {
    const id = Number(spell.key);
    spellsById[id] = {
      name: spell.name,
      image: spell.image?.full || null,
      cooldown: Array.isArray(spell.cooldown) ? spell.cooldown[0] : null
    };
  });

  ddragonCache.version = version;
  ddragonCache.championsById = championsById;
  ddragonCache.spellsById = spellsById;
  ddragonCache.fetchedAt = now;

  return ddragonCache;
};

const mapWithConcurrency = async (items, limit, iterator) => {
  const results = [];
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await iterator(items[current], current);
    }
  };

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
};

const buildTraits = (summary, mainRole, roleShare) => {
  if (!summary?.games) {
    return [];
  }
  const traits = [];
  const avgKills = summary.avgKills;
  const avgDeaths = summary.avgDeaths;
  const avgAssists = summary.avgAssists;
  const kdaRatio = summary.kdaRatio;
  const earlyDeathRate = summary.earlyDeathsPerGame;

  if (avgKills >= 6 || (kdaRatio >= 3 && avgKills >= 4)) {
    traits.push("Aggressive");
  }
  if (earlyDeathRate >= 0.6) {
    traits.push("Prone to ganks");
  } else if (earlyDeathRate >= 0.4) {
    traits.push("Dies early");
  }
  if (avgDeaths <= 3 && earlyDeathRate <= 0.2) {
    traits.push("Safe laner");
  }
  const visionTarget = mainRole === "UTILITY" ? 30 : 20;
  if (summary.avgVision >= visionTarget) {
    traits.push("Good warder");
  }
  if (roleShare > 0 && roleShare < 0.5) {
    traits.push("Off-role risk");
  }

  return traits;
};

const summarizeMatches = (matches, puuid, timelines) => {
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let totalVision = 0;
  let earlyDeaths = 0;
  const roleCounts = new Map();

  matches.forEach((match, index) => {
    const participant = match.info.participants.find(
      (player) => player.puuid === puuid
    );
    if (!participant) {
      return;
    }
    totalKills += participant.kills || 0;
    totalDeaths += participant.deaths || 0;
    totalAssists += participant.assists || 0;
    totalVision += participant.visionScore || 0;
    const role = participant.teamPosition || "UNKNOWN";
    roleCounts.set(role, (roleCounts.get(role) || 0) + 1);

    const timeline = timelines[index];
    if (timeline?.info?.frames && participant.participantId) {
      let deathsThisMatch = 0;
      timeline.info.frames.forEach((frame) => {
        frame.events?.forEach((event) => {
          if (
            event.type === "CHAMPION_KILL" &&
            event.victimId === participant.participantId &&
            event.timestamp <= EARLY_WINDOW_MS
          ) {
            deathsThisMatch += 1;
          }
        });
      });
      earlyDeaths += deathsThisMatch;
    }
  });

  const games = matches.length;
  const mainRoleEntry = Array.from(roleCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const mainRole = mainRoleEntry?.[0] || "UNKNOWN";
  const roleShare = games ? (mainRoleEntry?.[1] || 0) / games : 0;

  return {
    games,
    avgKills: games ? Math.round((totalKills / games) * 10) / 10 : 0,
    avgDeaths: games ? Math.round((totalDeaths / games) * 10) / 10 : 0,
    avgAssists: games ? Math.round((totalAssists / games) * 10) / 10 : 0,
    avgVision: games ? Math.round((totalVision / games) * 10) / 10 : 0,
    kdaRatio: (totalKills + totalAssists) / Math.max(1, totalDeaths),
    earlyDeathsPerGame: games ? earlyDeaths / games : 0,
    mainRole,
    roleShare
  };
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameName = searchParams.get("gameName");
    const tagLine = searchParams.get("tagLine");
    const region = (searchParams.get("region") || DEFAULT_REGION).toLowerCase();
    const apiKey = process.env.RIOT_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing Riot API key." },
        { status: 500 }
      );
    }
    if (!gameName || !tagLine) {
      return NextResponse.json(
        { error: "Missing gameName or tagLine." },
        { status: 400 }
      );
    }

    const route = REGION_TO_ROUTE[region] || REGION_TO_ROUTE[DEFAULT_REGION];
    const accountEndpoint = `https://${route}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      gameName
    )}/${encodeURIComponent(tagLine)}`;
    const accountResult = await riotFetch(
      accountEndpoint,
      apiKey,
      "Account lookup",
      { cacheTtlMs: RIOT_CACHE_TTL_MS }
    );
    if (!accountResult.ok || !accountResult.data?.puuid) {
      return NextResponse.json(
        { error: accountResult.error || "Account lookup failed." },
        { status: accountResult.status || 500 }
      );
    }

    const summonerEndpoint = `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${accountResult.data.puuid}`;
    const summonerResult = await riotFetch(
      summonerEndpoint,
      apiKey,
      "Summoner lookup",
      { cacheTtlMs: RIOT_CACHE_TTL_MS }
    );
    if (!summonerResult.ok || !summonerResult.data?.id) {
      return NextResponse.json(
        { error: summonerResult.error || "Summoner lookup failed." },
        { status: summonerResult.status || 500 }
      );
    }

    const spectatorEndpoint = `https://${region}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${summonerResult.data.id}`;
    const activeGameResult = await riotFetch(
      spectatorEndpoint,
      apiKey,
      "Active game",
      { allow404: true, cacheTtlMs: 15 * 1000 }
    );
    if (!activeGameResult.ok) {
      return NextResponse.json(
        { error: activeGameResult.error || "Active game lookup failed." },
        { status: activeGameResult.status || 500 }
      );
    }
    if (!activeGameResult.data) {
      return NextResponse.json(
        { activeGame: null, participants: [] },
        { status: 200 }
      );
    }

    const ddragonData = await getDdragonData();
    const targetPuuid = accountResult.data.puuid;
    const activeGame = activeGameResult.data;
    const participants = activeGame.participants || [];

    const enrichedParticipants = await mapWithConcurrency(
      participants,
      2,
      async (participant) => {
        const puuid = participant.puuid;
        const accountByPuuidEndpoint = `https://${route}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${puuid}`;
        const accountByPuuidResult = await riotFetch(
          accountByPuuidEndpoint,
          apiKey,
          "Account lookup",
          { cacheTtlMs: 5 * 60 * 1000 }
        );
        const riotId = accountByPuuidResult.ok
          ? `${accountByPuuidResult.data.gameName}#${accountByPuuidResult.data.tagLine}`
          : participant.summonerName || "Unknown";

        const matchListEndpoint = `https://${route}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${MATCH_LOOKBACK}`;
        const matchListResult = await riotFetch(
          matchListEndpoint,
          apiKey,
          "Match list",
          { cacheTtlMs: RIOT_CACHE_TTL_MS }
        );
        const matchIds = matchListResult.ok ? matchListResult.data : [];

        const rankedMatches = [];
        const timelines = [];
        for (const matchId of matchIds) {
          if (rankedMatches.length >= MAX_MATCHES) {
            break;
          }
          const matchEndpoint = `https://${route}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
          const matchResult = await riotFetch(
            matchEndpoint,
            apiKey,
            `Match ${matchId}`,
            { cacheTtlMs: MATCH_CACHE_TTL_MS }
          );
          if (!matchResult.ok || !matchResult.data) {
            continue;
          }
          if (!RANKED_QUEUE_IDS.has(matchResult.data.info.queueId)) {
            continue;
          }

          const timelineEndpoint = `https://${route}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`;
          const timelineResult = await riotFetch(
            timelineEndpoint,
            apiKey,
            `Timeline ${matchId}`,
            { cacheTtlMs: TIMELINE_CACHE_TTL_MS }
          );
          rankedMatches.push(matchResult.data);
          timelines.push(timelineResult.ok ? timelineResult.data : null);
        }

        const summary = summarizeMatches(rankedMatches, puuid, timelines);
        const traits = buildTraits(summary, summary.mainRole, summary.roleShare);
        const champMeta =
          ddragonData.championsById?.[participant.championId] || null;
        const spell1 = ddragonData.spellsById?.[participant.spell1Id] || null;
        const spell2 = ddragonData.spellsById?.[participant.spell2Id] || null;

        return {
          puuid,
          riotId,
          teamId: participant.teamId,
          championId: participant.championId,
          championName: champMeta?.name || null,
          championImage: champMeta?.image || null,
          spells: [
            {
              id: participant.spell1Id,
              name: spell1?.name || `Spell ${participant.spell1Id}`,
              image: spell1?.image || null,
              cooldown: spell1?.cooldown || null
            },
            {
              id: participant.spell2Id,
              name: spell2?.name || `Spell ${participant.spell2Id}`,
              image: spell2?.image || null,
              cooldown: spell2?.cooldown || null
            }
          ],
          mainRole: summary.mainRole,
          roleShare: summary.roleShare,
          traits,
          stats: summary
        };
      }
    );

    const targetParticipant = enrichedParticipants.find(
      (player) => player.puuid === targetPuuid
    );
    const friendlyTeamId = targetParticipant?.teamId || null;

    return NextResponse.json(
      {
        activeGame: {
          gameId: activeGame.gameId,
          gameStartTime: activeGame.gameStartTime,
          gameQueueConfigId: activeGame.gameQueueConfigId
        },
        targetPuuid,
        friendlyTeamId,
        participants: enrichedParticipants,
        ddVersion: ddragonData.version
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load live intel." },
      { status: 500 }
    );
  }
}
