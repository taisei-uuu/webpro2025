/**
 * 静的サイトビルダー
 *
 * microCMS と note から内容を取得し、views-static/ のテンプレートを使って
 * dist/ に完成した HTML を書き出す。Cloudflare Pages はこの dist/ を配信する。
 *
 *   npm run build:static
 *
 * 既存の index.ts / views/ には一切触らない。Render 上の Node アプリは
 * 移行が終わるまで並走させるため、両方が同じリポジトリからビルドできる必要がある。
 */

import 'dotenv/config';
import * as ejs from 'ejs';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

// ---------------------------------------------------------------- 設定

const SITE_URL = (process.env.SITE_URL || 'https://stockwith-jp.com').replace(/\/$/, '');
const NOTE_USERNAME = process.env.NOTE_USERNAME || '';
const MICROCMS_DOMAIN = process.env.MICROCMS_SERVICE_DOMAIN || '';
const MICROCMS_KEY = process.env.MICROCMS_API_KEY || '';

const ROOT = __dirname;
const VIEWS = path.join(ROOT, 'views-static');
const PAGES = path.join(VIEWS, 'pages');
const PUBLIC = path.join(ROOT, 'public');
const CONTENT = path.join(ROOT, 'content');
const DIST = path.join(ROOT, 'dist');

/** public/ からコピーしない対象。教材の削除と、WSLが残したゴミファイル。 */
const ASSET_EXCLUDES = [
  /^Stage[1-6]\//,          // 教材画像（約52MB）。ヒーローで使う4枚は public/flow/ に複製済み
  /:Zone\.Identifier$/,     // WSLのADS残骸（ファイル名は "画像.png:Zone.Identifier"）
  /~RF[0-9a-f]+\.TMP$/i,    // 同上
  /^chatbot\.js$/,          // チャットボットは廃止（/api/chat は元々コメントアウト済み）
  /^retro-cards\.(js|css)$/, // レッスン専用
  /^display-cards\.js$/,    // #display-cards は残るページに存在しない
  /^in-app-browser-detector\.js$/, // Clerk認証対策の警告バナー。静的サイトでは不要
  /^script\.js$/,           // 0バイト
  /\.md$/,                  // public/ 内の説明用README（配信対象ではない）
];

const NOTICE_TYPES = [
  { value: 'important', label: '重要なお知らせ', badgeClass: 'bg-danger', iconClass: 'fa-exclamation-triangle' },
  { value: 'financial', label: '財務情報', badgeClass: 'bg-success', iconClass: 'fa-chart-line' },
  { value: 'business', label: '事業報告', badgeClass: 'bg-primary', iconClass: 'fa-briefcase' },
  { value: 'legal', label: '法的事項', badgeClass: 'bg-warning', iconClass: 'fa-gavel' },
  { value: 'other', label: 'その他', badgeClass: 'bg-secondary', iconClass: 'fa-info-circle' },
];

const CATEGORY_SECTIONS = [
  { key: 'featured', title: '今日の注目記事' },
  { key: 'stock', title: '株式投資' },
  { key: 'other', title: 'その他' },
  { key: 'report', title: '週次レポート' },
];

// ---------------------------------------------------------------- 型

type Thumbnail = { url: string; width?: number; height?: number };

type Article = {
  id: string;
  title: string;
  introduction?: string;
  body?: string;
  isPaid: boolean;
  publishedAt: string;
  thumbnail?: Thumbnail;
  category?: string[];
};

type Attachment = { name: string; url: string; size?: string };

type Notice = {
  id: string;
  title: string;
  content: string;
  type: string;
  /**
   * 法定の掲載日。microCMS が自動で作る publishedAt（＝microCMSに登録した日）とは別物で、
   * そちらを使うと過去の公告の掲載日がずれるため、必ずこのフィールドを見ること。
   * microCMS 側は publishedAt を予約済みで同名フィールドを定義できないので、名前も分けてある。
   */
  publishedDate: string;
  isActive?: boolean;
  attachments?: Attachment[];
};

type NoteArticle = { title: string; url: string; publishedAt: string; thumbnail?: string };

