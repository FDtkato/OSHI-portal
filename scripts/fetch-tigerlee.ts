import puppeteer from "puppeteer";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { NewsItem, LiveItem } from "../src/data/artists";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "src", "data", "generated");

/**
 * タイガーリーのお知らせを ryzm.jp/news からPuppeteerで取得
 *
 * DOM構造:
 *   div.box
 *     img
 *     h4          — タイトル
 *     p           — 本文抜粋
 *     p.date      — 日付 "YYYY/MM/DD (Day)"
 *     a[href]     — 詳細リンク "/news/{UUID}"
 */
async function fetchNews(): Promise<NewsItem[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto("https://tigerlee.ryzm.jp/news", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    const news = await page.evaluate(() => {
      const items: { title: string; url: string; date: string }[] = [];
      const cards = document.querySelectorAll("div.box");

      cards.forEach((card) => {
        const titleEl = card.querySelector("h4");
        const dateEl = card.querySelector("p.date");
        const linkEl = card.querySelector('a[href*="/news/"]');
        if (!titleEl || !linkEl) return;

        const title = titleEl.textContent?.trim() ?? "";
        const href = (linkEl as HTMLAnchorElement).getAttribute("href") ?? "";
        const url = href.startsWith("http")
          ? href
          : `https://tigerlee.ryzm.jp${href}`;

        // 日付: "YYYY/MM/DD (Day)" → "YYYY-MM-DD"
        const dateText = dateEl?.textContent?.trim() ?? "";
        const m = dateText.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
        const date = m
          ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
          : "";

        if (title) {
          items.push({ title, url, date });
        }
      });

      return items;
    });

    return news;
  } finally {
    await browser.close();
  }
}

/**
 * タイガーリーのライブ情報を ryzm.jp/live からPuppeteerで取得
 *
 * DOM構造:
 *   ul.live_list > li > a[href="/live/{UUID}"]
 *     ul.tableview
 *       li.date        — "YYYY/MM/DD (Day)"
 *       li.live_title  — h4 にイベント名
 *       li.venue       — p に会場名
 */
async function fetchLive(): Promise<LiveItem[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto("https://tigerlee.ryzm.jp/live", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    const live = await page.evaluate(() => {
      const items: { title: string; url: string; date: string; venue?: string }[] = [];
      const rows = document.querySelectorAll("ul.live_list > li");

      rows.forEach((row) => {
        const anchor = row.querySelector("a");
        if (!anchor) return;

        const href = anchor.getAttribute("href") ?? "";
        // カテゴリフィルタリンク（?category_id=...）を除外
        if (!href.includes("/live/")) return;

        const url = href.startsWith("http")
          ? href
          : `https://tigerlee.ryzm.jp${href}`;

        // 日付: li.date → "YYYY/MM/DD (Day)" → "YYYY-MM-DD"
        const dateEl = anchor.querySelector("li.date");
        const dateText = dateEl?.textContent?.trim() ?? "";
        const m = dateText.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
        const date = m
          ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
          : "";

        // タイトル: li.live_title h4
        const titleEl = anchor.querySelector("li.live_title h4");
        const title = titleEl?.textContent?.trim() ?? "";

        // 会場: li.venue p
        const venueEl = anchor.querySelector("li.venue p");
        const venue = venueEl?.textContent?.trim() ?? undefined;

        if (title) {
          items.push({ title, url, date, venue });
        }
      });

      return items;
    });

    // 重複削除
    const seen = new Set<string>();
    return live.filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
  } finally {
    await browser.close();
  }
}

/**
 * メインエントリーポイント
 */
async function main() {
  console.log("[タイガーリー] データ取得開始...");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // お知らせ取得
  try {
    const news = await fetchNews();
    const newsPath = path.join(OUTPUT_DIR, "tigerlee-news.json");
    fs.writeFileSync(newsPath, JSON.stringify(news, null, 2), "utf-8");
    console.log(`  ✅ お知らせ: ${news.length}件 → ${newsPath}`);
  } catch (err) {
    console.error("  ❌ お知らせ取得失敗:", err);
  }

  // ライブ情報取得
  try {
    const live = await fetchLive();
    const livePath = path.join(OUTPUT_DIR, "tigerlee-live.json");
    fs.writeFileSync(livePath, JSON.stringify(live, null, 2), "utf-8");
    console.log(`  ✅ ライブ情報: ${live.length}件 → ${livePath}`);
  } catch (err) {
    console.error("  ❌ ライブ情報取得失敗:", err);
  }

  console.log("[タイガーリー] 完了");
}

export default main;

// 直接実行時
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
