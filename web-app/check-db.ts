import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const dotenvResult = dotenv.config();

if (dotenvResult.error) {
  console.error('Error loading .env file:', dotenvResult.error);
}

const prisma = new PrismaClient();

async function checkData() {
  // どのデータベースに接続しようとしているか確認
  console.log(`Checking database at: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.split('@')[1] : 'DATABASE_URL not found'}`);
  console.log('Checking data in the database...');
  try {
    const lessonCount = await prisma.lesson.count();
    console.log(`Found ${lessonCount} lessons.`);

    if (lessonCount > 0) {
      const firstLesson = await prisma.lesson.findFirst({
        include: {
          questions: {
            include: {
              options: true,
            },
          },
        },
      });
      console.log('First lesson found:', JSON.stringify(firstLesson, null, 2));
    }
  } catch (e) {
    console.error('An error occurred while checking the database:');
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();