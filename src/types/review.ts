export type ReviewPanelState = 'loading' | 'ready' | 'disabled' | 'unavailable';

export type ReviewSourceLocation =
  | string
  | number
  | {
      messageIndex: number;
      label?: string;
    };

export interface ReviewFinding {
  id: string;
  category: string;
  severity: string;
  speaker: string;
  explanation: string;
  sourceQuote: string;
  sourceLocation: ReviewSourceLocation;
}

export interface ReviewResult {
  state: Exclude<ReviewPanelState, 'loading'>;
  findings: ReviewFinding[];
  unavailableMessage?: string;
}
