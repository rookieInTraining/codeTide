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
import { CheckCircle, Error, Sync } from '@mui/icons-material';
import io from 'socket.io-client';

const PullProgressDialog = ({ open, onClose, onComplete, repositoryName }) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('Initializing');
  const [message, setMessage] = useState('Preparing to pull latest changes...');
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const [commitsPulled, setCommitsPulled] = useState(0);

  useEffect(() => {
    if (open && !socket) {
      console.log('Connecting to WebSocket for pull operation...');
      // Connect to WebSocket with better configuration
      const newSocket = io('http://localhost:5000', {
        transports: ['polling', 'websocket'],
        upgrade: true,
        rememberUpgrade: false,
        timeout: 20000,
        forceNew: true
      });
      setSocket(newSocket);

      // Set a timeout to handle cases where WebSocket events aren't received
      const timeoutId = setTimeout(() => {
        if (!isComplete && !error) {
          setError('Pull operation timed out. Please check your network connection and try again.');
          setIsComplete(true);
          setTimeout(() => {
            newSocket.disconnect();
          }, 1000);
        }
      }, 30000); // 30 second timeout

      newSocket.on('connect', () => {
        console.log('WebSocket connected for pull operation');
        setProgress(10);
        setStage('Connected');
        setMessage('Connected to server, starting pull...');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        clearTimeout(timeoutId);
      });

      newSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setError('Failed to connect to server. Please check your connection and try again.');
        setIsComplete(true);
        clearTimeout(timeoutId);
      });

      // Listen for pull events
      newSocket.on('pull_started', (data) => {
        console.log('Pull started:', data);
        setProgress(15);
        setStage('Starting');
        setMessage(`Pulling latest changes for ${repositoryName}...`);
      });

      newSocket.on('pull_progress', (data) => {
        console.log('Pull progress:', data);
        setProgress(data.progress || 0);
        setStage(data.stage || 'Processing');
        setMessage(data.message || data.stage);
      });

      newSocket.on('pull_completed', (data) => {
        console.log('Pull completed:', data);
        clearTimeout(timeoutId);
        if (data.success) {
          setProgress(100);
          setStage('Completed');
          setCommitsPulled(data.commits_pulled || 0);
          setMessage(data.message || 'Pull completed successfully!');
          setIsComplete(true);
          setTimeout(() => {
            onComplete(true, data.commits_pulled);
            newSocket.disconnect();
          }, 1500);
        } else {
          setError(data.error || 'Pull operation failed');
          setIsComplete(true);
          setTimeout(() => {
            newSocket.disconnect();
          }, 1000);
        }
      });

      // Handle pull errors specifically
      newSocket.on('pull_error', (data) => {
        console.log('Pull error received:', data);
        clearTimeout(timeoutId);
        setError(data.error || 'Pull operation failed due to an unknown error');
        setIsComplete(true);
        setTimeout(() => {
          newSocket.disconnect();
        }, 1000);
      });

      return () => {
        console.log('Cleaning up WebSocket connection...');
        clearTimeout(timeoutId);
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
    setMessage('Preparing to pull latest changes...');
    setIsComplete(false);
    setError(null);
    setCommitsPulled(0);
    onClose();
  };

  const getProgressColor = () => {
    if (error) return 'error';
    if (isComplete) return 'success';
    return 'primary';
  };

  const getIcon = () => {
    if (error) return <Error color="error" />;
    if (isComplete) return <CheckCircle color="success" />;
    return <Sync className="rotating-icon" color="primary" />;
  };

  return (
    <Dialog open={open} onClose={isComplete ? handleClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          {getIcon()}
          <Typography variant="h6">
            Pulling Repository: {repositoryName}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Stage: {stage}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            color={getProgressColor()}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="body2" sx={{ mt: 1 }}>
            {Math.round(progress)}% - {message}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {isComplete && !error && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {commitsPulled > 0 
              ? `Successfully pulled ${commitsPulled} new commits!`
              : 'Repository is already up to date.'
            }
          </Alert>
        )}
      </DialogContent>

      {isComplete && (
        <DialogActions>
          <Button onClick={handleClose} variant="contained">
            Close
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default PullProgressDialog;
