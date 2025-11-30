import { client } from "./lib/microcms";

async function debugMicroCMS() {
    try {
        console.log("Fetching article list...");
        const list = await client.getList({ endpoint: "articles" });
        console.log(`Found ${list.contents.length} articles.`);

        if (list.contents.length > 0) {
            const firstId = list.contents[0].id;
            console.log(`Fetching details for article ID: ${firstId}`);
            const detail = await client.getListDetail({
                endpoint: "articles",
                contentId: firstId,
            });
            console.log("Article Detail Data:", JSON.stringify(detail, null, 2));
        } else {
            console.log("No articles found.");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

debugMicroCMS();
