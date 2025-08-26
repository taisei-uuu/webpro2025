import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

// tsx経由での実行時に.envを確実に読み込むために追加
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  // どのデータベースに接続しようとしているか確認
  console.log(
    `Seeding database at: ${
      process.env.DATABASE_URL
        ? process.env.DATABASE_URL.split("@")[1]
        : "DATABASE_URL not found"
    }`
  );
  console.log(`Start seeding ...`);

  // 既存のデータをクリア (依存関係の深いものから削除)
  // QuizAttemptはまだUserモデルがないため、コメントアウトのまま
  await prisma.quizAttempt.deleteMany();
  await prisma.question.deleteMany(); // Questionを削除すると、関連するOptionもカスケード削除されます
  await prisma.lesson.deleteMany();
  await prisma.user.deleteMany();
  console.log("Deleted old data.");

  // パスワードをハッシュ化
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash("password123", 10);
  
  const user = await prisma.user.create({
    data: {
      email: "test@example.com",
      password: hashedPassword,
      name: "Test User",
    },
  });
  console.log(`Created user with id: ${user.id}`);

  const lessonsWithQuestions = [
    {
      chapter: 1,
      title: "1-1. 株式とは何か？",
      content: "株式の基本的な概念、株式会社の仕組みについて学びます。",
      questions: [
        {
          text: "株式会社が資金調達のために発行するものは何ですか？",
          options: [
            { text: "債券", isCorrect: false },
            { text: "株式", isCorrect: true },
            { text: "手形", isCorrect: false },
            { text: "投資信託", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 1,
      title: "1-2. 証券口座の開設方法",
      content:
        "株式投資を始めるために必要な証券口座の選び方と開設手順を解説します。",
      questions: [
        {
          text: "株式の売買を行うために、まず開設する必要があるものは何ですか？",
          options: [
            { text: "銀行口座", isCorrect: false },
            { text: "証券口座", isCorrect: true },
            { text: "FX口座", isCorrect: false },
            { text: "当座預金口座", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 1,
      title: "1-3. 株の買い方・売り方",
      content:
        "実際の株式取引の基本となる、注文方法（成行・指値など）を学びます。",
      questions: [
        {
          text: "価格を指定せずに現在の市場価格で売買する注文方法を何と呼びますか？",
          options: [
            { text: "指値注文", isCorrect: false },
            { text: "逆指値注文", isCorrect: false },
            { text: "成行注文", isCorrect: true },
            { text: "IOC注文", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 2,
      title: "2-1. 企業分析の第一歩（ファンダメンタルズ分析）",
      content: "企業の財務状況や成長性から株価の価値を分析する方法です。",
      questions: [
        {
          text: "企業の収益性や資産状況を分析する手法を何と呼びますか？",
          options: [
            { text: "テクニカル分析", isCorrect: false },
            { text: "ファンダメンタルズ分析", isCorrect: true },
            { text: "センチメント分析", isCorrect: false },
            { text: "クオンツ分析", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 2,
      title: "2-2. チャートの読み方（テクニカル分析）",
      content:
        "株価のチャートパターンや指標から将来の値動きを予測する方法です。",
      questions: [
        {
          text: "株価チャートで、短期の移動平均線が長期の移動平均線を下から上に突き抜ける現象を何と呼びますか？",
          options: [
            { text: "デッドクロス", isCorrect: false },
            { text: "ゴールデンクロス", isCorrect: true },
            { text: "ダウントレンド", isCorrect: false },
            { text: "レンジ相場", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 2,
      title: "2-3. 投資指標（PER, PBR, ROE）の見方",
      content: "企業の株価が割安か割高かを判断するための代表的な指標を学びます。",
      questions: [
        {
          text: "株価収益率（PER）が低いほど、一般的に株価はどのように評価されますか？",
          options: [
            { text: "割高", isCorrect: false },
            { text: "割安", isCorrect: true },
            { text: "適正価格", isCorrect: false },
            { text: "評価不能", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 3,
      title: "3-1. 長期投資と短期投資",
      content: "それぞれの投資スタイルのメリット・デメリットと戦略の違いを理解します。",
      questions: [
        {
          text: "配当や株主優待を目的とし、数年から数十年単位で株式を保有する投資スタイルはどれですか？",
          options: [
            { text: "デイトレード", isCorrect: false },
            { text: "スイングトレード", isCorrect: false },
            { text: "長期投資", isCorrect: true },
            { text: "スキャルピング", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 3,
      title: "3-2. 分散投資の重要性",
      content: "リスクを抑えるための資産分散（銘柄、時間、地域）の考え方を学びます。",
      questions: [
        {
          text: "投資のリスクを低減させるために、複数の異なる資産に資金を配分することを何と呼びますか？",
          options: [
            { text: "集中投資", isCorrect: false },
            { text: "信用取引", isCorrect: false },
            { text: "分散投資", isCorrect: true },
            { text: "レバレッジ", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 3,
      title: "3-3. 損切りルールの設定",
      content: "大きな損失を避けるための、損切り（ロスカット）の重要性とルールの設定方法を学びます。",
      questions: [
        {
          text: "保有している株式の価格が、購入時の価格から一定の割合下落した場合に売却するルールを何と呼びますか？",
          options: [
            { text: "利益確定（利確）", isCorrect: false },
            { text: "損切り（ロスカット）", isCorrect: true },
            { text: "ナンピン買い", isCorrect: false },
            { text: "塩漬け", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 4,
      title: "4-1. NISA・iDeCoの活用法",
      content: "税制優遇を受けられるNISAやiDeCoの制度を理解し、賢く活用する方法を学びます。",
      questions: [
        {
          text: "NISA（少額投資非課税制度）の最大のメリットは何ですか？",
          options: [
            { text: "元本が保証される", isCorrect: false },
            { text: "投資で得た利益が非課税になる", isCorrect: true },
            { text: "いつでも好きな金額を引き出せる", isCorrect: false },
            { text: "損失が出た場合に補填される", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 4,
      title: "4-2. 経済ニュースの読み解き方",
      content: "日々の経済ニュースが株価にどう影響するかを読み解く視点を養います。",
      questions: [
        {
          text: "中央銀行が金融引き締めのために行う政策は次のうちどれですか？",
          options: [
            { text: "利下げ", isCorrect: false },
            { text: "量的緩和", isCorrect: false },
            { text: "利上げ", isCorrect: true },
            { text: "財政出動", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 4,
      title: "4-3. 自分の投資スタイルを見つける",
      content: "これまでの学びを活かし、自分に合った投資スタイルを確立する方法を考えます。",
      questions: [
        {
          text: "自分の投資スタイルを確立する上で、最も重要でない要素は次のうちどれですか？",
          options: [
            { text: "リスク許容度", isCorrect: false },
            { text: "投資目的と期間", isCorrect: false },
            { text: "他人の成功事例をそのまま真似すること", isCorrect: true },
            { text: "自分の知識や経験", isCorrect: false },
          ],
        },
      ],
    },
  ];

  for (const data of lessonsWithQuestions) {
    const { questions, ...lessonData } = data;
    const lesson = await prisma.lesson.create({
      data: {
        ...lessonData,
        questions: {
          create: questions.map((q) => ({
            text: q.text,
            options: {
              create: q.options,
            },
          })),
        },
      },
    });
    console.log(`Created lesson with id: ${lesson.id}`);
  }

  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
