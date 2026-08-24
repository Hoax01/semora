import type { ReactNode } from 'react';

type StateTone = 'neutral' | 'error';

type PageStateProps = {
  eyebrow: string;
  title: string;
  message: string;
  tone?: StateTone;
  action?: ReactNode;
};

export function PageState({ eyebrow, title, message, tone = 'neutral', action }: PageStateProps) {
  return (
    <section
      className={`state-panel state-panel-${tone}`}
      role={tone === 'error' ? 'alert' : undefined}
    >
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{message}</p>
      {action ? <div className="state-panel-action">{action}</div> : null}
    </section>
  );
}

export function LoadingState({ eyebrow, label }: { eyebrow: string; label: string }) {
  return (
    <section className="state-panel state-panel-loading" aria-live="polite" role="status">
      <span className="loading-indicator" aria-hidden="true" />
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <p className="state-loading-label">{label}</p>
      </div>
    </section>
  );
}

export function InlineState({
  label,
  tone = 'neutral',
  action,
}: {
  label: string;
  tone?: StateTone;
  action?: ReactNode;
}) {
  return (
    <div
      className={`state-inline state-inline-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {tone === 'neutral' ? <span className="loading-indicator" aria-hidden="true" /> : null}
      <span>{label}</span>
      {action ? <span className="state-inline-action">{action}</span> : null}
    </div>
  );
}