// ---------------------------------------------------------------- ユーティリティ

const log = (msg: string) => console.log(`  ${msg}`);
const warn = (msg: string) => console.warn(`  ⚠  ${msg}`);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

function readFragment(name: string): string {
  return fs.readFileSync(path.join(PAGES, name), 'utf8');
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(CONTENT, file), 'utf8'));
}

/** 相対URLをそのまま出せるようエスケープ。属性値に入る文字だけ処理する。 */
function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------- データ取得

async function microcms<T>(endpoint: string, queries = ''): Promise<{ contents: T[]; totalCount: number } | null> {
  if (!MICROCMS_DOMAIN || !MICROCMS_KEY) {
    throw new Error('MICROCMS_SERVICE_DOMAIN / MICROCMS_API_KEY が設定されていません');
  }
  const url = `https://${MICROCMS_DOMAIN}.microcms.io/api/v1/${endpoint}?${queries}`;
  const res = await fetch(url, { headers: { 'X-MICROCMS-API-KEY': MICROCMS_KEY } });

  // エンドポイント未作成は「まだ無い」として呼び出し側に判断させる
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`microCMS ${endpoint}: HTTP ${res.status} ${await res.text()}`);
  return res.json() as any;
}

async function fetchArticles(): Promise<Article[]> {
  const all: Article[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await microcms<Article>('articles', `limit=${limit}&offset=${offset}&orders=-publishedAt`);
    if (!page) throw new Error('microCMS に articles エンドポイントがありません');
    all.push(...page.contents);
    if (all.length >= page.totalCount || page.contents.length === 0) break;
  }
  return all;
}

/**
 * 電子公告を取得する。
 * microCMS に notices があればそれを使い、まだ無ければ content/notices.json を使う（Phase 2 までの橋渡し）。
 * microCMS が「在るのに壊れている」場合は握りつぶさずビルドを失敗させる — 法定公告を黙って落とさないため。
 */
async function fetchNotices(): Promise<Notice[]> {
  // 並び順も publishedDate で指定する。microCMS の publishedAt で並べると
  // 「登録した順」になり、過去分をあとから入力したときに順序が狂う。
  const page = await microcms<Notice>('notices', 'limit=100&orders=-publishedDate');
  if (page) {
    log(`電子公告: microCMS から ${page.contents.length}件`);
    return validateNotices(page.contents, 'microCMS');
  }

  const local = readJson<{ notices: Notice[] }>('notices.json');
  log(`電子公告: microCMS に notices が無いため content/notices.json から ${local.notices.length}件`);
  return validateNotices(local.notices, 'content/notices.json');
}

/**
 * 公告の掲載日を検証する。
 * microCMS は publishedAt を必ず自動で埋めるので、publishedDate が空でも
 * 「それっぽい日付」が取れてしまう。黙って代用すると掲載日がずれた公告を
 * 出すことになるため、欠けていたらビルドを止める。
 */
function validateNotices(notices: Notice[], source: string): Notice[] {
  const bad = notices.filter((n) => !n.publishedDate || isNaN(+new Date(n.publishedDate)));
  if (bad.length > 0) {
    const list = bad.map((n) => `    - ${n.id}: ${n.title}（publishedDate=${JSON.stringify(n.publishedDate)}）`);
    throw new Error(
      `${source} の公告に掲載日(publishedDate)が無いか不正です:\n${list.join('\n')}\n` +
      `  法定公告の掲載日なので、microCMS の publishedAt で代用せず publishedDate を入力してください。`
    );
  }
  return notices;
}

