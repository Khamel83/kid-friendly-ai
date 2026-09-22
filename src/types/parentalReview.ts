export const PARENTAL_REVIEW_MAX_CHARS = 8000;

export type ParentalReviewStatus = 'disabled' | 'unavailable' | 'success';

export interface ParentalReviewSourceSpan {
  messageIndex: number;
  start: number;
  end: number;
  quote: string;
}

export interface ParentalReviewFinding {
  category: string;
  severity: string;
  speaker: string;
  explanation: string;
  sourceSpan?: ParentalReviewSourceSpan;
}

export interface ParentalReviewResult {
  status: ParentalReviewStatus;
  findings: ParentalReviewFinding[];
  sourceExcerpts: string[];
}

export const DISABLED_PARENTAL_REVIEW: ParentalReviewResult = {
  status: 'disabled',
  findings: [],
  sourceExcerpts: [],
};

export const UNAVAILABLE_PARENTAL_REVIEW: ParentalReviewResult = {
  status: 'unavailable',
  findings: [],
  sourceExcerpts: [],
};
