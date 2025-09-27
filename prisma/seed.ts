import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

// tsx経由での実行時に.envを確実に読み込むために追加
dotenv.config();

/**
 * データベースシードファイル
 * 
 * 使用方法:
 * - 通常のシード（進捗データを保護）: npm run db:seed
 * - 強制リセット（全データを削除）: npm run db:reset
 * 
 * レッスンデータの変更:
 * 1. lessonsWithQuestions配列を編集
 * 2. npm run db:reset を実行
 * 
 * 注意: 強制リセット時は全ユーザーの進捗データも削除されます
 */

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
  
  // FORCE_RESET環境変数で強制リセットを制御
  const forceReset = process.env.FORCE_RESET === 'true';
  
  if (existingLessons > 0 && !forceReset) {
    console.log(`Found ${existingLessons} existing lessons. Skipping seed to preserve user progress.`);
    console.log('To force reset, set FORCE_RESET=true environment variable');
    return;
  }

  if (forceReset) {
    console.log("FORCE_RESET=true detected. Proceeding with full reset...");
  } else {
    console.log("No existing lessons found. Proceeding with seed...");
  }

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
    // Stage 1: 証券口座を開設しよう
    {
      chapter: 1,
      title: "Stage1-1. 証券口座を開設しよう",
      slug: "stage1-1",
      content: "株式投資を始める第一歩は「証券口座」を開設することです。\n\n## 証券口座開設の流れ\n\n下のカードをクリックして、証券口座開設の詳細な手順を確認しましょう。\n\n<div id=\"retro-cards-container\"></div>\n\n### 基本的な流れ\n\n1. **証券口座とは**\n   • 株式や投資信託などの金融商品を売買するための専用の口座\n   • 普段使っている銀行口座とは別物\n   • 株を買ったり売ったりするためには必ず必要\n\n2. **証券口座の重要性**\n   • 投資を始めるための必須条件\n   • 安全で確実な取引の基盤\n   • 資産形成の第一歩",
      videoId: "1121367493",
      videoTitle: "証券口座を開設しよう",
      questions: [
        {
          text: "国内の株式取引において、最も安い手数料はいくらでしょうか。",
          options: [
            { text: "100円", isCorrect: false },
            { text: "0円", isCorrect: true },
            { text: "50円", isCorrect: false },
            { text: "500円", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 1,
      title: "Stage1-2. 口座開設手順を確認しよう",
      slug: "stage1-2",
      content: "証券口座開設の手続きは以下の流れで進みます。\n\n## 口座開設の詳細手順\n\n下のカードをクリックして、口座開設の詳細な手順を確認しましょう。\n\n<div id=\"retro-cards-container\"></div>\n\n### 基本的な流れ\n\n1. 申し込み手続き\n   • 証券会社のウェブサイトやアプリから申し込み\n   • 必要事項を入力\n\n2. 本人確認書類の提出\n   • 運転免許証やマイナンバーカードなど\n   • 書類をアップロード\n\n3. 審査期間\n   • 数日〜1週間程度\n   • 口座開設完了の連絡が来る\n\n4. 口座開設完了\n   • 口座に入金\n   • いよいよ株式投資のスタート！",
      videoId: "1121397428",
      videoTitle: "口座開設伴走",
      questions: [
        {
          text: "NISA口座の開設に関する以下の記述のうち、正しいものはどれですか？",
          options: [
            { text: "証券会社と銀行で、それぞれ1つずつNISA口座を開設できる。", isCorrect: false },
            { text: "年間投資額が大きい人は、特例で複数のNISA口座を開設できる。", isCorrect: false },
            { text: "自分が開設するすべての証券会社でNISA口座を開設できる。", isCorrect: false },
            { text: "NISA口座はすべての金融機関を通じて1人1つしか開設できない。", isCorrect: true },
          ],
        },
      ],
    },
    // Stage 2: 株価について知ろう
    {
      chapter: 2,
      title: "Stage2-1. 株価について学ぼう",
      slug: "stage2-1",
      content: "株価とは、株式（企業の一部の所有権）の市場での取引価格です。簡単に言えば、「その会社の株を1株買うためにいくら払えばいいか」を示す金額です。\n\n## 株価の詳細解説\n\n下のカードをクリックして、株価について詳しく学びましょう。\n\n<div id=\"retro-cards-container\"></div>\n\n### 株価の決まり方\n\n株価は需要と供給のバランスで決まります。\n• 買いたい人が多い（需要が高い）→株価は上がる\n• 売りたい人が多い（供給が多い）→株価は下がる\n\nつまり、その株を買いたいチームと売りたいチームの綱引きのようなものです！",
      videoId: "1121413384",
      videoTitle: "株価について",
      questions: [
        {
          text: "株価について説明したもので正しいものはどれですか？",
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
      title: "Stage2-2. 株価を見る道具について学ぼう",
      slug: "stage2-2",
      content: "株価を見る道具には次の2つがあるよ！\n\n## 株価分析ツールの詳細\n\n下のカードをクリックして、株価分析の道具について詳しく学びましょう。\n\n<div id=\"retro-cards-container\"></div>\n\n### 基本的な道具\n\n• 「板」：現在、株を売りたいチームと買いたいチームの人数をまとめた表。それぞれどの値段で売買したいと思っているのかを一目で確認できる。\n• 「チャート」：株価の時間的変化をグラフにしたもの。過去の値動きから将来を予測する参考になる。",
      videoId: "1121413425",
      videoTitle: "チャート・板",
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
    // Stage 3: 投資戦略を学ぼう
    {
      chapter: 3,
      title: "Stage3-1. NISAや税金について学ぼう",
      slug: "stage3-1",
      content: "投資で得た利益には税金がかかります。税金の仕組みを理解し、適切な口座を選択することで、税負担を軽減し、より効率的な資産形成が可能になります。\n\n## 税金と口座の詳細解説\n\n下のカードをクリックして、税金と口座について詳しく学びましょう。\n\n<div id=\"retro-cards-container\"></div>\n\n### 投資にかかる税金\n• 株式の売却益：20.315%（所得税15.315% + 住民税5%）\n• 配当金：20.315%（源泉徴収あり）\n• 投資信託の分配金：20.315%\n\n### 口座の種類\n• **特定口座（源泉徴収あり）**：証券会社が税金を計算・納付\n• **特定口座（源泉徴収なし）**：自分で確定申告が必要\n• **一般口座**：自分で確定申告が必要、複数証券会社の損益を通算可能\n• **NISA口座**：投資利益が非課税（年間120万円まで）",
      videoId: "1121413457",
      videoTitle: "口座区分",
      questions: [
        {
          text: "投資で得た利益にかかる税率は何％ですか？",
          options: [
            { text: "10.315%", isCorrect: false },
            { text: "15.315%", isCorrect: false },
            { text: "20.315%", isCorrect: true },
            { text: "25.315%", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 3,
      title: "Stage3-2. NISAについて深く学ぼう",
      slug: "stage3-2",
      content: "NISA（少額投資非課税制度）は、投資で得た利益が非課税になる日本独自の制度です。NISAの仕組みを詳しく理解し、効果的に活用することで、税負担を軽減しながら資産形成ができます。\n\n## NISAの詳細解説\n\n下のカードをクリックして、NISAについて詳しく学びましょう。\n\n<div id=\"retro-cards-container\"></div>\n\n### NISAの基本情報\n• **年間投資枠**：120万円（2024年から）\n• **非課税期間**：20年間\n• **投資対象**：株式、投資信託、ETFなど\n• **対象外**：REIT、債券、FXなど\n\n### 新NISAの特徴（2024年〜）\n• **投資枠の拡大**：年間120万円（従来の40万円から拡大）\n• **非課税期間の延長**：20年間（従来の5年間から延長）\n• **より柔軟な運用**：投資商品の選択肢が拡大",
      videoId: "1122376704",
      videoTitle: "NISA",
      questions: [
        {
          text: "NISAの成長投資枠における年間投資枠はいくらですか？",
          options: [
            { text: "40万円", isCorrect: false },
            { text: "80万円", isCorrect: false },
            { text: "120万円", isCorrect: false },
            { text: "240万円", isCorrect: true },
          ],
        },
      ],
    },
    // Stage 4: NISAについて知ろう
    {
      chapter: 4,
      title: "Stage4-1. 株の注文方法について学ぼう",
      slug: "stage4-1",
      content: "株式投資では、注文方法を理解することが重要です。指値注文と成行注文の特徴を理解し、市場状況や投資目的に応じて適切な注文方法を選択することで、より効果的な取引ができます。\n\n## 注文方法の詳細解説\n\n下のカードをクリックして、注文方法について詳しく学びましょう。\n\n<div id=\"retro-cards-container\"></div>\n\n### 指値注文の特徴\n• **価格指定**：希望する価格を指定して注文\n• **約定待ち**：指定価格で約定するまで待機\n• **コストコントロール**：希望価格で取引可能\n• **約定リスク**：指定価格で約定しない場合がある\n\n### 成行注文の特徴\n• **即座約定**：現在の市場価格で即座に約定\n• **確実性**：確実に約定する\n• **急変対応**：急な価格変動に対応可能\n• **価格リスク**：予想より不利な価格で約定する場合がある",
      videoId: "1122376741",
      videoTitle: "指値、成行",
      questions: [
        {
          text: "希望する価格を指定して注文する方法はどれですか？",
          options: [
            { text: "成行注文", isCorrect: false },
            { text: "指値注文", isCorrect: true },
            { text: "希望価格注文", isCorrect: false },
            { text: "OCO注文", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 4,
      title: "Stage4-2. 株の単元について学ぼう",
      slug: "stage4-2",
      content: "日本の株式市場では、基本的に100株単位で取引が行われます。これを「単元」といいます。また、1株単位で取引できる「単元未満株」という制度もあります。単元と単元未満株の特徴を理解し、目的に応じて使い分けることが重要です。\n\n## 単元と単元未満株の詳細解説\n\n下のカードをクリックして、単元について詳しく学びましょう。\n\n<div id=\"retro-cards-container\"></div>\n\n### 単元（100株単位）の特徴\n• **基本単位**：日本では基本的に100株単位で取引\n• **手数料**：通常の手数料で取引可能\n• **権利**：配当、株主優待、議決権などの権利を享受\n• **流動性**：高い流動性で売買しやすい\n\n### 単元未満株（1株単位）の特徴\n• **1株単位**：1株から取引可能\n• **制限事項**：配当は100株分のみ、株主優待は対象外\n• **手数料**：通常より高い手数料\n• **売却制限**：1株単位での売却のみ可能",
      videoId: "1122377645",
      videoTitle: "株の単元",
      questions: [
        {
          text: "日本の株式市場で基本的な取引単位は何株ですか？",
          options: [
            { text: "1株", isCorrect: false },
            { text: "10株", isCorrect: false },
            { text: "100株", isCorrect: true },
            { text: "1000株", isCorrect: false },
          ],
        },
      ],
    },
    // Stage 5: 投資信託について知ろう
    {
      chapter: 5,
      title: "Stage5-1. 基本的な分析手法について学ぼう",
      slug: "stage5-1",
      content: "株式投資では、適切な分析手法を理解することが重要です。テクニカル分析とファンダメンタル分析の特徴を理解し、目的に応じて使い分けることで、より良い投資判断ができます。\n\n## 分析手法の詳細解説\n\n下のカードをクリックして、分析手法について詳しく学びましょう。\n\n<div id=\"retro-cards-container\"></div>\n\n### テクニカル分析の特徴\n• **価格データ分析**：チャートや価格データを分析\n• **短期予測**：短期的な価格動向の予測に適している\n• **指標活用**：移動平均線、RSI、MACDなどの指標を使用\n• **市場心理**：市場参加者の心理を読み取る\n\n### ファンダメンタル分析の特徴\n• **企業価値分析**：企業の業績や財務状況を分析\n• **長期投資**：長期的な投資価値の判断に適している\n• **財務指標**：PER、PBR、ROEなどの財務指標を活用\n• **経済環境**：経済環境や業界動向を考慮",
      videoId: "1122379259",
      videoTitle: "分析手法",
      questions: [
        {
          text: "チャートを分析して将来の価格動向を予測する手法はどれですか？",
          options: [
            { text: "ファンダメンタル分析", isCorrect: false },
            { text: "テクニカル分析", isCorrect: true },
            { text: "バリュー投資", isCorrect: false },
            { text: "グロース投資", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 5,
      title: "Stage5-2. 投資信託について学ぼう",
      slug: "stage5-2",
      content: "投資信託は、多くの投資家から集めたお金を専門家が運用し、その成果を投資家に分配する金融商品です。少額から始められ、プロが運用してくれるため、初心者にもおすすめの投資商品です。\n\n## 投資信託の詳細解説\n\n下のカードをクリックして、投資信託について詳しく学びましょう。\n\n<div id=\"retro-cards-container\"></div>\n\n### 投資信託の特徴\n\n1. **少額から始められる**\n   • 100円から投資可能\n   • 個別株より手軽\n\n2. **プロが運用**\n   • 専門知識がなくても投資可能\n   • 分散投資が自動的に行われる\n\n3. **流動性が高い**\n   • 原則として毎日売買可能\n   • 換金しやすい\n\n4. **手数料がかかる**\n   • 信託報酬、購入時手数料など\n   • コストを理解して選択",
      videoId: "1122380913",
      videoTitle: "投資信託",
      questions: [
        {
          text: "投資信託の最大の特徴は何ですか？",
          options: [
            { text: "元本保証", isCorrect: false },
            { text: "専門家が運用する", isCorrect: true },
            { text: "必ず利益が出る", isCorrect: false },
            { text: "手数料がかからない", isCorrect: false },
          ],
        },
      ],
    },
    {
      chapter: 5,
      title: "Stage5-3. 投資の時間軸について学ぼう",
      slug: "stage5-3",
      content: "投資には様々な時間軸があります。長期投資、スイングトレード、デイトレード、スキャルピングなど、それぞれ異なる特徴があります。自分の性格や時間的余裕に応じて適切な投資手法を選択することが重要です。\n\n## 投資の時間軸詳細解説\n\n下のカードをクリックして、投資の時間軸について詳しく学びましょう。\n\n<div id=\"retro-cards-container\"></div>\n\n### 投資手法の比較\n\n1. **長期投資**\n   • 期間：数年〜数十年\n   • リスク：低〜中\n   • 必要な時間：少ない\n   • 初心者におすすめ\n\n2. **スイングトレード**\n   • 期間：数日〜数週間\n   • リスク：中\n   • 必要な時間：中程度\n   • 中級者向け\n\n3. **デイトレード**\n   • 期間：1日以内\n   • リスク：高\n   • 必要な時間：多い\n   • 上級者向け\n\n4. **スキャルピング**\n   • 期間：数分〜数時間\n   • リスク：非常に高い\n   • 必要な時間：非常に多い\n   • プロ向け",
      videoId: "1122386293",
      videoTitle: "時間軸",
      questions: [
        {
          text: "数日〜数週間のスパンで株式を取引するトレード手法を何と言いますか？",
          options: [
            { text: "デイトレード", isCorrect: false },
            { text: "スキャルピング", isCorrect: false },
            { text: "長期投資", isCorrect: false },
            { text: "スイングトレード", isCorrect: true },
          ],
        },
      ],
    },
    {
      chapter: 5,
      title: "Stage5-4. 自分の投資スタイルを見つける",
      slug: "stage5-4",
      content: "これまでの学びを活かし、自分に合った投資スタイルを確立することは、成功する投資の鍵となります。自分の性格、状況、目標に応じて、一貫性のある投資戦略を構築しましょう。\n\n## 投資スタイル確立の詳細\n\n下のカードをクリックして、投資スタイルの確立について詳しく学びましょう。\n\n<div id=\"retro-cards-container\"></div>\n\n### 投資スタイルの確立\n\n1. **リスク許容度の把握**\n   • 年齢、収入、家族構成を考慮\n   • 損失に耐えられる範囲を設定\n\n2. **投資目的の設定**\n   • 具体的な目標金額と期間\n   • 定期的な見直し\n\n3. **継続的な学習**\n   • 市場の動向を学ぶ\n   • 投資知識を深める\n\n4. **長期的な視点**\n   • 短期的な価格変動に惑わされない\n   • 着実に資産を築く",
      videoId: "1122386312",
      videoTitle: "総まとめ",
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
