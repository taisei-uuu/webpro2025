import 'dotenv/config';
import express from 'express';
import { clerkMiddleware, clerkClient, requireAuth, getAuth } from '@clerk/express';
import session from 'express-session';
// import Stripe from 'stripe';
// Phase別テーブル管理ライブラリをインポート
import {
  getPhaseTables,
  getPhaseFromLessonId,
  getPhase1Lessons,
  getPhaseLessons,
  getPhaseQuizAttempts,
  getPhaseClearedQuestions,
  getPhaseLessonBySlug,
  savePhaseQuizAttempt,
  savePhaseClearedQuestion,
  updatePhaseProgress,
  getPhase1ProgressPercentage,
  prisma
} from './lib/phase-database';
import {
  getArticles,
  getArticleBySlug,
  createArticle
} from './lib/article-database';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// セッションの型定義
declare module 'express-session' {
  interface SessionData {
    guestSessionId?: string;
  }
}

// prismaはphase-database.tsからインポート

// Stripeの初期化（コメントアウト）
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2024-12-18.acacia',
// });

const app = express();
// 環境変数 PORT があればそれを使う。なければ 8888 を使う
const PORT = process.env.PORT || 8888;

// JSONボディを解析するミドルウェア
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// EJS をビューエンジンとして設定する
app.set('view engine', 'ejs');
// viewsディレクトリのパスを絶対パスで指定
app.set('views', path.join(__dirname, 'views'));

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
const CACHE_DURATION = 5000; // 5秒に短縮（開発・テスト用）

