import React from 'react';
import { render, screen } from '@testing-library/react';
import Logo from './Logo';

describe('Logo Component', () => {
  test('renders logo with default props', () => {
    render(<Logo />);
    
    const logoSvg = screen.getByRole('img', { hidden: true });
    expect(logoSvg).toBeInTheDocument();
    expect(logoSvg).toHaveAttribute('width', '32');
    expect(logoSvg).toHaveAttribute('height', '32');
  });

  test('renders logo with custom size', () => {
    render(<Logo size={48} />);
    
    const logoSvg = screen.getByRole('img', { hidden: true });
    expect(logoSvg).toHaveAttribute('width', '48');
    expect(logoSvg).toHaveAttribute('height', '48');
  });

  test('renders logo with custom color', () => {
    render(<Logo color="#ff0000" />);
    
    const logoSvg = screen.getByRole('img', { hidden: true });
    const circle = logoSvg.querySelector('circle');
    expect(circle).toHaveAttribute('fill', '#ff0000');
  });

  test('contains all required SVG elements', () => {
    render(<Logo />);
    
    const logoSvg = screen.getByRole('img', { hidden: true });
    
    // Check for main elements
    expect(logoSvg.querySelector('circle')).toBeInTheDocument();
    expect(logoSvg.querySelectorAll('path')).toHaveLength(4); // 2 brackets + 2 waves
  });

  test('has correct viewBox', () => {
    render(<Logo />);
    
    const logoSvg = screen.getByRole('img', { hidden: true });
    expect(logoSvg).toHaveAttribute('viewBox', '0 0 40 40');
  });
});
