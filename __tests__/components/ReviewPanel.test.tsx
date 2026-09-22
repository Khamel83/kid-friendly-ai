import React from 'react';
import { render, screen } from './ComponentTestBase';
import ReviewPanel from '../../src/components/ReviewPanel';

const findings = [
  {
    id: 'finding-1',
    category: 'Personal information',
    severity: 'high',
    speaker: 'Child',
    explanation: 'The message includes a phone number.',
    sourceQuote: 'You can call me at 555-0100.',
    sourceLocation: { messageIndex: 3 }
  },
  {
    id: 'finding-2',
    category: 'Unsafe request',
    severity: 'medium',
    speaker: 'Buddy',
    explanation: 'The response suggests moving the conversation elsewhere.',
    sourceQuote: 'Let us keep this secret.',
    sourceLocation: 'Message 4'
  }
];

describe('ReviewPanel', () => {
  it('renders every finding and keeps the source excerpt distinct', () => {
    render(<ReviewPanel state="ready" findings={findings} />);

    expect(screen.getAllByTestId('review-finding')).toHaveLength(2);
    expect(screen.getByText('Personal information')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
    expect(screen.getByText('The message includes a phone number.')).toBeInTheDocument();
    expect(screen.getByText('You can call me at 555-0100.')).toBeInTheDocument();
    expect(screen.getByText('Source excerpt · Message 3')).toBeInTheDocument();
    expect(screen.getByText('You can call me at 555-0100.').tagName).toBe('BLOCKQUOTE');
  });

  it('explains when the review returns no findings without implying approval', () => {
    render(<ReviewPanel state="ready" findings={[]} />);

    expect(screen.getByText(/No findings were returned/)).toBeInTheDocument();
    expect(screen.getByText(/not a safety approval/)).toBeInTheDocument();
  });

  it('explains when the review service is unavailable', () => {
    render(<ReviewPanel state="unavailable" />);

    expect(screen.getByRole('alert')).toHaveTextContent(/currently unavailable/);
    expect(screen.getByRole('alert')).toHaveTextContent(/not a safety approval/);
  });
 
  it('keeps the safety disclaimer when the service supplies an unavailable message', () => {
    render(<ReviewPanel state="unavailable" unavailableMessage="Review service timed out." />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Review service timed out. This is not a safety approval.'
    );
  });

  it('provides explicit loading and disabled states', () => {
    const { rerender } = render(<ReviewPanel state="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent(/Reviewing the conversation/);

    rerender(<ReviewPanel state="disabled" />);
    expect(screen.getByText(/turned off/)).toBeInTheDocument();
    expect(screen.getByText(/not a safety approval/)).toBeInTheDocument();
  });
});
