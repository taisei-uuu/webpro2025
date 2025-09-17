import 'dotenv/config';
import express from 'express';
import { clerkMiddleware, clerkClient, requireAuth, getAuth } from '@clerk/express';
import session from 'express-session';
// import Stripe from 'stripe';
// 生成した Prisma Client をインポート
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// セッションの型定義
declare module 'express-session' {
  interface SessionData {
    guestSessionId?: string;
  }
}

const prisma = new PrismaClient({
  // 開発中は、実行されたクエリをログに表示する
  log: ['query'],
});

// Stripeの初期化（コメントアウト）
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2024-12-18.acacia',
// });

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

// セッションミドルウェアを追加（ゲストモード用）
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false, // セッションが実際に使用されるまで保存しない
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true, // XSS攻撃を防ぐ
    maxAge: 24 * 60 * 60 * 1000, // 24時間
    sameSite: 'lax' // CSRF攻撃を防ぐ
  },
  name: 'stockwith.session' // デフォルトのセッション名を変更
}));

// Clerkミドルウェアを追加（環境変数が設定されている場合のみ）
if (process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) {
  app.use(clerkMiddleware());
  console.log('Clerk middleware initialized');
} else {
  console.warn('Clerk environment variables not set, skipping Clerk middleware');
}

// ゲストセッション管理のヘルパー関数（最適化版）
function getOrCreateGuestSession(req: express.Request): string {
  if (!req.session.guestSessionId) {
    req.session.guestSessionId = uuidv4();
  }
  return req.session.guestSessionId;
}

// ユーザーIDまたはセッションIDを取得するヘルパー関数（最適化版）
function getUserIdentifier(req: express.Request): { userId?: string; sessionId?: string } {
  try {
    const { userId } = getAuth(req);
    if (userId) {
      return { userId: userId }; // ClerkのユーザーIDは文字列のまま使用
    } else {
      return { sessionId: getOrCreateGuestSession(req) };
    }
  } catch (error) {
    console.error('Error in getUserIdentifier:', error);
    // Clerkミドルウェアが初期化されていない場合はゲストセッションを使用
    return { sessionId: getOrCreateGuestSession(req) };
  }
}

// グローバルエラーハンドリングミドルウェア
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', error);
  
  // セッション関連のエラーの場合
  if (error.code === 'EBADCSRFTOKEN' || error.message.includes('session')) {
    // セッションをクリアしてリダイレクト
    req.session.destroy((err) => {
      if (err) console.error('Error destroying session:', err);
    });
    return res.redirect('/');
  }
  
  // その他のエラーは500エラーとして処理
  res.status(500).render('error', { 
    message: 'サーバーエラーが発生しました。しばらく時間をおいてから再度お試しください。',
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || ''
  });
});

// クイズ回答履歴をキャッシュするMap
const quizAttemptsCache = new Map<string, { data: any[], timestamp: number }>();
const CACHE_DURATION = 30000; // 30秒

// キャッシュされたクイズ回答履歴を取得する関数
async function getCachedQuizAttempts(userId?: string, sessionId?: string) {
  const cacheKey = userId ? `user_${userId}` : `session_${sessionId}`;
  const cached = quizAttemptsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const attempts = await prisma.quizAttempt.findMany({
    where: {
      OR: [
        userId ? { clerkUserId: userId } : {}, // ClerkのユーザーIDを直接使用
        sessionId ? { sessionId: sessionId } : {}
      ],
      isCorrect: true,
    },
    select: {
      questionId: true,
    },
  });
  
  quizAttemptsCache.set(cacheKey, {
    data: attempts,
    timestamp: Date.now()
  });
  
  return attempts;
}

// Stripe関連のコード（コメントアウト）
// サブスクリプションページ
// app.get('/subscription', (req, res) => {
//   res.render('subscription', { 
//     publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
//     STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY 
//   });
// });

