import express from 'express';
// 生成した Prisma Client をインポート
import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient({
  // 開発中は、実行されたクエリをログに表示する
  log: ['query'],
});

const app = express();
// 環境変数 PORT があればそれを使う。なければ 8888 を使う
const PORT = process.env.PORT || 8888;

// EJS をビューエンジンとして設定する
app.set('view engine', 'ejs');
// viewsディレクトリのパスを絶対パスで指定
app.set('views', path.join(__dirname, 'views'));

// POSTリクエストのbodyを解釈するためのミドルウェア
app.use(express.urlencoded({ extended: true }));

// publicディレクトリを静的ファイルとして配信
app.use(express.static(path.join(__dirname, 'public')));

// ルートURL ("/") にGETリクエストが来たときの処理
app.get('/', async (req, res) => {
  const lessons = await prisma.lesson.findMany({
    orderBy: {
      id: 'asc',
    },
  });

  // 章の情報を定義
  const chapterInfo: Record<number, string> = {
    1: '株式投資の基礎知識',
    2: '銘柄選びの基本',
    3: '投資戦略とリスク管理',
    4: '実践と応用',
  };

  // 章ごとにレッスンをグループ化
  const chapters = lessons.reduce((acc, lesson) => {
    const chapterNum = lesson.chapter;
    if (!acc[chapterNum]) {
      acc[chapterNum] = {
        chapter: chapterNum,
        title: chapterInfo[chapterNum] || `第${chapterNum}章`,
        lessons: [],
      };
    }
    acc[chapterNum].lessons.push(lesson);
    return acc;
  }, {} as Record<number, { chapter: number; title: string; lessons: typeof lessons }>);

  res.render('index', { chapters: Object.values(chapters) });
});

// 新規レッスン作成フォームを表示するルート
app.get('/admin/lessons/new', (req, res) => {
  res.render('new-lesson');
});

// 新規レッスンを作成するルート
app.post('/admin/lessons', async (req, res) => {
  const { title, content, chapter } = req.body;

  await prisma.lesson.create({
    data: {
      title,
      content,
      chapter: parseInt(chapter, 10),
    },
  });

  res.redirect('/');
});

// 検索結果ページ
app.get('/search', async (req, res) => {
  const query = req.query.q as string;

  // クエリがない場合は空の結果を返す
  if (!query) {
    return res.render('search-results', { lessons: [], query: '' });
  }

  const lessons = await prisma.lesson.findMany({
    where: {
      OR: [
        {
          title: {
            contains: query,
            mode: 'insensitive', // 大文字・小文字を区別しない
          },
        },
        {
          content: {
            contains: query,
            mode: 'insensitive',
          },
        },
      ],
    },
  });

  res.render('search-results', { lessons, query });
});

// レッスン詳細ページ
app.get('/lessons/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const lesson = await prisma.lesson.findUnique({
    where: { id },
  });
  if (!lesson) {
    return res.status(404).send('Lesson not found');
  }
  res.render('lesson', { lesson });
});

// 指定したポートでサーバーを起動し、リクエストを待ち始める
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});