import type { NextApiRequest, NextApiResponse } from 'next';
import type { ParentalReviewResult } from '../../types/parentalReview';
import { requestParentalReview } from '../../server/parentalReviewClient';

interface ParentalReviewRequestBody {
  conversationSegment?: unknown;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ParentalReviewResult | { error: string }>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as ParentalReviewRequestBody | undefined;
  const conversationSegment = typeof body?.conversationSegment === 'string'
    ? body.conversationSegment
    : '';
  const result = await requestParentalReview(conversationSegment);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(result);
}
