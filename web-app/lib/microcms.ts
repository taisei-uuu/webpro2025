import { createClient } from "microcms-js-sdk";

// APIクライアントの作成
export const client = createClient({
  serviceDomain: process.env.MICROCMS_SERVICE_DOMAIN || "",
  apiKey: process.env.MICROCMS_API_KEY || "",
});

// さっきMicroCMSで作ったフィールドと合わせます
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
  category?: string[]; // セレクトリスト（複数選択可の場合もあるため配列として定義）
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