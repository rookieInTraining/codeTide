import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Typography,
  Box,
  Alert
} from '@mui/material';
import { CheckCircle, Error } from '@mui/icons-material';
import io from 'socket.io-client';

const CloneProgressDialog = ({ open, onClose, repositoryName, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('Initializing');
  const [message, setMessage] = useState('Preparing to clone repository...');
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (open && !socket) {
      console.log('Connecting to WebSocket...');
      // Connect to WebSocket with better configuration
      const newSocket = io('http://localhost:5000', {
        transports: ['polling', 'websocket'],
        upgrade: true,
        rememberUpgrade: false,
        timeout: 20000,
        forceNew: true
      });
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('WebSocket connected successfully');
        setProgress(10);
        setStage('Connected');
        setMessage('Connected to server, starting clone...');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
      });

      newSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
      });

      // Listen for clone events
      newSocket.on('clone_started', (data) => {
        console.log('Clone started:', data);
        setProgress(15);
        setStage('Starting');
        setMessage(`Cloning ${repositoryName}...`);
      });

      newSocket.on('clone_progress', (data) => {
        console.log('Clone progress:', data);
        setProgress(data.progress || 0);
        setStage(data.stage || 'Processing');
        setMessage(data.message || data.stage);
      });

      newSocket.on('clone_completed', (data) => {
        console.log('Clone completed:', data);
        if (data.success) {
          setProgress(100);
          setStage('Completed');
          setMessage('Repository cloned successfully!');
          setIsComplete(true);
          setTimeout(() => {
            onComplete(true);
            newSocket.disconnect();
          }, 1500);
        } else {
          setError(data.error || 'Clone operation failed');
          setIsComplete(true);
          setTimeout(() => {
            newSocket.disconnect();
          }, 1000);
        }
      });

      return () => {
        console.log('Cleaning up WebSocket connection...');
        if (newSocket.connected) {
          newSocket.disconnect();
        }
      };
    }
  }, [open, socket, repositoryName, onComplete]);

  const handleClose = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    setProgress(0);
    setStage('Initializing');
    setMessage('Preparing to clone repository...');
    setIsComplete(false);
    setError(null);
    onClose();
  };

  const getProgressColor = () => {
    if (error) return 'error';
    if (isComplete) return 'success';
    return 'primary';
  };

  const getIcon = () => {
    if (error) return <Error color="error" />;
    if (isComplete && !error) return <CheckCircle color="success" />;
    return null;
  };

  return (
    <Dialog open={open} onClose={isComplete ? handleClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          {getIcon()}
          <Typography variant="h6">
            {error ? 'Clone Failed' : isComplete ? 'Clone Complete' : 'Cloning Repository'}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" gutterBottom>
            <strong>{repositoryName}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {message}
          </Typography>
        </Box>

        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <>
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {stage} - {progress}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              color={getProgressColor()}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </>
        )}

        {isComplete && !error && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Repository has been successfully cloned and is ready for analysis!
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        {isComplete && (
          <Button onClick={handleClose} variant="contained">
            {error ? 'Close' : 'Continue'}
          </Button>
        )}
        {!isComplete && (
          <Button onClick={handleClose} disabled>
            Cloning...
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CloneProgressDialog;
