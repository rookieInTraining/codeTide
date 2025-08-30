import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon, Delete as DeleteIcon, GetApp as PullIcon } from '@mui/icons-material';
import CloneProgressDialog from './CloneProgressDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import PullProgressDialog from './PullProgressDialog';
import AnalysisProgressDialog from './AnalysisProgressDialog';

const RepositoryManager = ({ repositories, onRepoAdded }) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    path: '', 
    url: '', 
    clone_to_path: '' 
  });
  const [repoSource, setRepoSource] = useState('local'); // 'local' or 'remote'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [cloneProgressOpen, setCloneProgressOpen] = useState(false);
  const [cloneRepositoryName, setCloneRepositoryName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [repositoryToDelete, setRepositoryToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pullProgressOpen, setPullProgressOpen] = useState(false);
  const [pullRepositoryName, setPullRepositoryName] = useState('');
  const [cloneProgress, setCloneProgress] = useState({ open: false, repositoryName: '' });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, repository: null });
  const [analysisProgress, setAnalysisProgress] = useState({ open: false, repositoryName: '', repositoryId: null });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation based on source type
    if (!formData.name) {
      setError('Repository name is required');
      return;
    }
    
    if (repoSource === 'local' && !formData.path) {
      setError('Local repository path is required');
      return;
    }
    
    if (repoSource === 'remote' && !formData.url) {
      setError('Git repository URL is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare request data based on source type
      const requestData = {
        name: formData.name,
        ...(repoSource === 'local' ? { path: formData.path } : {}),
        ...(repoSource === 'remote' ? { 
          url: formData.url,
          ...(formData.clone_to_path ? { clone_to_path: formData.clone_to_path } : {})
        } : {})
      };

      const response = await fetch('http://localhost:5000/api/repositories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add repository');
      }

      const result = await response.json();
      
      if (result.cloning) {
        // Show progress dialog for clone operations
        setCloneProgress({ open: true, repositoryName: formData.name });
        setFormData({ name: '', path: '', url: '', clone_to_path: '' });
        setRepoSource('local');
        setOpen(false);
      } else {
        // Local repository added successfully
        setSuccess(`Repository "${result.name}" added successfully!`);
        setFormData({ name: '', path: '', url: '', clone_to_path: '' });
        setRepoSource('local');
        setOpen(false);
        onRepoAdded();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (repo) => {
    setAnalysisProgress({ 
      open: true, 
      repositoryName: repo.name, 
      repositoryId: repo.id 
    });
  };

  const handleCloneComplete = (success) => {
    setCloneProgress({ open: false, repositoryName: '' });
    if (success) {
      setSuccess('Repository cloned and added successfully!');
      onRepoAdded();
    }
  };

  const handleDeleteClick = (repository) => {
    setDeleteDialog({ open: true, repository });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.repository) return;
    
    setDeleteLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/repositories/${deleteDialog.repository.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete repository');
      }
      
      const result = await response.json();
      setSuccess(result.message);
      setDeleteDialog({ open: false, repository: null });
      onRepoAdded(); // Refresh the repository list
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, repository: null });
  };

  const handlePullClick = (repository) => {
    setPullRepositoryName(repository.name);
    setPullProgressOpen(true);
    
    // Start the pull operation
    fetch(`http://localhost:5000/api/repositories/${repository.id}/pull`, {
      method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
      if (!data.error) {
        console.log('Pull operation initiated:', data);
      } else {
        setError(data.error);
        setPullProgressOpen(false);
      }
    })
    .catch(err => {
      setError(`Failed to start pull operation: ${err.message}`);
      setPullProgressOpen(false);
    });
  };

  const handlePullComplete = (success, commitsPulled) => {
    setPullProgressOpen(false);
    setPullRepositoryName('');
    
    if (success) {
      if (commitsPulled > 0) {
        setSuccess(`Successfully pulled ${commitsPulled} new commits! You may want to re-analyze the repository to update metrics.`);
      } else {
        setSuccess('Repository is already up to date.');
      }
      onRepoAdded(); // Refresh the repository list
    }
  };

  const handleAnalysisComplete = (success, commitsProcessed) => {
    setAnalysisProgress({ open: false, repositoryName: '', repositoryId: null });
    
    if (success) {
      setSuccess(`Analysis complete! Processed ${commitsProcessed.toLocaleString()} commits.`);
      onRepoAdded(); // Refresh the repository list
    }
  };

  return (
    <div>
      <Grid container spacing={3} alignItems="center" sx={{ mb: 3 }}>
        <Grid item xs>
          <Typography variant="h4">Repository Management</Typography>
        </Grid>
        <Grid item>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
          >
            Add Repository
          </Button>
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Tracked Repositories
          </Typography>
          
          {repositories.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No repositories added yet. Click "Add Repository" to get started.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Repository Name</TableCell>
                    <TableCell>Repository Path</TableCell>
                    <TableCell>Repository URL</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Last Analyzed</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {repositories.map((repo) => (
                    <TableRow key={repo.id}>
                      <TableCell>
                        <Typography variant="subtitle2">{repo.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {repo.path}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {repo.url ? (
                          <Typography variant="body2">{repo.url}</Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Not specified
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label="Active" 
                          color="success" 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>
                        {repo.last_analyzed ? (
                          <Typography variant="body2">
                            {new Date(repo.last_analyzed).toLocaleString()}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Never
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={() => handleAnalyze(repo)}
                            disabled={loading}
                          >
                            Analyze
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            startIcon={<PullIcon />}
                            onClick={() => handlePullClick(repo)}
                            disabled={loading}
                          >
                            Pull
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => handleDeleteClick(repo)}
                            disabled={loading}
                          >
                            Delete
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Add Repository Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>Add New Repository</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Repository Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  helperText="A friendly name for this repository"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Repository Source</FormLabel>
                  <RadioGroup
                    row
                    value={repoSource}
                    onChange={(e) => setRepoSource(e.target.value)}
                  >
                    <FormControlLabel 
                      value="local" 
                      control={<Radio />} 
                      label="Local Repository" 
                    />
                    <FormControlLabel 
                      value="remote" 
                      control={<Radio />} 
                      label="Clone from URL" 
                    />
                  </RadioGroup>
                </FormControl>
              </Grid>

              {repoSource === 'local' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Local Path"
                    value={formData.path}
                    onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                    required
                    helperText="Full path to the existing git repository on your local machine"
                    placeholder="C:\path\to\your\repo"
                  />
                </Grid>
              )}

              {repoSource === 'remote' && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Git Repository URL"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      required
                      helperText="Git repository URL to clone from"
                      placeholder="https://github.com/user/repo.git"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Clone to Path (Optional)"
                      value={formData.clone_to_path}
                      onChange={(e) => setFormData({ ...formData, clone_to_path: e.target.value })}
                      helperText="Local path where repository should be cloned. Leave empty for auto-generated path."
                      placeholder="C:\path\to\clone\destination"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                      <Typography variant="body2" color="info.contrastText">
                        <strong>Note:</strong> The repository will be cloned to your local machine and then tracked for analysis.
                        {!formData.clone_to_path && " If no path is specified, it will be cloned to a 'repositories' folder in the current directory."}
                      </Typography>
                    </Box>
                  </Grid>
                </>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} />
              ) : (
                repoSource === 'remote' ? 'Clone & Add Repository' : 'Add Repository'
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Clone Progress Dialog */}
      <CloneProgressDialog
        open={cloneProgress.open}
        repositoryName={cloneProgress.repositoryName}
        onClose={() => setCloneProgress({ open: false, repositoryName: '' })}
        onComplete={handleCloneComplete}
      />

      {/* Pull Progress Dialog */}
      <PullProgressDialog
        open={pullProgressOpen}
        repositoryName={pullRepositoryName}
        onClose={() => setPullProgressOpen(false)}
        onComplete={handlePullComplete}
      />

      {/* Analysis Progress Dialog */}
      <AnalysisProgressDialog
        open={analysisProgress.open}
        repositoryName={analysisProgress.repositoryName}
        repositoryId={analysisProgress.repositoryId}
        onClose={() => setAnalysisProgress({ open: false, repositoryName: '', repositoryId: null })}
        onComplete={handleAnalysisComplete}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        repositoryName={deleteDialog.repository?.name || ''}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
      />
    </div>
  );
};

export default RepositoryManager;
