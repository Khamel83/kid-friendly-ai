import { useState, useEffect } from 'react';

const emojis = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

interface SimpleMemoryGameProps {
  onClose: () => void;
}

export default function SimpleMemoryGame({ onClose }: SimpleMemoryGameProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [isChecking, setIsChecking] = useState(false);

  const initializeGame = () => {
    const gameEmojis = emojis.slice(0, 6);
    const cardPairs = [...gameEmojis, ...gameEmojis];
    const shuffled = cardPairs
      .map((emoji, index) => ({
        id: index,
        emoji,
        isFlipped: false,
        isMatched: false,
      }))
      .sort(() => Math.random() - 0.5);

    setCards(shuffled);
    setFlippedCards([]);
    setMoves(0);
    setMatches(0);
    setIsChecking(false);
  };

  useEffect(() => {
    initializeGame();
  }, []);

  const handleCardClick = (cardId: number) => {
    if (isChecking) return;
    if (flippedCards.includes(cardId)) return;
    if (cards[cardId].isMatched) return;
    if (flippedCards.length >= 2) return;

    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);

    const newCards = cards.map((card) =>
      card.id === cardId ? { ...card, isFlipped: true } : card
    );
    setCards(newCards);

    if (newFlipped.length === 2) {
      setMoves(moves + 1);
      setIsChecking(true);

      const [first, second] = newFlipped;
      if (cards[first].emoji === cards[second].emoji) {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((card) =>
              card.id === first || card.id === second
                ? { ...card, isMatched: true }
                : card
            )
          );
          setMatches(matches + 1);
          setFlippedCards([]);
          setIsChecking(false);
        }, 500);
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((card) =>
              card.id === first || card.id === second
                ? { ...card, isFlipped: false }
                : card
            )
          );
          setFlippedCards([]);
          setIsChecking(false);
        }, 1000);
      }
    }
  };

  const isGameComplete = matches === 6;

  return (
    <div className="game-overlay">
      <div className="game-modal">
        <button className="game-close" onClick={onClose}>✕</button>

        <h2 className="game-title">🧠 Memory Match</h2>

        <div className="game-stats">
          <div className="stat">
            <span className="stat-label">Moves:</span>
            <span className="stat-value">{moves}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Matches:</span>
            <span className="stat-value">{matches}/6</span>
          </div>
        </div>

        {isGameComplete && (
          <div className="game-complete">
            <div className="complete-message">🎉 You Won! 🎉</div>
            <div className="complete-stats">Completed in {moves} moves!</div>
          </div>
        )}

        <div className="memory-grid">
          {cards.map((card) => (
            <div
              key={card.id}
              className={`memory-card ${card.isFlipped || card.isMatched ? 'flipped' : ''} ${
                card.isMatched ? 'matched' : ''
              }`}
              onClick={() => handleCardClick(card.id)}
            >
              <div className="card-inner">
                <div className="card-front">?</div>
                <div className="card-back">{card.emoji}</div>
              </div>
            </div>
          ))}
        </div>

        {isGameComplete && (
          <div className="game-buttons">
            <button className="game-button primary" onClick={initializeGame}>
              Play Again 🔄
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .game-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .game-modal {
          background: white;
          border-radius: 24px;
          padding: 32px;
          max-width: 600px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          position: relative;
          max-height: 90vh;
          overflow-y: auto;
        }

        .game-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: #f0f0f0;
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          font-size: 24px;
          cursor: pointer;
        }

        .game-close:hover {
          background: #e0e0e0;
        }

        .game-title {
          font-size: 32px;
          margin: 0 0 24px 0;
          text-align: center;
          color: #2c3e50;
        }

        .game-stats {
          display: flex;
          justify-content: center;
          gap: 32px;
          margin-bottom: 24px;
        }

        .stat {
          text-align: center;
        }

        .stat-label {
          font-size: 14px;
          color: #7f8c8d;
          display: block;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #2c3e50;
        }

        .game-complete {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          padding: 20px;
          border-radius: 16px;
          color: white;
          text-align: center;
          margin-bottom: 24px;
        }

        .complete-message {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 8px;
        }

        .complete-stats {
          font-size: 18px;
        }

        .memory-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin: 24px 0;
        }

        .memory-card {
          aspect-ratio: 1;
          cursor: pointer;
          perspective: 1000px;
        }

        .memory-card.matched {
          cursor: default;
        }

        .card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.6s;
          transform-style: preserve-3d;
        }

        .memory-card.flipped .card-inner {
          transform: rotateY(180deg);
        }

        .card-front,
        .card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          font-size: 48px;
          font-weight: bold;
        }

        .card-front {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .card-back {
          background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
          transform: rotateY(180deg);
        }

        .memory-card.matched .card-back {
          background: linear-gradient(135deg, #a8e6cf 0%, #56ab2f 100%);
        }

        .game-buttons {
          display: flex;
          justify-content: center;
          margin-top: 24px;
        }

        .game-button {
          padding: 16px 32px;
          font-size: 20px;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-weight: bold;
          transition: transform 0.2s;
        }

        .game-button:hover {
          transform: scale(1.05);
        }

        .game-button.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        @media (max-width: 600px) {
          .game-modal {
            padding: 24px;
          }

          .memory-grid {
            gap: 8px;
          }

          .card-front,
          .card-back {
            font-size: 36px;
          }
        }
      `}</style>
    </div>
  );
}
