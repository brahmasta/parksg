import { useState } from 'react';
import type { Carpark } from '../lib/types';
import { synthesizeCap, synthesizeRate, synthesizeWindow } from '../lib/rateDisplay';
import { IconChevronDown } from './icons';

type SectionKey = 'weekday' | 'saturday' | 'sundayPH';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'weekday', label: 'Weekday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sundayPH', label: 'Sunday & PH' },
];

export function RateTable({ rates }: { rates: Carpark['rates'] }) {
  const [open, setOpen] = useState<SectionKey | null>('weekday');
  return (
    <div
      style={{
        background: 'var(--bg-1)',
        border: '0.5px solid var(--line)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {SECTIONS.map((s, i) => {
        const isOpen = open === s.key;
        return (
          <div
            key={s.key}
            style={{ borderTop: i > 0 ? '0.5px solid var(--line)' : 'none' }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : s.key)}
              aria-expanded={isOpen}
              style={{
                appearance: 'none',
                border: 0,
                background: 'transparent',
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                color: 'var(--text-1)',
                minHeight: 44,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: -0.1,
                }}
              >
                {s.label}
              </span>
              <span
                style={{
                  color: 'var(--text-3)',
                  transform: `rotate(${isOpen ? 0 : -90}deg)`,
                  transition: 'transform 180ms ease',
                  display: 'inline-flex',
                }}
              >
                <IconChevronDown size={16} stroke={2} />
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 14px 12px' }}>
                {rates[s.key].map((r, j) => {
                  const win = synthesizeWindow(r);
                  const rate = synthesizeRate(r);
                  const cap = synthesizeCap(r);
                  return (
                    <div
                      key={j}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '7px 0',
                        borderTop: j > 0 ? '0.5px solid var(--line)' : 'none',
                        gap: 12,
                        alignItems: 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          color: 'var(--text-2)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {win}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12.5,
                          color: 'var(--text-1)',
                          fontWeight: 500,
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {rate}
                        {cap && (
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--text-3)',
                              fontWeight: 400,
                              marginTop: 1,
                            }}
                          >
                            {cap}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
