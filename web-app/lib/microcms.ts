import { createClient } from "microcms-js-sdk";

// APIクライアントの作成
export const client = createClient({
  serviceDomain: process.env.MICROCMS_SERVICE_DOMAIN || process.env.MICROCMS_SERVICE_DOMAIN_LESSON || "",
  apiKey: process.env.MICROCMS_API_KEY || process.env.MICROCMS_API_KEY_LESSON || "",
});

// 記事型定義
export type Article = {
  id: string;
  createdAt: string;
  publishedAt: string;
  title: string;
  introduction: string; // 無料エリア
  body?: string;        // 有料エリア（任意の可能性あり）
  isPaid: boolean;      // 有料記事かどうか
  price?: number;
  thumbnail?: {
    url: string;
    height: number;
    width: number;
  };
  category?: string[]; // セレクトリスト
};

// 記事一覧を取得
export const getArticles = async () => {
  const data = await client.getList<Article>({
    endpoint: "articles",
    queries: { orders: "-publishedAt" },
  });
  return data.contents;
};

// 記事詳細を取得
export const getArticleById = async (id: string) => {
  const data = await client.getListDetail<Article>({
    endpoint: "articles",
    contentId: id,
  });
  return data;
};

// レッスン型定義
export type Lesson = {
  id: string; // MicroCMSのシステムID
  title: string;
  content: string;
  slug?: string; // 旧仕様 (後方互換用)
  contentId?: string; // ユーザー定義ID (例: stage1-1)
  videoId?: string;
  slides?: {
    url: string;
    height: number;
    width: number;
  }[];
};

// レッスン一覧を取得
export const getLessons = async () => {
  const data = await client.getList<Lesson>({
    endpoint: "lessons",
    queries: { limit: 100 }
  });
  return data.contents;
};

// スラッグ(またはcontentId)でレッスンを検索して取得
export const getLessonBySlug = async (slug: string) => {
  // 1. まずcontentIdフィールドで検索してみる
  try {
    const data = await client.getList<Lesson>({
      endpoint: "lessons",
      queries: { filters: `contentId[equals]${slug}` }
    });

    if (data.contents.length > 0) {
      return data.contents[0];
    }
  } catch (e) {
    // contentIdフィールドがない場合は無視
  }

  // 2. 次にslugフィールドで検索してみる (後方互換性)
  try {
    const data = await client.getList<Lesson>({
      endpoint: "lessons",
      queries: { filters: `slug[equals]${slug}` }
    });

    if (data.contents.length > 0) {
      return data.contents[0];
    }
  } catch (e) { }

  // 3. 見つからない場合、コンテンツID(システムID)として取得を試みる
  try {
    const detail = await client.getListDetail<Lesson>({
      endpoint: "lessons",
      contentId: slug,
    });
    return detail;
  } catch (e) {
    return null;
  }
};