// キャッシュされたクイズ回答履歴を取得する関数
async function getCachedQuizAttempts(userId?: string, sessionId?: string) {
  const cacheKey = userId ? `user_${userId}` : `session_${sessionId}`;
  const cached = quizAttemptsCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const attempts = await prisma.phase1QuizAttempt.findMany({
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

// Phase2ページ
app.get('/phase2', async (req, res) => {
  try {
    // 認証状態を取得
    const { userId, sessionId } = getUserIdentifier(req);

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
        const phase1Progress = await getPhase1Progress(null);
        const phase2Lessons = await getPhaseLessons(2);

        // Phase2のレッスンをチャプター別にグループ化
        const phase2Chapters = phase2Lessons.reduce((acc: any[], lesson: any) => {
          let chapter = acc.find(c => c.chapter === lesson.chapter);
          if (!chapter) {
            chapter = {
              chapter: lesson.chapter,
              title: `Stage ${lesson.chapter}`,
              lessons: [],
              totalQuestions: 0,
              clearedQuestions: 0,
              progressPercentage: 0
            };
            acc.push(chapter);
          }
          chapter.lessons.push(lesson);
          chapter.totalQuestions += lesson.questions.length;
          return acc;
        }, []);

        return res.render('phase2', {
          user: null,
          isGuest: true,
          publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
          phase1Progress: phase1Progress,
          phase2Lessons: phase2Lessons,
          chapters: phase2Chapters
        });
      }
    }

    const phase1Progress = await getPhase1Progress(userId);

    // Phase2のレッスンデータを取得
    const phase2Lessons = await getPhaseLessons(2);

    // Phase2のレッスンをチャプター別にグループ化
    const phase2Chapters = phase2Lessons.reduce((acc: any[], lesson: any) => {
      let chapter = acc.find(c => c.chapter === lesson.chapter);
      if (!chapter) {
        chapter = {
          chapter: lesson.chapter,
          title: `Stage ${lesson.chapter}`,
          lessons: [],
          totalQuestions: 0,
          clearedQuestions: 0,
          progressPercentage: 0
        };
        acc.push(chapter);
      }
      chapter.lessons.push(lesson);
      chapter.totalQuestions += lesson.questions.length;
      return acc;
    }, []);

    res.render('phase2', {
      user: user,
      isGuest: !userId,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
      phase1Progress: phase1Progress,
      phase2Lessons: phase2Lessons,
      chapters: phase2Chapters
    });
  } catch (error) {
    console.error('Error in /phase2 route:', error);
    res.status(500).render('error', {
      message: 'ページの読み込み中にエラーが発生しました。',
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY
    });
  }
});

// Phase3ページ
app.get('/phase3', async (req, res) => {
  try {
    // 認証状態を取得
    const { userId, sessionId } = getUserIdentifier(req);

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
        const phase1Progress = await getPhase1Progress(null);
        return res.render('phase3', {
          user: null,
          isGuest: true,
          publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
          phase1Progress: phase1Progress
        });
      }
    }

    const phase1Progress = await getPhase1Progress(userId);

    res.render('phase3', {
      user: user,
      isGuest: !userId,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
      phase1Progress: phase1Progress
    });
  } catch (error) {
    console.error('Error in /phase3 route:', error);
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
    // 1. Phase1のレッスンと、それに紐づく問題を取得
    const lessonsWithQuestions = await getPhase1Lessons();

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

    // ゲストモードでは進捗を無効化
    let correctAttempts: any[] = [];
    let clearedQuestionIds = new Set<number>();

    if (userId) {
      // ログイン済みの場合のみ進捗を取得
      correctAttempts = await getCachedQuizAttempts(userId, sessionId);
      clearedQuestionIds = new Set(correctAttempts.map(a => a.questionId));

      // デバッグ情報を追加
      console.log('Progress debug:', {
        userId,
        sessionId,
        correctAttemptsCount: correctAttempts.length,
        correctAttempts: correctAttempts,
        clearedQuestionIds: Array.from(clearedQuestionIds)
      });
    } else {
      console.log('Guest mode: Progress disabled');
    }

    // 章の情報を定義
    const chapterInfo: Record<number, string> = {
      1: '証券口座を開設しよう',
      2: '株価について学ぼう',
      3: 'NISAや税金について学ぼう',
      4: '株の買い方について学ぼう',
      5: '投資家のスタイルついて学ぼう',
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

    // 既存のchaptersを処理
    const processedChapters = Object.values(chapters).map(chapter => ({
      ...chapter,
      progressPercentage: chapter.totalQuestions > 0 ? (chapter.clearedQuestions / chapter.totalQuestions) * 100 : 0,
    }));

    // はじめにを追加
    const stage0Chapter = {
      chapter: 0,
      title: 'はじめに',
      lessons: [{
        id: 'stage0-intro',
        title: 'はじめに',
        slug: 'stage0-intro',
        chapter: 0,
        questions: []
      }],
      totalQuestions: 0,
      clearedQuestions: 0,
      progressPercentage: 0
    };

    // おわりにを追加
    const endingChapter = {
      chapter: 999, // 最後に表示されるように大きな数字
      title: 'おわりに',
      lessons: [{
        id: 'ending-intro',
        title: 'おわりに',
        slug: 'ending-intro',
        chapter: 999,
        questions: []
      }],
      totalQuestions: 0,
      clearedQuestions: 0,
      progressPercentage: 0
    };

    // はじめにを最初に、おわりにを最後に追加
    const chaptersWithProgress = [stage0Chapter, ...processedChapters, endingChapter];

    // Phase1の総問題数を計算（現在の全レッスンの問題数）
    const totalQuestions = lessonsWithQuestions.reduce((total, lesson) => total + lesson.questions.length, 0);

    // Phase1の進捗率を計算
    const phase1Progress = totalQuestions > 0 ? Math.round((clearedQuestionIds.size / totalQuestions) * 100) : 0;

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
          totalQuestions: totalQuestions,
          clearedQuestionIds: clearedQuestionIds,
          phase1Progress: phase1Progress,
          publishableKey: process.env.CLERK_PUBLISHABLE_KEY || ''
        });
      }
    }

    res.render('index', {
      chapters: chaptersWithProgress,
      user: user,
      isGuest: !userId, // ゲストモードかどうかのフラグ
      totalQuestions: totalQuestions,
      clearedQuestionIds: clearedQuestionIds,
      phase1Progress: phase1Progress,
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

// // 新規レッスン作成フォームを表示するルート
// app.get('/admin/lessons/new', (req, res) => {
//   res.render('new-lesson');
// });

// 記事一覧ページ
app.get('/articles', async (req, res) => {
  try {
    const articles = await getArticles();
    const { userId } = getUserIdentifier(req);

    // ユーザー情報を取得（ログイン済みの場合のみ）
    let user: any = null;
    if (userId && process.env.CLERK_SECRET_KEY) {
      try {
        user = await clerkClient.users.getUser(userId.toString());
      } catch (error) {
        console.error('Error fetching user from Clerk:', error);
      }
    }

    res.render('articles/index', {
      articles,
      user,
      isGuest: !userId,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY || ''
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).render('error', {
      message: '記事の取得中にエラーが発生しました。',
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY
    });
  }
});

// 記事詳細ページ
app.get('/articles/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const article = await getArticleBySlug(slug);

    if (!article) {
      return res.status(404).render('error', {
        message: '記事が見つかりませんでした。',
        publishableKey: process.env.CLERK_PUBLISHABLE_KEY
      });
    }

    const { userId } = getUserIdentifier(req);

    // ユーザー情報を取得（ログイン済みの場合のみ）
    let user: any = null;
    if (userId && process.env.CLERK_SECRET_KEY) {
      try {
        user = await clerkClient.users.getUser(userId.toString());
      } catch (error) {
        console.error('Error fetching user from Clerk:', error);
      }
    }

    res.render('articles/show', {
      article,
      user,
      isGuest: !userId,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY || ''
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).render('error', {
      message: '記事の取得中にエラーが発生しました。',
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY
    });
  }
});

// 記事作成ページ（管理者用）
app.get('/admin/articles/new', async (req, res) => {
  try {
    const { userId } = getUserIdentifier(req);

    // ユーザー情報を取得（ログイン済みの場合のみ）
    let user: any = null;
    if (userId && process.env.CLERK_SECRET_KEY) {
      try {
        user = await clerkClient.users.getUser(userId.toString());
      } catch (error) {
        console.error('Error fetching user from Clerk:', error);
      }
    }

    res.render('admin/articles/new', {
      user,
      isGuest: !userId,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY || ''
    });
  } catch (error) {
    console.error('Error loading article creation page:', error);
    res.status(500).render('error', {
      message: 'エラーが発生しました。',
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY
    });
  }
});

// 記事作成処理（管理者用）
app.post('/admin/articles', async (req, res) => {
  try {
    const { title, slug, content } = req.body;

    if (!title || !slug || !content) {
      return res.status(400).send('必須項目が不足しています');
    }

    await createArticle({
      title,
      slug,
      content
    });

    res.redirect('/articles');
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).send('記事の作成に失敗しました');
  }
});

// // 新規レッスンを作成するルート

// // 新規レッスンを作成するルート
// app.post('/admin/lessons', async (req, res) => {
//   const { title, content, chapter } = req.body;

//   await prisma.lesson.create({
//     data: {
//       title,
//       content,
//       chapter: parseInt(chapter, 10),
//     },
//   });

//   res.redirect('/learning');
// });

// クイズの回答を処理するルート（ゲストモード対応）
app.post('/lessons/:slug/quiz/submit', async (req, res) => {
  const slug = req.params.slug;
  const { questionId, selectedOptionId } = req.body;

  // レッスンのPhaseを判定して適切なテーブルを使用
  const phase = getPhaseFromLessonId(slug);
  const tables = getPhaseTables(phase);

  // レッスンを取得してIDを取得
  const lesson = await tables.lesson.findUnique({
    where: { slug }
  });

  if (!lesson) {
    return res.status(404).send('Lesson not found');
  }

  // デバッグ用ログ
  const { userId, sessionId } = getUserIdentifier(req);
  console.log('Quiz submission:', {
    lessonId: lesson.id,
    slug,
    questionId,
    selectedOptionId,
    userId,
    sessionId
  });

  // 選択された選択肢が正しいか確認
  const selectedOption = await tables.option.findUnique({
    where: { id: parseInt(selectedOptionId, 10) },
  });

  if (!selectedOption) {
    return res.status(404).send('Option not found');
  }

  const isCorrect = selectedOption.isCorrect;

  // ログイン済みの場合のみ進捗を保存
  if (userId) {
    // QuizAttemptに記録
    await savePhaseQuizAttempt(phase, {
      clerkUserId: userId,
      sessionId: null,
      questionId: parseInt(questionId, 10),
      selectedOptionId: parseInt(selectedOptionId, 10),
      isCorrect: isCorrect,
    });

    // キャッシュをクリア（進捗データを即座に反映）
    quizAttemptsCache.delete(`user_${userId}`);
    console.log(`Cache cleared for user: ${userId}`);
  } else {
    console.log('Guest mode: Progress not saved');
  }

  // 正解の選択肢IDを取得
  const correctOption = await tables.option.findFirst({
    where: { questionId: parseInt(questionId, 10), isCorrect: true },
  });

  const resultQuery = `?result=${isCorrect ? 'correct' : 'incorrect'}&selected=${selectedOptionId}&correct=${correctOption?.id}&question=${questionId}`;
  res.redirect(`/lessons/${slug}${resultQuery}`);
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

    // Phase1のレッスンを検索対象とする
    const totalLessons = await prisma.phase1Lesson.count();
    console.log('Total Phase1 lessons in database:', totalLessons);

    // SQLiteでは大文字小文字を区別しない検索のために、クエリを小文字に変換
    const searchQuery = query.toLowerCase();

    // Phase1のレッスンを取得して、JavaScriptで検索を実行
    const allLessons = await prisma.phase1Lesson.findMany();
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

// おわりに 専用ページ
app.get('/lessons/ending-intro', async (req, res) => {
  try {
    // 認証状態を取得
    const { userId, sessionId } = getUserIdentifier(req);

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
          lesson: {
            id: 'ending-intro',
            title: 'おわりに',
            content: `
              <div class="stage0-lesson-content">
                <p class="intro-greeting">Phase1の学習、お疲れさまでした！<span class="highlight-text">ナイスランです！</span></p>
                
                <p class="intro-description">
                  これであなたも「NISAって何？」と聞かれてドヤ顔できるレベルには到達したはずです。投資家デビューの準備は整いました！
                </p>
                
                <p class="intro-description">
                  とはいえ、投資の世界は広大です。正直なところ、Phase1を終えた時点では「ようやく装備を整えて、最初の草原に一歩踏み出した」くらいかもしれません。
                </p>
                
                <p class="intro-description">
                  しかし、ここから何よりも強力な武器になるのが<span class="highlight-text">「時間」</span>です。投資の利益は「複利」の魔法で、時間をかければかけるほど雪だるま式に大きくなっていきます。今日から投資の世界に足を踏み入れられたことは、数年後のあなたにとって最高のプレゼントとなることでしょう。
                </p>
                
                <p class="intro-description">
                  この先、Phase2, 3もご用意しています！私たちの目的は、「これを買えば絶対勝てる！」というような必勝法を伝授することではありません。巷に溢れる様々な投資法を前に、「なるほど、その手があったか」「これは自分にはちょっと…」と見極めるための<span class="highlight-text">「知識と判断力」</span>を、皆さんに提供することです。
                </p>
                
                <p class="intro-description">
                  「もっと先の景色を見てみたい！」と感じていただけたなら、ぜひPhase2、3へとお進みください！お待ちしております！
                </p>
                
                <div style="text-align: center;">
                  <a href="/phase2" class="next-stage-button">
                    Phase2へ進む <i class="fa-solid fa-arrow-right"></i>
                  </a>
                </div>
              </div>
            `,
            videoId: null,
            questions: []
          },
          nextLesson: null,
          user: null,
          isGuest: true,
          publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
          clearedQuestionIds: new Set(),
          quizResult: null
        });
      }
    }

    const lesson = {
      id: 'ending-intro',
      title: 'おわりに',
      content: `
        <div class="stage0-lesson-content">
          <p class="intro-greeting">Phase1の学習、お疲れさまでした！<span class="highlight-text">ナイスランです！</span></p>
          
          <p class="intro-description">
            これであなたも「NISAって何？」と聞かれてドヤ顔できるレベルには到達したはずです。投資家デビューの準備は整いました！
          </p>
          
          <p class="intro-description">
            とはいえ、投資の世界は広大です。正直なところ、Phase1を終えた時点では「ようやく装備を整えて、最初の草原に一歩踏み出した」くらいかもしれません。
          </p>
          
          <p class="intro-description">
            しかし、ここから何よりも強力な武器になるのが<span class="highlight-text">「時間」</span>です。投資の利益は「複利」の魔法で、時間をかければかけるほど雪だるま式に大きくなっていきます。今日から投資の世界に足を踏み入れられたことは、数年後のあなたにとって最高のプレゼントとなることでしょう。
          </p>
          
          <p class="intro-description">
            この先、Phase2, 3もご用意しています！私たちの目的は、「これを買えば絶対勝てる！」というような必勝法を伝授することではありません。巷に溢れる様々な投資法を前に、「なるほど、その手があったか」「これは自分にはちょっと…」と見極めるための<span class="highlight-text">「知識と判断力」</span>を、皆さんに提供することです。
          </p>
          
          <p class="intro-description">
            「もっと先の景色を見てみたい！」と感じていただけたなら、ぜひPhase2、3へとお進みください！お待ちしております！
          </p>
          
          <div style="text-align: center;">
            <a href="/phase2" class="next-stage-button">
              Phase2へ進む <i class="fa-solid fa-arrow-right"></i>
            </a>
          </div>
        </div>
      `,
      videoId: null,
      questions: []
    };

    res.render('lesson', {
      lesson,
      nextLesson: null,
      user: user,
      isGuest: !userId, // ゲストモードかどうかのフラグ
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      clearedQuestionIds: new Set(),
      quizResult: null
    });
  } catch (error) {
    console.error('Error in /lessons/ending-intro route:', error);
    res.status(500).render('error', {
      message: 'ページの読み込み中にエラーが発生しました。',
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY
    });
  }
});

