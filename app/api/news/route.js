import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

export const runtime = "nodejs";

const NEWS_TTL_MS = 2 * 60 * 1000;
let cached = { timestamp: 0, items: [] };
let cachedUserId = null;

export async function GET() {
  try {
    const now = Date.now();
    if (now - cached.timestamp < NEWS_TTL_MS && cached.items.length) {
      return NextResponse.json({ items: cached.items }, { status: 200 });
    }

    const feedUrl = process.env.NEWS_FEED_URL;
    const xToken = process.env.X_BEARER_TOKEN;
    const xUser = process.env.X_USERNAME || "leagueofleaks";

    if (feedUrl) {
      const response = await fetch(feedUrl, { cache: "no-store" });
      if (!response.ok) {
        return NextResponse.json(
          { error: "Failed to load news feed." },
          { status: 502 }
        );
      }

      const xml = await response.text();
      const parser = new XMLParser({
        ignoreAttributes: false,
        textNodeName: "#text",
        cdataPropName: "__cdata"
      });
      const parsed = parser.parse(xml);
      const rssChannel = Array.isArray(parsed?.rss?.channel)
        ? parsed.rss.channel[0]
        : parsed?.rss?.channel;
      const items =
        rssChannel?.item ||
        parsed?.feed?.entry ||
        parsed?.channel?.item ||
        [];

      const getText = (value) => {
        if (!value) {
          return "";
        }
        if (typeof value === "string") {
          return value;
        }
        return value.__cdata || value["#text"] || "";
      };

      const getImageUrl = (item) => {
        const mediaContent = item?.["media:content"];
        const mediaThumbnail = item?.["media:thumbnail"];
        const enclosure = item?.enclosure;
        const imageCandidate =
          mediaContent?.["@_url"] ||
          (Array.isArray(mediaContent) ? mediaContent[0]?.["@_url"] : null) ||
          mediaThumbnail?.["@_url"] ||
          (Array.isArray(mediaThumbnail) ? mediaThumbnail[0]?.["@_url"] : null) ||
          enclosure?.["@_url"] ||
          (Array.isArray(enclosure) ? enclosure[0]?.["@_url"] : null) ||
          "";

        if (imageCandidate) {
          return imageCandidate;
        }

        const description =
          getText(item?.description) ||
          getText(item?.content) ||
          getText(item?.summary) ||
          "";
        const match = description.match(/<img[^>]+src=["']([^"']+)["']/i);
        return match?.[1] || "";
      };

      const normalized = (Array.isArray(items) ? items : [items])
        .filter(Boolean)
        .slice(0, 10)
        .map((item) => ({
          title: getText(item.title) || "Update",
          link:
            item.link?.["@_href"] ||
            item.link?.["#text"] ||
            getText(item.link) ||
            "",
          published:
            getText(item.pubDate) ||
            getText(item.published) ||
            getText(item.updated) ||
            "",
          image: getImageUrl(item)
        }));

      if (!normalized.length) {
        return NextResponse.json(
          { error: "No items found in RSS feed." },
          { status: 502 }
        );
      }

      cached = { timestamp: now, items: normalized };

      return NextResponse.json({ items: normalized }, { status: 200 });
    }

    if (xToken) {
      if (!cachedUserId) {
        const userResponse = await fetch(
          `https://api.x.com/2/users/by/username/${encodeURIComponent(xUser)}`,
          {
            headers: { Authorization: `Bearer ${xToken}` },
            cache: "no-store"
          }
        );
        const userData = await userResponse.json();
        if (!userResponse.ok) {
          return NextResponse.json(
            { error: userData?.detail || "Failed to load X user." },
            { status: 502 }
          );
        }
        cachedUserId = userData.data?.id || null;
      }

      const tweetsResponse = await fetch(
        `https://api.x.com/2/users/${cachedUserId}/tweets?max_results=5&tweet.fields=created_at`,
        {
          headers: { Authorization: `Bearer ${xToken}` },
          cache: "no-store"
        }
      );
      const tweetsData = await tweetsResponse.json();
      if (!tweetsResponse.ok) {
        return NextResponse.json(
          { error: tweetsData?.detail || "Failed to load X tweets." },
          { status: 502 }
        );
      }

      const normalized = (tweetsData.data || []).map((tweet) => ({
        title: tweet.text,
        link: `https://x.com/${xUser}/status/${tweet.id}`,
        published: tweet.created_at
      }));

      cached = { timestamp: now, items: normalized };
      return NextResponse.json({ items: normalized }, { status: 200 });
    }

    return NextResponse.json(
      { error: "Missing NEWS_FEED_URL or X_BEARER_TOKEN." },
      { status: 500 }
    );

  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load news feed." },
      { status: 500 }
    );
  }
}