/** note の RSS。未設定・取得失敗はセクションを出さないだけで、ビルドは止めない。 */
async function fetchNoteArticles(): Promise<NoteArticle[]> {
  if (!NOTE_USERNAME) {
    log('note: NOTE_USERNAME 未設定のためスキップ');
    return [];
  }
  try {
    const res = await fetch(`https://note.com/${NOTE_USERNAME}/rss`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    // RSS本文のXML実体参照を戻す。戻さないと EJS の <%= %> が再エスケープして
    // 「&amp;」が画面にそのまま出てしまう。
    const decodeEntities = (s: string) => s
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&'); // &amp; は最後（&amp;lt; を誤って二重変換しないため）

    const pick = (block: string, tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      if (!m) return '';
      const raw = m[1].trim();
      // CDATA の中身は実体参照ではなく生のテキストなので、デコードしない
      const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
      return cdata ? cdata[1].trim() : decodeEntities(raw);
    };

    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const articles = items.map((item) => ({
      title: pick(item, 'title'),
      url: pick(item, 'link'),
      publishedAt: pick(item, 'pubDate'),
      thumbnail: pick(item, 'media:thumbnail') || undefined,
    })).filter((a) => a.title && a.url);

    log(`note: RSS から ${articles.length}件`);
    return articles;
  } catch (e) {
    warn(`note の RSS を取得できませんでした（noteセクションは省略します）: ${(e as Error).message}`);
    return [];
  }
}

// ---------------------------------------------------------------- 出力

async function writePage(relPath: string, html: string) {
  const dest = path.join(DIST, relPath);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.writeFile(dest, html, 'utf8');
}

type RenderOptions = {
  headExtra: string;
  content: string;
  bodyClass?: string;
  bodyScripts?: string;
  isHome?: boolean;
};

async function renderLayout(opts: RenderOptions): Promise<string> {
  return ejs.renderFile(path.join(VIEWS, 'layout.ejs'), {
    headExtra: opts.headExtra,
    content: opts.content,
    bodyClass: opts.bodyClass || '',
    bodyScripts: opts.bodyScripts || '',
    isHome: opts.isHome || false,
    year: new Date().getFullYear(),
  });
}

async function renderHeadMeta(vars: {
  title: string; description?: string; canonical?: string; ogType?: string; ogImage?: string;
}): Promise<string> {
  return ejs.renderFile(path.join(VIEWS, 'partials', 'head-meta.ejs'), {
    title: vars.title,
    description: vars.description || '',
    canonical: vars.canonical || '',
    ogType: vars.ogType || 'website',
    ogImage: vars.ogImage || `${SITE_URL}/logo.png`,
  });
}

// ---------------------------------------------------------------- アセット

async function copyAssets(): Promise<string[]> {
  const copied: string[] = [];

  async function walk(dir: string, rel = '') {
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (ASSET_EXCLUDES.some((re) => re.test(relPath))) continue;

      const src = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(src, relPath);
      } else {
        const dest = path.join(DIST, relPath);
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        await fsp.copyFile(src, dest);
        copied.push(relPath);
      }
    }
  }

  await walk(PUBLIC);
  return copied;
}

// ---------------------------------------------------------------- 検証

/**
 * 出力HTML内のサイト内参照（/... で始まる src/href）が実在するか確かめる。
 * 画像やCSSの取りこぼしは静かに壊れるので、ビルド時に落とす。
 */
