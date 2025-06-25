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
  const { name, age } = req.body; // nameとageを両方取得

  // ageが文字列で送られてくるので、数値に変換する
  // 入力がない場合は null になるようにする
  const ageInt = age ? parseInt(age, 10) : null;

  if (name) {
    await prisma.user.create({
      data: {
        name,
        age: ageInt, // 年齢も保存
      },
    });
    console.log('新しいユーザーを追加しました:', { name, age: ageInt });
  }
  res.redirect('/');
});

// 指定したポートでサーバーを起動し、リクエストを待ち始める
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});