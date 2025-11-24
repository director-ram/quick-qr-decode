import { useEffect } from 'react';

interface KeyboardShortcuts {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for modifier keys
      const isCtrl = event.ctrlKey || event.metaKey;
      const isShift = event.shiftKey;
      const isAlt = event.altKey;

      // Build shortcut key
      const parts: string[] = [];
      if (isCtrl) parts.push('ctrl');
      if (isShift) parts.push('shift');
      if (isAlt) parts.push('alt');
      const key = event.key?.toLowerCase?.();
      if (!key) {
        return;
      }
      parts.push(key);

      const shortcutKey = parts.join('+');

      // Check if this shortcut exists
      if (shortcuts[shortcutKey]) {
        event.preventDefault();
        shortcuts[shortcutKey]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

