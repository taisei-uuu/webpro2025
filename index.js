// node.jsの標準ライブラリであるhttpモジュールを読み込む
// "node:" をつけることで、コアモジュールであることを明示するんじゃ
import http from 'node:http';

// サーバーが待ち受けるポート番号を設定する
// 環境変数 PORT があればそれを使う。なければ 8888 を使う
const PORT = process.env.PORT || 8888;

// httpサーバーを作成する
const server = http.createServer((req, res) => {
  // URLの情報を解析するためのオブジェクトを作成
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  console.log(`Request for ${pathname} received.`);

  // ヘッダーに文字コードをUTF-8に設定する
  // これをしないと、日本語が文字化けしてしまうことがあるんじゃ
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  // URLのパス名によって処理を分岐する
  if (pathname === '/') {
    // ルートパス ("/") にアクセスされた場合
    res.writeHead(200); // ステータスコード 200 (成功) を返す
    res.end('こんにちは！');
    console.log("Responded with 'こんにちは！'");

  } else if (pathname === '/ask') {
    // "/ask" にアクセスされた場合
    const question = url.searchParams.get('q'); // クエリパラメータ 'q' の値を取得
    res.writeHead(200);
    res.end(`Your question is '${question}'`);
    console.log(`Responded with question: ${question}`);

  } else {
    // それ以外のパスにアクセスされた場合
    res.writeHead(404); // ステータスコード 404 (見つからない) を返す
    res.end('Not Found');
    console.log('Responded with Not Found');
  }
});

// 指定したポートでリクエストを待ち始める
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});