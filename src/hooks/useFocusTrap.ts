import { useEffect } from 'react';

/**
 * Universal Apple HIG Modal Focus Trap & Keyboard Navigation Hook
 * 
 * Traps Tab focus cycling within the active modal panel to prevent background element leaks.
 * Supports Escape key to dismiss modal.
 */
export const useFocusTrap = (
  isActive: boolean,
  containerRef: React.RefObject<HTMLElement>,
  onClose?: () => void
): void => {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 1. Escape key dismissal
      if (event.key === 'Escape' && onClose) {
        event.preventDefault();
        onClose();
        return;
      }

      // 2. Tab key focus trapping
      if (event.key === 'Tab' && containerRef.current) {
        const focusableSelectors = [
          'a[href]',
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])'
        ].join(', ');

        const focusableElements = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
        ).filter(el => el.offsetParent !== null); // Filter out display:none elements

        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          // Backward tab: if on first element, wrap to last
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Forward tab: if on last element, wrap to first
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, containerRef, onClose]);
};