// はじめに 専用ページ
app.get('/lessons/stage0-intro', async (req, res) => {
  try {
    // 認証状態を取得
    const { userId, sessionId } = getUserIdentifier(req);

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
          lesson: {
            id: 'stage0-intro',
            title: 'はじめに',
            content: `
              <div class="page-wrapper">
                  <header class="hero-section">
                      <h1 class="hero-title">はじめに</h1>
                      <p class="hero-subtitle">株式投資の世界へようこそ</p>
                  </header>

                  <main class="cards-container">
                      <div class="impact-card">
                          <div class="card-number">01</div>
                          <h2 class="card-title">
                              実践が<br />最大の学び
                          </h2>
                          <p class="card-text">
                              とりあえずやってみることが<br />一番の近道です
                          </p>
                      </div>

                      <div class="impact-card">
                          <div class="card-number">02</div>
                          <h2 class="card-title">
                              学習は<br />すぐに終わる
                          </h2>
                          <p class="card-text">
                              30分もあれば<br />投資家デビューできます
                          </p>
                      </div>
                  </main>

                  <div class="action-area">
                      <a href="/lessons/stage1-1" class="cta-button">
                          <span>Stage1-1へ進む</span>
                          <svg xmlns="http://www.w3.org/2000/svg" class="cta-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                      </a>
                  </div>
              </div>
            `,
            videoId: null,
            questions: []
          },
          nextLesson: null,
          user: null,
          isGuest: true,
          publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
          clearedQuestionIds: new Set(),
          quizResult: null
        });
      }
    }

    const lesson = {
      id: 'stage0-intro',
      title: 'はじめに',
      content: `
        <div class="page-wrapper">
            <header class="hero-section">
                <h1 class="hero-title">はじめに</h1>
                <p class="hero-subtitle">株式投資の世界へようこそ</p>
            </header>

            <main class="cards-container">
                <div class="impact-card">
                    <div class="card-number">01</div>
                    <h2 class="card-title">
                        実践が<br />最大の学び
                    </h2>
                    <p class="card-text">
                        とりあえずやってみることが<br />一番の近道です
                    </p>
                </div>

                <div class="impact-card">
                    <div class="card-number">02</div>
                    <h2 class="card-title">
                        学習は<br />すぐに終わる
                    </h2>
                    <p class="card-text">
                        30分もあれば<br />投資家デビューできます
                    </p>
                </div>
            </main>

            <div class="action-area">
                <a href="/lessons/stage1-1" class="cta-button">
                    <span>Stage1-1へ進む</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="cta-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                </a>
            </div>
        </div>
      `,
      videoId: null,
      questions: []
    };

    res.render('lesson', {
      lesson,
      nextLesson: null,
      user: user,
      isGuest: !userId, // ゲストモードかどうかのフラグ
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      clearedQuestionIds: new Set(),
      quizResult: null
    });
  } catch (error) {
    console.error('Error in /lessons/stage0-intro route:', error);
    res.status(500).render('error', {
      message: 'ページの読み込み中にエラーが発生しました。',
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY
    });
  }
});

