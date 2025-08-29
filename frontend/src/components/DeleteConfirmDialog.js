import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  Box
} from '@mui/material';
import { Warning } from '@mui/icons-material';

const DeleteConfirmDialog = ({ open, onClose, onConfirm, repositoryName, loading }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Warning color="warning" />
          <Typography variant="h6">
            Delete Repository
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>This action cannot be undone!</strong>
          </Typography>
        </Alert>
        
        <Typography variant="body1" gutterBottom>
          Are you sure you want to delete the repository <strong>"{repositoryName}"</strong>?
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          This will permanently delete:
        </Typography>
        <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
          <Typography component="li" variant="body2" color="text.secondary">
            The repository record from the database
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            All commit history and analysis data
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            All associated metrics and snapshots
          </Typography>
        </Box>
        
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Note:</strong> The actual repository files on your local machine will not be deleted.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained" 
          color="error"
          disabled={loading}
        >
          {loading ? 'Deleting...' : 'Delete Repository'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmDialog;
