// Consistent form styling theme for CodeTide
export const formStyles = {
  // Standard form control styling
  formControl: {
    fullWidth: true,
    sx: {
      minHeight: '56px', // Consistent height for all form controls
      '& .MuiInputLabel-root': {
        fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' }
      },
      '& .MuiSelect-select': {
        fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' },
        py: { xs: 1.5, sm: 1.75, md: 2 }
      },
      '& .MuiOutlinedInput-root': {
        fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' }
      }
    }
  },

  // Standard button styling
  button: {
    primary: {
      variant: 'contained',
      fullWidth: true,
      sx: {
        fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' },
        py: { xs: 1.5, sm: 1.75, md: 2 },
        minHeight: '48px',
        fontWeight: 500
      }
    },
    secondary: {
      variant: 'outlined',
      fullWidth: true,
      sx: {
        fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' },
        py: { xs: 1.5, sm: 1.75, md: 2 },
        minHeight: '48px',
        fontWeight: 500
      }
    },
    small: {
      size: 'small',
      variant: 'outlined',
      sx: {
        fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' },
        py: { xs: 1, sm: 1.25, md: 1.5 },
        px: { xs: 2, sm: 2.5, md: 3 },
        minHeight: '36px',
        fontWeight: 500
      }
    }
  },

  // Standard text field styling
  textField: {
    fullWidth: true,
    sx: {
      '& .MuiInputBase-root': {
        fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' },
        minHeight: '56px'
      },
      '& .MuiInputLabel-root': {
        fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' }
      }
    }
  },

  // Grid spacing for form layouts
  gridSpacing: {
    container: { xs: 2, sm: 2.5, md: 3 },
    item: { xs: 2, sm: 2, md: 2 }
  },

  // Card padding for form containers
  cardPadding: {
    p: { xs: 2, sm: 2.5, md: 3 }
  }
};
