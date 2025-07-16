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

// 簡易的な認証: 常にユーザーID 1 として扱う
const MOCK_USER_ID = 1;

// publicディレクトリを静的ファイルとして配信
app.use(express.static(path.join(__dirname, 'public')));

// ルートURL ("/") にGETリクエストが来たときの処理
app.get('/', async (req, res) => {
  // 1. 全てのレッスンと、それに紐づく問題を取得
  const lessonsWithQuestions = await prisma.lesson.findMany({
    include: {
      questions: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  // 2. 現在のユーザーの正解した回答履歴を取得
  const correctAttempts = await prisma.quizAttempt.findMany({
    where: {
      userId: MOCK_USER_ID,
      isCorrect: true,
    },
    select: {
      questionId: true,
    },
  });
  const clearedQuestionIds = new Set(correctAttempts.map(a => a.questionId));


  // 章の情報を定義
  const chapterInfo: Record<number, string> = {
    1: '株式投資の基礎知識',
    2: '銘柄選びの基本',
    3: '投資戦略とリスク管理',
    4: '実践と応用',
  };

  // 章ごとにレッスンをグループ化
  const chapters = lessonsWithQuestions.reduce((acc, lesson) => {
    const chapterNum = lesson.chapter;
    if (!acc[chapterNum]) {
      acc[chapterNum] = {
        chapter: chapterNum,
        title: chapterInfo[chapterNum] || `第${chapterNum}章`,
        lessons: [],
        totalQuestions: 0,
        clearedQuestions: 0,
      };
    }
    acc[chapterNum].lessons.push(lesson);
    acc[chapterNum].totalQuestions += lesson.questions.length;
    acc[chapterNum].clearedQuestions += lesson.questions.filter(q => clearedQuestionIds.has(q.id)).length;
    return acc;
  }, {} as Record<number, {
    chapter: number;
    title: string;
    lessons: typeof lessonsWithQuestions;
    totalQuestions: number;
    clearedQuestions: number;
  }>);

  const chaptersWithProgress = Object.values(chapters).map(chapter => ({
    ...chapter,
    progressPercentage: chapter.totalQuestions > 0 ? (chapter.clearedQuestions / chapter.totalQuestions) * 100 : 0,
  }));

  res.render('index', { chapters: chaptersWithProgress });
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

// クイズの回答を処理するルート
app.post('/lessons/:lessonId/quiz/submit', async (req, res) => {
  const lessonId = parseInt(req.params.lessonId, 10);
  // questionId と selectedOptionId は文字列として送られてくる
  const { questionId, selectedOptionId } = req.body;

  // バリデーション: questionId と selectedOptionId が存在するか確認
  if (!questionId || !selectedOptionId) {
    // 何も選択されずにフォームが送信された場合など
    return res.status(400).send('問題と選択肢の両方を選択してください。');
  }

  // 文字列を数値に変換
  const questionIdNum = parseInt(questionId, 10);
  const selectedOptionIdNum = parseInt(selectedOptionId, 10);

  // 数値変換が成功したか確認
  if (isNaN(questionIdNum) || isNaN(selectedOptionIdNum)) {
    return res.status(400).send('不正なIDです。');
  }

  // 選択された選択肢が正しいか確認
  const selectedOption = await prisma.option.findUnique({
    where: { id: selectedOptionIdNum },
  });

  if (!selectedOption) {
    return res.status(404).send('選択肢が見つかりません。');
  }

  const isCorrect = selectedOption.isCorrect;

  // QuizAttemptに記録
  await prisma.quizAttempt.create({
    data: {
      userId: MOCK_USER_ID,
      questionId: questionIdNum,
      selectedOptionId: selectedOptionIdNum,
      isCorrect: isCorrect,
    },
  });

  // 正解の選択肢IDを取得
  const correctOption = await prisma.option.findFirst({
    where: { questionId: questionIdNum, isCorrect: true },
  });

  const resultQuery = `?result=${isCorrect ? 'correct' : 'incorrect'}&selected=${selectedOptionIdNum}&correct=${correctOption?.id}&question=${questionIdNum}`;
  res.redirect(`/lessons/${lessonId}${resultQuery}`);
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
  const { result, selected, correct, question: answeredQuestionId } = req.query;

  // ユーザーの回答履歴を取得
  const attempts = await prisma.quizAttempt.findMany({
    where: {
      userId: MOCK_USER_ID,
      question: {
        lessonId: id,
      },
      isCorrect: true,
    },
    select: {
      questionId: true,
    },
  });
  const clearedQuestionIds = new Set(attempts.map(a => a.questionId));

  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      questions: {
        include: {
          options: true,
        },
      },
    },
  });
  if (!lesson) {
    return res.status(404).send('Lesson not found');
  }
  res.render('lesson', {
    lesson,
    clearedQuestionIds,
    quizResult: {
      result,
      selectedId: selected ? parseInt(selected as string, 10) : undefined,
      correctId: correct ? parseInt(correct as string, 10) : undefined,
      questionId: answeredQuestionId ? parseInt(answeredQuestionId as string, 10) : undefined,
    },
  });
});

// 指定したポートでサーバーを起動し、リクエストを待ち始める
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});