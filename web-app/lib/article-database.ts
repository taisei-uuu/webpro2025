import { PrismaClient } from '@prisma/client';

// PrismaClientのインスタンスを共有するために既存のものをインポートするか、ここで新しく作成する
// index.tsやphase-database.tsと同じインスタンスを使うのが理想的ですが、
// 循環参照を避けるためにここでは新しくインスタンス化するか、phase-database.tsからエクスポートされたものを使う
// ここではphase-database.tsからprismaをインポートします
import { prisma } from './phase-database';

export interface ArticleData {
    title: string;
    slug: string;
    content: string;
}

// 全ての記事を取得
export async function getArticles() {
    return await prisma.article.findMany({
        orderBy: {
            publishedAt: 'desc',
        },
    });
}

// スラッグで記事を取得
export async function getArticleBySlug(slug: string) {
    return await prisma.article.findUnique({
        where: {
            slug: slug,
        },
    });
}

// 記事を作成
export async function createArticle(data: ArticleData) {
    return await prisma.article.create({
        data: {
            title: data.title,
            slug: data.slug,
            content: data.content,
        },
    });
}
