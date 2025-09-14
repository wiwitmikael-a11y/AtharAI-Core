import React from 'react';

const BrandIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        className={className}
        viewBox="0 0 100 100" 
        xmlns="http://www.w3.org/2000/svg"
    >
        <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#22d3ee', stopOpacity: 1 }} /> 
                <stop offset="50%" style={{ stopColor: '#818cf8', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#c084fc', stopOpacity: 1 }} />
            </linearGradient>
        </defs>
        <path 
            d="M50,5 L95,27.5 L95,72.5 L50,95 L5,72.5 L5,27.5 Z"
            fill="none"
            stroke="url(#grad1)"
            strokeWidth="6"
        />
        <text 
            x="50" 
            y="64" 
            fontFamily="monospace"
            fontSize="45" 
            fill="white"
            textAnchor="middle"
            fontWeight="bold"
        >
            A
        </text>
    </svg>
);

export default BrandIcon;