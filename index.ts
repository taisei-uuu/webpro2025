import express from 'express';
// 生成した Prisma Client をインポート
import { PrismaClient } from './generated/prisma/client';

const prisma = new PrismaClient({
  // 開発中は、実行されたクエリをログに表示する
  log: ['query'],
});

const app = express();
// 環境変数 PORT があればそれを使う。なければ 8888 を使う
const PORT = process.env.PORT || 8888;

// EJS をビューエンジンとして設定する
app.set('view engine', 'ejs');
// EJS のテンプレートファイルが置かれているディレクトリを指定する
app.set('views', './views');

// POSTリクエストで送信されたフォームのデータを受け取れるようにする設定
app.use(express.urlencoded({ extended: true }));

// ルートURL ("/") にGETリクエストが来たときの処理
app.get('/', async (req, res) => {
  // データベースからすべてのユーザーを取得
  const users = await prisma.user.findMany();
  // 'index.ejs' というテンプレートを描画し、'users' という名前でデータを渡す
  res.render('index', { users });
});

// "/users" にPOSTリクエストが来たときの処理（ユーザー追加）
app.post('/users', async (req, res) => {
  // フォームの 'name' フィールドからユーザー名を取得
  const name = req.body.name;
  if (name) {
    // データベースに新しいユーザーを作成
    await prisma.user.create({
      data: { name },
    });
    console.log('新しいユーザーを追加しました:', name);
  }
  // 処理が終わったら、ルートURL ("/") にリダイレクト（再読み込み）する
  res.redirect('/');
});

// 指定したポートでサーバーを起動し、リクエストを待ち始める
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});