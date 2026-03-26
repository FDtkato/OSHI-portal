# 推しポータル 詳細設計書

| 項目 | 内容 |
|------|------|
| プロジェクト名 | 推しポータル (oshi-portal) |
| バージョン | 0.0.1 |
| 作成日 | 2026-03-25 |
| 最終更新日 | 2026-03-26 |

---

## 1. システム概要

### 1.1 目的

複数アーティスト（タイガーリー、ガガガSP）の公式情報・ライブ情報・SNS投稿を一画面で確認できるファン向け非公式ポータルサイトを提供する。

### 1.2 システム構成図

```
┌──────────────────────────────────────────────────────────────────────┐
│                        GitHub Actions (CI/CD)                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐    │
│  │ fetch-all.ts │───▶│ Astro Build  │───▶│ GitHub Pages Deploy  │    │
│  │  (6h cron)   │    │ (SSG)        │    │ (静的HTML配信)        │    │
│  └──────┬───────┘    └──────────────┘    └──────────────────────┘    │
│         │                                                            │
│  ┌──────┴──────────────────────┐                                     │
│  │  ┌────────────────────────┐ │                                     │
│  │  │ fetch-gagagasp.ts      │ │  → gagagasp-news.json               │
│  │  │ (rss-parser + cheerio) │ │  → gagagasp-live.json               │
│  │  └────────────────────────┘ │                                     │
│  │  ┌────────────────────────┐ │                                     │
│  │  │ fetch-tigerlee.ts      │ │  → tigerlee-news.json               │
│  │  │ (Puppeteer)            │ │  → tigerlee-live.json               │
│  │  └────────────────────────┘ │                                     │
│  └─────────────────────────────┘                                     │
└──────────────────────────────────────────────────────────────────────┘

外部データソース:
  ┌─────────────────┐    ┌─────────────────┐
  │ gagagasp.jp     │    │ tigerlee.ryzm.jp│
  │ (WordPress)     │    │ (SPA / ryzm)    │
  │ - RSS Feed      │    │ - JS Rendered   │
  │ - HTML          │    │                 │
  └─────────────────┘    └─────────────────┘

ブラウザ埋め込み（クライアントサイド）:
  ┌─────────────────┐    ┌─────────────────┐
  │ X (Twitter)     │    │ Instagram       │
  │ Embed Widget    │    │ Profile Link    │
  └─────────────────┘    └─────────────────┘
```

### 1.3 技術スタック

| カテゴリ | 技術 | バージョン | 用途 |
|---------|------|-----------|------|
| フレームワーク | Astro | v6.0.8 | 静的サイトジェネレーター (SSG) |
| CSS | Tailwind CSS | v4.2.2 | ユーティリティファーストCSS |
| Tailwind統合 | @tailwindcss/vite | v4.2.2 | Viteプラグイン経由でTailwindを統合 |
| HTML解析 | cheerio | v1.2.0 | サーバーサイドHTMLスクレイピング |
| RSS解析 | rss-parser | v3.13.0 | RSSフィード解析 |
| ブラウザ自動化 | Puppeteer | v24.40.0 | SPA対応ヘッドレスChrome |
| TypeScript実行 | tsx | v4.21.0 | スクリプトのTS直接実行 |
| 型チェック | @astrojs/check | v0.9.8 | Astroテンプレートの型検証 |
| 言語 | TypeScript | v5.9.3 | 型安全な開発 |
| CI/CD | GitHub Actions | — | 自動データ取得・ビルド・デプロイ |
| ホスティング | GitHub Pages | — | 静的サイト配信 |

---

## 2. ディレクトリ構造

