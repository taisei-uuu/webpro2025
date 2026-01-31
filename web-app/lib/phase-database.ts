// Phase別テーブル管理ライブラリ
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Phase番号に基づいて適切なテーブルを取得する関数 (互換性のために残すが、すべてPhase1を参照)
export function getPhaseTables(phase: number) {
  // すべてPhase1 (現在は統合されたメインテーブル) を返す
  return {
    lesson: prisma.phase1Lesson,
    question: prisma.phase1Question,
    option: prisma.phase1Option,
    quizAttempt: prisma.phase1QuizAttempt,
    clearedQuestion: prisma.phase1ClearedQuestion,
    progress: prisma.phase1Progress,
  };
}

// レッスンIDからPhaseを判定する関数
// すべてのレッスンはPhase 1扱い（統合済み）
export function getPhaseFromLessonId(lessonId: string): number {
  return 1;
}

// Phase1のレッスンを取得する関数
export async function getPhase1Lessons() {
  return await prisma.phase1Lesson.findMany({
    include: {
      questions: {
        include: {
          options: true,
        },
      },
    },
    orderBy: {
      id: 'asc',
    },
  });
}

// Phase別のレッスンを取得する関数 (Phase 1テーブルから取得)
export async function getPhaseLessons(phase: number) {
  // phase引数は無視してPhase1Lessonから取得
  return await getPhase1Lessons();
}

// Phase別のクイズ試行を取得する関数
export async function getPhaseQuizAttempts(phase: number, userId?: string, sessionId?: string) {
  const tables = getPhaseTables(1);

  const whereClause: any = {};
  if (userId) {
    whereClause.clerkUserId = userId;
  } else if (sessionId) {
    whereClause.sessionId = sessionId;
  }

  return await tables.quizAttempt.findMany({
    where: whereClause,
    include: {
      question: true,
      selectedOption: true,
    },
  });
}

// Phase別のクリア済み問題を取得する関数
export async function getPhaseClearedQuestions(phase: number, userId: string) {
  const tables = getPhaseTables(1);
  return await tables.clearedQuestion.findMany({
    where: {
      user: {
        clerkId: userId,
      },
    },
  });
}

// Phase別の進捗を取得する関数
export async function getPhaseProgress(phase: number, userId: string) {
  const tables = getPhaseTables(1);
  return await tables.progress.findMany({
    where: {
      user: {
        clerkId: userId,
      },
    },
    include: {
      lesson: true,
    },
  });
}

// Phase別のレッスン詳細を取得する関数
export async function getPhaseLessonBySlug(phase: number, slug: string) {
  const tables = getPhaseTables(1);
  return await tables.lesson.findUnique({
    where: { slug },
    include: {
      questions: {
        include: {
          options: true,
        },
      },
    },
  });
}

// Phase別のクイズ回答を保存する関数
export async function savePhaseQuizAttempt(
  phase: number,
  data: {
    clerkUserId?: string;
    sessionId?: string;
    questionId: number;
    selectedOptionId?: number;
    isCorrect: boolean;
  }
) {
  const tables = getPhaseTables(1);
  return await tables.quizAttempt.create({
    data: {
      clerkUserId: data.clerkUserId,
      sessionId: data.sessionId,
      questionId: data.questionId,
      selectedOptionId: data.selectedOptionId,
      isCorrect: data.isCorrect,
    },
  });
}

// Phase別のクリア済み問題を保存する関数
export async function savePhaseClearedQuestion(phase: number, userId: string, questionId: number) {
  const tables = getPhaseTables(1);

  // ユーザーIDを取得
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return await tables.clearedQuestion.upsert({
    where: {
      userId_questionId: {
        userId: user.id,
        questionId: questionId,
      },
    },
    update: {
      clearedAt: new Date(),
    },
    create: {
      userId: user.id,
      questionId: questionId,
    },
  });
}

// Phase別の進捗を更新する関数
export async function updatePhaseProgress(phase: number, userId: string, lessonId: number, completed: boolean = true) {
  const tables = getPhaseTables(1);

  // ユーザーIDを取得
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return await tables.progress.upsert({
    where: {
      userId_lessonId: {
        userId: user.id,
        lessonId: lessonId,
      },
    },
    update: {
      completed: completed,
      completedAt: completed ? new Date() : null,
    },
    create: {
      userId: user.id,
      lessonId: lessonId,
      completed: completed,
      completedAt: completed ? new Date() : null,
    },
  });
}

// Phase1の進捗率を計算する関数
export async function getPhase1ProgressPercentage(userId: string): Promise<number> {
  try {
    // Phase1のレッスンを取得
    const phase1Lessons = await prisma.phase1Lesson.findMany({
      where: {
        chapter: {
          gte: 1,
          lte: 5,
        },
      },
      include: {
        questions: true,
      },
    });

    // Phase1の全問題IDを取得
    const phase1QuestionIds = phase1Lessons.flatMap(lesson => lesson.questions.map(q => q.id));

    // ユーザーがPhase1の問題で正解した回数を取得
    const correctAttempts = await prisma.phase1QuizAttempt.findMany({
      where: {
        clerkUserId: userId,
        questionId: {
          in: phase1QuestionIds,
        },
        isCorrect: true,
      },
    });

    // ユニークな正解問題数を計算
    const uniqueCorrectQuestionIds = new Set(correctAttempts.map(attempt => attempt.questionId));

    const totalQuestions = phase1QuestionIds.length;
    const clearedQuestions = uniqueCorrectQuestionIds.size;

    return totalQuestions > 0 ? Math.round((clearedQuestions / totalQuestions) * 100) : 0;
  } catch (error) {
    console.error('Error calculating Phase1 progress:', error);
    return 0;
  }
}

export { prisma };
