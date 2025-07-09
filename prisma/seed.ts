import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  // 既存のデータをクリア
  await prisma.lesson.deleteMany();
  console.log('Deleted old lessons.');

  const lessonsData = [
    { chapter: 1, title: '1-1. 株式とは何か？', content: '株式の基本的な概念、株式会社の仕組みについて学びます。' },
    { chapter: 1, title: '1-2. 証券口座の開設方法', content: '株式投資を始めるために必要な証券口座の選び方と開設手順を解説します。' },
    { chapter: 1, title: '1-3. 株の買い方・売り方', content: '実際の株式取引の基本となる、注文方法（成行・指値など）を学びます。' },
    { chapter: 2, title: '2-1. 企業分析の第一歩（ファンダメンタルズ分析）', content: '企業の財務状況や成長性から株価の価値を分析する方法です。' },
    { chapter: 2, title: '2-2. チャートの読み方（テクニカル分析）', content: '株価のチャートパターンや指標から将来の値動きを予測する方法です。' },
    { chapter: 2, title: '2-3. 投資指標（PER, PBR, ROE）の見方', content: '企業の株価が割安か割高かを判断するための代表的な指標を学びます。' },
    { chapter: 3, title: '3-1. 長期投資と短期投資', content: 'それぞれの投資スタイルのメリット・デメリットと戦略の違いを理解します。' },
    { chapter: 3, title: '3-2. 分散投資の重要性', content: 'リスクを抑えるための資産分散（銘柄、時間、地域）の考え方を学びます。' },
    { chapter: 3, title: '3-3. 損切りルールの設定', content: '大きな損失を避けるための、損切り（ロスカット）の重要性とルールの設定方法を学びます。' },
    { chapter: 4, title: '4-1. NISA・iDeCoの活用法', content: '税制優遇を受けられるNISAやiDeCoの制度を理解し、賢く活用する方法を学びます。' },
    { chapter: 4, title: '4-2. 経済ニュースの読み解き方', content: '日々の経済ニュースが株価にどう影響するかを読み解く視点を養います。' },
    { chapter: 4, title: '4-3. 自分の投資スタイルを見つける', content: 'これまでの学びを活かし、自分に合った投資スタイルを確立する方法を考えます。' },
  ];

  const createdLessons = await prisma.lesson.createMany({
    data: lessonsData,
  });

  console.log(`${createdLessons.count} lessons were created.`);
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

