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
import { io } from 'socket.io-client';

const AnalysisProgressDialog = ({ 
  open, 
  repositoryName, 
  repositoryId,
  onClose, 
  onComplete 
}) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('Initializing analysis...');
  const [commitsProcessed, setCommitsProcessed] = useState(0);
  const [error, setError] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (open && repositoryId) {
      // Initialize socket connection
      const newSocket = io('http://localhost:5000');
      setSocket(newSocket);

      // Reset state
      setProgress(0);
      setStage('Initializing analysis...');
      setCommitsProcessed(0);
      setError(null);
      setCompleted(false);

      // Set up socket listeners
      newSocket.on('analysis_started', (data) => {
        console.log('Analysis started:', data);
        setStage('Starting repository analysis...');
        setProgress(5);
      });

      newSocket.on('analysis_progress', (data) => {
        console.log('Analysis progress:', data);
        setStage(data.stage || 'Processing commits...');
        setProgress(data.progress || 0);
        if (data.commits_processed !== undefined) {
          setCommitsProcessed(data.commits_processed);
        }
      });

      newSocket.on('analysis_completed', (data) => {
        console.log('Analysis completed:', data);
        if (data.success) {
          setStage('Analysis completed successfully!');
          setProgress(100);
          setCommitsProcessed(data.commits_processed || 0);
          setCompleted(true);
          setTimeout(() => {
            onComplete(true, data.commits_processed || 0);
          }, 1500);
        } else {
          setError(data.error || 'Analysis failed');
          setCompleted(true);
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setError('Failed to connect to server for progress updates');
      });

      // Start the analysis
      startAnalysis();

      return () => {
        newSocket.disconnect();
      };
    }
  }, [open, repositoryId]);

  const startAnalysis = async () => {
    try {
      setStage('Starting analysis...');
      setProgress(10);

      const response = await fetch(`http://localhost:5000/api/repositories/${repositoryId}/analyze`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      // If no socket events are received, simulate progress
      setTimeout(() => {
        if (progress < 50) {
          setStage('Processing commits...');
          setProgress(50);
        }
      }, 2000);

      setTimeout(() => {
        if (progress < 80 && !completed) {
          setStage('Analyzing commit patterns...');
          setProgress(80);
        }
      }, 4000);

      // Handle response if socket events don't work
      const result = await response.json();
      if (!completed) {
        setStage('Analysis completed successfully!');
        setProgress(100);
        setCommitsProcessed(result.commits_processed || 0);
        setCompleted(true);
        setTimeout(() => {
          onComplete(true, result.commits_processed || 0);
        }, 1500);
      }

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message);
      setCompleted(true);
    }
  };

  const handleClose = () => {
    if (socket) {
      socket.disconnect();
    }
    onClose();
  };

  const handleComplete = () => {
    if (error) {
      onComplete(false, 0);
    } else {
      onComplete(true, commitsProcessed);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={completed ? handleClose : undefined}
      maxWidth="sm" 
      fullWidth
      disableEscapeKeyDown={!completed}
    >
      <DialogTitle>
        Analyzing Repository: {repositoryName}
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {stage}
          </Typography>
          
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ mb: 2, height: 8, borderRadius: 4 }}
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Progress: {Math.round(progress)}%
            </Typography>
            {commitsProcessed > 0 && (
              <Typography variant="body2" color="text.secondary">
                Commits processed: {commitsProcessed.toLocaleString()}
              </Typography>
            )}
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {completed && !error && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Analysis completed successfully! Processed {commitsProcessed.toLocaleString()} commits.
          </Alert>
        )}

        {!completed && !error && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
            <Typography variant="body2" color="info.contrastText">
              <strong>Note:</strong> This process may take several minutes for large repositories. 
              The analysis will now process all commits without any limit.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {completed ? (
          <Button onClick={handleComplete} variant="contained">
            {error ? 'Close' : 'Done'}
          </Button>
        ) : (
          <Button onClick={handleClose} disabled={!completed}>
            Cancel
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AnalysisProgressDialog;
