import { useRef } from 'react';

/**
 * Accessibility utilities for the Kid-Friendly AI Assistant
 */

export const AccessibilityUtils = {
  /**
   * Generate a unique ID for accessibility attributes
   */
  generateId: (prefix: string): string => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Announce a message to screen readers
   */
  announce: (message: string): void => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.setAttribute('aria-hidden', 'false');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';

    document.body.appendChild(announcement);
    announcement.textContent = message;

    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  },

  /**
   * Trap focus within a container
   */
  trapFocus: (container: HTMLElement): void => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Store cleanup function
    (container as any)._cleanupFocusTrap = () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  },

  /**
   * Remove focus trap from container
   */
  removeFocusTrap: (container: HTMLElement): void => {
    if ((container as any)._cleanupFocusTrap) {
      (container as any)._cleanupFocusTrap();
      delete (container as any)._cleanupFocusTrap;
    }
  },

  /**
   * Check if an element is in the viewport
   */
  isInViewport: (element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  /**
   * Scroll element into view with accessibility considerations
   */
  scrollToElement: (element: HTMLElement): void => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });

    // Announce to screen readers
    AccessibilityUtils.announce(`Scrolled to ${element.textContent || 'element'}`);
  },

  /**
   * Set up keyboard navigation for custom components
   */
  setupKeyboardNavigation: (
    element: HTMLElement,
    onEnter?: () => void,
    onSpace?: () => void,
    onEscape?: () => void
  ): void => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          onEnter?.();
          break;
        case ' ':
          e.preventDefault();
          onSpace?.();
          break;
        case 'Escape':
          e.preventDefault();
          onEscape?.();
          break;
      }
    };

    element.addEventListener('keydown', handleKeyDown);

    // Store cleanup function
    (element as any)._cleanupKeyboardNav = () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  },

  /**
   * Remove keyboard navigation setup
   */
  removeKeyboardNavigation: (element: HTMLElement): void => {
    if ((element as any)._cleanupKeyboardNav) {
      (element as any)._cleanupKeyboardNav();
      delete (element as any)._cleanupKeyboardNav;
    }
  }
};

/**
 * Hook for managing focus
 */
export const useFocusManagement = () => {
  const focusRef = useRef<HTMLElement>(null);

  const setFocus = (): void => {
    focusRef.current?.focus();
  };

  const restoreFocus = (): void => {
    setTimeout(() => {
      focusRef.current?.focus();
    }, 0);
  };

  return { focusRef, setFocus, restoreFocus };
};

/**
 * ARIA roles utility
 */
export const ARIA_ROLES = {
  // Landmark roles
  BANNER: 'banner',
  COMPLEMENTARY: 'complementary',
  CONTENTINFO: 'contentinfo',
  FORM: 'form',
  MAIN: 'main',
  NAVIGATION: 'navigation',
  REGION: 'region',
  SEARCH: 'search',

  // Widget roles
  BUTTON: 'button',
  CHECKBOX: 'checkbox',
  COMBOBOX: 'combobox',
  DIALOG: 'dialog',
  GRID: 'grid',
  GRIDCELL: 'gridcell',
  LINK: 'link',
  LISTBOX: 'listbox',
  MENU: 'menu',
  MENUBAR: 'menubar',
  MENUITEM: 'menuitem',
  OPTION: 'option',
  PROGRESSBAR: 'progressbar',
  RADIO: 'radio',
  SCROLLBAR: 'scrollbar',
  SEARCHBOX: 'searchbox',
  SLIDER: 'slider',
  SPINBUTTON: 'spinbutton',
  SWITCH: 'switch',
  TAB: 'tab',
  TABLIST: 'tablist',
  TABPANEL: 'tabpanel',
  TEXTBOX: 'textbox',
  TREEITEM: 'treeitem'
} as const;

/**
 * ARIA states and properties
 */
export const ARIA_STATES = {
  BUSY: 'aria-busy',
  CHECKED: 'aria-checked',
  DISABLED: 'aria-disabled',
  EXPANDED: 'aria-expanded',
  GRAABBED: 'aria-grabbed',
  HIDDEN: 'aria-hidden',
  INVALID: 'aria-invalid',
  PRESSED: 'aria-pressed',
  SELECTED: 'aria-selected'
} as const;

export const ARIA_PROPERTIES = {
  ACTDESCENDANT: 'aria-activedescendant',
  ATOMIC: 'aria-atomic',
  AUTOCOMPLETE: 'aria-autocomplete',
  CONTROLS: 'aria-controls',
  DESCRIBEDBY: 'aria-describedby',
  DROPEFFECT: 'aria-dropeffect',
  FLOWTO: 'aria-flowto',
  HASPOPUP: 'aria-haspopup',
  LABEL: 'aria-label',
  LABELLEDBY: 'aria-labelledby',
  LEVEL: 'aria-level',
  LIVE: 'aria-live',
  MULTILINE: 'aria-multiline',
  MULTISELECTABLE: 'aria-multiselectable',
  ORIENTATION: 'aria-orientation',
  OWNS: 'aria-owns',
  POSINSET: 'aria-posinset',
  READONLY: 'aria-readonly',
  RELEVANT: 'aria-relevant',
  REQUIRED: 'aria-required',
  SETSIZE: 'aria-setsize',
  SORT: 'aria-sort',
  VALUEMAX: 'aria-valuemax',
  VALUEMIN: 'aria-valuemin',
  VALUENOW: 'aria-valuenow',
  VALUETEXT: 'aria-valuetext'
} as const;