```
推しポータル/
├── .github/
│   └── workflows/
│       └── fetch-and-deploy.yml   # CI/CDワークフロー定義
├── public/                        # 静的アセット（favicon等）
├── scripts/                       # データ取得スクリプト（ビルド時実行）
│   ├── fetch-all.ts               # 全アーティストデータ取得のエントリポイント
│   ├── fetch-gagagasp.ts          # ガガガSP データ取得
│   └── fetch-tigerlee.ts          # タイガーリー データ取得
├── src/
│   ├── components/                # UIコンポーネント
│   │   ├── ArtistTabs.astro       # アーティスト切替タブ
│   │   ├── InstagramFeed.astro    # Instagramリンクカード
│   │   ├── LiveSection.astro      # ライブ情報セクション
│   │   ├── NewsSection.astro      # ニュースセクション
│   │   └── XTimeline.astro        # X(Twitter)タイムライン埋め込み
│   ├── data/
│   │   ├── artists.ts             # アーティスト情報の型定義・マスター定義
│   │   └── generated/             # データ取得スクリプトの出力先
│   │       ├── gagagasp-live.json  # ガガガSP ライブ情報
│   │       ├── gagagasp-news.json  # ガガガSP ニュース
│   │       ├── tigerlee-live.json  # タイガーリー ライブ情報
│   │       └── tigerlee-news.json  # タイガーリー ニュース
│   ├── layouts/
│   │   └── Layout.astro           # 共通HTMLレイアウト
│   ├── pages/
│   │   └── index.astro            # メインダッシュボードページ
│   └── styles/
│       └── global.css             # グローバルCSS（Tailwind読み込み）
├── astro.config.mjs               # Astro設定
├── package.json                   # プロジェクト定義・依存関係
└── tsconfig.json                  # TypeScript設定
```

---

## 3. データモデル設計

### 3.1 型定義一覧

#### Artist インターフェース

アーティストのマスター情報を定義する。

```typescript
interface Artist {
  id: string;              // 一意識別子（例: "tigerlee", "gagagasp"）
  name: string;            // 表示名（例: "タイガーリー"）
  officialUrl: string;     // 公式サイトURL
  liveUrl: string;         // ライブ情報ページURL
  xHandle: string;         // X(Twitter)ハンドル名（@なし）
  instagramHandle: string; // Instagramハンドル名
  color: string;           // テーマカラー（HEXコード）
  fetchType: "rss" | "puppeteer"; // データ取得方式
  rssUrl?: string;         // RSSフィードURL（fetchType="rss"の場合のみ）
}
```

#### NewsItem インターフェース

ニュース/お知らせ1件を表すデータ構造。

```typescript
interface NewsItem {
  title: string;     // 記事タイトル
  url: string;       // 記事URL
  date: string;      // 公開日（YYYY-MM-DD形式）
  category?: string; // カテゴリ（例: "NEWS", "メディア"）※省略可
}
```

#### LiveItem インターフェース

ライブ/イベント1件を表すデータ構造。

```typescript
interface LiveItem {
  title: string;   // 公演タイトル
  url: string;     // 詳細ページURL
  date: string;    // 開催日（YYYY-MM-DD形式）
  venue?: string;  // 会場名（例: "【兵庫】MUSIC ZOO KOBE 太陽と虎"）※省略可
}
```

### 3.2 アーティストマスターデータ

| ID | 名前 | 公式サイト | テーマカラー | 取得方式 | Xハンドル | Instagramハンドル |
|----|------|-----------|-------------|---------|----------|------------------|
| tigerlee | タイガーリー | https://tigerlee.ryzm.jp/ | `#e85d04` | puppeteer | tigerlee0620 | tgl___official |
| gagagasp | ガガガSP | https://gagagasp.jp/ | `#d90429` | rss | ga3sp_official | ga3sp_official |

### 3.3 生成データ（JSONファイル）

データ取得スクリプトにより `src/data/generated/` 配下に出力される。

| ファイル名 | 型 | 内容 |
|-----------|-----|------|
| `{artistId}-news.json` | `NewsItem[]` | アーティストのニュース一覧 |
| `{artistId}-live.json` | `LiveItem[]` | アーティストのライブ情報一覧 |

**命名規則:** `{artistId}-{データ種別}.json`

**出力例 (gagagasp-news.json):**
```json
[
  {
    "title": "にんげんっていいな/My First Kissアナログ7inchレコードリリース決定",
    "url": "https://gagagasp.jp/blog/archives/6126",
    "date": "2026-03-06",
    "category": "NEWS"
  }
]
```

