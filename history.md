# 推しポータル 開発履歴

## プロジェクト概要

複数アーティスト（タイガーリー、ガガガSP）の公式情報・ライブ情報・SNS投稿を一画面で確認できるファンポータルサイト。

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Astro v6（静的サイトジェネレーター） |
| CSS | Tailwind CSS v4（@tailwindcss/vite プラグイン経由） |
| データ取得 | rss-parser, cheerio, Puppeteer |
| スクリプト実行 | tsx (TypeScript) |
| CI/CD | GitHub Actions（6時間おきのcron） |
| デプロイ先 | GitHub Pages |

## 開発経緯

### 1. 要件定義

- **対象アーティスト**: タイガーリー、ガガガSP（将来的に追加可能）
- **表示情報**: 公式お知らせ、ライブ情報、X投稿、Instagram投稿
- **アーティスト切替**: タブ切替方式
- **SNS連携方式**: ハイブリッド（埋め込みウィジェット + GitHub Actionsで公式サイトデータ取得）
- **データ更新頻度**: 6時間ごと
- **デプロイ先**: GitHub Pages

### 2. サイト調査

各アーティストの公式サイトを調査し、データ取得方法を決定した。

#### タイガーリー (tigerlee.ryzm.jp)
- JavaScript SPAのため、通常のHTTPリクエストではコンテンツ取得不可
- RSSフィード なし（/feed, /rss, /feed.xml いずれも404）
- → **Puppeteer（ヘッドレスChrome）** による取得が必要

#### ガガガSP (gagagasp.jp)
- WordPress v6.5.8 サイト
- RSSフィード あり (`https://gagagasp.jp/feed/`)
- ライブ情報はトップページのHTML内に記載
- → **rss-parser + cheerio** で取得可能

### 3. 実装

以下のファイルを作成した：

#### 設定・ビルド
- `package.json` — プロジェクト定義、依存関係、スクリプト
- `astro.config.mjs` — Astro設定（static出力、Tailwind Viteプラグイン）
- `tsconfig.json` — TypeScript設定
- `.gitignore` — Git除外設定

#### データ定義
- `src/data/artists.ts` — アーティスト情報の型定義と設定（URL、SNSハンドル、テーマカラー、取得方法など）

#### データ取得スクリプト
- `scripts/fetch-gagagasp.ts` — ガガガSP: RSSからニュース取得 + トップページHTMLからライブ情報スクレイピング
- `scripts/fetch-tigerlee.ts` — タイガーリー: Puppeteerでryzm.jpのSPAからデータ取得
- `scripts/fetch-all.ts` — 全アーティストのデータ取得を順次実行するエントリポイント

#### 生成データ
- `src/data/generated/gagagasp-news.json` — ガガガSPニュース（10件取得済み）
- `src/data/generated/gagagasp-live.json` — ガガガSPライブ情報（10件取得済み）
- `src/data/generated/tigerlee-news.json` — タイガーリーニュース（初期は空配列）
- `src/data/generated/tigerlee-live.json` — タイガーリーライブ情報（初期は空配列）

#### UIコンポーネント
- `src/layouts/Layout.astro` — ベースHTMLレイアウト（ダークテーマ）
- `src/components/ArtistTabs.astro` — タブ切替ナビゲーション（スティッキー表示）
- `src/components/NewsSection.astro` — ニュース一覧カード
- `src/components/LiveSection.astro` — ライブ情報表示（日付バッジ、upcoming/past分割）
- `src/components/XTimeline.astro` — Xタイムライン埋め込みウィジェット
- `src/components/InstagramFeed.astro` — Instagramプロフィールへのリンクカード
- `src/pages/index.astro` — メインダッシュボードページ（2カラムグリッド）

#### CI/CD
- `.github/workflows/fetch-and-deploy.yml` — GitHub Actionsワークフロー（6時間cron + push + 手動トリガー）

### 4. 解決した問題

#### @astrojs/tailwind 非互換
- Astro v6 では `@astrojs/tailwind` インテグレーションが非対応
- → `@tailwindcss/vite` Viteプラグインに変更

#### Tailwind CSS v3/v4 競合
- ルートの `tailwindcss` がv3、`@tailwindcss/vite` がv4を要求
- → `npm uninstall tailwindcss && npm install tailwindcss@4` で解決