// レッスン詳細ページ（ゲストモード対応）
app.get('/lessons/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const { result, selected, correct, question: answeredQuestionId } = req.query;

    // ユーザーの回答履歴を取得（キャッシュ使用）
    const { userId, sessionId } = getUserIdentifier(req);

    // ゲストモードでは進捗を無効化
    let clearedQuestionIds = new Set<number>();

    if (userId) {
      // ログイン済みの場合のみ進捗を取得
      const allAttempts = await getCachedQuizAttempts(userId, sessionId);
      const attempts = allAttempts.filter(attempt => {
        // レッスンIDでフィルタリング（キャッシュから取得したデータをフィルタ）
        return true; // この部分は後で最適化
      });
      clearedQuestionIds = new Set(attempts.map(a => a.questionId));
    } else {
      console.log('Guest mode: Progress disabled for lesson');
    }

    // レッスンのPhaseを判定して適切なテーブルを使用
    const phase = getPhaseFromLessonId(slug);
    let lesson;

    if (phase === 1) {
      // Phase1の場合はPhase1テーブルから取得
      lesson = await prisma.phase1Lesson.findUnique({
        where: { slug },
        include: {
          questions: {
            include: {
              options: true,
            },
          },
        },
      });
    } else {
      // Phase2/3の場合はPhase別テーブルから取得
      lesson = await getPhaseLessonBySlug(phase, slug);
    }

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
      if (phase === 1) {
        // Phase1の場合はPhase1テーブルから取得
        nextLesson = await prisma.phase1Lesson.findUnique({
          where: { id: nextLessonId }
        });
      } else {
        // Phase2/3の場合はPhase別のテーブルから取得
        const tables = getPhaseTables(phase);
        nextLesson = await tables.lesson.findUnique({
          where: { id: nextLessonId }
        });
      }
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

// Phase1の進捗を計算する関数
async function getPhase1Progress(userId: string | null): Promise<number> {
  if (!userId) return 0;

  try {
    // Phase1の進捗率を計算
    return await getPhase1ProgressPercentage(userId);
  } catch (error) {
    console.error('Error calculating Phase1 progress:', error);
    return 0;
  }
}

// 開発中ページ
app.get('/under-development', (req, res) => {
  res.render('under-development');
});

// 電子公告ページ
app.get('/notice', async (req, res) => {
  try {
    // 電子公告を取得（公開済みのもののみ、新しい順）
    const notices = await prisma.electronicNotice.findMany({
      where: {
        isActive: true
      },
      include: {
        attachments: true
      },
      orderBy: {
        publishedAt: 'desc'
      }
    });

    res.render('electronic-notice', {
      notices,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY
    });
  } catch (error) {
    console.error('Error fetching electronic notices:', error);
    res.status(500).render('error', {
      message: '電子公告の取得中にエラーが発生しました。',
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY
    });
  }
});

// 電子公告管理画面（管理者のみアクセス可能）
app.get('/admin/notice', requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).render('error', {
        message: '認証が必要です。',
        publishableKey: process.env.CLERK_PUBLISHABLE_KEY
      });
    }

    // ユーザー情報を取得してメールアドレスを確認
    const user = await clerkClient.users.getUser(userId);
    const userEmail = user.emailAddresses[0]?.emailAddress;

    // 管理者メールアドレスかチェック
    if (userEmail !== 'taisei040428@gmail.com') {
      return res.status(403).render('error', {
        message: 'このページにアクセスする権限がありません。',
        publishableKey: process.env.CLERK_PUBLISHABLE_KEY
      });
    }

    // 全ての電子公告を取得（非公開も含む）
    const notices = await prisma.electronicNotice.findMany({
      include: {
        attachments: true
      },
      orderBy: {
        publishedAt: 'desc'
      }
    });

    res.render('admin-electronic-notice', {
      notices,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY
    });
  } catch (error) {
    console.error('Error accessing admin panel:', error);
    res.status(500).render('error', {
      message: '管理画面へのアクセス中にエラーが発生しました。',
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY
    });
  }
});

