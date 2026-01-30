import 'dotenv/config';
import { getLessons, getLessonBySlug } from './lib/microcms';

async function main() {
    console.log("=== Debugging MicroCMS Lesson API ===");

    try {
        console.log("\n1. Fetching all lessons...");
        const lessons = await getLessons();
        console.log(`Success! Found ${lessons.length} lessons.`);

        lessons.forEach(lesson => {
            console.log(`- ID: ${lesson.id}`);
            console.log("  Raw Object Keys:", Object.keys(lesson));
            console.log(`  Title: ${lesson.title}`);
            console.log(`  Content ID: ${lesson.contentId || '(undefined)'}`);
            console.log(`  Content Preview: ${lesson.content ? lesson.content.substring(0, 30) + '...' : '(empty)'}`);
            if (lesson.slides && lesson.slides.length > 0) {
                console.log(`  Slides: ${lesson.slides.length} images`);
            }
        });

        console.log("\n--------------------------------");

        // Test with specific query (assuming the user might have set stage1-1 either as ID or Slug)
        const testSlug = "stage1-1";
        console.log(`\n2. Attempting to fetch lesson by slug/id: "${testSlug}"...`);

        const lesson = await getLessonBySlug(testSlug);

        if (lesson) {
            console.log("Success! Found lesson:");
            console.log(JSON.stringify(lesson, null, 2));
        } else {
            console.log(`Failed inside wrapper. It seems "${testSlug}" was not found as ID or Slug.`);
        }

    } catch (error) {
        console.error("Error during debug:", error);
    }
}

main();
