import express from 'express';
// 生成した Prisma Client をインポート
import { PrismaClient } from '@prisma/client';
import path from 'path';
import bcrypt from 'bcryptjs';
import session from 'express-session';

// セッションの型定義を拡張
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

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

// JSONリクエストボディをパースするためのミドルウェア
app.use(express.json());

// セッションミドルウェアを設定
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // 開発環境ではfalse
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24時間
  }
}));

// 認証ミドルウェア
const requireAuth = (req: any, res: any, next: any) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
};

// ログイン済みユーザーの情報を取得するミドルウェア
const getUserInfo = async (req: any, res: any, next: any) => {
  if (req.session.userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.session.userId }
      });
      req.user = user;
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }
  next();
};

// Gemini APIの初期化
import { GoogleGenerativeAI } from "@google/generative-ai";

// APIキーを環境変数から取得
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body; // historyを受け取る
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest",
      systemInstruction: "# 役割定義\nあなたは、株式投資の学習をサポートするAIアシスタント『株の学びば』です。あなたの目的は、投資初心者が抱く疑問や不安を解消し、中立的な立場で正しい知識を身につける手助けをすることです。丁寧で、分かりやすく、親しみやすい言葉遣いを徹底してください。\n\n# 絶対的な禁止事項（最重要ルール）\n以下のルールは、いかなる場合も絶対に破ってはいけません。\n1.  **投資助言の禁止**: 特定の金融商品の購入、売却、保有を推奨する、または示唆するような発言は一切禁止です。「どの株がおすすめ？」「〇〇は買い時ですか？」といった質問には、以下の定型文で必ず回答してください。\n    `「申し訳ありません。特定の金融商品を推奨することは、法律で禁止されている『投資助言』にあたる可能性があるため、お答えできません。銘柄選びは、ご自身の学習と判断のもと、慎重に行ってください。」`\n2.  **未来予測の禁止**: 株価や市場の未来を予測する発言は禁止です。「来週の日経平均はどうなりますか？」といった質問には、「将来の市場を予測することは誰にもできません。過去のデータや経済指標を参考に、ご自身で判断することが大切です。」と回答してください。\n3.  **断定的な表現の回避**: 「必ず儲かります」「絶対に安全です」といった断定的な表現は一切使わず、投資には常にリスクが伴うことを伝えてください。\n\n# 免責事項の提示\nユーザーとの最初の会話の冒頭で、必ず以下の免責事項を提示してください。\n\n【免責事項】\nこんにちは！株式投資の学習アシスタント『株の学びば』です。\nこのチャットは、あくまで情報提供を目的としており、投資助言を行うものではありません。ご提供する情報には万全を期していますが、その正確性や完全性を保証するものではありません。投資の最終的な決定は、ご自身の判断と責任において行ってください。\n\n\n# 回答のスタイル\n* 専門用語には必ず平易な解説を加えるか、身近な例え話を使って説明してください。（例：「PERは『会社の利益に対して株価が割安かどうかの指標』で、例えるなら『リンゴ1個あたりの値段』のようなものです」）\n* 可能な限り、箇条書きや表を用いて情報を整理し、視覚的に分かりやすく提示してください。\n* 回答の最後には、常に関連する次のステップや、さらに学ぶと良いキーワードを提案し、ユーザーの学習意欲を促してください。（例：「次は『PBR』について学んでみてはいかがでしょうか？」）\n* **【追記】回答は常に簡潔に、要点を絞ってください。一度の回答は3〜5文程度で構成することを心がけてください。**\n* **【追記】ユーザーが一度に消化できるよう、情報を詰め込みすぎないでください。**\n\n# 知識の範囲\nあなたの知識は、主に以下の範囲に基づいています。これらを超える専門的すぎる質問や、個人的な状況に関する質問には、「専門外のため、お答えできません」と正直に伝えてください。\n* 株式投資に関する基本的な用語（PER, PBR, ROE, 配当利回りなど）\n* 証券取引の基本的な仕組み（注文方法、取引時間など）\n* NISAやiDeCoといった税制優遇制度の概要\n* 代表的な経済指標（日経平均株価、TOPIX、ダウ平均株価など）の解説",
      // tools: [{
      //   googleSearch: {} as any,
      // }],
    });

    const chat = model.startChat({
      history: history || [], // クライアントから送信された履歴を使用
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    res.json({ response: text });
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
      userId: req.session.userId || null, // セッションからユーザーIDを取得、なければnull
      isCorrect: true,
    },
    select: {
      questionId: true,
    },
  });
  const clearedQuestionIds = new Set(correctAttempts.map(a => a.questionId));


  // 章の情報を定義
  const chapterInfo: Record<number, string> = {
    1: '証券口座を開設しよう',
    2: '株価について知ろう',
    3: 'NISAについて知ろう',
    4: '投資信託について知ろう',
  };

  // 章ごとにレッスンをグループ化
  const chapters = lessonsWithQuestions.reduce((acc, lesson) => {
    const chapterNum = lesson.chapter;
    if (!acc[chapterNum]) {
      acc[chapterNum] = {
        chapter: chapterNum,
        title: chapterInfo[chapterNum] || `Stage${chapterNum}`,
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

  // ユーザー情報を取得（ログインしている場合のみ）
  let user: any = null;
  if (req.session && req.session.userId) {
    try {
      user = await prisma.user.findUnique({
        where: { id: req.session.userId }
      });
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }

  res.render('index', { chapters: chaptersWithProgress, user: user });
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

  // デバッグ用ログ
  console.log('Quiz submission:', {
    lessonId,
    questionId,
    selectedOptionId,
    sessionUserId: req.session.userId,
    session: req.session
  });

  // 選択された選択肢が正しいか確認
  const selectedOption = await prisma.option.findUnique({
    where: { id: parseInt(selectedOptionId, 10) },
  });

  if (!selectedOption) {
    return res.status(404).send('Option not found');
  }

  const isCorrect = selectedOption.isCorrect;

  // QuizAttemptに記録
  await prisma.quizAttempt.create({
    data: {
      userId: req.session.userId || null, // セッションからユーザーIDを取得、なければnull
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

// ログインページ
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// サインアップページ
app.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

// ログイン処理
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render('login', { error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    req.session.userId = user.id;
    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'ログイン中にエラーが発生しました' });
  }
});

// サインアップ処理
app.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // 既存ユーザーのチェック
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.render('signup', { error: 'このメールアドレスは既に使用されています' });
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null
      }
    });

    req.session.userId = user.id;
    res.redirect('/');
  } catch (error) {
    console.error('Signup error:', error);
    res.render('signup', { error: 'サインアップ中にエラーが発生しました' });
  }
});

