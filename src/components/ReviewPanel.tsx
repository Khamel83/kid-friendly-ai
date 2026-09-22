import React from 'react';
import { ReviewFinding, ReviewPanelState, ReviewSourceLocation } from '../types/review';

const SAFETY_APPROVAL_DISCLAIMER = 'This is not a safety approval.';

export interface ReviewPanelProps {
  state: ReviewPanelState;
  findings?: ReviewFinding[];
  unavailableMessage?: string;
  className?: string;
}

function formatSourceLocation(location: ReviewSourceLocation): string {
  if (typeof location === 'object') {
    return location.label || `Message ${location.messageIndex}`;
  }

  return typeof location === 'number' ? `Message ${location}` : location;
}

function getUnavailableMessage(unavailableMessage?: string): string {
  const message = unavailableMessage?.trim();

  if (!message) {
    return `Conversation review is currently unavailable. ${SAFETY_APPROVAL_DISCLAIMER}`;
  }

  return /not a safety approval/i.test(message)
    ? message
    : `${message} ${SAFETY_APPROVAL_DISCLAIMER}`;
}

function StateMessage({ state, unavailableMessage }: Pick<ReviewPanelProps, 'state' | 'unavailableMessage'>) {
  if (state === 'loading') {
    return (
      <p className="review-panel-state" role="status" aria-live="polite">
        Reviewing the conversation…
      </p>
    );
  }

  if (state === 'disabled') {
    return (
      <p className="review-panel-state">
        Conversation review is turned off. This is not a safety approval.
      </p>
    );
  }

  if (state === 'unavailable') {
    return (
      <p className="review-panel-state review-panel-state-error" role="alert">
        {getUnavailableMessage(unavailableMessage)}
      </p>
    );
  }

  return null;
}

function FindingCard({ finding }: { finding: ReviewFinding }) {
  return (
    <article className="review-finding" data-testid="review-finding">
      <div className="review-finding-header">
        <h4>{finding.category}</h4>
        <span className="review-severity">{finding.severity}</span>
      </div>
      <dl className="review-finding-details">
        <div>
          <dt>Speaker</dt>
          <dd>{finding.speaker}</dd>
        </div>
        <div>
          <dt>Explanation</dt>
          <dd>{finding.explanation}</dd>
        </div>
      </dl>
      <div className="review-source">
        <div className="review-source-label">
          Source excerpt · {formatSourceLocation(finding.sourceLocation)}
        </div>
        <blockquote>{finding.sourceQuote}</blockquote>
      </div>
    </article>
  );
}

export default function ReviewPanel({
  state,
  findings = [],
  unavailableMessage,
  className = ''
}: ReviewPanelProps) {
  const hasFindings = state === 'ready' && findings.length > 0;

  return (
    <section className={`review-panel ${className}`.trim()} aria-labelledby="review-panel-title">
      <div className="review-panel-heading">
        <div>
          <p className="review-panel-kicker">Secondary signal</p>
          <h3 id="review-panel-title">Conversation review</h3>
        </div>
        <span className="review-panel-note">Does not change chat safety decisions</span>
      </div>

      <StateMessage state={state} unavailableMessage={unavailableMessage} />

      {state === 'ready' && !hasFindings && (
        <p className="review-panel-state">
          No findings were returned. This review is not a safety approval.
        </p>
      )}

      {hasFindings && (
        <div className="review-findings" aria-label="Conversation review findings">
          {findings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
        </div>
      )}

      <style jsx>{`
        .review-panel {
          margin-top: 1.5rem;
          padding: 1rem;
          border: 1px solid rgba(47, 62, 70, 0.18);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.72);
          color: #263238;
        }

        .review-panel-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .review-panel-kicker {
          margin: 0 0 0.25rem;
          color: #607d8b;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h3,
        h4,
        p {
          margin-top: 0;
        }

        h3 {
          margin-bottom: 0;
          font-size: 1.15rem;
        }

        .review-panel-note {
          max-width: 13rem;
          color: #607d8b;
          font-size: 0.75rem;
          line-height: 1.35;
          text-align: right;
        }

        .review-panel-state {
          margin: 0;
          color: #455a64;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .review-panel-state-error {
          color: #8d3c2f;
        }

        .review-findings {
          display: grid;
          gap: 0.9rem;
        }

        .review-finding {
          padding: 0.9rem;
          border: 1px solid rgba(47, 62, 70, 0.14);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.82);
        }

        .review-finding-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.7rem;
        }

        h4 {
          margin-bottom: 0;
          font-size: 0.98rem;
          text-transform: capitalize;
        }

        .review-severity {
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          background: #fff1cf;
          color: #7a5514;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: capitalize;
        }

        .review-finding-details {
          display: grid;
          gap: 0.55rem;
          margin: 0;
        }

        .review-finding-details div {
          display: grid;
          grid-template-columns: 6.5rem 1fr;
          gap: 0.65rem;
        }

        dt {
          color: #607d8b;
          font-size: 0.78rem;
          font-weight: 700;
        }

        dd {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.45;
        }

        .review-source {
          margin-top: 0.85rem;
          padding: 0.75rem;
          border-left: 3px solid #4f8a8b;
          background: #edf6f4;
        }

        .review-source-label {
          color: #356366;
          font-size: 0.76rem;
          font-weight: 700;
        }

        blockquote {
          margin: 0.35rem 0 0;
          color: #203b3c;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        @media (max-width: 520px) {
          .review-panel-heading {
            display: block;
          }

          .review-panel-note {
            display: block;
            margin-top: 0.45rem;
            max-width: none;
            text-align: left;
          }

          .review-finding-details div {
            grid-template-columns: 1fr;
            gap: 0.15rem;
          }
        }
      `}</style>
    </section>
  );
}
