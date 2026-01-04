"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface StardustButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export const StardustButton = ({ 
  children = "Launching Soon", 
  onClick, 
  className = "",
  ...props 
}: StardustButtonProps) => {
  const buttonStyle = {
    '--white': '#e6f3ff',
    '--bg': '#0a1929',
    '--radius': '12px',
    outline: 'none',
    cursor: 'pointer',
    border: 0,
    position: 'relative' as const,
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--bg)',
    transition: 'all 0.2s ease',
    boxShadow: `
      inset 0 0.3rem 0.9rem rgba(255, 255, 255, 0.3),
      inset 0 -0.1rem 0.3rem rgba(0, 0, 0, 0.7),
      inset 0 -0.4rem 0.9rem rgba(255, 255, 255, 0.5),
      0 1rem 1rem rgba(0, 0, 0, 0.2),
      0 0.5rem 0.5rem -0.3rem rgba(0, 0, 0, 0.6)
    `,
  };

  const wrapStyle = {
    fontSize: '14px',
    fontWeight: 500,
    color: 'rgba(129, 216, 255, 0.9)',
    padding: '12px 16px',
    borderRadius: 'inherit',
    position: 'relative' as const,
    overflow: 'hidden',
  };

  const pStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    margin: 0,
    transition: 'all 0.2s ease',
    transform: 'translateY(2%)',
    maskImage: 'linear-gradient(to bottom, rgba(129, 216, 255, 1) 40%, transparent)',
  };

  const beforeAfterStyles = `
    .pearl-button .wrap::before,
    .pearl-button .wrap::after {
      content: "";
      position: absolute;
      transition: all 0.3s ease;
    }
    
    .pearl-button .wrap::before {
      left: -15%;
      right: -15%;
      bottom: 25%;
      top: -100%;
      border-radius: 50%;
      background-color: rgba(64, 180, 255, 0.15);
    }
    
    .pearl-button .wrap::after {
      left: 6%;
      right: 6%;
      top: 12%;
      bottom: 40%;
      border-radius: 22px 22px 0 0;
      box-shadow: inset 0 10px 8px -10px rgba(129, 216, 255, 0.6);
      background: linear-gradient(
        180deg,
        rgba(64, 180, 255, 0.25) 0%,
        rgba(0, 0, 0, 0) 50%,
        rgba(0, 0, 0, 0) 100%
      );
    }
    
    .pearl-button .wrap p .hover-icon {
      display: none;
    }
    
    .pearl-button:hover .wrap p .default-icon {
      display: none;
    }
    
    .pearl-button:hover .wrap p .hover-icon {
      display: inline-flex;
    }
    
    .pearl-button:hover {
      box-shadow:
        inset 0 0.3rem 0.5rem rgba(129, 216, 255, 0.4),
        inset 0 -0.1rem 0.3rem rgba(0, 0, 0, 0.7),
        inset 0 -0.4rem 0.9rem rgba(64, 180, 255, 0.6),
        0 1rem 1rem rgba(0, 0, 0, 0.2),
        0 0.5rem 0.5rem -0.3rem rgba(0, 0, 0, 0.6);
    }
    
    .pearl-button:hover .wrap::before {
      transform: translateY(-5%);
    }
    
    .pearl-button:hover .wrap::after {
      opacity: 0.4;
      transform: translateY(5%);
    }
    
    .pearl-button:hover .wrap p {
      transform: translateY(-4%);
    }
    
    .pearl-button:active {
      transform: translateY(2px);
      box-shadow:
        inset 0 0.3rem 0.5rem rgba(129, 216, 255, 0.5),
        inset 0 -0.1rem 0.3rem rgba(0, 0, 0, 0.8),
        inset 0 -0.4rem 0.9rem rgba(64, 180, 255, 0.4),
        0 1rem 1rem rgba(0, 0, 0, 0.2),
        0 0.5rem 0.5rem -0.3rem rgba(0, 0, 0, 0.6);
    }
  `;

  return (
    <>
      <style>{beforeAfterStyles}</style>
      <button
        className={cn("pearl-button w-full", className)}
        style={buttonStyle}
        onClick={onClick}
        {...props}
      >
        <div className="wrap" style={wrapStyle}>
          <p style={pStyle}>
            {children}
          </p>
        </div>
      </button>
    </>
  );
};
