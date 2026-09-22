import React from 'react';
import { fireEvent, render, screen } from './ComponentTestBase';
import SoundControls from '../../src/components/SoundControls';
import { useSoundAccessibility, useSoundControls, useSoundLibrary } from '../../src/hooks/useSoundEffects';

jest.mock('../../src/hooks/useSoundEffects', () => ({
  useSoundAccessibility: jest.fn(),
  useSoundControls: jest.fn(),
  useSoundLibrary: jest.fn()
}));

const mockUseSoundAccessibility = useSoundAccessibility as jest.Mock;
const mockUseSoundControls = useSoundControls as jest.Mock;
const mockUseSoundLibrary = useSoundLibrary as jest.Mock;

const defaultSoundState = {
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  voiceVolume: 1,
  ambientVolume: 0.5,
  muted: false,
  categories: {
    ui: true,
    game: true,
    educational: true,
    music: true,
    ambient: true,
    character: true,
    notification: true,
    error: true,
    success: true,
    interaction: true
  },
  spatialAudioEnabled: true,
  compressionEnabled: true,
  accessibilityMode: false,
  parentalControls: {
    maxVolume: 0.8,
    allowedCategories: [],
    contentFilter: 'moderate'
  }
};

const findings = [
  {
    id: 'finding-1',
    category: 'Personal information',
    severity: 'high',
    speaker: 'Child',
    explanation: 'The message includes a phone number.',
    sourceQuote: 'You can call me at 555-0100.',
    sourceLocation: { messageIndex: 3 }
  }
];

function openParentalControls(reviewResult: {
  state: 'ready' | 'disabled' | 'unavailable';
  findings: typeof findings;
  unavailableMessage?: string;
}) {
  render(<SoundControls showParentalControls reviewResult={reviewResult} />);
  fireEvent.click(screen.getByRole('button', { name: 'Parental controls' }));
}

describe('SoundControls parental review', () => {
  beforeEach(() => {
    mockUseSoundAccessibility.mockReturnValue({
      visualFeedback: false,
      closedCaptions: false,
      vibrationEnabled: false,
      setVisualFeedback: jest.fn(),
      setClosedCaptions: jest.fn(),
      setVibrationEnabled: jest.fn(),
      triggerVibration: jest.fn(),
      showVisualFeedback: jest.fn()
    });
    mockUseSoundControls.mockReturnValue({
      state: defaultSoundState,
      setMasterVolume: jest.fn(),
      setCategoryVolume: jest.fn(),
      toggleMute: jest.fn(),
      setCategoryEnabled: jest.fn(),
      isMuted: false,
      masterVolume: 0.8,
      sfxVolume: 0.8,
      musicVolume: 0.7
    });
    mockUseSoundLibrary.mockReturnValue({
      library: null,
      sounds: [],
      loadLibrary: jest.fn(),
      playSound: jest.fn(),
      isLoading: false,
      error: null
    });
  });

  it('renders findings from the server review result in parental controls', () => {
    openParentalControls({ state: 'ready', findings });

    expect(screen.getByTestId('review-finding')).toHaveTextContent('Personal information');
    expect(screen.getByTestId('review-finding')).toHaveTextContent('high');
    expect(screen.getByTestId('review-finding')).toHaveTextContent('Child');
    expect(screen.getByTestId('review-finding')).toHaveTextContent('The message includes a phone number.');
    expect(screen.getByText('Source excerpt · Message 3')).toBeInTheDocument();
    expect(screen.getByText('You can call me at 555-0100.')).toBeInTheDocument();
  });

  it('renders the no-findings state without implying approval', () => {
    openParentalControls({ state: 'ready', findings: [] });

    expect(screen.getByText(/No findings were returned/)).toBeInTheDocument();
    expect(screen.getByText(/not a safety approval/)).toBeInTheDocument();
  });

  it('renders the unavailable state without implying approval', () => {
    openParentalControls({ state: 'unavailable', findings: [] });

    expect(screen.getByRole('alert')).toHaveTextContent(/currently unavailable/);
    expect(screen.getByRole('alert')).toHaveTextContent(/not a safety approval/);
  });
 
  it('uses the unavailable message from the server review result', () => {
    openParentalControls({
      state: 'unavailable',
      findings: [],
      unavailableMessage: 'The review service timed out.'
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The review service timed out. This is not a safety approval.'
    );
  });
});
