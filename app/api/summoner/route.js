import { NextResponse } from "next/server";
import { createClient } from "redis";

export const runtime = "nodejs";

const DEFAULT_REGION = "euw1";
const MAX_MATCHES = 10;
const SUMMARY_MATCHES = 20;
const RIOT_CACHE_TTL_MS = 60 * 1000;
const MATCH_CACHE_TTL_MS = 5 * 60 * 1000;
const ACTIVE_GAME_TTL_MS = 15 * 1000;
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

const QUEUE_ID_LABELS = {
  400: "Normal Draft",
  420: "Ranked Solo/Duo",
  430: "Normal Blind",
  440: "Ranked Flex",
  450: "ARAM",
  1700: "Arena"
};

const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";
const DDRAGON_TTL_MS = 6 * 60 * 60 * 1000;
const ddragonCache = {
  version: null,
  championsById: null,
  championsByKey: null,
  itemsById: null,
  fetchedAt: 0
};

const riotCache = new Map();
const redisUrl = process.env.REDIS_URL;
let redisClientPromise = null;

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

const fetchLatestDdragonVersion = async () => {
  const versionsResponse = await fetch(`${DDRAGON_BASE}/api/versions.json`, {
    cache: "no-store"
  });
  if (!versionsResponse.ok) {
    throw new Error("Failed to load Data Dragon versions.");
  }
  const versions = await versionsResponse.json();
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error("No Data Dragon versions available.");
  }
  return versions[0];
};

const getDdragonData = async () => {
  const now = Date.now();
  if (
    ddragonCache.version &&
    ddragonCache.championsById &&
    ddragonCache.itemsById &&
    now - ddragonCache.fetchedAt < DDRAGON_TTL_MS
  ) {
    return ddragonCache;
  }

  const version = await fetchLatestDdragonVersion();
  const [championsResponse, itemsResponse] = await Promise.all([
    fetch(`${DDRAGON_BASE}/cdn/${version}/data/en_US/champion.json`, {
      cache: "no-store"
    }),
    fetch(`${DDRAGON_BASE}/cdn/${version}/data/en_US/item.json`, {
      cache: "no-store"
    })
  ]);

  if (!championsResponse.ok || !itemsResponse.ok) {
    throw new Error("Failed to load Data Dragon data.");
  }

  const championsPayload = await championsResponse.json();
  const itemsPayload = await itemsResponse.json();

  const championsById = {};
  const championsByKey = {};
  Object.values(championsPayload.data || {}).forEach((champion) => {
    const entry = {
      name: champion.name,
      image: champion.image?.full || null
    };
    championsById[Number(champion.key)] = entry;
    championsByKey[champion.id] = entry;
  });

  const itemsById = {};
  Object.entries(itemsPayload.data || {}).forEach(([id, item]) => {
    itemsById[Number(id)] = {
      name: item.name,
      image: item.image?.full || null,
      from: item.from || []
    };
  });

  ddragonCache.version = version;
  ddragonCache.championsById = championsById;
  ddragonCache.championsByKey = championsByKey;
  ddragonCache.itemsById = itemsById;
  ddragonCache.fetchedAt = now;

  return ddragonCache;
};