// 電子公告のCRUD操作API

// 新しい公告を作成
app.post('/admin/notice', requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: '認証が必要です。' });
    }

    // ユーザー情報を取得してメールアドレスを確認
    const user = await clerkClient.users.getUser(userId);
    const userEmail = user.emailAddresses[0]?.emailAddress;

    // 管理者メールアドレスかチェック
    if (userEmail !== 'taisei040428@gmail.com') {
      return res.status(403).json({ error: 'この操作を実行する権限がありません。' });
    }

    const { title, content, type, publishedAt, isActive } = req.body;

    const notice = await prisma.electronicNotice.create({
      data: {
        title,
        content,
        type,
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        isActive: isActive === 'true' || isActive === true
      }
    });

    res.json({ success: true, notice });
  } catch (error) {
    console.error('Error creating notice:', error);
    res.status(500).json({ error: '公告の作成中にエラーが発生しました。' });
  }
});

// 公告を更新
app.put('/admin/notice/:id', requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: '認証が必要です。' });
    }

    // ユーザー情報を取得してメールアドレスを確認
    const user = await clerkClient.users.getUser(userId);
    const userEmail = user.emailAddresses[0]?.emailAddress;

    // 管理者メールアドレスかチェック
    if (userEmail !== 'taisei040428@gmail.com') {
      return res.status(403).json({ error: 'この操作を実行する権限がありません。' });
    }

    const { id } = req.params;
    const { title, content, type, publishedAt, isActive } = req.body;

    const notice = await prisma.electronicNotice.update({
      where: { id: parseInt(id) },
      data: {
        title,
        content,
        type,
        publishedAt: publishedAt ? new Date(publishedAt) : undefined,
        isActive: isActive === 'true' || isActive === true
      }
    });

    res.json({ success: true, notice });
  } catch (error) {
    console.error('Error updating notice:', error);
    res.status(500).json({ error: '公告の更新中にエラーが発生しました。' });
  }
});