async function verifyLinks(pagePaths: string[]): Promise<string[]> {
  const problems: string[] = [];

  for (const rel of pagePaths) {
    const html = await fsp.readFile(path.join(DIST, rel), 'utf8');
    const refs = new Set<string>();
    for (const m of html.matchAll(/(?:src|href)="(\/[^"#?]*)/g)) refs.add(m[1]);

    for (const ref of refs) {
      const decoded = decodeURIComponent(ref);
      const candidates = [
        path.join(DIST, decoded),
        path.join(DIST, `${decoded}.html`),
        path.join(DIST, decoded, 'index.html'),
      ];
      if (!candidates.some((p) => fs.existsSync(p))) {
        problems.push(`${rel} → ${ref}`);
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------- メイン

async function main() {
  console.log('\n静的サイトをビルドします\n');

  // --- 取得 ---
  const [articles, notices, noteArticles] = await Promise.all([
    fetchArticles(),
    fetchNotices(),
    fetchNoteArticles(),
  ]);

  const freeArticles = articles.filter((a) => !a.isPaid);
  const paidArticles = articles.filter((a) => a.isPaid);
  log(`記事: 全${articles.length}件（自社掲載=無料${freeArticles.length}件 / note移行対象=有料${paidArticles.length}件）`);

  await fsp.rm(DIST, { recursive: true, force: true });
  await fsp.mkdir(DIST, { recursive: true });

  const written: string[] = [];
  const write = async (rel: string, html: string) => {
    await writePage(rel, html);
    written.push(rel);
  };

  // --- 抽出済みの静的ページ（トップ・法務3点） ---
  const STATIC_PAGES = [
    { name: 'home', out: 'index.html', isHome: true },
    { name: 'privacy', out: 'privacy.html', isHome: false },
    { name: 'terms', out: 'terms.html', isHome: false },
    { name: 'commercial-disclosure', out: 'commercial-disclosure.html', isHome: false },
  ];

  for (const page of STATIC_PAGES) {
    const html = await renderLayout({
      headExtra: readFragment(`${page.name}.head.html`),
      content: readFragment(`${page.name}.body.html`),
      isHome: page.isHome,
      bodyClass: page.name === 'home' ? '' : 'bg-light',
    });
    await write(page.out, html);
  }

  // --- 電子公告 ---
  const typeMeta = (type: string) =>
    NOTICE_TYPES.find((t) => t.value === type) || NOTICE_TYPES[NOTICE_TYPES.length - 1];

  const activeNotices = notices
    .filter((n) => n.isActive !== false)
    .sort((a, b) => +new Date(b.publishedDate) - +new Date(a.publishedDate))
    .map((n) => {
      const meta = typeMeta(n.type);
      return {
        ...n,
        attachments: n.attachments || [],
        year: String(new Date(n.publishedDate).getFullYear()),
        publishedAtIso: new Date(n.publishedDate).toISOString(),
        publishedAtLabel: formatDate(n.publishedDate),
        excerpt: n.content.length > 200 ? `${n.content.slice(0, 200)}…` : n.content,
        typeLabel: meta.label,
        badgeClass: meta.badgeClass,
        iconClass: meta.iconClass,
      };
    });

  // 添付PDFの実体は microCMS ではなく public/notices/ に置く（Hobbyプランはファイル
  // フィールドが使えず、画像フィールドはPDFを受け付けないため）。url はそこへの相対パス。
  // 実体が無いまま公告を出すと「添付あり」と表示されてリンクが404になるので、ここで止める。
  const missingPdfs = activeNotices.flatMap((n) =>
    n.attachments
      .filter((a) => a.url.startsWith('/') && !fs.existsSync(path.join(PUBLIC, a.url.slice(1))))
      .map((a) => `    - ${n.title} → ${a.url}（public${a.url} が無い）`)
  );
  if (missingPdfs.length > 0) {
    throw new Error(`公告の添付ファイルの実体が見つかりません:\n${missingPdfs.join('\n')}`);
  }

  await write('notice.html', await renderLayout({
    headExtra: readFragment('notice.head.html'),
    bodyClass: 'bg-light',
    bodyScripts: readFragment('notice.scripts.html'),
    content: await ejs.renderFile(path.join(PAGES, 'notice.ejs'), {
      notices: activeNotices,
      types: NOTICE_TYPES,
      years: [...new Set(activeNotices.map((n) => n.year))].sort().reverse(),
    }),
  }));

  // --- 記事一覧 ---
  const noteProfileUrl = NOTE_USERNAME ? `https://note.com/${NOTE_USERNAME}` : '';

  const decorate = (a: Article) => ({
    ...a,
    publishedAtIso: new Date(a.publishedAt).toISOString(),
    publishedAtLabel: new Date(a.publishedAt).toLocaleDateString('ja-JP'),
  });

  const sections = CATEGORY_SECTIONS
    .map((section) => ({
      title: section.title,
      articles: freeArticles
        .filter((a) => section.key === 'featured'
          ? (!a.category?.length || a.category.includes('featured'))
          : a.category?.includes(section.key))
        .map(decorate),
    }))
    .filter((s) => s.articles.length > 0);

  await write('articles/index.html', await renderLayout({
    headExtra: await renderHeadMeta({
      title: '記事一覧 - Stock with',
      description: '20代投資家のリアルな投資記録と、株式投資の基礎知識をお届けします。',
      canonical: `${SITE_URL}/articles`,
    }),
    content: await ejs.renderFile(path.join(PAGES, 'articles.ejs'), {
      sections,
      noteArticles: noteArticles.map((a) => ({
        ...a,
        publishedAtIso: new Date(a.publishedAt).toISOString(),
        publishedAtLabel: new Date(a.publishedAt).toLocaleDateString('ja-JP'),
      })),
      noteProfileUrl,
    }),
  }));

  // --- 記事本文（無料記事のみ。旧URL /articles/<id> をそのまま維持する） ---
  for (const article of freeArticles) {
    const plain = (article.introduction || '').replace(/<[^>]*>/g, '').trim();
    await write(`articles/${article.id}.html`, await renderLayout({
      headExtra: await renderHeadMeta({
        title: `${article.title} - Stock with`,
        description: plain.slice(0, 120),
        canonical: `${SITE_URL}/articles/${article.id}`,
        ogType: 'article',
        ogImage: article.thumbnail?.url || `${SITE_URL}/logo.png`,
      }),
      content: await ejs.renderFile(path.join(PAGES, 'article.ejs'), {
        article: decorate(article),
        noteProfileUrl,
      }),
    }));
  }

  // --- 404 ---
  await write('404.html', await renderLayout({
    headExtra: await renderHeadMeta({ title: 'ページが見つかりません - Stock with' }),
    content: readFragment('404.ejs'),
  }));

  // --- リダイレクト ---
  const noteLinks = readJson<{ links: Record<string, string> }>('note-links.json').links;
  const redirects = [
    '# 教材・会員機能の廃止にともなう旧URLの転送',
    '/learning        /          301',
    '/learning/*      /          301',
    '/lessons/*       /          301',
    '/phase2          /          301',
    '/phase3          /          301',
    '/under-development /        301',
    '',
    '# 有料販売の停止にともなう転送',
    '/subscription    /articles  301',
    '/subscription/*  /articles  301',
    '',
    '# 管理画面・検索の廃止',
    '/admin/*         /          301',
    '/search          /articles  301',
    '',
    '# note へ移行した有料記事',
  ];

  for (const article of paidArticles) {
    const target = noteLinks[article.id];
    redirects.push(`/articles/${article.id}  ${target || '/articles'}  301`);
  }

  const mapped = paidArticles.filter((a) => noteLinks[a.id]).length;
  await write('_redirects', `${redirects.join('\n')}\n`);
  log(`リダイレクト: 有料記事 ${paidArticles.length}件中 ${mapped}件が note へ、残りは /articles へ`);

  // --- sitemap / robots ---
  const urls = [
    '/', '/articles', '/notice', '/privacy', '/terms', '/commercial-disclosure',
    ...freeArticles.map((a) => `/articles/${a.id}`),
  ];
  await write('sitemap.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${SITE_URL}${escapeAttr(u)}</loc></url>`),
    '</urlset>',
  ].join('\n'));

  await write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

  // --- 静的アセット ---
  const assets = await copyAssets();
  log(`アセット: ${assets.length}件コピー`);

  // --- 検証 ---
  const problems = await verifyLinks(written.filter((f) => f.endsWith('.html')));
  if (problems.length > 0) {
    console.error('\n参照先が存在しないリンクがあります:');
    problems.forEach((p) => console.error(`  ✗ ${p}`));
    throw new Error(`壊れたサイト内リンクが ${problems.length}件あります`);
  }

  const size = (await Promise.all(
    written.concat(assets).map(async (f) => (await fsp.stat(path.join(DIST, f))).size)
  )).reduce((a, b) => a + b, 0);

  console.log(`\n✓ ビルド完了 — ${written.length}ページ + ${assets.length}アセット / 合計 ${(size / 1024 / 1024).toFixed(1)}MB → dist/\n`);
}

main().catch((e) => {
  console.error('\n✗ ビルド失敗:', e.message, '\n');
  process.exit(1);
});