**出力例 (gagagasp-live.json):**
```json
[
  {
    "title": "【愛媛】Hi BACK PACK SPECIAL@松山W studio RED",
    "url": "https://gagagasp.jp/events/event-6083",
    "date": "2026-03-28",
    "venue": "【愛媛】松山W studio RED"
  }
]
```

---

## 4. データ取得スクリプト設計

### 4.1 全体フロー

```
npm run fetch (tsx scripts/fetch-all.ts)
    │
    ├── fetchGagagasp()   → gagagasp-news.json, gagagasp-live.json
    │
    └── fetchTigerlee()   → tigerlee-news.json, tigerlee-live.json
    │
    └── 結果サマリー出力 → 失敗時は exit(1)
```

### 4.2 fetch-all.ts（エントリポイント）

| 項目 | 内容 |
|------|------|
| ファイルパス | `scripts/fetch-all.ts` |
| 実行方法 | `npm run fetch` (`tsx scripts/fetch-all.ts`) |
| 役割 | 全アーティストのデータ取得を順次実行し、結果をサマリー出力する |

**処理フロー:**

1. `fetchGagagasp()` を実行（成功/失敗を記録）
2. `fetchTigerlee()` を実行（成功/失敗を記録）
3. 結果サマリーをコンソール出力
4. 1件でも失敗した場合は `process.exit(1)` で異常終了

**エラーハンドリング:**
- 各アーティストの取得は独立して実行
- 一方が失敗しても他方は続行する
- 最終的に失敗があれば exit code 1 を返す

### 4.3 fetch-gagagasp.ts（ガガガSP）

| 項目 | 内容 |
|------|------|
| ファイルパス | `scripts/fetch-gagagasp.ts` |
| 取得方式 | RSS (rss-parser) + HTML スクレイピング (cheerio) |
| 対象サイト | https://gagagasp.jp/ (WordPress v6.5.8) |

#### 4.3.1 ニュース取得 (`fetchNews`)

| 項目 | 内容 |
|------|------|
| データソース | `https://gagagasp.jp/feed/` (RSS 2.0) |
| 使用ライブラリ | rss-parser |
| 出力ファイル | `src/data/generated/gagagasp-news.json` |

**処理フロー:**

1. `rss-parser` で RSS フィード (`https://gagagasp.jp/feed/`) を取得・解析
2. 各フィードアイテムから以下を抽出:
   - `title` ← `item.title`
   - `url` ← `item.link`
   - `date` ← `item.pubDate` を `YYYY-MM-DD` 形式に変換
   - `category` ← `item.categories[0]`（存在する場合）
3. `NewsItem[]` として JSON ファイルに書き出し

#### 4.3.2 ライブ情報取得 (`fetchLive`)

| 項目 | 内容 |
|------|------|
| データソース | `https://gagagasp.jp/` (トップページ HTML) |
| 使用ライブラリ | cheerio (HTMLスクレイピング), Node.js fetch |
| 出力ファイル | `src/data/generated/gagagasp-live.json` |

**処理フロー:**

1. `fetch()` でトップページの HTML を取得
2. cheerio で DOM を解析
3. `a[href*='/events/event-']` セレクタでライブ情報リンクを抽出
4. 各要素から以下を抽出:
   - `title` ← リンクテキスト
   - `url` ← `href` 属性（相対パスの場合は絶対URLに変換）
   - `date` ← 親要素のテキストから `YYYY年MM月DD日` パターンを正規表現で抽出し `YYYY-MM-DD` に変換
   - `venue` ← タイトル/テキスト内の `@` 以降や `【地名】`、`（地名）` パターンから抽出
5. URL ベースで重複を除去
6. `LiveItem[]` として JSON ファイルに書き出し

**会場名抽出ロジック:**

```
入力テキストパターン                                    → 抽出結果
-----------------------------------------------------------------------
"【愛媛】Hi BACK PACK SPECIAL@松山W studio RED"        → 【愛媛】松山W studio RED
"【ツアー】青春謳歌ワンマンツアー@アウトライン（福島）"     → 【福島】アウトライン
"イベント名@会場名"                                     → 会場名
```