const buildMatchInsights = (matches, playerPuuid, ddragonData) => {
  const championStats = new Map();
  const teammateCounts = new Map();
  let totalGames = 0;
  let totalWins = 0;

  matches.forEach((match) => {
    const participant = match.info.participants.find(
      (player) => player.puuid === playerPuuid
    );

    if (!participant) {
      return;
    }

    totalGames += 1;
    if (participant.win) {
      totalWins += 1;
    }

    const championName = participant.championName || "Unknown";
    const championMeta =
      ddragonData?.championsByKey?.[participant.championName] || null;
    const champEntry = championStats.get(championName) || {
      championName,
      championImage: championMeta?.image || null,
      games: 0,
      wins: 0
    };
    champEntry.games += 1;
    if (participant.win) {
      champEntry.wins += 1;
    }
    championStats.set(championName, champEntry);

    match.info.participants
      .filter(
        (player) =>
          player.teamId === participant.teamId &&
          player.puuid !== playerPuuid
      )
      .forEach((teammate) => {
        const teammateName =
          teammate.riotIdGameName && teammate.riotIdTagline
            ? `${teammate.riotIdGameName}#${teammate.riotIdTagline}`
            : teammate.summonerName || "Unknown";
        teammateCounts.set(
          teammateName,
          (teammateCounts.get(teammateName) || 0) + 1
        );
      });
  });

  const championStatsList = Array.from(championStats.values()).map((entry) => ({
    ...entry,
    winrate: entry.games ? entry.wins / entry.games : 0
  }));

  const mostPlayedChampion = championStatsList.reduce(
    (current, entry) =>
      !current || entry.games > current.games ? entry : current,
    null
  );

  const highestWinrateChampion = championStatsList.reduce((current, entry) => {
    if (entry.games === 0) {
      return current;
    }
    if (!current || entry.winrate > current.winrate) {
      return entry;
    }
    return current;
  }, null);

  const lowestWinrateChampion = championStatsList.reduce((current, entry) => {
    if (entry.games === 0) {
      return current;
    }
    if (!current || entry.winrate < current.winrate) {
      return entry;
    }
    return current;
  }, null);

  const mostPlayedWith = Array.from(teammateCounts.entries())
    .map(([name, games]) => ({ name, games }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 3);

  return {
    summary: {
      games: totalGames,
      wins: totalWins,
      winrate: totalGames ? totalWins / totalGames : 0
    },
    championStats: championStatsList,
    mostPlayedChampion,
    highestWinrateChampion,
    lowestWinrateChampion,
    mostPlayedWith
  };
};

const buildMatchSummaries = (matches, playerPuuid, ddragonData) => {
  return matches
    .map((match) => {
      const participant = match.info.participants.find(
        (player) => player.puuid === playerPuuid
      );

      if (!participant) {
        return null;
      }

      const champMeta =
        ddragonData?.championsById?.[participant.championId] || null;
      const items = [
        participant.item0,
        participant.item1,
        participant.item2,
        participant.item3,
        participant.item4,
        participant.item5,
        participant.item6
      ]
        .filter((itemId) => itemId && itemId !== 0)
        .map((itemId) => {
          const itemMeta = ddragonData?.itemsById?.[itemId] || null;
          const fromNames = (itemMeta?.from || [])
            .map((fromId) => ddragonData?.itemsById?.[Number(fromId)]?.name)
            .filter(Boolean);

          return {
            id: itemId,
            name: itemMeta?.name || `Item ${itemId}`,
            image: itemMeta?.image || null,
            buildFrom: fromNames
          };
        });

      return {
        matchId: match.metadata.matchId,
        gameMode: match.info.gameMode,
        gameType: match.info.gameType,
        queueId: match.info.queueId,
        queueName: QUEUE_ID_LABELS[match.info.queueId] || null,
        gameCreation: match.info.gameCreation,
        gameDuration: match.info.gameDuration,
        win: participant.win,
        championName: participant.championName,
        championImage: champMeta?.image || null,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
        items
      };
    })
    .filter(Boolean);
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const gameName = searchParams.get("gameName");
  const tagLine = searchParams.get("tagLine");
  const region = (searchParams.get("region") || DEFAULT_REGION).toLowerCase();
  const lite = searchParams.get("lite") === "1";
  const summaryOnly = searchParams.get("summary") === "1";
  const statusOnly = searchParams.get("status") === "1";
  const apiKey = process.env.RIOT_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing RIOT_API_KEY in environment." },
      { status: 500 }
    );
  }

  if (!gameName || !tagLine) {
    return NextResponse.json(
      { error: "Missing game name or tagline." },
      { status: 400 }
    );
  }

  const route = REGION_TO_ROUTE[region] || REGION_TO_ROUTE[DEFAULT_REGION];
  const accountEndpoint = `https://${route}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
    gameName
  )}/${encodeURIComponent(tagLine)}`;

  try {
    const warnings = [];
    const accountResult = await riotFetch(
      accountEndpoint,
      apiKey,
      "Account lookup",
      { cacheTtlMs: RIOT_CACHE_TTL_MS }
    );

    if (!accountResult.ok) {
      return NextResponse.json(
        { error: accountResult.error },
        { status: accountResult.status }
      );
    }

    const accountData = accountResult.data;
    const summonerEndpoint = `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(
      accountData.puuid
    )}`;

    const summonerResult = await riotFetch(
      summonerEndpoint,
      apiKey,
      "Summoner lookup",
      { cacheTtlMs: RIOT_CACHE_TTL_MS }
    );

    if (!summonerResult.ok) {
      return NextResponse.json(
        { error: summonerResult.error },
        { status: summonerResult.status }
      );
    }

    const summonerData = summonerResult.data;
    const rankedEndpoint = `https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(
      summonerData.puuid
    )}`;
    const matchCount = summaryOnly
      ? SUMMARY_MATCHES
      : statusOnly
        ? 1
        : MAX_MATCHES;
    const matchListEndpoint = `https://${route}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(
      summonerData.puuid
    )}/ids?start=0&count=${matchCount}`;
    const masteryEndpoint = `https://${region}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(
      summonerData.puuid
    )}/top?count=5`;
    const challengesEndpoint = `https://${region}.api.riotgames.com/lol/challenges/v1/player-data/${encodeURIComponent(
      summonerData.puuid
    )}`;
    const activeGameEndpoint = `https://${region}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(
      summonerData.puuid
    )}`;

    const rankedResult = await riotFetch(
      rankedEndpoint,
      apiKey,
      "Ranked lookup",
      { cacheTtlMs: RIOT_CACHE_TTL_MS }
    );
    const matchListResult = statusOnly
      ? await riotFetch(matchListEndpoint, apiKey, "Match list", {
          cacheTtlMs: RIOT_CACHE_TTL_MS
        })
      : lite
        ? { ok: true, data: [] }
        : await riotFetch(matchListEndpoint, apiKey, "Match list", {
            cacheTtlMs: RIOT_CACHE_TTL_MS
          });
    const masteryResult = lite || statusOnly || summaryOnly
      ? { ok: true, data: [] }
      : await riotFetch(masteryEndpoint, apiKey, "Champion mastery", {
          cacheTtlMs: RIOT_CACHE_TTL_MS
        });
    const challengesResult = lite || statusOnly || summaryOnly
      ? { ok: true, data: null }
      : await riotFetch(challengesEndpoint, apiKey, "Challenges", {
          cacheTtlMs: RIOT_CACHE_TTL_MS
        });
    const activeGameResult = lite
      ? { ok: true, data: null }
      : await riotFetch(activeGameEndpoint, apiKey, "Active game", {
          allow404: true,
          cacheTtlMs: ACTIVE_GAME_TTL_MS
        });

    const rankedData = rankedResult.ok ? rankedResult.data : [];
    if (!rankedResult.ok) {
      warnings.push(rankedResult.error);
    }

    const matchIds = matchListResult.ok ? matchListResult.data : [];
    if (!matchListResult.ok) {
      warnings.push(matchListResult.error);
    }

    const masteryTop = masteryResult.ok ? masteryResult.data : [];
    if (!masteryResult.ok) {
      warnings.push(masteryResult.error);
    }

    const challengesData = challengesResult.ok ? challengesResult.data : null;
    if (!challengesResult.ok) {
      warnings.push(challengesResult.error);
    }

    const activeGame = activeGameResult.ok ? activeGameResult.data : null;
    if (!activeGameResult.ok) {
      warnings.push(activeGameResult.error);
    }

    const wantsMatchDetails = !lite && (!statusOnly || summaryOnly);
    const matchDetails = wantsMatchDetails
      ? await Promise.all(
          matchIds.map(async (matchId) => {
            const matchEndpoint = `https://${route}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
            const matchResult = await riotFetch(
              matchEndpoint,
              apiKey,
              `Match ${matchId}`,
              { cacheTtlMs: MATCH_CACHE_TTL_MS }
            );

            if (!matchResult.ok) {
              warnings.push(matchResult.error);
              return null;
            }

            return matchResult.data;
          })
        )
      : [];

    const statusMatchId = statusOnly ? matchIds[0] : null;
    const statusMatch = statusMatchId
      ? await riotFetch(
          `https://${route}.api.riotgames.com/lol/match/v5/matches/${statusMatchId}`,
          apiKey,
          `Match ${statusMatchId}`,
          { cacheTtlMs: MATCH_CACHE_TTL_MS }
        )
      : null;

    let ddragonData = null;
    if (!lite && (!statusOnly || summaryOnly)) {
      try {
        ddragonData = await getDdragonData();
      } catch (error) {
        warnings.push(`Data Dragon: ${error.message}`);
      }
    }

    const matchInsights = lite || (statusOnly && !summaryOnly)
      ? null
      : buildMatchInsights(
          matchDetails.filter(Boolean),
          summonerData.puuid,
          ddragonData
        );
    const matchSummaries = lite || (statusOnly && !summaryOnly)
      ? []
      : buildMatchSummaries(
          matchDetails.filter(Boolean),
          summonerData.puuid,
          ddragonData
        );

    const lastMatch = matchDetails.find(Boolean) || null;

    return NextResponse.json(
      {
        ...summonerData,
        riotId: {
          gameName: accountData.gameName,
          tagLine: accountData.tagLine
        },
        ranked: rankedData,
        masteryTop: ddragonData
          ? masteryTop.map((entry) => ({
              ...entry,
              championName:
                ddragonData?.championsById?.[entry.championId]?.name || null,
              championImage:
                ddragonData?.championsById?.[entry.championId]?.image || null
            }))
          : masteryTop,
        challenges: challengesData,
        activeGame: activeGame
          ? {
              ...activeGame,
              queueName:
                QUEUE_ID_LABELS[activeGame.gameQueueConfigId] || null
            }
          : null,
        status: statusOnly
          ? {
              inGame: Boolean(activeGame),
              lastPlayedAt: statusMatch?.ok
                ? statusMatch.data?.info?.gameEndTimestamp || null
                : lastMatch?.info?.gameEndTimestamp || null
            }
          : null,
        matches: summaryOnly ? [] : matchDetails.filter(Boolean),
        matchSummaries,
        insights: matchInsights,
        ddVersion: ddragonData?.version || null,
        warnings
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unexpected error." },
      { status: 500 }
    );
  }
}