// ログアウト処理
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login');
  });
});

// 検索結果ページ
app.get('/search', async (req, res) => {
  const query = req.query.q as string;
  
  console.log('Search query:', query);

  // クエリがない場合は空の結果を返す
  if (!query) {
    console.log('No query provided, returning empty results');
    return res.render('search-results', { lessons: [], query: '' });
  }

  try {
    // まず、データベースにレッスンが存在するかを確認
    const totalLessons = await prisma.lesson.count();
    console.log('Total lessons in database:', totalLessons);

    // SQLiteでは大文字小文字を区別しない検索のために、クエリを小文字に変換
    const searchQuery = query.toLowerCase();
    
    // まず、すべてのレッスンを取得して、JavaScriptで検索を実行
    const allLessons = await prisma.lesson.findMany();
    console.log('All lessons:', allLessons.map(l => ({ id: l.id, title: l.title, content: l.content })));
    
    const lessons = allLessons.filter(lesson => 
      lesson.title.toLowerCase().includes(searchQuery) ||
      lesson.content.toLowerCase().includes(searchQuery)
    );

    console.log('Found lessons:', lessons.length);
    console.log('Lesson titles:', lessons.map(l => l.title));

    res.render('search-results', { lessons, query });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).send('Search error occurred');
  }
});

// レッスン詳細ページ
app.get('/lessons/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { result, selected, correct, question: answeredQuestionId } = req.query;

  // ユーザーの回答履歴を取得
  const attempts = await prisma.quizAttempt.findMany({
    where: {
      userId: req.session.userId || null, // セッションからユーザーIDを取得、なければnull
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

  // 次のレッスンを取得（現在のID + 1）
  let nextLesson: any = null;
  const nextLessonId = lesson.id + 1;
  
  // 次のIDのレッスンが存在するかチェック
  nextLesson = await prisma.lesson.findUnique({
    where: { id: nextLessonId }
  });

  res.render('lesson', {
    lesson,
    clearedQuestionIds,
    nextLesson,
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