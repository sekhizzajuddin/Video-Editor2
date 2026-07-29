import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  variant?: 'default' | 'danger' | 'submenu';
  submenu?: ContextMenuItem[];
  separator?: boolean;
  disabled?: boolean;
  checked?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    setTimeout(() => {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('keydown', handleEsc);
    }, 0);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 32 - 20);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[200] min-w-[200px] bg-[#1e1e1e] border border-[#3e3e3e] rounded-md shadow-2xl py-1 text-xs"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item, idx) => {
        if (item.separator) {
          return <div key={`sep-${idx}`} className="h-px bg-[#3e3e3e] my-1 mx-1" />;
        }

        const isDisabled = item.disabled;
        const variantClass =
          item.variant === 'danger'
            ? 'text-red-400 hover:bg-red-500/15'
            : 'text-white hover:bg-amber-500/20';

        return (
          <button
            key={item.id}
            type="button"
            disabled={isDisabled}
            onClick={() => {
              if (item.onClick) item.onClick();
              onClose();
            }}
            className={`w-full px-3 py-1.5 flex items-center gap-2 text-left transition-colors ${
              isDisabled
                ? 'text-[#6a6a6a] cursor-not-allowed'
                : variantClass
            }`}
          >
            {item.icon && <span className="w-4 h-4 flex items-center justify-center">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <span className="text-[9px] text-[#6a6a6a] font-mono">{item.shortcut}</span>
            )}
            {item.checked !== undefined && (
              <span className="text-amber-500">{item.checked ? '✓' : ''}</span>
            )}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