- `【...】` 内が「ツアー」以外の場合は地名として扱う
- `（...）` 内のテキストは地域情報として `【】` 付きで付与
- `@` 以降を会場名として抽出

### 4.4 fetch-tigerlee.ts（タイガーリー）

| 項目 | 内容 |
|------|------|
| ファイルパス | `scripts/fetch-tigerlee.ts` |
| 取得方式 | Puppeteer（ヘッドレスChrome） |
| 対象サイト | https://tigerlee.ryzm.jp/ (JavaScript SPA) |
| Puppeteer理由 | ryzm.jp は SPA のため通常のHTTPリクエストではコンテンツ取得不可 |

**Puppeteer起動オプション:**

```typescript
{
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
}
```

#### 4.4.1 ニュース取得 (`fetchNews`)

| 項目 | 内容 |
|------|------|
| 対象URL | `https://tigerlee.ryzm.jp/news` |
| 待機条件 | `networkidle2`（ネットワークリクエストが2件以下になるまで待機） |
| タイムアウト | 30秒 |
| 出力ファイル | `src/data/generated/tigerlee-news.json` |

**ryzm.jp ニュースページの DOM 構造:**

```html
<div class="box">
  <img src="...">
  <h4>タイトル</h4>
  <p>本文抜粋...</p>
  <p class="date">YYYY/MM/DD (Day)</p>
  <a href="/news/{UUID}"></a>
</div>
```

**処理フロー:**

1. Puppeteer でブラウザを起動
2. `https://tigerlee.ryzm.jp/news` にアクセス（`networkidle2` で待機）
3. `page.evaluate()` でブラウザ内DOM操作:
   - `div.box` セレクタで各ニュースカードを取得
   - `h4` → タイトル
   - `p.date` → 日付（`YYYY/MM/DD (Day)` → `YYYY-MM-DD` に変換）
   - `a[href*="/news/"]` → 詳細URL（相対パスを絶対URLに変換）
4. `NewsItem[]` として JSON ファイルに書き出し
5. ブラウザを close（`finally` ブロックで確実に実行）

#### 4.4.2 ライブ情報取得 (`fetchLive`)

| 項目 | 内容 |
|------|------|
| 対象URL | `https://tigerlee.ryzm.jp/live` |
| 待機条件 | `networkidle2` |
| タイムアウト | 30秒 |
| 出力ファイル | `src/data/generated/tigerlee-live.json` |

**ryzm.jp ライブページの DOM 構造:**

```html
<ul class="live_list">
  <li>
    <a href="/live/{UUID}">
      <ul class="tableview">
        <li class="w30 date">YYYY/MM/DD (Day)</li>
        <li class="w45 live_title"><h4>イベント名</h4></li>
        <li class="w25 venue"><p>会場名</p></li>
      </ul>
    </a>
  </li>
</ul>
```

**処理フロー:**

1. Puppeteer でブラウザを起動
2. `https://tigerlee.ryzm.jp/live` にアクセス（`networkidle2` で待機）
3. `page.evaluate()` でブラウザ内DOM操作:
   - `ul.live_list > li` でライブ情報の各行を取得
   - カテゴリフィルタリンク（`?category_id=...`）は除外し、`/live/{UUID}` のみ対象
   - `li.date` → 日付（`YYYY/MM/DD (Day)` → `YYYY-MM-DD` に変換）
   - `li.live_title h4` → イベントタイトル
   - `li.venue p` → 会場名
   - 相対パスを絶対URLに変換
4. `LiveItem[]` として JSON ファイルに書き出し
5. ブラウザを close

### 4.5 出力先ディレクトリ

| 定数 | 値 |
|------|---|
| `OUTPUT_DIR` | `scripts/../src/data/generated/`（`__dirname` からの相対パス） |

ディレクトリが存在しない場合は `fs.mkdirSync(OUTPUT_DIR, { recursive: true })` で作成する。

---

## 5. UIコンポーネント設計

### 5.1 コンポーネント構成図