// サブスクリプション作成API
// app.post('/api/create-subscription', requireAuth(), async (req, res) => {
//   try {
//     const { userId } = getAuth(req);
//     
//     // ユーザー情報を取得または作成
//     let user = await prisma.user.findUnique({
//       where: { clerkId: userId }
//     });
//     
//     if (!user) {
//       // Clerkのユーザー情報を取得
//       const clerkUser = await clerkClient.users.getUser(userId);
//       
//       // データベースにユーザーを作成
//       user = await prisma.user.create({
//         data: {
//           clerkId: userId,
//           email: clerkUser.emailAddresses[0]?.emailAddress || '',
//           name: clerkUser.firstName || null,
//           password: '' // Clerkを使用するため空文字
//         }
//       });
//     }
//     
//     // Stripe顧客を作成または取得
//     let customer;
//     const existingCustomers = await stripe.customers.list({
//       email: user.email,
//       limit: 1
//     });
//     
//     if (existingCustomers.data.length > 0) {
//       customer = existingCustomers.data[0];
//     } else {
//       customer = await stripe.customers.create({
//         email: user.email,
//         name: user.name || undefined,
//         metadata: {
//           clerkId: userId,
//           userId: user.id.toString()
//         }
//       });
//     }
//     
//     // 価格ID（Stripeダッシュボードで作成した価格のID）
//     const priceId = process.env.STRIPE_PRICE_ID || 'price_1234567890'; // 実際の価格IDに置き換え
//     
//     // チェックアウトセッションを作成
//     const session = await stripe.checkout.sessions.create({
//       customer: customer.id,
//       payment_method_types: ['card'],
//       line_items: [
//         {
//           price: priceId,
//           quantity: 1,
//         },
//       ],
//       mode: 'subscription',
//       success_url: `${req.protocol}://${req.get('host')}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
//       cancel_url: `${req.protocol}://${req.get('host')}/subscription`,
//       metadata: {
//         userId: user.id.toString(),
//         clerkId: userId
//       }
//     });
//     
//     res.json({ clientSecret: session.id });
//   } catch (error) {
//     console.error('Error creating subscription:', error);
//     res.status(500).json({ error: 'Failed to create subscription' });
//   }
// });

// サブスクリプション成功ページ
// app.get('/subscription/success', requireAuth(), async (req, res) => {
//   const { session_id } = req.query;
//   
//   try {
//     const session = await stripe.checkout.sessions.retrieve(session_id as string);
//     
//     if (session.payment_status === 'paid') {
//       res.render('subscription-success', {
//         sessionId: session_id,
//         customerEmail: session.customer_details?.email
//       });
//     } else {
//       res.redirect('/subscription?error=payment_failed');
//     }
//   } catch (error) {
//     console.error('Error retrieving session:', error);
//     res.redirect('/subscription?error=session_error');
//   }
// });

// Stripe Webhook
// app.post('/webhook/stripe', express.raw({type: 'application/json'}), async (req, res) => {
//   const sig = req.headers['stripe-signature'];
//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
//   } catch (err) {
//     console.error('Webhook signature verification failed:', err);
//     return res.status(400).send('Webhook Error');
//   }

//   try {
//     switch (event.type) {
//       case 'checkout.session.completed':
//         const session = event.data.object;
//         await handleSubscriptionCreated(session);
//         break;
//       case 'customer.subscription.updated':
//         const subscription = event.data.object;
//         await handleSubscriptionUpdated(subscription);
//         break;
//       case 'customer.subscription.deleted':
//         const deletedSubscription = event.data.object;
//         await handleSubscriptionDeleted(deletedSubscription);
//         break;
//       default:
//         console.log(`Unhandled event type: ${event.type}`);
//     }
//   } catch (error) {
//     console.error('Error handling webhook:', error);
//     return res.status(500).send('Webhook handler error');
//   }

//   res.json({received: true});
// });

// サブスクリプション作成処理
// async function handleSubscriptionCreated(session: any) {
//   const { userId, clerkId } = session.metadata;
//   
//   if (!userId || !clerkId) {
//     console.error('Missing user metadata in session');
//     return;
//   }

//   const subscription = await stripe.subscriptions.retrieve(session.subscription);
//   
//   await prisma.subscription.create({
//     data: {
//       userId: parseInt(userId),
//       stripeCustomerId: session.customer,
//       stripeSubscriptionId: subscription.id,
//       status: subscription.status,
//       currentPeriodStart: new Date(subscription.current_period_start * 1000),
//       currentPeriodEnd: new Date(subscription.current_period_end * 1000),
//     }
//   });
//   
//   console.log(`Subscription created for user ${userId}`);
// }

