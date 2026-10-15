import type { ReactNode } from 'react';

export function Modal({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className="modal-backdrop">
      <div className={`modal card pop ${className}`} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}