```
Layout.astro
└── index.astro
    ├── ArtistTabs.astro (sticky nav)
    ├── [artist ごとにループ]
    │   ├── ヘッダーバナー (inline)
    │   ├── NewsSection.astro
    │   ├── LiveSection.astro
    │   ├── XTimeline.astro
    │   └── InstagramFeed.astro
    └── フッター (inline)
```

### 5.2 Layout.astro（共通レイアウト）

| 項目 | 内容 |
|------|------|
| ファイルパス | `src/layouts/Layout.astro` |
| 役割 | 全ページ共通の HTML 骨格を提供 |

**Props:**

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| title | `string` | ページタイトル（`<title>` タグに反映） |

**機能:**
- HTML5 doctype、`lang="ja"`
- viewport メタタグ（レスポンシブ対応）
- description メタタグ
- favicon 設定
- Tailwind CSS v4のインポート（`global.css` 経由）
- ダークテーマ基本背景色: `bg-gray-950 text-gray-100`
- `<slot />` で子コンテンツを受け取る

### 5.3 ArtistTabs.astro（タブ切替ナビゲーション）

| 項目 | 内容 |
|------|------|
| ファイルパス | `src/components/ArtistTabs.astro` |
| 役割 | アーティスト切替用タブUI |
| 表示位置 | sticky（画面上部に固定: `sticky top-0 z-50`） |

**Props:** なし（`artists` データを直接インポート）

**UI仕様:**
- ロゴ: 🎸 推しポータル
- 各アーティスト名をボタンとして表示
- アクティブタブ: `bg-white/10 text-white`
- 非アクティブタブ: `text-gray-400`、hover時 `text-gray-200 bg-white/5`
- 初期表示: 1番目のアーティストがアクティブ
- ナビゲーション背景: `bg-gray-900/95 backdrop-blur`（半透明ブラー効果）
- 横方向スクロール対応: `overflow-x-auto`

**クライアントサイドスクリプト:**

```
イベント: DOMContentLoaded
リスナー: 各タブボタンの click

処理:
  1. クリックされたタブの data-artist-id を取得
  2. 全タブのスタイルを非アクティブ状態にリセット
  3. クリックされたタブをアクティブスタイルに変更
  4. data-artist-section 属性で該当アーティストのセクションを表示
  5. 他のアーティストセクションに hidden クラスを付与して非表示化
```

### 5.4 NewsSection.astro（ニュースセクション）

| 項目 | 内容 |
|------|------|
| ファイルパス | `src/components/NewsSection.astro` |
| 役割 | ニュース/お知らせの一覧表示 |

**Props:**

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| items | `NewsItem[]` | ニュース記事の配列 |
| officialUrl | `string` | 公式サイトへのリンク |
| color | `string` | アーティストのテーマカラー（HEXコード） |

**UI仕様:**
- セクションヘッダー: 📢 お知らせ（右側に「公式サイト →」リンク）
- データなし時: 「お知らせはまだ取得されていません。」を中央表示
- 各記事カード:
  - 左端にテーマカラーの縦ライン（`width: 1px`、高さ可変）
  - 日付（`tabular-nums` で等幅数字）
  - カテゴリバッジ（存在する場合のみ表示、`bg-white/5` 背景）
  - 記事タイトル
  - 右端に「↗」リンクアイコン
  - カード全体がリンク（`target="_blank"`, `rel="noopener noreferrer"`）
  - ホバー時: ボーダーハイライト・テキスト色変化（`transition-all`）

### 5.5 LiveSection.astro（ライブ情報セクション）

| 項目 | 内容 |
|------|------|
| ファイルパス | `src/components/LiveSection.astro` |
| 役割 | ライブ/イベント情報の表示（今後/過去の自動分類） |

**Props:**

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| items | `LiveItem[]` | ライブ情報の配列 |
| liveUrl | `string` | ライブ一覧ページへのリンク |
| color | `string` | アーティストのテーマカラー |

**ライブ分類ロジック:**

```
today = new Date().toISOString().slice(0, 10)  // "YYYY-MM-DD"

upcoming = items.filter(item => item.date >= today)  // 今日以降
past     = items.filter(item => item.date < today)   // 今日より前
```

