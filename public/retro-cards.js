// Retro Cards Component for EJS/Node.js
class RetroCards {
  constructor(containerId, cardsData) {
    this.container = document.getElementById(containerId);
    this.cardsData = cardsData;
    this.currentIndex = 0;
    this.isModalOpen = false;
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="retro-cards-container">
        <div class="retro-cards-scroll" id="cards-scroll">
          <div class="retro-cards-wrapper">
            ${this.cardsData.map((card, index) => this.renderCard(card, index)).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderCard(card, index) {
    return `
      <div class="retro-card-item">
        <button class="retro-card-button" data-index="${index}" onclick="retroCards.openModal(${index})">
          <div class="retro-card ${index % 2 === 0 ? 'rotate-0' : '-rotate-0'}">
            <div class="retro-card-background">
              <div class="retro-card-background-inner">
                <img src="${card.backgroundImage}" alt="${card.name}" />
              </div>
            </div>
            <div class="retro-card-content">
              <!-- テキストコンテンツは非表示 -->
            </div>
          </div>
        </button>
      </div>
    `;
  }

  bindEvents() {
    // Keyboard events
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isModalOpen) {
        this.closeModal();
      }
    });
  }


  openModal(index) {
    if (this.isModalOpen) return;

    this.isModalOpen = true;
    this.currentIndex = index;
    const card = this.cardsData[index];

    // Lock body scroll - CSSクラスを使用する安全な方法
    const scrollY = window.scrollY;
    document.body.dataset.scrollY = scrollY.toString();
    
    // CSSクラスを追加してスクロールをロック
    document.body.classList.add('body-scroll-lock');
    document.body.style.top = `-${scrollY}px`;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'retro-modal-overlay';
    modal.innerHTML = `
      <div class="retro-modal-backdrop"></div>
      <div class="retro-modal-content">
        <button class="retro-modal-close" onclick="retroCards.closeModal()">
          <svg class="retro-modal-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m18 6-12 12"/>
            <path d="m6 6 12 12"/>
          </svg>
        </button>
        <div class="retro-modal-card">
          <img src="${card.backgroundImage}" alt="${card.name}" />
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add animation classes
    setTimeout(() => {
      modal.querySelector('.retro-modal-backdrop').classList.add('retro-modal-enter-active');
      modal.querySelector('.retro-modal-content').classList.add('retro-modal-enter-active');
    }, 10);

    // Close on backdrop click
    modal.querySelector('.retro-modal-backdrop').addEventListener('click', () => {
      this.closeModal();
    });
  }

  closeModal() {
    if (!this.isModalOpen) return;

    this.isModalOpen = false;

    // Restore body scroll - CSSクラスを使用する安全な方法
    const scrollY = parseInt(document.body.dataset.scrollY || '0', 10);
    
    // CSSクラスを削除してスクロールを復元
    document.body.classList.remove('body-scroll-lock');
    document.body.style.top = '';
    
    // データ属性もクリア
    delete document.body.dataset.scrollY;
    
    // スクロール位置を復元
    window.scrollTo({ top: scrollY, behavior: 'instant' });

    // Remove modal
    const modal = document.querySelector('.retro-modal-overlay');
    if (modal) {
      modal.querySelector('.retro-modal-backdrop').classList.add('retro-modal-exit-active');
      modal.querySelector('.retro-modal-content').classList.add('retro-modal-exit-active');
      
      setTimeout(() => {
        modal.remove();
        
        // モーダル削除後にフォントサイズを強制的にリセット
        this.resetFontSizes();
      }, 300);
    }
  }

  // フォントサイズをリセットする関数
  resetFontSizes() {
    // すべての要素のフォントサイズを一時的にリセット
    const allElements = document.querySelectorAll('*');
    allElements.forEach(element => {
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.fontSize) {
        element.style.fontSize = computedStyle.fontSize;
      }
    });
    
    // 少し遅延してから元に戻す
    setTimeout(() => {
      allElements.forEach(element => {
        element.style.fontSize = '';
      });
    }, 50);
  }
}

// Generate card data based on lesson title
function generateCardsData(lessonTitle) {
  // Extract stage and lesson number from title (e.g., "Stage1-1" -> stage: 1, lesson: 1)
  const match = lessonTitle.match(/Stage(\d+)-(\d+)/);
  if (!match) {
    console.log('No stage pattern found in lesson title:', lessonTitle);
    return [];
  }
  
  const stage = match[1];
  const lesson = match[2];
  const basePath = `/Stage${stage}/${stage}-${lesson}`;
  
  // Define card data for each lesson
  const cardDataMap = {
    'Stage1-1': [
      { name: "証券口座の基本", designation: "Step 1: 口座開設の準備", description: "株式投資を始める第一歩は証券口座の開設です。銀行口座とは別の専用口座で、株式や投資信託などの金融商品を売買するために必要不可欠です。" },
      { name: "口座の種類", designation: "Step 2: 証券会社の選択", description: "証券会社は大きく分けて対面型とネット証券の2種類があります。初心者には使いやすさと手数料の安さを重視したネット証券がおすすめです。" },
      { name: "選び方のポイント", designation: "Step 3: 比較検討", description: "取引手数料、使いやすさ、銀行との連携、投資情報の充実度など、複数のポイントを比較して自分に合った証券会社を選びましょう。" },
      { name: "申し込み手続き", designation: "Step 4: オンライン申し込み", description: "証券会社のウェブサイトやアプリから必要事項を入力して申し込みを行います。本人確認書類の準備も忘れずに。" },
      { name: "本人確認書類", designation: "Step 5: 書類提出", description: "運転免許証やマイナンバーカードなどの本人確認書類をアップロードします。学生証は使用できないので注意が必要です。" },
      { name: "審査期間", designation: "Step 6: 審査待ち", description: "申し込み後、数日から1週間程度の審査期間があります。審査完了の連絡が来るまで待機しましょう。" },
      { name: "口座開設完了", designation: "Step 7: 入金準備", description: "審査が完了すると口座開設の通知が届きます。口座に入金していよいよ株式投資のスタートです！" },
      { name: "投資開始", designation: "Step 8: 取引開始", description: "口座開設が完了したら、いよいよ株式投資を始めることができます。まずは少額から始めて、徐々に慣れていきましょう。" },
      { name: "継続的な学習", designation: "Step 9: 知識の向上", description: "投資は継続的な学習が重要です。市場の動向を学び、投資知識を深めることで、より良い投資判断ができるようになります。" }
    ],
    'Stage1-2': [
      { name: "申し込み準備", designation: "Step 1: 必要書類の確認", description: "証券口座開設に必要な書類を事前に準備しましょう。" },
      { name: "オンライン申し込み", designation: "Step 2: ウェブサイトで申し込み", description: "証券会社のウェブサイトから申し込み手続きを行います。" },
      { name: "本人確認", designation: "Step 3: 書類のアップロード", description: "本人確認書類をアップロードして本人確認を行います。" },
      { name: "審査待ち", designation: "Step 4: 審査期間", description: "申し込み後、審査が完了するまで待機します。" },
      { name: "口座開設完了", designation: "Step 5: 開設通知", description: "審査完了後、口座開設の通知が届きます。" },
      { name: "入金準備", designation: "Step 6: 資金の準備", description: "口座に入金して投資を開始する準備をします。" },
      { name: "取引開始", designation: "Step 7: 投資スタート", description: "いよいよ株式投資を開始します。" }
    ],
    'Stage2-1': [
      { name: "株価の基本", designation: "Step 1: 株価とは", description: "株価の基本的な概念を理解しましょう。" },
      { name: "需要と供給", designation: "Step 2: 価格決定の仕組み", description: "株価が需要と供給のバランスで決まることを学びます。" },
      { name: "市場の動き", designation: "Step 3: 株価変動の要因", description: "株価が変動する様々な要因を理解します。" },
      { name: "投資判断", designation: "Step 4: 株価の見方", description: "株価を参考にした投資判断の方法を学びます。" },
      { name: "リスク管理", designation: "Step 5: リスクの理解", description: "株価変動に伴うリスクを理解します。" },
      { name: "長期視点", designation: "Step 6: 長期的な視点", description: "短期的な株価変動に惑わされない考え方を身につけます。" }
    ],
    'Stage2-2': [
      { name: "板情報", designation: "Step 1: 板の見方", description: "板情報から売買の状況を読み取ります。" },
      { name: "チャート分析", designation: "Step 2: チャートの基本", description: "チャートを使って株価の動きを分析します。" },
      { name: "テクニカル分析", designation: "Step 3: 技術的分析", description: "テクニカル分析の基本を学びます。" },
      { name: "ファンダメンタル分析", designation: "Step 4: 基本分析", description: "企業の業績や財務状況を分析します。" },
      { name: "情報収集", designation: "Step 5: 情報の活用", description: "投資に必要な情報を効率的に収集します。" },
      { name: "判断材料", designation: "Step 6: 総合判断", description: "様々な情報を総合して投資判断を行います。" }
    ],
    'Stage3-1': [
      { name: "税金の基本", designation: "Step 1: 投資と税金", description: "投資で得た利益には税金がかかります。利益の種類によって税率が異なります。" },
      { name: "特定口座とは", designation: "Step 2: 特定口座の特徴", description: "証券会社が税金を計算・納付してくれる便利な口座です。源泉徴収ありとなしがあります。" },
      { name: "一般口座とは", designation: "Step 3: 一般口座の特徴", description: "自分で確定申告を行う必要がある口座です。複数の証券会社の損益を通算できます。" },
      { name: "NISA口座とは", designation: "Step 4: NISA口座の特徴", description: "投資で得た利益が非課税になる特別な口座です。年間120万円まで投資可能です。" },
      { name: "口座の比較", designation: "Step 5: 口座の使い分け", description: "特定口座、一般口座、NISA口座の特徴を比較し、目的に応じて使い分けます。" },
      { name: "税金の計算", designation: "Step 6: 税額の計算", description: "投資利益にかかる税金の計算方法を理解し、税負担を把握します。" },
      { name: "節税のポイント", designation: "Step 7: 節税対策", description: "NISAやiDeCoを活用した節税対策について学びます。" }
    ],
    'Stage3-2': [
      { name: "NISAの基本", designation: "Step 1: NISAとは", description: "NISA（少額投資非課税制度）は投資で得た利益が非課税になる制度です。" },
      { name: "投資枠の仕組み", designation: "Step 2: 年間投資枠", description: "年間120万円まで投資可能で、20年間の非課税期間があります。" },
      { name: "投資対象の制限", designation: "Step 3: 投資できる商品", description: "株式、投資信託、ETFなどが投資対象で、REITや債券は対象外です。" },
      { name: "非課税期間", designation: "Step 4: 20年間の制限", description: "20年間の非課税期間終了後は課税対象となり、新たな投資枠はありません。" },
      { name: "新NISAの特徴", designation: "Step 5: 新NISA制度", description: "2024年から始まった新NISAでは、投資枠が拡大し、より柔軟な運用が可能です。" },
      { name: "活用のポイント", designation: "Step 6: 効果的な活用", description: "NISAを効果的に活用するためのポイントと注意点を学びます。" }
    ],
    'Stage4-1': [
      { name: "指値注文とは", designation: "Step 1: 指値注文の基本", description: "希望する価格を指定して注文する方法です。指定した価格で約定するまで待機します。" },
      { name: "成行注文とは", designation: "Step 2: 成行注文の基本", description: "価格を指定せず、現在の市場価格で即座に約定する注文方法です。" },
      { name: "指値のメリット", designation: "Step 3: 指値の利点", description: "希望価格で取引できるため、コストをコントロールできます。" },
      { name: "成行のメリット", designation: "Step 4: 成行の利点", description: "確実に約定するため、急な価格変動に対応できます。" },
      { name: "注文の使い分け", designation: "Step 5: 使い分けのポイント", description: "市場状況や投資目的に応じて、指値と成行を使い分けます。" },
      { name: "注文の注意点", designation: "Step 6: 注意事項", description: "各注文方法のリスクと注意点を理解し、適切に活用します。" }
    ],
    'Stage4-2': [
      { name: "単元とは", designation: "Step 1: 単元の基本", description: "日本では基本的に100株単位で株式取引が行われます。これを単元といいます。" },
      { name: "単元未満株とは", designation: "Step 2: 単元未満株の仕組み", description: "1株単位で取引できる制度で、証券会社によって提供されています。" },
      { name: "単元未満株の制限", designation: "Step 3: 制限事項", description: "売却時は1株単位、配当は100株分のみ、株主優待は対象外などの制限があります。" },
      { name: "手数料の違い", designation: "Step 4: コストの比較", description: "単元未満株は手数料が高く、通常の単元取引よりコストがかかります。" },
      { name: "取引時間の制限", designation: "Step 5: 取引時間", description: "単元未満株は通常の取引時間とは異なる場合があり、注意が必要です。" },
      { name: "使い分けのポイント", designation: "Step 6: 活用方法", description: "単元と単元未満株の特徴を理解し、目的に応じて使い分けます。" }
    ],
    'Stage5-1': [
      { name: "テクニカル分析とは", designation: "Step 1: テクニカル分析の基本", description: "チャートや価格データを分析して、将来の価格動向を予測する手法です。" },
      { name: "ファンダメンタル分析とは", designation: "Step 2: ファンダメンタル分析の基本", description: "企業の業績、財務状況、経済環境を分析して投資価値を判断する手法です。" },
      { name: "テクニカル分析の手法", designation: "Step 3: テクニカル手法", description: "移動平均線、RSI、MACDなどの指標を使って価格動向を分析します。" },
      { name: "ファンダメンタル分析の要素", designation: "Step 4: ファンダメンタル要素", description: "売上高、利益、PER、PBRなどの財務指標を分析します。" },
      { name: "分析手法の比較", designation: "Step 5: 手法の使い分け", description: "テクニカル分析とファンダメンタル分析の特徴を比較し、使い分けます。" },
      { name: "初心者へのおすすめ", designation: "Step 6: 学習の進め方", description: "初心者はファンダメンタル分析から始めて、徐々にテクニカル分析を学びます。" }
    ],
    'Stage5-2': [
      { name: "投資信託とは", designation: "Step 1: 投資信託の基本", description: "多くの投資家から集めたお金を専門家が運用し、その成果を投資家に分配する金融商品です。" },
      { name: "投資信託の特徴", designation: "Step 2: 主な特徴", description: "少額から始められ、プロが運用し、自動的に分散投資が行われる特徴があります。" },
      { name: "投資信託の種類", designation: "Step 3: 種類の分類", description: "投資対象や運用方法によって、様々な種類の投資信託があります。" },
      { name: "手数料の仕組み", designation: "Step 4: コスト構造", description: "信託報酬、購入時手数料、解約時手数料などの手数料がかかります。" },
      { name: "リスクとリターン", designation: "Step 5: リスク管理", description: "投資信託にもリスクがあり、リスクとリターンの関係を理解することが重要です。" },
      { name: "選び方のポイント", designation: "Step 6: 選択基準", description: "投資目的、リスク許容度、手数料などを考慮して投資信託を選択します。" }
    ],
    'Stage5-3': [
      { name: "長期投資とは", designation: "Step 1: 長期投資の基本", description: "数年から数十年単位で株式を保有し、配当や株主優待を目的とする投資スタイルです。" },
      { name: "スイングトレードとは", designation: "Step 2: スイングトレードの基本", description: "数日から数週間の期間で売買を行い、中期的な価格変動を狙う投資手法です。" },
      { name: "デイトレードとは", designation: "Step 3: デイトレードの基本", description: "1日の中で売買を完結させ、短期的な価格変動を狙う投資手法です。" },
      { name: "スキャルピングとは", designation: "Step 4: スキャルピングの基本", description: "数分から数時間の極めて短い期間で売買を繰り返す投資手法です。" },
      { name: "投資手法の比較", designation: "Step 5: 手法の特徴比較", description: "各投資手法のリスク、リターン、必要な時間、スキルを比較します。" },
      { name: "初心者へのおすすめ", designation: "Step 6: 初心者向けアドバイス", description: "初心者は長期投資から始めて、徐々に短期投資を学ぶことをおすすめします。" }
    ],
    'Stage5-4': [
      { name: "リスク許容度の把握", designation: "Step 1: 自分のリスク", description: "年齢、収入、家族構成を考慮し、損失に耐えられる範囲を設定します。" },
      { name: "投資目的の設定", designation: "Step 2: 明確な目標", description: "具体的な目標金額と期間を設定し、定期的な見直しを行います。" },
      { name: "継続的な学習", designation: "Step 3: 知識の向上", description: "市場の動向を学び、投資知識を深めることで、より良い投資判断ができるようになります。" },
      { name: "長期的な視点", designation: "Step 4: 長期投資", description: "短期的な価格変動に惑わされず、着実に資産を築く長期的な視点を持ちます。" },
      { name: "感情のコントロール", designation: "Step 5: 投資心理", description: "投資における感情をコントロールし、冷静な判断を心がけます。" },
      { name: "計画的な投資", designation: "Step 6: 計画的実行", description: "計画に基づいて投資を実行し、一貫性のある投資戦略を維持します。" },
      { name: "柔軟性の維持", designation: "Step 7: 適応力", description: "市場の変化に柔軟に対応し、必要に応じて戦略を調整します。" }
    ]
  };
  
  const lessonKey = `Stage${stage}-${lesson}`;
  const cardData = cardDataMap[lessonKey] || [];
  
  return cardData.map((card, index) => ({
    ...card,
    backgroundImage: `${basePath}/${index + 1}.png`
  }));
}

// Initialize cards when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Wait a bit more to ensure all content is rendered
  setTimeout(() => {
    const container = document.getElementById('retro-cards-container');
    if (!container) {
      console.log('retro-cards-container not found, skipping initialization');
      return;
    }

    // Get lesson title from the page
    const lessonTitleElement = document.querySelector('.lesson-title');
    if (!lessonTitleElement) {
      console.log('Lesson title not found, skipping card initialization');
      return;
    }
    
    const lessonTitle = lessonTitleElement.textContent.trim();
    console.log('Found lesson title:', lessonTitle);
    
    // Generate card data based on lesson title
    const cardsData = generateCardsData(lessonTitle);
    
    if (cardsData.length === 0) {
      console.log('No card data generated for lesson:', lessonTitle);
      return;
    }

    console.log('Generated cards data:', cardsData);

    // Initialize the cards component
    window.retroCards = new RetroCards('retro-cards-container', cardsData);
  }, 100);
});
