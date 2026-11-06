import type { ReactNode } from 'react';
import { tripStopParts } from '../trips/format';

interface MyTripCardProps {
  from: string;
  to: string;
  status?: ReactNode;
  facts: ReactNode;
  actions: ReactNode;
  footerNote?: string;
  busy?: boolean;
  children?: ReactNode;
}

export function MyTripCard({ from, to, status, facts, actions, footerNote, busy, children }: MyTripCardProps) {
  return <article className="my-booking-card" aria-busy={busy}>
    {status}
    <header>
      <h2>{tripStopParts(from, { abbreviate: false }).name} → {tripStopParts(to, { abbreviate: false }).name}</h2>
      <p className="my-booking-address">{from} → {to}</p>
    </header>
    <dl className="my-booking-facts">{facts}</dl>
    {children}
    <footer className="my-booking-footer">
      {footerNote && <p>{footerNote}</p>}
      <div className="trip-actions">{actions}</div>
    </footer>
  </article>;
}