**UI仕様:**
- セクションヘッダー: 🎤 ライブ情報（右側に「すべてのライブ →」リンク）
- データなし時: 「ライブ情報はまだ取得されていません。」
- **今後のライブ (upcoming):**
  - 日付バッジ: 上段に月（テーマカラー背景、白文字）、下段に日（`bg-white/10`）
  - タイトル（太字）
  - 会場名（📍 アイコン付き、存在する場合のみ）
  - ホバーエフェクト付きカード
- **過去のライブ (past):**
  - `<details>` 要素で折りたたみ表示
  - サマリー: 「過去のライブ ({n}件)」
  - `opacity-50` で控えめな表示
  - 各項目: 日付 — タイトル（簡易表示）

### 5.6 XTimeline.astro（Xタイムライン）

| 項目 | 内容 |
|------|------|
| ファイルパス | `src/components/XTimeline.astro` |
| 役割 | X(Twitter)のタイムラインウィジェットを埋め込み表示 |

**Props:**

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| handle | `string` | Xのユーザーハンドル（@なし） |

**UI仕様:**
- セクションヘッダー: 𝕏 最新ポスト
- X公式埋め込みウィジェットを使用
- ウィジェット設定:
  - テーマ: `dark`
  - Chrome: `noheader nofooter noborders transparent`
  - ツイート表示数: 5件（`data-tweet-limit="5"`）
  - 高さ: 480px
- 読み込み中テキスト: `@{handle} のポストを読み込み中...`

**外部スクリプト読み込み:**
- `https://platform.twitter.com/widgets.js` を動的ロード
- 重複読み込み防止: `id="twitter-wjs"` で存在チェック
- `is:inline` 属性でAstroのスクリプト最適化をバイパス

### 5.7 InstagramFeed.astro（Instagramフィード）

| 項目 | 内容 |
|------|------|
| ファイルパス | `src/components/InstagramFeed.astro` |
| 役割 | Instagramプロフィールへのリンクカード表示 |

**Props:**

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| handle | `string` | Instagramのユーザーハンドル |

**UI仕様:**
- セクションヘッダー: 📸 Instagram
- Instagramアイコン（SVG）とハンドル名を表示
- グラデーション背景（Instagram ブランドカラー: 紫→ピンク→オレンジ）
- 説明文: 「Instagramの投稿はプロフィールページでご覧ください」
- CTAボタン:「Instagramを見る ↗」
  - グラデーション背景: `from-purple-600 via-pink-600 to-orange-500`
  - ホバー時: `opacity-90`
- リンク先: `https://www.instagram.com/{handle}/`

> **設計判断:** Instagram API の制約（認証・Token管理の複雑さ）のため、埋め込み表示ではなくプロフィールリンク方式を採用。

---

## 6. ページ設計

### 6.1 index.astro（メインダッシュボード）

| 項目 | 内容 |
|------|------|
| ファイルパス | `src/pages/index.astro` |
| ルート | `/` |
| レイアウト | `Layout.astro` |
| ページタイトル | 推しポータル |

**データフロー:**

```
src/data/generated/*.json
    │  (JSONインポート)
    ▼
index.astro (フロントマター)
    │  artistData: Record<string, { news: NewsItem[]; live: LiveItem[] }>
    ▼
各コンポーネントへ Props として配信
```

**ページ構成:**

```
┌─────────────────────────────────────────┐
│ ArtistTabs (sticky nav)                  │
├─────────────────────────────────────────┤
│ ヘッダーバナー                             │
│  アーティスト名 (テーマカラー)              │
│  最終更新日時 | [公式サイト]               │
├────────────────────┬────────────────────┤
│ 左カラム            │ 右カラム             │
│  ┌──────────────┐  │  ┌──────────────┐  │
│  │ NewsSection  │  │  │ XTimeline    │  │
│  └──────────────┘  │  └──────────────┘  │
│  ┌──────────────┐  │  ┌──────────────┐  │
│  │ LiveSection  │  │  │ InstagramFeed│  │
│  └──────────────┘  │  └──────────────┘  │
├────────────────────┴────────────────────┤
│ フッター                                 │
│ 推しポータル — ファンのための非公式情報集約サイト │
└─────────────────────────────────────────┘
```

