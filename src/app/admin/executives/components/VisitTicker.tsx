'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './VisitTicker.css';

export type VisitTickerItem = {
  executiveId: string;
  username: string;
  visitCount: number;
};

export type VisitTickerProps = {
  visits: VisitTickerItem[];
  title?: string;
  autoScroll?: boolean;         // default: false
  autoScrollSpeed?: number;     // px/sec, default: 80
  className?: string;
};

function formatDate(d: string | Date) {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const VisitTicker: React.FC<VisitTickerProps> = ({
  visits,
  title = 'Executive Visits',
  autoScroll = false,
  autoScrollSpeed = 80,
  className = '',
}) => {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

  // Optional auto-scroll
  useEffect(() => {
    if (!autoScroll || !isMounted) return;
    let raf: number;
    let last = performance.now();

    const step = (now: number) => {
      const dt = (now - last) / 1000; // seconds
      last = now;
      const el = scrollRef.current;
      if (el && !isDragging.current) {
        el.scrollLeft += autoScrollSpeed * dt;
        // Looping effect
        if (el.scrollLeft + el.clientWidth >= el.scrollWidth) {
          el.scrollLeft = 0;
        }
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [autoScroll, autoScrollSpeed, isMounted]);

  const limited = useMemo(() => visits.slice(0, 20), [visits]);

  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const el = scrollRef.current;
    if (!el) return;
    isDragging.current = true;
    startX.current = e.pageX - el.offsetLeft;
    scrollLeft.current = el.scrollLeft;
  };

  const onMouseLeaveOrUp = () => {
    isDragging.current = false;
  };

  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const el = scrollRef.current;
    if (!el || !isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX.current) * 1; // multiplier for speed
    el.scrollLeft = scrollLeft.current - walk;
  };

  const onCardClick = (execId: string) => {
    router.push(`/admin/visit-report?executiveId=${execId}`);
  };

  return (
    <div className={`visit-ticker ${className}`}>
      <div className="visit-ticker-header">
        <h3 className="visit-ticker-title">{title}</h3>
        <div className="visit-ticker-subtitle">Last 20 submissions</div>
      </div>

      <div
        className="visit-ticker-track"
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseLeaveOrUp}
        onMouseLeave={onMouseLeaveOrUp}
        onMouseMove={onMouseMove}
      >
        {limited.length === 0 ? (
          <div className="visit-ticker-empty">No recent visit reports.</div>
        ) : (
          limited.map((v) => (
            <div
              key={v.executiveId}
              className="visit-ticker-card"
              onClick={() => onCardClick(v.executiveId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' ? onCardClick(v.executiveId) : null)}
            >
              <div className="visit-ticker-user">{v.username}</div>
              <div className="visit-ticker-count">{v.visitCount} {v.visitCount === 1 ? 'visit' : 'visits'}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VisitTicker;
