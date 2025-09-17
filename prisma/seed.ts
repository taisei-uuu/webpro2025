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

  // 既存のレッスンデータをチェック
  const existingLessons = await prisma.lesson.count();
  
  if (existingLessons > 0) {
    console.log(`Found ${existingLessons} existing lessons. Skipping seed to preserve user progress.`);
    return;
  }

  console.log("No existing lessons found. Proceeding with seed...");

  // 既存のデータをクリア (依存関係の深いものから削除)
  await prisma.quizAttempt.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.question.deleteMany(); // Questionを削除すると、関連するOptionもカスケード削除されます
  await prisma.lesson.deleteMany();
  await prisma.user.deleteMany();
  console.log("Deleted old data.");

  // テストユーザーを作成（Clerkを使用するため、パスワードは不要）
  const user = await prisma.user.create({
    data: {
      email: "test@example.com",
      password: "", // Clerkを使用するため空文字
      name: "Test User",
      clerkId: "test_clerk_id", // テスト用のClerk ID
    },
  });
  console.log(`Created user with id: ${user.id}`);

  const lessonsWithQuestions = [
    {
      chapter: 1,
      title: "1-1. 証券口座について",
      content: "株式投資を始める第一歩は「証券口座」を開設することです。\n\n1. 証券口座とは\n   • 株式や投資信託などの金融商品を売買するための専用の口座\n   • 普段使っている銀行口座とは別物\n   • 株を買ったり売ったりするためには必ず必要\n\n2. 証券口座の重要性\n   • 投資を始めるための必須条件\n   • 安全で確実な取引の基盤\n   • 資産形成の第一歩",
      questions: [
        {
          text: "株式投資を始める第一歩として必要なものは何ですか？",
          options: [
            { text: "銀行口座", isCorrect: false },
            { text: "証券口座", isCorrect: true },
            { text: "FX口座", isCorrect: false },
            { text: "クレジットカード", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 1,
      title: "1-2. 証券会社の選び方",
      content: "証券会社は大きく分けて2種類あります。\n\n1. 対面型証券会社\n   • 店舗で担当者と直接相談しながら取引\n   • 初心者には心強い\n   • 手数料が高め\n\n2. ネット証券\n   • インターネットで全て完結\n   • 手数料が安い\n   • スマホでも簡単に取引可能",
      questions: [
        {
          text: "手数料が安く、スマホでも簡単に取引できる証券会社の種類は何ですか？",
          options: [
            { text: "対面型証券会社", isCorrect: false },
            { text: "ネット証券", isCorrect: true },
            { text: "銀行系証券会社", isCorrect: false },
            { text: "保険系証券会社", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 1,
      title: "1-3. 証券会社選びのポイント",
      content: "証券会社選びの重要なポイントは以下の通りです。\n\n1. 取引手数料\n   • 安い方が利益を出しやすい\n   • 最近はネット証券で株式取引が無料のところも増加\n\n2. 使いやすさ\n   • 特に初心者にはアプリやウェブサイトの使いやすさが重要\n   • 直感的な操作ができるかチェック\n\n3. 銀行との連携\n   • 普段使っている銀行と連携している証券会社\n   • お金の入出金がスムーズ\n\n4. 投資情報の充実度\n   • 銘柄情報や投資に役立つコンテンツが充実しているか\n   • 学習コンテンツの質も確認",
      questions: [
        {
          text: "証券会社を選ぶ際に、初心者にとって特に重要なポイントは何ですか？",
          options: [
            { text: "取引手数料の安さ", isCorrect: false },
            { text: "アプリやウェブサイトの使いやすさ", isCorrect: true },
            { text: "店舗の数", isCorrect: false },
            { text: "設立年数", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 1,
      title: "1-4. 口座開設の流れ",
      content: "証券口座開設の手続きは以下の流れで進みます。\n\n1. 申し込み手続き\n   • 証券会社のウェブサイトやアプリから申し込み\n   • 必要事項を入力\n\n2. 本人確認書類の提出\n   • 運転免許証やマイナンバーカードなど\n   • 書類をアップロード\n\n3. 審査期間\n   • 数日〜1週間程度\n   • 口座開設完了の連絡が来る\n\n4. 口座開設完了\n   • 口座に入金\n   • いよいよ株式投資のスタート！",
      questions: [
        {
          text: "証券口座開設の手続きで、本人確認書類として使用できないものは何ですか？",
          options: [
            { text: "運転免許証", isCorrect: false },
            { text: "マイナンバーカード", isCorrect: false },
            { text: "パスポート", isCorrect: false },
            { text: "学生証", isCorrect: true },
          ],
        },
      ],
    },
    {
      chapter: 2,
      title: "2-1. 株価とは",
      content: "株価とは、株式（企業の一部の所有権）の市場での取引価格です。簡単に言えば、「その会社の株を1株買うためにいくら払えばいいか」を示す金額です。\n\n株価の決まり方：株価は需要と供給のバランスで決まります。\n• 買いたい人が多い（需要が高い）→株価は上がる\n• 売りたい人が多い（供給が多い）→株価は下がる\n\nつまり、その株を買いたいチームと売りたいチームの綱引きのようなものです！",
      questions: [
        {
          text: "株価とは？",
          options: [
            { text: "企業の利益", isCorrect: false },
            { text: "株式の市場での取引価格", isCorrect: true },
            { text: "企業の資産", isCorrect: false },
            { text: "配当金", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 2,
      title: "2-2. 株価を見る道具",
      content: "株価を見る道具には次の2つがあるよ！\n\n• 「板」：現在、株を売りたいチームと買いたいチームの人数をまとめた表。それぞれどの値段で売買したいと思っているのかを一目で確認できる。\n• 「チャート」：株価の時間的変化をグラフにしたもの。過去の値動きから将来を予測する参考になる。",
      questions: [
        {
          text: "株価の時間的変化をグラフにしたものはどれ？",
          options: [
            { text: "板", isCorrect: false },
            { text: "チャート", isCorrect: true },
            { text: "トランジション", isCorrect: false },
            { text: "配当", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 2,
      title: "2-3. 株式売買の単元",
      content: "株式売買の単元：日本市場では100株単位で売買されているよ！これを単元という！だからもし、株価が1000円の企業の株を買いたいと思ったら、1000円×100株=10万円用意しなければならないんだ！でも、証券会社によっては、1株単位で売買できる「単元未満株」を提供しているものもあるよ！",
      questions: [
        {
          text: "日本市場において取引される単位は何株？",
          options: [
            { text: "1株", isCorrect: false },
            { text: "10株", isCorrect: false },
            { text: "100株", isCorrect: true },
            { text: "1000株", isCorrect: false },
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
