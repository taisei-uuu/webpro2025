// DisplayCards Component JavaScript
class DisplayCards {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      cards: options.cards || this.getDefaultCards(),
      ...options
    };
    this.init();
  }

  getDefaultCards() {
    return [
      {
        icon: 'sparkles',
        title: '基礎学習',
        description: '投資の基本から学べる',
        date: '今すぐ開始',
        iconClassName: 'text-blue-800',
        titleClassName: 'text-blue-800'
      },
      {
        icon: 'trending-up',
        title: '実践分析',
        description: '実際の市場で学ぶ',
        date: '2週間後',
        iconClassName: 'text-blue-800',
        titleClassName: 'text-blue-800'
      },
      {
        icon: 'star',
        title: '上級テクニック',
        description: 'プロの投資手法を習得',
        date: '1ヶ月後',
        iconClassName: 'text-blue-800',
        titleClassName: 'text-blue-800'
      }
    ];
  }

  getIconSVG(iconName) {
    const icons = {
      'sparkles': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.936l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0L9.937 15.5Z"/>
        <path d="M19 3v4"/>
        <path d="M21 5h-4"/>
        <path d="M19 17v4"/>
        <path d="M21 19h-4"/>
        <path d="M5 3v4"/>
        <path d="M7 5H3"/>
        <path d="M5 17v4"/>
        <path d="M7 19H3"/>
      </svg>`,
      'trending-up': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/>
        <polyline points="16,7 22,7 22,13"/>
      </svg>`,
      'star': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2"/>
      </svg>`,
      'chart-line': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3v18h18"/>
        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
      </svg>`,
      'target': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="6"/>
        <circle cx="12" cy="12" r="2"/>
      </svg>`
    };
    return icons[iconName] || icons['sparkles'];
  }

  createCard(cardData, index) {
    const card = document.createElement('div');
    card.className = 'display-card';
    
    const iconSVG = this.getIconSVG(cardData.icon);
    
    card.innerHTML = `
      <div>
        <span class="display-card-icon">
          ${iconSVG}
        </span>
        <p class="display-card-title ${cardData.titleClassName || ''}">${cardData.title}</p>
      </div>
      <p class="display-card-description">${cardData.description}</p>
      <p class="display-card-date">${cardData.date}</p>
    `;

    return card;
  }

  render() {
    if (!this.container) {
      console.error('DisplayCards container not found');
      return;
    }

    this.container.innerHTML = '';
    this.container.className = 'display-cards-container';

    this.options.cards.forEach((cardData, index) => {
      const card = this.createCard(cardData, index);
      this.container.appendChild(card);
    });
  }

  init() {
    this.render();
  }

  updateCards(newCards) {
    this.options.cards = newCards;
    this.render();
  }
}

// Initialize DisplayCards when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Auto-initialize if container exists
  const container = document.getElementById('display-cards');
  if (container) {
    new DisplayCards('display-cards');
  }
});

// Export for manual initialization
window.DisplayCards = DisplayCards;