// サブスクリプション更新処理
// async function handleSubscriptionUpdated(subscription: any) {
//   await prisma.subscription.update({
//     where: { stripeSubscriptionId: subscription.id },
//     data: {
//       status: subscription.status,
//       currentPeriodStart: new Date(subscription.current_period_start * 1000),
//       currentPeriodEnd: new Date(subscription.current_period_end * 1000),
//     }
//   });
//   
//   console.log(`Subscription updated: ${subscription.id}`);
// }

// サブスクリプション削除処理
// async function handleSubscriptionDeleted(subscription: any) {
//   await prisma.subscription.update({
//     where: { stripeSubscriptionId: subscription.id },
//     data: {
//       status: 'canceled',
//     }
//   });
//   
//   console.log(`Subscription canceled: ${subscription.id}`);
// }

// Gemini APIの初期化（一時的にコメントアウト）
// import { GoogleGenerativeAI } from "@google/generative-ai";

// APIキーを環境変数から取得
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// app.post('/api/chat', async (req, res) => {
//   try {
//     const { message, history } = req.body; // historyを受け取る
//     if (!message) {
//       return res.status(400).json({ error: 'Message is required' });
//     }

//     const model = genAI.getGenerativeModel({
//       model: "gemini-1.5-pro-latest",
//       systemInstruction: "# 役割定義\nあなたは、株式投資の学習をサポートするAIアシスタント『Stock with』です。あなたの目的は、投資初心者が抱く疑問や不安を解消し、中立的な立場で正しい知識を身につける手助けをすることです。丁寧で、分かりやすく、親しみやすい言葉遣いを徹底してください。\n\n# 絶対的な禁止事項（最重要ルール）\n以下のルールは、いかなる場合も絶対に破ってはいけません。\n1.  **投資助言の禁止**: 特定の金融商品の購入、売却、保有を推奨する、または示唆するような発言は一切禁止です。「どの株がおすすめ？」「〇〇は買い時ですか？」といった質問には、以下の定型文で必ず回答してください。\n    `「申し訳ありません。特定の金融商品を推奨することは、法律で禁止されている『投資助言』にあたる可能性があるため、お答えできません。銘柄選びは、ご自身の学習と判断のもと、慎重に行ってください。」`\n2.  **未来予測の禁止**: 株価や市場の未来を予測する発言は禁止です。「来週の日経平均はどうなりますか？」といった質問には、「将来の市場を予測することは誰にもできません。過去のデータや経済指標を参考に、ご自身で判断することが大切です。」と回答してください。\n3.  **断定的な表現の回避**: 「必ず儲かります」「絶対に安全です」といった断定的な表現は一切使わず、投資には常にリスクが伴うことを伝えてください。\n\n# 免責事項の提示\nユーザーとの最初の会話の冒頭で、必ず以下の免責事項を提示してください。\n\n【免責事項】\nこんにちは！株式投資の学習アシスタント『Stock with』です。\nこのチャットは、あくまで情報提供を目的としており、投資助言を行うものではありません。ご提供する情報には万全を期していますが、その正確性や完全性を保証するものではありません。投資の最終的な決定は、ご自身の判断と責任において行ってください。\n\n\n# 回答のスタイル\n* 専門用語には必ず平易な解説を加えるか、身近な例え話を使って説明してください。（例：「PERは『会社の利益に対して株価が割安かどうかの指標』で、例えるなら『リンゴ1個あたりの値段』のようなものです」）\n* 可能な限り、箇条書きや表を用いて情報を整理し、視覚的に分かりやすく提示してください。\n* 回答の最後には、常に関連する次のステップや、さらに学ぶと良いキーワードを提案し、ユーザーの学習意欲を促してください。（例：「次は『PBR』について学んでみてはいかがでしょうか？」）\n* **【追記】回答は常に簡潔に、要点を絞ってください。一度の回答は3〜5文程度で構成することを心がけてください。**\n* **【追記】ユーザーが一度に消化できるよう、情報を詰め込みすぎないでください。**\n\n# 知識の範囲\nあなたの知識は、主に以下の範囲に基づいています。これらを超える専門的すぎる質問や、個人的な状況に関する質問には、「専門外のため、お答えできません」と正直に伝えてください。\n* 株式投資に関する基本的な用語（PER, PBR, ROE, 配当利回りなど）\n* 証券取引の基本的な仕組み（注文方法、取引時間など）\n* NISAやiDeCoといった税制優遇制度の概要\n* 代表的な経済指標（日経平均株価、TOPIX、ダウ平均株価など）の解説",
//       // tools: [{
//       //   googleSearch: {} as any,
//       // }],
//     });

