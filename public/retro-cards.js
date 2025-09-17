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

    // Lock body scroll
    document.body.style.position = 'fixed';
    document.body.style.top = `-${window.scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.dataset.scrollY = window.scrollY.toString();

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

    // Restore body scroll
    const scrollY = parseInt(document.body.dataset.scrollY || '0', 10);
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo({ top: scrollY, behavior: 'instant' });

    // Remove modal
    const modal = document.querySelector('.retro-modal-overlay');
    if (modal) {
      modal.querySelector('.retro-modal-backdrop').classList.add('retro-modal-exit-active');
      modal.querySelector('.retro-modal-content').classList.add('retro-modal-exit-active');
      
      setTimeout(() => {
        modal.remove();
      }, 300);
    }
  }
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

    // Card data for 1-1 lesson
    const cardsData = [
    {
      name: "証券口座の基本",
      designation: "Step 1: 口座開設の準備",
      description: "株式投資を始める第一歩は証券口座の開設です。銀行口座とは別の専用口座で、株式や投資信託などの金融商品を売買するために必要不可欠です。",
      backgroundImage: "/1-1/1.png"
    },
    {
      name: "口座の種類",
      designation: "Step 2: 証券会社の選択",
      description: "証券会社は大きく分けて対面型とネット証券の2種類があります。初心者には使いやすさと手数料の安さを重視したネット証券がおすすめです。",
      backgroundImage: "/1-1/2.png"
    },
    {
      name: "選び方のポイント",
      designation: "Step 3: 比較検討",
      description: "取引手数料、使いやすさ、銀行との連携、投資情報の充実度など、複数のポイントを比較して自分に合った証券会社を選びましょう。",
      backgroundImage: "/1-1/3.png"
    },
    {
      name: "申し込み手続き",
      designation: "Step 4: オンライン申し込み",
      description: "証券会社のウェブサイトやアプリから必要事項を入力して申し込みを行います。本人確認書類の準備も忘れずに。",
      backgroundImage: "/1-1/4.png"
    },
    {
      name: "本人確認書類",
      designation: "Step 5: 書類提出",
      description: "運転免許証やマイナンバーカードなどの本人確認書類をアップロードします。学生証は使用できないので注意が必要です。",
      backgroundImage: "/1-1/5.png"
    },
    {
      name: "審査期間",
      designation: "Step 6: 審査待ち",
      description: "申し込み後、数日から1週間程度の審査期間があります。審査完了の連絡が来るまで待機しましょう。",
      backgroundImage: "/1-1/6.png"
    },
    {
      name: "口座開設完了",
      designation: "Step 7: 入金準備",
      description: "審査が完了すると口座開設の通知が届きます。口座に入金していよいよ株式投資のスタートです！",
      backgroundImage: "/1-1/7.png"
    },
    {
      name: "投資開始",
      designation: "Step 8: 取引開始",
      description: "口座開設が完了したら、いよいよ株式投資を始めることができます。まずは少額から始めて、徐々に慣れていきましょう。",
      backgroundImage: "/1-1/8.png"
    },
    {
      name: "継続的な学習",
      designation: "Step 9: 知識の向上",
      description: "投資は継続的な学習が重要です。市場の動向を学び、投資知識を深めることで、より良い投資判断ができるようになります。",
      backgroundImage: "/1-1/9.png"
    }
  ];

    // Initialize the cards component
    window.retroCards = new RetroCards('retro-cards-container', cardsData);
  }, 100); // 100ms delay to ensure content is rendered
  });