**レスポンシブ対応:**
- モバイル (`< lg`): 1カラム表示（左カラム→右カラムが縦に並ぶ）
- デスクトップ (`lg` 以上): 2カラムグリッド表示（`grid-cols-1 lg:grid-cols-2`）

**アーティスト切替:**
- `artists` 配列を `map` でループし、各アーティストのセクションを生成
- 初期表示: 1番目のアーティスト（`i !== 0 && "hidden"`）
- `data-artist-section` 属性でArtistTabsのスクリプトと連携

**最終更新日時:**
- ビルド時の `new Date()` から生成（`Asia/Tokyo` タイムゾーン）
- 表示形式: `YYYY/MM/DD HH:mm`

---

## 7. スタイル設計

### 7.1 CSS構成

| ファイル | 内容 |
|---------|------|
| `src/styles/global.css` | `@import "tailwindcss";`（Tailwind v4 のエントリポイント） |

- Tailwind CSS v4 を `@tailwindcss/vite` プラグイン経由で統合
- `global.css` はAstroフロントマターの `import` 文で読み込み（`<style is:global>` 内の `@import` はPostCSSエラーとなるため回避）

### 7.2 デザインシステム

#### カラーパレット

| 用途 | クラス/値 | 説明 |
|------|----------|------|
| 背景 (ページ) | `bg-gray-950` | 最も暗いグレー |
| 背景 (ナビ) | `bg-gray-900/95` | 半透明ダークナビ |
| 背景 (カード) | `bg-gray-800/50` | 半透明カード |
| テキスト (メイン) | `text-gray-100` | メインテキスト |
| テキスト (サブ) | `text-gray-400` / `text-gray-500` | 補助テキスト |
| ボーダー | `border-gray-700/50` / `border-gray-800` | カード・区切り線 |
| タイガーリー | `#e85d04` | アーティストテーマカラー |
| ガガガSP | `#d90429` | アーティストテーマカラー |

#### 共通パターン

| パターン | クラス構成 |
|---------|-----------|
| カード | `bg-gray-800/50 rounded-xl border border-gray-700/50` |
| ホバーカード | `hover:border-gray-600 hover:bg-gray-800 transition-all` |
| バッジ | `text-xs px-2 py-0.5 rounded-full bg-white/5` |
| リンクボタン | `px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-lg` |
| セクション間隔 | `space-y-6` |
| コンテンツ幅 | `max-w-7xl mx-auto px-4` |

---

## 8. CI/CD 設計

### 8.1 ワークフロー概要

| 項目 | 内容 |
|------|------|
| ファイルパス | `.github/workflows/fetch-and-deploy.yml` |
| ワークフロー名 | Fetch Data & Deploy |

### 8.2 トリガー条件

| トリガー | 条件 | 説明 |
|---------|------|------|
| schedule (cron) | `0 0,6,12,18 * * *` | 6時間ごと（JST: 9:00, 15:00, 21:00, 3:00） |
| workflow_dispatch | — | 手動トリガー |
| push | `branches: [main]` | main ブランチへの push |

### 8.3 パーミッション

| スコープ | 権限 |
|---------|------|
| contents | write |
| pages | write |
| id-token | write |

### 8.4 並行制御

```yaml
concurrency:
  group: "pages"
  cancel-in-progress: true
```

同一グループのワークフローが実行中の場合、進行中のものをキャンセルして新しいものを実行する。

### 8.5 ジョブステップ

