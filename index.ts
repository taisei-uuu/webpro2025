// Prismaが自動生成したクライアントを、指定の場所からインポートする
import { PrismaClient } from "./generated/prisma/client";
const prisma = new PrismaClient({
  // 実行されたクエリをコンソールにログとして表示する設定
  log: ['query'],
});

// メインの処理を記述する非同期関数
async function main() {
  console.log("Prisma Client を初期化しました。");

  // 既存のユーザーをすべて取得して表示
  let users = await prisma.user.findMany();
  console.log("Before ユーザー一覧:", users);

  // 新しいユーザーを作成
  const newUser = await prisma.user.create({
    data: {
      name: `新しいユーザー ${new Date().toISOString()}`,
    },
  });
  console.log("新しいユーザーを追加しました:", newUser);

  // もう一度ユーザーをすべて取得して表示
  users = await prisma.user.findMany();
  console.log("After ユーザー一覧:", users);
}

// main関数を実行する
main()
  .catch(e => {
    // もしエラーが起きたら内容を表示
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // 処理の最後に、データベースとの接続を切断する
    await prisma.$disconnect();
    console.log("Prisma Client を切断しました。");
  });