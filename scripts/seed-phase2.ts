import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

// tsx経由での実行時に.envを確実に読み込むために追加
dotenv.config();

/**
 * Phase2のデータベースシードファイル
 * 
 * 使用方法:
 * - Phase2のレッスンとクイズを追加: npm run seed:phase2
 * 
 * 注意: 既存のPhase2データがある場合は上書きされます
 */

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Phase2のレッスンデータを追加中...");

  // 既存のPhase2データをチェック
  const existingPhase2Lessons = await prisma.phase2Lesson.count();
  
  if (existingPhase2Lessons > 0) {
    console.log(`既存のPhase2レッスンが${existingPhase2Lessons}件見つかりました。`);
    console.log("既存データを削除してから新しいデータを追加します...");
    
    // 既存のPhase2データをクリア（依存関係の深いものから削除）
    await prisma.phase2QuizAttempt.deleteMany();
    await prisma.phase2ClearedQuestion.deleteMany();
    await prisma.phase2Progress.deleteMany();
    await prisma.phase2Option.deleteMany();
    await prisma.phase2Question.deleteMany();
    await prisma.phase2Lesson.deleteMany();
    console.log("既存のPhase2データを削除しました。");
  }

  // Phase2のレッスンデータを定義
  const phase2LessonsWithQuestions = [
    // Stage 6: テクニカル分析について学ぼう
    {
      chapter: 6,
      title: "Stage6-1. 移動平均線について学ぼう",
      slug: "stage6-1",
      content: "移動平均線は、テクニカル分析の基本となる指標の一つです。過去の一定期間の価格の平均値を線で結んだもので、トレンドの方向性を把握するのに役立ちます。\n\n## 移動平均線の詳細解説\n\n下のカードをクリックして、移動平均線について詳しく学びましょう。\n\n<div id=\"retro-cards-container\"></div>\n\n### 移動平均線の基本\n\n1. **短期線と長期線**\n   • 短期線：5日、25日移動平均線など\n   • 長期線：75日、200日移動平均線など\n   • 短期線が長期線より上にあると上昇トレンド\n   • 短期線が長期線より下にあると下落トレンド\n\n2. **ゴールデンクロスとデッドクロス**\n   • ゴールデンクロス：短期線が長期線を下から上に突き抜ける\n   • デッドクロス：短期線が長期線を上から下に突き抜ける\n   • これらはトレンド転換のシグナルとして注目される\n\n3. **移動平均線の活用方法**\n   • トレンドの方向性を確認\n   • サポート・レジスタンスラインとして機能\n   • 買い時・売り時の判断材料",
      videoId: null, // 動画IDは後で設定
      videoTitle: "移動平均線について",
      questions: [
        {
          text: "移動平均線の短期線が長期線を下から上に突き抜けることは一般的に何を示すと考えられる？",
          options: [
            { text: "下落トレンドへの転換", isCorrect: false },
            { text: "上昇トレンドへの転換", isCorrect: true },
            { text: "トレンドの継続", isCorrect: false },
            { text: "この世の終わり", isCorrect: false },
          ],
        },
      ],
    },
  ];

  // Phase2のレッスンとクイズを作成
  for (const data of phase2LessonsWithQuestions) {
    const { questions, ...lessonData } = data;
    const lesson = await prisma.phase2Lesson.create({
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
    console.log(`✅ Phase2レッスンを作成しました: ${lesson.title} (ID: ${lesson.id})`);
  }

  console.log(`🎉 Phase2のシードが完了しました！`);
  console.log(`📊 作成されたデータ:`);
  console.log(`  - Phase2レッスン: ${phase2LessonsWithQuestions.length}件`);
  
  // 作成されたクイズの数を確認
  const totalQuestions = phase2LessonsWithQuestions.reduce((sum, lesson) => sum + lesson.questions.length, 0);
  console.log(`  - Phase2クイズ問題: ${totalQuestions}件`);
}

main()
  .catch((e) => {
    console.error("❌ エラーが発生しました:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