// 公告の公開/非公開を切り替え
app.post('/admin/notice/:id/toggle', requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: '認証が必要です。' });
    }

    // ユーザー情報を取得してメールアドレスを確認
    const user = await clerkClient.users.getUser(userId);
    const userEmail = user.emailAddresses[0]?.emailAddress;

    // 管理者メールアドレスかチェック
    if (userEmail !== 'taisei040428@gmail.com') {
      return res.status(403).json({ error: 'この操作を実行する権限がありません。' });
    }

    const { id } = req.params;
    const { isActive } = req.body;

    const notice = await prisma.electronicNotice.update({
      where: { id: parseInt(id) },
      data: { isActive }
    });

    res.json({ success: true, notice });
  } catch (error) {
    console.error('Error toggling notice status:', error);
    res.status(500).json({ error: '公告の状態変更中にエラーが発生しました。' });
  }
});

// 公告を削除
app.delete('/admin/notice/:id', requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: '認証が必要です。' });
    }

    // ユーザー情報を取得してメールアドレスを確認
    const user = await clerkClient.users.getUser(userId);
    const userEmail = user.emailAddresses[0]?.emailAddress;

    // 管理者メールアドレスかチェック
    if (userEmail !== 'taisei040428@gmail.com') {
      return res.status(403).json({ error: 'この操作を実行する権限がありません。' });
    }

    const { id } = req.params;

    await prisma.electronicNotice.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notice:', error);
    res.status(500).json({ error: '公告の削除中にエラーが発生しました。' });
  }
});

// 指定したポートでサーバーを起動し、リクエストを待ち始める
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});