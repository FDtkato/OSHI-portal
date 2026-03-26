import RssParser from "rss-parser";
import * as cheerio from "cheerio";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { NewsItem, LiveItem } from "../src/data/artists";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "src", "data", "generated");

/**
 * ガガガSP のお知らせを RSS フィードから取得
 */
async function fetchNews(): Promise<NewsItem[]> {
  const parser = new RssParser();
  const feed = await parser.parseURL("https://gagagasp.jp/feed/");

  return (feed.items ?? []).map((item) => ({
    title: item.title ?? "",
    url: item.link ?? "",
    date: item.pubDate
      ? new Date(item.pubDate).toISOString().slice(0, 10)
      : "",
    category:
      item.categories && item.categories.length > 0
        ? item.categories[0]
        : undefined,
  }));
}

/**
 * ガガガSP のライブ情報を公式トップページから HTML スクレイピングで取得
 * トップページにライブ情報が日付付きで掲載されている
 */
async function fetchLive(): Promise<LiveItem[]> {
  const res = await fetch("https://gagagasp.jp/");
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return parseLiveFromHtml(await res.text());
}

function parseLiveFromHtml(html: string): LiveItem[] {
  const $ = cheerio.load(html);
  const items: LiveItem[] = [];

  // gagagasp.jp のライブ情報はリンク付きリストで掲載
  // 形式: "2026年03月22日（日）タイトル @会場" のようなテキスト + リンク
  $("a[href*='/events/event-']").each((_i, el) => {
    const $el = $(el);
    const href = $el.attr("href") ?? "";
    const text = $el.text().trim();

    // 親要素から日付テキストを取得（日付はリンクの前に記載されている場合が多い）
    const parentText = $el.parent().text().trim();

    // 日付パターンを抽出: "2026年03月22日" or "2026年3月22日"
    const dateMatch = parentText.match(
      /(\d{4})年(\d{1,2})月(\d{1,2})日/
    );
    let date = "";
    if (dateMatch) {
      const [, y, m, d] = dateMatch;
      date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // 会場を抽出 — タイトルの「@」以降、または括弧内の地名
    // 例: "【ツアー】青春謳歌ワンマンツアー@アウトライン（福島）"
    //   → venue: "【福島】アウトライン"
    // 例: "【愛媛】Hi BACK PACK SPECIAL@松山W studio RED"
    //   → venue: "【愛媛】松山W studio RED"
    let venue: string | undefined;
    const prefectureMatch = text.match(/（(.+?)）/);
    const bracketMatch = text.match(/【(.+?)】/);
    const atMatch = text.match(/@(.+?)(?:（|$)/);

    if (bracketMatch && bracketMatch[1] !== "ツアー") {
      // 【愛媛】のような地名付き
      venue = `【${bracketMatch[1]}】${atMatch ? atMatch[1] : ""}`.trim();
    } else if (prefectureMatch && atMatch) {
      // （福島）のような末尾の地名 + @会場名
      venue = `【${prefectureMatch[1]}】${atMatch[1]}`.trim();
    } else if (atMatch) {
      venue = atMatch[1].trim();
    }

    const url = href.startsWith("http")
      ? href
      : `https://gagagasp.jp${href}`;

    if (text) {
      items.push({ title: text, url, date, venue });
    }
  });

  // 重複削除（URLベース）
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

/**
 * メインエントリーポイント
 */
async function main() {
  console.log("[ガガガSP] データ取得開始...");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // お知らせ取得
  try {
    const news = await fetchNews();
    const newsPath = path.join(OUTPUT_DIR, "gagagasp-news.json");
    fs.writeFileSync(newsPath, JSON.stringify(news, null, 2), "utf-8");
    console.log(`  ✅ お知らせ: ${news.length}件 → ${newsPath}`);
  } catch (err) {
    console.error("  ❌ お知らせ取得失敗:", err);
  }

  // ライブ情報取得
  try {
    const live = await fetchLive();
    const livePath = path.join(OUTPUT_DIR, "gagagasp-live.json");
    fs.writeFileSync(livePath, JSON.stringify(live, null, 2), "utf-8");
    console.log(`  ✅ ライブ情報: ${live.length}件 → ${livePath}`);
  } catch (err) {
    console.error("  ❌ ライブ情報取得失敗:", err);
  }

  console.log("[ガガガSP] 完了");
}

export default main;

// 直接実行時
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