//     const chat = model.startChat({
//       history: history || [], // クライアントから送信された履歴を使用
//     });

//     const result = await chat.sendMessage(message);
//     const response = await result.response;
//     const text = response.text();

//     res.json({ response: text });
//   } catch (error) {
//     console.error('Error in /api/chat:', error);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

// 自社ホームページ
app.get('/', (req, res) => {
  try {
    // デバッグ情報を表示
    console.log('CLERK_PUBLISHABLE_KEY:', process.env.CLERK_PUBLISHABLE_KEY ? 'Set' : 'Not set');
    console.log('CLERK_SECRET_KEY:', process.env.CLERK_SECRET_KEY ? 'Set' : 'Not set');
    
    res.render('home', { 
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '' 
    });
  } catch (error) {
    console.error('Error in / route:', error);
    res.status(500).render('error', { 
      message: 'ページの読み込み中にエラーが発生しました。',
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY 
    });
  }
});

// プライバシーポリシーページ
app.get('/privacy', (req, res) => {
  try {
    res.render('privacy', {
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '' 
    });
  } catch (error) {
    console.error('Error in /privacy route:', error);
    res.status(500).render('error', { 
      message: 'ページの読み込み中にエラーが発生しました。',
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY 
    });
  }
});

// 利用規約ページ
app.get('/terms', (req, res) => {
  try {
    res.render('terms', {
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '' 
    });
  } catch (error) {
    console.error('Error in /terms route:', error);
    res.status(500).render('error', { 
      message: 'ページの読み込み中にエラーが発生しました。',
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY 
    });
  }
});