#### CSS @import エラー
- `<style is:global>` 内の `@import` でPostCSS "Unknown word" エラー
- → `import "../styles/global.css"` をAstroフロントマターに移動

#### import.meta.dirname 未定義
- tsx では `import.meta.dirname` が未サポート
- → `fileURLToPath(import.meta.url)` + `path.dirname()` に変更

#### ガガガSP ライブデータの日付取得
- `/event` ページが429エラーを返す
- → トップページ (`gagagasp.jp/`) からスクレイピングに変更
- 日付正規表現: `(\d{4})年(\d{1,2})月(\d{1,2})日`

#### 会場名抽出ロジック改善
- 初期実装で「【ツアー】」が会場名として誤抽出される問題
- → `@会場（地名）` や `【地名】` パターンを個別にパース

#### ビルド終了コード異常
- Windows/PowerShellで日本語パスのエンコーディングにより終了コード -1073740791
- 実際には `dist/index.html` は正常に生成されている
- GitHub Actions (ubuntu-latest) では問題なし

#### フォルダ重複問題
- `npm create astro` が Unicode NFD エンコーディングのフォルダ名で作成
- 実プロジェクトは NFC エンコーディング → 2つの「推しポータル」フォルダが存在
- NFDフォルダ（テンプレート残骸のみ）を削除して解決

### 5. タイガーリー DOM 調査 & Puppeteerセレクタ修正

ryzm.jp のSPA をPuppeteerで調査し、実際のDOM構造に基づきセレクタを修正した。

#### ニュースページ (`/news`) の DOM構造
```html
<div class="box">
  <img src="...">
  <h4>タイトル</h4>
  <p>本文抜粋...</p>
  <p class="date">YYYY/MM/DD (Day)</p>
  <a href="/news/{UUID}"></a>
</div>
```
- セレクタ: `div.box` → `h4` (タイトル), `p.date` (日付), `a[href*="/news/"]` (URL)
- 取得結果: 4件

#### ライブページ (`/live`) の DOM構造
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
- セレクタ: `ul.live_list > li` → `li.date` (日付), `li.live_title h4` (タイトル), `li.venue p` (会場)
- カテゴリフィルタリンク (`?category_id=...`) は除外
- 取得結果: 12件（日付・タイトル・会場すべて正常取得）

#### SNSハンドル修正（DOM調査で判明）
- X: `tigerlee__info` → `tigerlee0620`（公式サイトのリンクに基づき修正）
- Instagram: `tigerlee__official` → `tgl___official`（公式サイトのリンクに基づき修正）
- ガガガSP: X `ga3sp_official` ✓、Instagram `ga3sp_official` ✓（変更なし）

### 6. 動作確認済み項目

- [x] ガガガSP ニュース取得（RSS経由、10件）
- [x] ガガガSP ライブ情報取得（HTMLスクレイピング、10件、日付・会場付き）
- [x] タイガーリー ニュース取得（Puppeteer、4件、日付付き）
- [x] タイガーリー ライブ情報取得（Puppeteer、12件、日付・タイトル・会場付き）
- [x] Astroビルド → `dist/index.html` 正常生成
- [x] 開発サーバー起動（localhost:4321）

### 7. 残課題

- [x] ~~**タイガーリー DOM 調査**: ryzm.jp のSPA DOM構造を調査し、Puppeteerスクリプトのセレクタを修正する~~
- [x] ~~**SNSハンドル確認**: X (`tigerlee0620`), Instagram (`tgl___official`) に修正済み~~
- [ ] **GitHub リポジトリ作成 & デプロイ**: GitHubにpushし、Settings → Pages でGitHub Actionsソースを有効化
- [ ] **astro.config.mjs base設定**: サブパスデプロイ時（例: `https://user.github.io/oshi-portal/`）は `base` を設定
- [ ] **アーティスト追加手順**: `src/data/artists.ts` 更新 → fetchスクリプト作成 → `src/pages/index.astro` にインポート追加
- [ ] **Instagram表示改善**: 現在はプロフィールリンクカードのみ。oEmbed API利用で投稿埋め込みも検討可能

---

*最終更新: 2026年3月26日*
