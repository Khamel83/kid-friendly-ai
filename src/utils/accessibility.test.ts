import { AccessibilityUtils } from './accessibility';

describe('AccessibilityUtils', () => {
  let originalWindow: any;

  beforeEach(() => {
    originalWindow = global.window;
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  describe('Screen Reader Detection', () => {
    it('should detect screen reader when user agent indicates it', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 JAWS/2021.2106.64',
        configurable: true,
      });

      expect(AccessibilityUtils.isScreenReaderActive()).toBe(true);
    });

    it('should not detect screen reader when user agent does not indicate it', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        configurable: true,
      });

      expect(AccessibilityUtils.isScreenReaderActive()).toBe(false);
    });
  });

  describe('Reduced Motion Detection', () => {
    it('should detect reduced motion preference', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
        configurable: true,
      });

      expect(AccessibilityUtils.prefersReducedMotion()).toBe(true);
    });

    it('should return false when reduced motion is not preferred', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn().mockImplementation(query => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
        configurable: true,
      });

      expect(AccessibilityUtils.prefersReducedMotion()).toBe(false);
    });
  });

  describe('High Contrast Detection', () => {
    it('should detect high contrast preference', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
        configurable: true,
      });

      expect(AccessibilityUtils.prefersHighContrast()).toBe(true);
    });
  });

  describe('Focus Management', () => {
    let mockElement: HTMLElement;

    beforeEach(() => {
      mockElement = {
        focus: jest.fn(),
        scrollIntoView: jest.fn(),
      } as any;
    });

    it('should focus element with scroll', () => {
      AccessibilityUtils.focusElement(mockElement, true);

      expect(mockElement.focus).toHaveBeenCalled();
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    });

    it('should focus element without scroll', () => {
      AccessibilityUtils.focusElement(mockElement, false);

      expect(mockElement.focus).toHaveBeenCalled();
      expect(mockElement.scrollIntoView).not.toHaveBeenCalled();
    });

    it('should handle null element gracefully', () => {
      expect(() => {
        AccessibilityUtils.focusElement(null);
      }).not.toThrow();
    });
  });

  describe('Trap Focus', () => {
    let mockContainer: HTMLElement;
    let mockElement1: HTMLElement;
    let mockElement2: HTMLElement;

    beforeEach(() => {
      mockElement1 = {
        focus: jest.fn(),
        tabIndex: 0,
        getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 100, right: 100 }),
      } as any;

      mockElement2 = {
        focus: jest.fn(),
        tabIndex: 0,
        getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 100, right: 100 }),
      } as any;

      mockContainer = {
        querySelectorAll: jest.fn().mockReturnValue([mockElement1, mockElement2]),
        contains: jest.fn().mockReturnValue(true),
      } as any;
    });

    it('should trap focus within container', () => {
      const mockEvent = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: jest.fn(),
        target: mockElement1,
      } as any;

      AccessibilityUtils.trapFocus(mockContainer, mockEvent);

      // Should not prevent default when focus is within bounds
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('should prevent tab when focus would leave container', () => {
      const mockEvent = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: jest.fn(),
        target: mockElement2,
      } as any;

      // Mock contains to return false for focusable elements
      (mockContainer.contains as jest.Mock).mockReturnValue(false);

      AccessibilityUtils.trapFocus(mockContainer, mockEvent);

      // Should prevent default when focus would leave container
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockElement1.focus).toHaveBeenCalled();
    });

    it('should handle null container gracefully', () => {
      const mockEvent = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: jest.fn(),
      } as any;

      expect(() => {
        AccessibilityUtils.trapFocus(null, mockEvent);
      }).not.toThrow();
    });
  });

  describe('Announce to Screen Reader', () => {
    beforeEach(() => {
      // Mock document methods
      document.createElement = jest.fn().mockReturnValue({
        id: '',
        style: {},
        ariaLive: '',
        ariaAtomic: '',
        textContent: '',
        parentNode: null,
      });

      document.body = {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
      } as any;
    });

    it('should create announcement element', () => {
      const createElementSpy = jest.spyOn(document, 'createElement');
      const appendChildSpy = jest.spyOn(document.body, 'appendChild');

      AccessibilityUtils.announceToScreenReader('Test message');

      expect(createElementSpy).toHaveBeenCalledWith('div');
      expect(appendChildSpy).toHaveBeenCalled();
    });

    it('should remove existing announcement element', () => {
      const existingElement = { parentNode: document.body };
      const removeChildSpy = jest.spyOn(document.body, 'removeChild');

      // Simulate existing element
      (document.getElementById as jest.Mock) = jest.fn().mockReturnValue(existingElement);

      AccessibilityUtils.announceToScreenReader('New message');

      expect(removeChildSpy).toHaveBeenCalledWith(existingElement);
    });

    it('should handle announcement with different politeness levels', () => {
      const createElementSpy = jest.spyOn(document, 'createElement');

      AccessibilityUtils.announceToScreenReader('Important message', 'assertive');

      expect(createElementSpy).toHaveBeenCalled();
      // Verify aria-live is set correctly
      const createdElement = createElementSpy.mock.results[0].value;
      expect(createdElement.ariaLive).toBe('assertive');
    });
  });

  describe('Color Contrast', () => {
    it('should calculate relative luminance correctly', () => {
      // Test white color
      const whiteLuminance = AccessibilityUtils.calculateRelativeLuminance('#ffffff');
      expect(whiteLuminance).toBe(1);

      // Test black color
      const blackLuminance = AccessibilityUtils.calculateRelativeLuminance('#000000');
      expect(blackLuminance).toBe(0);

      // Test gray color
      const grayLuminance = AccessibilityUtils.calculateRelativeLuminance('#808080');
      expect(grayLuminance).toBeCloseTo(0.2159, 3);
    });

    it('should calculate contrast ratio correctly', () => {
      const contrastRatio = AccessibilityUtils.calculateContrastRatio('#ffffff', '#000000');
      expect(contrastRatio).toBe(21);
    });

    it('should validate contrast against WCAG standards', () => {
      // Test AAA compliance for large text
      const largeTextAAA = AccessibilityUtils.validateContrast('#ffffff', '#000000', 'large');
      expect(largeTextAAA).toEqual({ passes: true, ratio: 21, level: 'AAA' });

      // Test AA compliance for normal text
      const normalTextAA = AccessibilityUtils.validateContrast('#ffffff', '#666666', 'normal');
      expect(normalTextAA.passes).toBe(false);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should generate unique keyboard nav IDs', () => {
      const id1 = AccessibilityUtils.generateKeyboardNavId();
      const id2 = AccessibilityUtils.generateKeyboardNavId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^keyboard-nav-/);
    });

    it('should register and unregister keyboard shortcuts', () => {
      const mockCallback = jest.fn();

      AccessibilityUtils.registerKeyboardShortcut('Escape', mockCallback);

      // Verify registration (this would need to be tested with actual event system)
      expect(() => {
        AccessibilityUtils.registerKeyboardShortcut('Escape', mockCallback);
      }).not.toThrow();

      AccessibilityUtils.unregisterKeyboardShortcut('Escape');
      expect(() => {
        AccessibilityUtils.unregisterKeyboardShortcut('Escape');
      }).not.toThrow();
    });
  });
});