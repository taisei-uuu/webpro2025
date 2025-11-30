// public/in-app-browser-detector.js

function isInAppBrowser() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isInstagram = ua.indexOf("Instagram") > -1;
    const isFacebook = ua.indexOf("FBAN") > -1 || ua.indexOf("FBAV") > -1;
    // 他のアプリ内ブラウザも必要に応じて追加できます
    // const isLine = ua.indexOf("Line") > -1;
  
    return isInstagram || isFacebook;
  }
  
  function showInAppBrowserWarning() {
    // 警告用のモーダルやバナーを生成
    const warningBanner = document.createElement("div");
    warningBanner.id = "in-app-browser-warning";
    warningBanner.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; background-color: #ffc107; color: #333; padding: 15px; text-align: center; z-index: 10000; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
        <strong>現在、アプリ内ブラウザで表示されています。</strong><br>
        正常に動作しない可能性があるため、右上の・・・から「外部ブラウザで開く」を選択、またはSafariやChromeで開いてください。
        <button onclick="document.getElementById('in-app-browser-warning').style.display='none'" style="border: none; background: transparent; font-size: 20px; position: absolute; top: 10px; right: 15px; cursor: pointer;">&times;</button>
      </div>
    `;
    document.body.appendChild(warningBanner);
  }
  
  window.addEventListener("load", () => {
    if (isInAppBrowser()) {
      showInAppBrowserWarning();
    }
  });