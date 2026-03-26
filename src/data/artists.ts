export interface Artist {
  id: string;
  name: string;
  officialUrl: string;
  liveUrl: string;
  xHandle: string;
  instagramHandle: string;
  color: string;
  fetchType: "rss" | "puppeteer";
  rssUrl?: string;
}

export const artists: Artist[] = [
  {
    id: "tigerlee",
    name: "タイガーリー",
    officialUrl: "https://tigerlee.ryzm.jp/",
    liveUrl: "https://tigerlee.ryzm.jp/live",
    xHandle: "tigerlee0620",
    instagramHandle: "tgl___official",
    color: "#e85d04",
    fetchType: "puppeteer",
  },
  {
    id: "gagagasp",
    name: "ガガガSP",
    officialUrl: "https://gagagasp.jp/",
    liveUrl: "https://gagagasp.jp/event",
    xHandle: "ga3sp_official",
    instagramHandle: "ga3sp_official",
    color: "#d90429",
    fetchType: "rss",
    rssUrl: "https://gagagasp.jp/feed/",
  },
];

export interface NewsItem {
  title: string;
  url: string;
  date: string;
  category?: string;
}

export interface LiveItem {
  title: string;
  url: string;
  date: string;
  venue?: string;
}