| # | ステップ名 | 内容 | エラー時の動作 |
|---|-----------|------|--------------|
| 1 | Checkout | `actions/checkout@v4` でソース取得 | 失敗で停止 |
| 2 | Setup Node.js | `actions/setup-node@v4` (Node 22, npm キャッシュ) | 失敗で停止 |
| 3 | Install dependencies | `npm ci` | 失敗で停止 |
| 4 | Fetch artist data | `npx tsx scripts/fetch-all.ts` | **続行** (`continue-on-error: true`) |
| 5 | Build Astro site | `npm run build` | 失敗で停止 |
| 6 | Upload Pages artifact | `actions/upload-pages-artifact@v3` (dist/) | 失敗で停止 |
| 7 | Deploy to GitHub Pages | `actions/deploy-pages@v4` (id: deploy) | 失敗で停止 |

**environment 設定:**

```yaml
environment:
  name: github-pages
  url: ${{ steps.deploy.outputs.page_url }}
```

> **設計判断:** データ取得ステップ（#4）は `continue-on-error: true` としている。これにより、外部サイトの一時的な障害時でも既存のJSONデータを使ってビルド・デプロイが継続される。

> **Node.js バージョン:** Astro v6 は `>=22.12.0` を要求するため、Node.js 22 を使用する。

---

## 9. ビルド・デプロイ設計

### 9.1 Astro設定

| 項目 | 値 | 説明 |
|------|---|------|
| site | `https://FDtkato.github.io` | デプロイ先サイトURL |
| base | `/OSHI-portal` | GitHub Pages サブパス |
| output | static (デフォルト) | 静的サイト生成 |
| Viteプラグイン | `@tailwindcss/vite` | Tailwind CSS v4 統合 |

### 9.2 TypeScript設定

| 項目 | 値 |
|------|---|
| extends | `astro/tsconfigs/strict` |
| baseUrl | `.` |
| パスエイリアス | `@/*` → `src/*` |

### 9.3 npm スクリプト

| コマンド | 実行内容 | 用途 |
|---------|---------|------|
| `npm run dev` | `astro dev` | 開発サーバー起動 |
| `npm run build` | `astro build` | 本番ビルド |
| `npm run preview` | `astro preview` | ビルド結果プレビュー |
| `npm run fetch` | `tsx scripts/fetch-all.ts` | データ取得実行 |

### 9.4 デプロイフロー

```
[トリガー発火]
    │
    ▼
[npm ci] 依存関係インストール
    │
    ▼
[tsx scripts/fetch-all.ts] データ取得 → src/data/generated/*.json 更新
    │ (失敗しても続行)
    ▼
[astro build] 静的HTML生成 → dist/ 出力
    │
    ▼
[Upload artifact] dist/ を Pages アーティファクトとしてアップロード
    │
    ▼
[Deploy] GitHub Pages にデプロイ
```

---

## 10. 拡張設計

### 10.1 アーティスト追加手順

新しいアーティストを追加する場合の手順:

1. **`src/data/artists.ts`** に `Artist` オブジェクトを追加
2. **`scripts/fetch-{artistId}.ts`** にデータ取得スクリプトを新規作成
3. **`scripts/fetch-all.ts`** に新スクリプトの呼び出しを追加
4. **`src/pages/index.astro`** に新アーティストの JSON インポートと `artistData` への追加
5. **`src/data/generated/{artistId}-news.json`**, **`{artistId}-live.json`** の初期ファイル（空配列 `[]`）を作成

**`fetchType` による取得方式の分岐:**
- `"rss"`: rss-parser + cheerio を使用（WordPress等のRSS対応サイト向け）
- `"puppeteer"`: Puppeteer を使用（SPA/JavaScript レンダリングサイト向け）

### 10.2 現在の制約事項

| 制約 | 内容 | 影響 |
|------|------|------|
| Instagram | API 未使用、プロフィールリンクのみ | 投稿の埋め込み表示不可 |
| X (Twitter) | 公式埋め込みウィジェット依存 | ウィジェット仕様変更時に影響を受ける |
| タイガーリー | ryzm.jp の DOM 構造に依存（`div.box`, `ul.live_list` 等） | サイトリニューアル時にスクレイピング修正が必要 |
| ガガガSP | トップページの HTML 構造に依存 | イベントページ (`/event`) は 429 エラーのため使用不可 |
| ビルド時データ | SSG のため最大6時間のデータ遅延 | リアルタイム性は限定的 |
