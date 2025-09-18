# Sound Effects Library

This directory contains the sound effects and audio assets for the Kid-Friendly AI application.

## Directory Structure

- **ui/** - User interface sounds (clicks, pops, transitions)
- **game/** - Game-related sounds (success, failure, achievements)
- **educational/** - Educational sounds (counting, alphabet, learning feedback)
- **music/** - Background music tracks
- **ambient/** - Ambient sound effects and environmental sounds
- **character/** - Character voice sounds and expressions
- **notification/** - Notification sounds and alerts
- **error/** - Error and warning sounds
- **success/** - Success and achievement sounds
- **interaction/** - General interaction sounds

## Audio Format Support

The application supports the following audio formats:
- MP3 (preferred)
- WAV
- OGG
- AAC
- FLAC

## Sound File Naming Convention

Use descriptive names that follow this pattern:
`category_action_variant.extension`

Examples:
- `ui_click_primary.mp3`
- `game_success_achievement.mp3`
- `educational_counting_1.mp3`

## Audio Quality Guidelines

- **Sample Rate**: 44.1kHz or 48kHz
- **Bit Depth**: 16-bit or 24-bit
- **Format**: MP3 at 192kbps for optimal quality/file size balance
- **Duration**: Keep sounds short (0.1-3 seconds) for UI interactions
- **Volume**: Normalize to -6dB to -3dB peak level

## Accessibility

All sounds should have:
- Visual alternatives
- Text descriptions
- Closed captioning support
- Alternative feedback mechanisms

## Performance Considerations

- Compress audio files to reduce load times
- Use appropriate file formats for different use cases
- Implement lazy loading for large sound libraries
- Cache frequently used sounds

## Adding New Sounds

1. Place sound files in appropriate category directory
2. Follow naming conventions
3. Update sound library configuration
4. Add accessibility descriptions
5. Test across different devices and browsers

## Placeholder Files

The current placeholder files are base64 encoded minimal audio snippets. Replace these with actual audio files for production use.