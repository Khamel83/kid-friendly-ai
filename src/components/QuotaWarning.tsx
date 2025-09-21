import React from 'react';
import { usageTracker } from '../utils/usageTracker';

interface QuotaWarningProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function QuotaWarning({ isVisible, onClose }: QuotaWarningProps) {
  if (!isVisible) return null;

  const usage = usageTracker.getCurrentUsage();

  return (
    <div className="quota-warning-overlay">
      <div className="quota-warning-modal">
        <div className="quota-warning-header">
          <h2>🗣️ Talking Time Update</h2>
        </div>

        <div className="quota-warning-content">
          <div className="usage-stats">
            <div className="usage-bar">
              <div
                className="usage-fill"
                style={{ width: `${Math.min(usage.percentage, 100)}%` }}
              />
            </div>
            <p className="usage-text">
              {usage.used} out of {usage.limit} characters used this month
            </p>
          </div>

          <div className="quota-message">
            <p>{usageTracker.getUsageMessage()}</p>

            {usage.percentage >= 100 ? (
              <div className="limit-reached">
                <p>🎮 Good news! We can still:</p>
                <ul>
                  <li>💬 Chat with text messages</li>
                  <li>🎲 Play games</li>
                  <li>🧮 Do math problems</li>
                  <li>📚 Learn new things</li>
                </ul>
                <p className="parent-note">
                  💡 <strong>For parents:</strong> The free voice limit resets next month,
                  or you can upgrade your ElevenLabs account for more talking time.
                </p>
              </div>
            ) : (
              <div className="usage-ok">
                <p>😊 You can keep talking with your AI buddy!</p>
              </div>
            )}
          </div>
        </div>

        <div className="quota-warning-footer">
          <button
            className="quota-close-button"
            onClick={onClose}
          >
            Got it! 👍
          </button>
        </div>
      </div>

      <style jsx>{`
        .quota-warning-overlay {
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

        .quota-warning-modal {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 20px;
          padding: 30px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          animation: modalSlideIn 0.3s ease-out;
        }

        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translateY(-50px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .quota-warning-header h2 {
          margin: 0 0 20px 0;
          text-align: center;
          font-size: 24px;
        }

        .usage-stats {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 15px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .usage-bar {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          height: 20px;
          overflow: hidden;
          margin-bottom: 10px;
        }

        .usage-fill {
          height: 100%;
          background: linear-gradient(90deg, #4ecdc4 0%, #44a08d 50%, #ff6b6b 100%);
          border-radius: 10px;
          transition: width 0.3s ease;
        }

        .usage-text {
          text-align: center;
          margin: 0;
          font-size: 16px;
          font-weight: 500;
        }

        .quota-message {
          text-align: center;
          font-size: 18px;
          line-height: 1.6;
        }

        .limit-reached {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 15px;
          padding: 20px;
          margin-top: 15px;
        }

        .limit-reached ul {
          text-align: left;
          margin: 15px 0;
          padding-left: 20px;
        }

        .limit-reached li {
          margin: 8px 0;
        }

        .parent-note {
          font-size: 14px;
          margin-top: 15px;
          padding: 15px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
        }

        .usage-ok {
          margin-top: 15px;
          padding: 15px;
          background: rgba(76, 175, 80, 0.3);
          border-radius: 10px;
        }

        .quota-warning-footer {
          text-align: center;
          margin-top: 25px;
        }

        .quota-close-button {
          background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
          color: white;
          border: none;
          border-radius: 15px;
          padding: 15px 30px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 150px;
        }

        .quota-close-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        }

        .quota-close-button:active {
          transform: translateY(0);
        }

        @media (max-width: 600px) {
          .quota-warning-modal {
            margin: 10px;
            padding: 20px;
          }

          .quota-warning-header h2 {
            font-size: 20px;
          }

          .quota-message {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}