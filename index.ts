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

// JSONリクエストボディをパースするためのミドルウェア
app.use(express.json());

// Gemini APIの初期化
import { GoogleGenerativeAI } from "@google/generative-ai";

// APIキーを環境変数から取得
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest",
      systemInstruction: "あなたは、株式投資の学習をサポートするAIアシスタント『株の学びば』です。ユーザーからの質問に対して、常に親切・丁寧に、そして正確な情報を提供してください。難しい専門用語は避け、初心者にも理解しやすいように、平易な言葉で説明することを心がけてください。また、必要に応じて具体例や比喩を用いることで、より直感的な理解を促してください。",
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    res.json({ reply: text });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

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
  const { questionId, selectedOptionId } = req.body;

  // 選択された選択肢が正しいか確認
  const selectedOption = await prisma.option.findUnique({
    where: { id: parseInt(selectedOptionId, 10) },
  });

  if (!selectedOption) {
    return res.status(404).send('Option not found');
  }

  const isCorrect = selectedOption.isCorrect;

  // QuizAttemptに記録 (UserモデルがまだないのでuserIdはコメントアウト)
  await prisma.quizAttempt.create({
    data: {
      userId: MOCK_USER_ID,
      questionId: parseInt(questionId, 10),
      selectedOptionId: parseInt(selectedOptionId, 10),
      isCorrect: isCorrect,
    },
  });

  // 正解の選択肢IDを取得
  const correctOption = await prisma.option.findFirst({
    where: { questionId: parseInt(questionId, 10), isCorrect: true },
  });

  const resultQuery = `?result=${isCorrect ? 'correct' : 'incorrect'}&selected=${selectedOptionId}&correct=${correctOption?.id}&question=${questionId}`;
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