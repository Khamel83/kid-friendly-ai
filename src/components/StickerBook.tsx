import React, { useState, useEffect, useCallback } from 'react';

interface Sticker {
  id: string;
  emoji: string;
  name: string;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  earned: boolean;
  earnedDate?: string;
  description: string;
}

interface StickerBookProps {
  onComplete?: () => void;
  onStickerEarned?: (sticker: Sticker) => void;
}

const StickerBook: React.FC<StickerBookProps> = ({ onComplete, onStickerEarned }) => {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCelebration, setShowCelebration] = useState(false);
  const [newSticker, setNewSticker] = useState<Sticker | null>(null);

  // Initialize stickers
  useEffect(() => {
    const initialStickers: Sticker[] = [
      // Common Stickers
      { id: 'star_1', emoji: '⭐', name: 'First Star', category: 'achievement', rarity: 'common', earned: false, description: 'Earn your first star!' },
      { id: 'paw_1', emoji: '🐾', name: 'Animal Friend', category: 'animals', rarity: 'common', earned: false, description: 'Learn about animals!' },
      { id: 'book_1', emoji: '📚', name: 'Book Worm', category: 'learning', rarity: 'common', earned: false, description: 'Love learning!' },
      { id: 'rainbow_1', emoji: '🌈', name: 'Rainbow', category: 'achievement', rarity: 'common', earned: false, description: 'See the rainbow!' },

      // Uncommon Stickers
      { id: 'rocket_1', emoji: '🚀', name: 'Space Explorer', category: 'space', rarity: 'uncommon', earned: false, description: 'Explore space!' },
      { id: 'heart_1', emoji: '❤️', name: 'Kind Heart', category: 'achievement', rarity: 'uncommon', earned: false, description: 'Be kind to others!' },
      { id: 'tree_1', emoji: '🌳', name: 'Nature Lover', category: 'nature', rarity: 'uncommon', earned: false, description: 'Love nature!' },
      { id: 'music_1', emoji: '🎵', name: 'Music Maker', category: 'creativity', rarity: 'uncommon', earned: false, description: 'Make music!' },

      // Rare Stickers
      { id: 'diamond_1', emoji: '💎', name: 'Genius', category: 'achievement', rarity: 'rare', earned: false, description: 'Super smart!' },
      { id: 'crown_1', emoji: '👑', name: 'Question Master', category: 'achievement', rarity: 'rare', earned: false, description: 'Answer many questions!' },
      { id: 'rainbow_2', emoji: '🦄', name: 'Magical', category: 'fantasy', rarity: 'rare', earned: false, description: 'Believe in magic!' },
      { id: 'robot_1', emoji: '🤖', name: 'AI Buddy', category: 'technology', rarity: 'rare', earned: false, description: 'Best friends with AI!' },

      // Legendary Stickers
      { id: 'trophy_1', emoji: '🏆', name: 'Champion', category: 'achievement', rarity: 'legendary', earned: false, description: 'Win everything!' },
      { id: 'rainbow_3', emoji: '🌟', name: 'Super Star', category: 'achievement', rarity: 'legendary', earned: false, description: 'Be a superstar!' },
    ];

    // Load from localStorage if available
    const savedStickers = localStorage.getItem('kidFriendlyAiStickers');
    if (savedStickers) {
      try {
        const parsed = JSON.parse(savedStickers);
        setStickers(parsed);
      } catch (error) {
        console.error('Error loading stickers:', error);
        setStickers(initialStickers);
      }
    } else {
      setStickers(initialStickers);
    }
  }, []);

  // Save to localStorage when stickers change
  useEffect(() => {
    if (stickers.length > 0) {
      localStorage.setItem('kidFriendlyAiStickers', JSON.stringify(stickers));
    }
  }, [stickers]);

  const categories = [
    { id: 'all', name: 'All Stickers', emoji: '📖' },
    { id: 'achievement', name: 'Achievements', emoji: '🏆' },
    { id: 'animals', name: 'Animals', emoji: '🐾' },
    { id: 'space', name: 'Space', emoji: '🚀' },
    { id: 'nature', name: 'Nature', emoji: '🌳' },
    { id: 'learning', name: 'Learning', emoji: '📚' },
    { id: 'creativity', name: 'Creativity', emoji: '🎨' },
    { id: 'fantasy', name: 'Fantasy', emoji: '🦄' },
    { id: 'technology', name: 'Technology', emoji: '🤖' },
  ];

  const filteredStickers = selectedCategory === 'all'
    ? stickers
    : stickers.filter(sticker => sticker.category === selectedCategory);

  const earnSticker = useCallback((stickerId: string) => {
    setStickers(prev => {
      const updated = prev.map(sticker =>
        sticker.id === stickerId
          ? { ...sticker, earned: true, earnedDate: new Date().toISOString() }
          : sticker
      );

      const earnedSticker = updated.find(s => s.id === stickerId);
      if (earnedSticker && onStickerEarned) {
        onStickerEarned(earnedSticker);
      }

      return updated;
    });
  }, [onStickerEarned]);

  const showStickerCelebration = useCallback((sticker: Sticker) => {
    setNewSticker(sticker);
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 3000);
  }, []);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'linear-gradient(135deg, #95e1d3, #4ecdc4)';
      case 'uncommon': return 'linear-gradient(135deg, #a8e6cf, #7fcdcd)';
      case 'rare': return 'linear-gradient(135deg, #ffe66d, #ffd93d)';
      case 'legendary': return 'linear-gradient(135deg, #ff6b6b, #ff8a80)';
      default: return 'linear-gradient(135deg, #f8f9fa, #e9ecef)';
    }
  };

  const getRarityBorder = (rarity: string) => {
    switch (rarity) {
      case 'common': return '2px solid #4ecdc4';
      case 'uncommon': return '2px solid #7fcdcd';
      case 'rare': return '2px solid #ffd93d';
      case 'legendary': return '2px solid #ff6b6b';
      default: return '2px solid #dee2e6';
    }
  };

  const earnedCount = stickers.filter(s => s.earned).length;
  const totalCount = stickers.length;

  return (
    <div className="sticker-book">
      {/* Header */}
      <div className="sticker-book-header">
        <div className="sticker-book-title">
          <h2>📖 My Sticker Book</h2>
          <div className="progress-info">
            <span>{earnedCount} / {totalCount} Stickers</span>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(earnedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {onComplete && (
          <button
            className="close-button"
            onClick={onComplete}
            aria-label="Close sticker book"
          >
            ✖️
          </button>
        )}
      </div>

      {/* Category Filter */}
      <div className="category-filter">
        <div className="category-buttons">
          {categories.map(category => (
            <button
              key={category.id}
              className={`category-button ${selectedCategory === category.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.id)}
              aria-label={`Filter by ${category.name}`}
            >
              <span className="category-emoji">{category.emoji}</span>
              <span className="category-name">{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sticker Grid */}
      <div className="sticker-grid">
        {filteredStickers.map(sticker => (
          <div
            key={sticker.id}
            className={`sticker-item ${sticker.earned ? 'earned' : 'locked'} ${sticker.rarity}`}
            style={{
              background: sticker.earned ? getRarityColor(sticker.rarity) : '#f8f9fa',
              border: getRarityBorder(sticker.rarity)
            }}
          >
            <div className="sticker-content">
              <div className="sticker-emoji">
                {sticker.earned ? sticker.emoji : '❓'}
              </div>
              <div className="sticker-info">
                <div className="sticker-name">
                  {sticker.earned ? sticker.name : '???'}
                </div>
                <div className="sticker-rarity">
                  {sticker.earned && (
                    <span className={`rarity-badge ${sticker.rarity}`}>
                      {sticker.rarity}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {sticker.earnedDate && (
              <div className="earned-date">
                Earned {new Date(sticker.earnedDate).toLocaleDateString()}
              </div>
            )}

            {!sticker.earned && (
              <div className="locked-overlay">
                <div className="lock-icon">🔒</div>
                <div className="hint">{sticker.description}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Celebration Modal */}
      {showCelebration && newSticker && (
        <div className="celebration-modal">
          <div className="celebration-content">
            <div className="celebration-emoji">{newSticker.emoji}</div>
            <h3>New Sticker Earned!</h3>
            <div className="sticker-name">{newSticker.name}</div>
            <div className="sticker-description">{newSticker.description}</div>
            <div className={`rarity-badge ${newSticker.rarity}`}>
              {newSticker.rarity}
            </div>
          </div>

          {/* Confetti Animation */}
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                backgroundColor: ['#ffe66d', '#ff6b6b', '#4ecdc4', '#a8e6cf', '#95e1d3'][Math.floor(Math.random() * 5)],
                animation: `confettiFall ${1 + Math.random() * 2}s linear forwards`,
                animationDelay: `${Math.random() * 0.5}s`
              }}
            />
          ))}
        </div>
      )}

      {/* Debug Panel - Remove in production */}
      <div className="debug-panel" style={{ display: 'none' }}>
        <h4>Debug: Earn Stickers</h4>
        <div className="debug-buttons">
          <button onClick={() => earnSticker('star_1')}>Earn Star</button>
          <button onClick={() => earnSticker('rocket_1')}>Earn Rocket</button>
          <button onClick={() => earnSticker('diamond_1')}>Earn Diamond</button>
          <button onClick={() => earnSticker('trophy_1')}>Earn Trophy</button>
        </div>
      </div>
    </div>
  );
};

export default StickerBook;

// Helper function to earn stickers from outside components
export const earnSticker = (stickerId: string) => {
  // This would typically use a context or state management
  // For now, we'll dispatch a custom event
  window.dispatchEvent(new CustomEvent('earnSticker', { detail: { stickerId } }));
};

// Hook to use sticker book functionality
export const useStickerBook = () => {
  const earnSticker = useCallback((stickerId: string) => {
    window.dispatchEvent(new CustomEvent('earnSticker', { detail: { stickerId } }));
  }, []);

  return { earnSticker };
};