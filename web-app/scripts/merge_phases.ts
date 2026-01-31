
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting Phase 2/3 migration...');

    // 1. Get current Max Chapter in Phase 1
    // We exclude 999 (Ending) if it exists, to insert new stages before it?
    // Actually, user said "Ending" (Phase 1 Ending) comes first, then Stage 6.
    // Wait, if Phase 1 has "Ending" as Chapter 999.
    // And user wants Stage 6 AFTER Ending.
    // Does existing "Ending" chapter stay as 999?
    // If I add Chapter 6, 7, 8...
    // In the sorting `orderBy: { id: 'asc' }` or `chapter: 'asc'`?
    // In `index.ts`, `chapters` object key is chapter number.
    // If I have 0, 1, 2, 3, 4, 5, 999.
    // And I add 6, 7.
    // The display order in `Object.values` or `reduce` iteration depends on insertion/key order?
    // In `index.ts`: `const chapters = ...` reduce, then `Object.keys(chapters).sort((a, b) => Number(a) - Number(b))`?
    // No, `index.ts` line 1083 just pushes to `acc`. It doesn't sort.
    // Wait, `reduce` is over `lessonsWithQuestions`. `lessonsWithQuestions` is ordered by `id` asc (or chapter?).
    // `getPhase1Lessons` orders by `id: 'asc'`.
    // If I insert new lessons, they will have higher IDs.
    // So they will come AFTER existing lessons.
    // So if I insert Chapter 6, it will come after Chapter 999 (Ending) if Ending was inserted earlier.
    // If Ending is Chapter 999.
    // If I interpret "After Ending" literally, I should just let them follow.
    // But purely numerically 6 < 999.
    // If the view sorts by Chapter Number, 6 will come BEFORE 999.
    // User said: "Phase2 and Phase3 ... display after 'Ending'".
    // If 'Ending' is 999.
    // Maybe I should renumber 'Ending' to be, say, 5.5? Or just renumber 'Ending' to be the LAST.
    // Or, User might mean the "End of the list".
    // Let's assume user wants: 0, 1, 2, 3, 4, 5, 999(Ending), 6, 7...
    // That's weird order numerically.
    // I should probably change "Ending" (999) to be `max_chapter + 1` at the end?
    // Or just insert 6, 7... and if the view sorts by ID, it works.
    // BUT the view DOES rely on `chapter` number for "Stage X" label.
    // If I invoke `views/index.ejs`, it iterates `chapters`.
    // `chapters` is an array? No, `index.ts` `reduce` returns an Object?
    // Line 1098 in `index.ts`: `chapters` is `Record<number, ...>`.
    // Pass to view: `chapters: Object.values(chapters)`.
    // `Object.values` order is not guaranteed strictly, but usually numbers ascending.
    // So 0, 1, 2, 3, 4, 5, 6, 7... 999.
    // This puts 6 BEFORE 999.
    // User said: "Phase2 and Phase3 ... display after 'Ending'".
    // So 999 (Ending) should be ... wait, is Ending "Stage 0 (Ending)"?
    // If Ending is 999, it appears last.
    // If I want 6 after Ending, 6 must be > 999?
    // Or I renumber Ending.
    // Let's assume I renumber Ending to 5 (and shift others?) or make Ending just a regular chapter?
    // Actually, Phase 1 Ending is "おわりに".
    // Maybe I should keeps its ID but change its chapter number?
    // Or, I make Phase 2 start at 1000? "Stage 1000"? No, user wants "Stage 6".
    // So "Ending" must be BEFORE Stage 6.
    // So "Ending" chapter number should be, say, 5.5 (float)? Or I renumber Ending to 5, and make "Investment Style" 4?
    // Let's look at Phase 1 chapters again.
    // 0: Intro. 1..5: Stages. 999: Ending.
    // If I want 0 -> 1..5 -> Ending -> 6..7
    // Then Ending must be, say, 5 and the old 5 must be 4? No.
    // Or maybe Ending is just "Stage 6" content-wise?
    // "Ending" title is "おわりに".
    // User said: "‘おわりに’ の後に、Stage6、Stage7と順に表示".
    // So Visual Order: [Intro, Stage1..5, Ending, Stage6..]
    // Numbering: 0, 1..5, 999, 6..?
    // If I use (0, 1, 2, 3, 4, 5, 6, 7 ... , 999) -> Ending is last.
    // User wants Ending BEFORE Stage 6.
    // So Ending must be < 6.
    // So Ending should be remapped to, say, `6` (and retain title "おわりに")? And new Stages start at 7?
    // Or Ending is just a lesson in Stage 5?
    // Currently Ending is Chapter 999.
    // I will Update Ending Chapter to `6` (or `6` represents Ending?).
    // And Phase 2 starts at `7`?
    // Or I renumber Ending to the correct sequence index.
    // Current: 0, 1, 2, 3, 4, 5. (Total 6).
    // Then Ending is next. So Ending should be Chapter 6.
    // Then Phase 2 starts at Chapter 7.
    // I will Update the existing Chapter 999 lessons to Chapter 6.
    // Then Phase 2 Chapter 1 -> Chapter 7.

    // Script Logic:
    // 1. Update Phase1Lesson where chapter=999 to chapter=6.
    // 2. Fetch Phase 2. Map Ch 1 -> 7, Ch 2 -> 8...
    // 3. Fetch Phase 3. Continue...

    // Wait, check if Chapter 6 acts weird?
    // `index.ts` `title` map:
    // 0: Intro... 5: Style.
    // I need to add 6: 'おわりに'?
    // And 7: Phase 2 Ch 1 Title.

    // Phase 2 lessons have their own DB, but titles?
    // `chapterInfo` in `index.ts` is manual.
    // I will need to update `chapterInfo` in `index.ts` to include new titles or use the title from the first lesson of the chapter?
    // My new code in `index.ejs` uses `chapter.title`.
    // `index.ts` sets `chapter.title` from `chapterInfo` map OR `Stage${num}`.
    // For Phase 1, `chapterInfo` provides titles.
    // For Phase 2, I need to know the titles.
    // `Phase2Lesson` likely has a title, but `chapter` title is usually separate in Phase 1 (hardcoded map).
    // Does Phase 2/3 have "Chapter Titles"?
    // Looking at `getPhaseLessons` result in `phase2` route (Step 539):
    // `title: 'Stage ' + lesson.chapter`.
    // It seems Phase 2 doesn't have specific "Chapter Titles" stored, just Lesson Titles.
    // So "Stage 7" is fine for title.

    // SO:
    // 1. Renumber Phase 1 Ch 999 -> Ch 6.
    // 2. Start Phase 2 at Ch 7.

    const phase1Ending = await prisma.phase1Lesson.updateMany({
        where: { chapter: 999 },
        data: { chapter: 6 }
    });
    console.log(`Updated ending chapters: ${phase1Ending.count}`);

    let currentChapter = 7;

    // Process Phase 2
    const p2Lessons = await prisma.phase2Lesson.findMany({
        include: { questions: { include: { options: true } } },
        orderBy: { id: 'asc' } // Preserve order
    });

    // Group by original chapter to keep structure
    // Phase 2 might have multiple lessons per chapter.
    // We need to map (OldCh) -> (NewCh).
    // But Phase 2 likely starts at Ch 1.
    // And Ch 1 might have multiple lessons.
    // So I iterate distinct chapters.

    // Helper to re-insert
    for (const lesson of p2Lessons) {
        // Map chapter
        // Assume Phase 2 Ch 1 -> 7.
        // Phase 2 Ch 2 -> 8.
        // So newChapter = lesson.chapter + 6.
        const newChapter = lesson.chapter + 6;

        // Check collision?
        // Insert
        const newLesson = await prisma.phase1Lesson.create({
            data: {
                chapter: newChapter,
                title: lesson.title,
                slug: lesson.slug, // Might collide if same slug used? Should be unique.
                content: lesson.content,
                videoId: lesson.videoId,
                videoTitle: lesson.videoTitle,
                questions: {
                    create: lesson.questions.map(q => ({
                        text: q.text,
                        options: {
                            create: q.options.map(o => ({
                                text: o.text,
                                isCorrect: o.isCorrect
                            }))
                        }
                    }))
                }
            }
        });
        console.log(`Migrated P2 Lesson: ${lesson.title} -> Ch ${newChapter}`);
    }

    // Determine standard offset for Phase 3.
    // Max Phase 2 Chapter?
    const maxP2Chapter = p2Lessons.reduce((max, l) => Math.max(max, l.chapter), 0);
    const p3Offset = 6 + maxP2Chapter;
    // e.g. Max P2 is 5 (so Ch 11). Offset=6+5=11. Phase 3 Ch 1 -> 12.

    const p3Lessons = await prisma.phase3Lesson.findMany({
        include: { questions: { include: { options: true } } },
        orderBy: { id: 'asc' }
    });
    for (const lesson of p3Lessons) {
        const newChapter = lesson.chapter + p3Offset;
        await prisma.phase1Lesson.create({
            data: {
                chapter: newChapter,
                title: lesson.title,
                slug: lesson.slug,
                content: lesson.content,
                videoId: lesson.videoId,
                videoTitle: lesson.videoTitle,
                questions: {
                    create: lesson.questions.map(q => ({
                        text: q.text,
                        options: {
                            create: q.options.map(o => ({
                                text: o.text,
                                isCorrect: o.isCorrect
                            }))
                        }
                    }))
                }
            }
        });
        console.log(`Migrated P3 Lesson: ${lesson.title} -> Ch ${newChapter}`);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
