import React, { HTMLAttributes } from 'react';
import './Card.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'elevated' | 'outlined';
    padding?: 'sm' | 'md' | 'lg';
    hoverable?: boolean;
}

const Card: React.FC<CardProps> = ({
    children,
    variant = 'default',
    padding = 'md',
    hoverable = false,
    className = '',
    ...props
}) => {
    const classes = [
        'card',
        `card-${variant}`,
        `card-padding-${padding}`,
        hoverable ? 'card-hoverable' : '',
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={classes} {...props}>
            {children}
        </div>
    );
};

export default Card;
