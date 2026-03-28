import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { XPost } from "../src/data/artists";
import { artists } from "../src/data/artists";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "src", "data", "generated");

/**
 * Twitter Syndication API の __NEXT_DATA__ からポストを取得
 * Puppeteer不要 — fetch のみで動作
 */
async function fetchXPosts(handle: string): Promise<XPost[]> {
  const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`;
  console.log(`  [X] ${url} にアクセス中...`);

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; OshiPortal/1.0)" },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const html = await res.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s
  );

  if (!match) {
    console.warn("  [X] __NEXT_DATA__ が見つかりません");
    return [];
  }

  const data = JSON.parse(match[1]);
  const entries = data.props?.pageProps?.timeline?.entries || [];

  const posts: XPost[] = [];
  for (const entry of entries) {
    if (entry.type !== "tweet") continue;
    const tw = entry.content?.tweet;
    if (!tw?.text) continue;

    // t.co リンクを除去してテキストをクリーンアップ
    const cleanText = tw.text
      .replace(/https?:\/\/t\.co\/\S+/g, "")
      .trim();

    if (!cleanText) continue;

    // created_at → YYYY-MM-DD
    const date = tw.created_at
      ? new Date(tw.created_at).toISOString().slice(0, 10)
      : "";

    const screenName = tw.user?.screen_name || handle;
    const tweetId = tw.conversation_id_str || entry.entry_id?.replace("tweet-", "");

    posts.push({
      text: cleanText,
      url: `https://x.com/${screenName}/status/${tweetId}`,
      date,
    });
  }

  console.log(`  [X] ${posts.length}件のポストを取得`);
  return posts.slice(0, 5);
}

export default async function fetchAllXPosts() {
  console.log("[X] ポスト取得開始");

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const artist of artists) {
    try {
      const posts = await fetchXPosts(artist.xHandle);
      const outputPath = path.join(OUTPUT_DIR, `${artist.id}-x-posts.json`);
      fs.writeFileSync(outputPath, JSON.stringify(posts, null, 2), "utf-8");
      console.log(`  [X] ${artist.name}: ${outputPath} に保存 (${posts.length}件)`);
    } catch (err) {
      console.error(`  [X] ${artist.name}: 取得失敗`, err);
      // 失敗時は空配列を書き込み（既存データがあればそのまま）
      const outputPath = path.join(OUTPUT_DIR, `${artist.id}-x-posts.json`);
      if (!fs.existsSync(outputPath)) {
        fs.writeFileSync(outputPath, "[]", "utf-8");
      }
    }
  }

  console.log("[X] ポスト取得完了");
}

// 直接実行時
const isMain = process.argv[1]?.includes("fetch-x-posts");
if (isMain) {
  fetchAllXPosts().catch(console.error);
}
