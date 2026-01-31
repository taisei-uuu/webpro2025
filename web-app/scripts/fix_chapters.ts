
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Inspecting chapters...');

    // Check Phase 2 Lessons source
    const p2 = await prisma.phase2Lesson.findMany({ select: { chapter: true, title: true } });
    console.log('Phase 2 Source Chapters:', [...new Set(p2.map(p => p.chapter))]);

    // Check Phase 1 Lessons (Target)
    const p1 = await prisma.phase1Lesson.findMany({
        where: { chapter: { gt: 5 } },
        select: { id: true, chapter: true, title: true }
    });
    console.log('Phase 1 High Chapters:', p1.map(p => `${p.chapter}: ${p.title}`));

    // Fix Logic:
    // If we find Chapter 12 (likely from 6+6), we want it to be Chapter 7 (if Ending is 6) or 6 (if Ending is 5.5?).
    // User: "After Ending, display Stage 6, 7..."
    // If Ending is currently 999.
    // I will check if 999 exists.
    const ending = await prisma.phase1Lesson.findFirst({ where: { chapter: 999 } });
    console.log('Ending Chapter 999 exists?', !!ending);

    // Proposal:
    // 1. If 999 exists, update it to 6.
    // 2. Update 12 -> 7, 13 -> 8. (Assuming offset was +6).
    //    Wait, if Phase 2 source was 6. 6+6=12.
    //    If Ending becomes 6. Then Phase 2 should be 7.
    //    So 12 -> 7. (Minus 5).
    //    If Phase 2 source was 1. 1+6=7.
    //    I suspect Phase 2 source was 6.

    if (p1.some(p => p.chapter === 12)) {
        console.log('Fixing chapters 12+ -> 7+ ...');
        // Update logic
        // We must be careful not to collide.
        // 12 -> 7.
        // Update many.
        // But updateMany doesn't support "value - 5".
        // Iterate and update.
        const toFix = await prisma.phase1Lesson.findMany({ where: { chapter: { gt: 10 } } });
        for (const l of toFix) {
            const newCh = l.chapter - 5; // 12->7.
            await prisma.phase1Lesson.update({
                where: { id: l.id },
                data: { chapter: newCh }
            });
            console.log(`Updated ${l.title}: ${l.chapter} -> ${newCh}`);
        }
    }

    // Handle Ending (999 -> 6)
    if (ending) {
        // Check if 6 is occupied (it shouldn't be if we mapped 12->7).
        // Wait, if Phase 2 source was 1. 1+6=7. So 6 is free.
        // If Phase 2 source was 6. 6+6=12. 12->7. So 6 is free.
        await prisma.phase1Lesson.updateMany({
            where: { chapter: 999 },
            data: { chapter: 6 }
        });
        console.log('Moved Ending 999 -> 6');
    } else {
        console.log('No Ending (999) found in DB. It might be virtual in UI.');
        // If virtual, I should create a DB entry for it so it sorts correctly?
        // Or just handle in UI.
        // If user wants Stage 6...
        // If I leave it virtual, and keys are 0..5, 7..X.
        // And I insert Ending at UI level.
        // But purely numerically 7 is after 5.
        // Where does Ending go?
        // I'll assume I should insert a "Real" Ending lesson if missing, or rely on UI to place "Ending" before Stage 6.
    }

}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
