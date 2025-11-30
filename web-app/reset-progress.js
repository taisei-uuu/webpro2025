// 進捗データをリセットするスクリプト
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetProgress() {
  try {
    console.log('進捗データをリセット中...');
    
    // 1. 進捗データを削除
    await prisma.quizAttempt.deleteMany();
    console.log('✅ QuizAttemptデータを削除しました');
    
    // 2. レッスンデータを削除
    await prisma.question.deleteMany();
    await prisma.lesson.deleteMany();
    console.log('✅ レッスンデータを削除しました');
    
    // 3. ユーザーデータを削除（オプション）
    await prisma.user.deleteMany();
    console.log('✅ ユーザーデータを削除しました');
    
    console.log('🎉 進捗データのリセットが完了しました！');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetProgress();
