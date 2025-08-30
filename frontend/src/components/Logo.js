import React from 'react';
import { Box } from '@mui/material';

const Logo = ({ size = 32, color = '#1976d2' }) => {
  return (
    <Box
      component="svg"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      sx={{ mr: 1 }}
    >
      {/* Background circle */}
      <circle cx="20" cy="20" r="18" fill={color} stroke="#ffffff" strokeWidth="2"/>
      
      {/* Code brackets */}
      <path d="M12 14L8 20L12 26" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M28 14L32 20L28 26" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      
      {/* Wave/tide element */}
      <path d="M10 20C12 18 14 22 16 20C18 18 20 22 22 20C24 18 26 22 28 20C30 18 32 22 30 20" 
            stroke="#64b5f6" strokeWidth="2" strokeLinecap="round" fill="none"/>
      
      {/* Smaller wave */}
      <path d="M12 24C14 22 16 26 18 24C20 22 22 26 24 24C26 22 28 26 26 24" 
            stroke="#90caf9" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </Box>
  );
};

export default Logo;