// 株学習プラットフォームのメインページ（ゲストモード対応）
app.get('/learning', async (req, res) => {
  try {
    // 1. 全てのレッスンと、それに紐づく問題を取得
    const lessonsWithQuestions = await prisma.lesson.findMany({
      include: {
        questions: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    // 2. 現在のユーザー（ログイン済みまたはゲスト）の正解した回答履歴を取得（キャッシュ使用）
    const { userId, sessionId } = getUserIdentifier(req);
    
    // デバッグ情報を追加
    console.log('Learning route - Auth state:', {
      userId,
      sessionId,
      hasUser: !!userId,
      isGuest: !userId,
      userIdType: typeof userId,
      userIdValue: userId
    });
    
    const correctAttempts = await getCachedQuizAttempts(userId, sessionId);
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

    // ユーザー情報を取得（ログイン済みの場合のみ）
    let user: any = null;
    if (userId && process.env.CLERK_SECRET_KEY) {
      try {
        user = await clerkClient.users.getUser(userId.toString());
      } catch (error) {
        console.error('Error fetching user from Clerk:', error);
        // ユーザー情報の取得に失敗した場合は、認証状態をリセット
        console.log('Resetting auth state due to user fetch error');
        
        // セッションをクリアしてゲストモードに切り替え
        req.session.destroy((err) => {
          if (err) console.error('Error destroying session:', err);
        });
        
        // ゲストモードで再レンダリング
        return res.render('index', { 
          chapters: chaptersWithProgress, 
          user: null,
          isGuest: true,
          publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '' 
        });
      }
    }

    res.render('index', { 
      chapters: chaptersWithProgress, 
      user: user,
      isGuest: !userId, // ゲストモードかどうかのフラグ
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '' 
    });
  } catch (error) {
    console.error('Error in /learning route:', error);
    res.status(500).render('error', { 
      message: 'サーバーエラーが発生しました。しばらく時間をおいてから再度お試しください。',
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY 
    });
  }
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

  res.redirect('/learning');
});

// クイズの回答を処理するルート（ゲストモード対応）
app.post('/lessons/:lessonId/quiz/submit', async (req, res) => {
  const lessonId = parseInt(req.params.lessonId, 10);
  const { questionId, selectedOptionId } = req.body;

  // デバッグ用ログ
  const { userId, sessionId } = getUserIdentifier(req);
  console.log('Quiz submission:', {
    lessonId,
    questionId,
    selectedOptionId,
    userId,
    sessionId
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
      clerkUserId: userId || null, // ClerkのユーザーIDを直接保存
      sessionId: sessionId || null,
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
  try {
    const query = req.query.q as string;
    
    console.log('Search query:', query);

    // クエリがない場合は空の結果を返す
    if (!query) {
      console.log('No query provided, returning empty results');
      return res.render('search-results', { lessons: [], query: '' });
    }

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

    res.render('search-results', { 
      lessons, 
      query
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).render('error', { 
      message: '検索中にエラーが発生しました。しばらく時間をおいてから再度お試しください。',
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY 
    });
  }
});

// レッスン詳細ページ（ゲストモード対応）
app.get('/lessons/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { result, selected, correct, question: answeredQuestionId } = req.query;

    // ユーザーの回答履歴を取得（キャッシュ使用）
    const { userId, sessionId } = getUserIdentifier(req);
    const allAttempts = await getCachedQuizAttempts(userId, sessionId);
    const attempts = allAttempts.filter(attempt => {
      // レッスンIDでフィルタリング（キャッシュから取得したデータをフィルタ）
      return true; // この部分は後で最適化
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
      return res.status(404).render('error', { 
        message: 'レッスンが見つかりません。',
        publishableKey: process.env.CLERK_PUBLISHABLE_KEY 
      });
    }

    // 次のレッスンを取得（現在のID + 1）
    let nextLesson: any = null;
    const nextLessonId = lesson.id + 1;
    
    try {
      // 次のIDのレッスンが存在するかチェック
      nextLesson = await prisma.lesson.findUnique({
        where: { id: nextLessonId }
      });
    } catch (error) {
      console.error('Error fetching next lesson:', error);
      // 次のレッスンの取得に失敗しても処理を続行
    }

    // ユーザー情報を取得（ログイン済みの場合のみ）
    let user: any = null;
    if (userId && process.env.CLERK_SECRET_KEY) {
      try {
        user = await clerkClient.users.getUser(userId.toString());
      } catch (error) {
        console.error('Error fetching user from Clerk:', error);
        // ユーザー情報の取得に失敗した場合は、認証状態をリセット
        console.log('Resetting auth state due to user fetch error');
        
        // セッションをクリアしてゲストモードに切り替え
        req.session.destroy((err) => {
          if (err) console.error('Error destroying session:', err);
        });
        
        // ゲストモードで再レンダリング
        return res.render('lesson', {
          lesson,
          clearedQuestionIds,
          nextLesson,
          isGuest: true,
          user: null,
          publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
          quizResult: {
            result,
            selectedId: selected ? parseInt(selected as string, 10) : undefined,
            correctId: correct ? parseInt(correct as string, 10) : undefined,
            questionId: answeredQuestionId ? parseInt(answeredQuestionId as string, 10) : undefined,
          },
        });
      }
    }

    res.render('lesson', {
      lesson,
      clearedQuestionIds,
      nextLesson,
      isGuest: !userId, // ゲストモードかどうかのフラグ
      user: user, // 完全なユーザー情報を追加
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
      quizResult: {
        result,
        selectedId: selected ? parseInt(selected as string, 10) : undefined,
        correctId: correct ? parseInt(correct as string, 10) : undefined,
        questionId: answeredQuestionId ? parseInt(answeredQuestionId as string, 10) : undefined,
      },
    });
  } catch (error) {
    console.error('Error in /lessons/:id route:', error);
    res.status(500).render('error', { 
      message: 'レッスンの読み込み中にエラーが発生しました。しばらく時間をおいてから再度お試しください。',
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY 
    });
  }
});

// 指定したポートでサーバーを起動し、リクエストを待ち始める
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});