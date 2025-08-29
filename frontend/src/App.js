import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Grid,
  Card,
  CardContent,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Box
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Dashboard from './components/Dashboard';
import RepositoryManager from './components/RepositoryManager';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/repositories');
      if (!response.ok) throw new Error('Failed to fetch repositories');
      const data = await response.json();
      setRepositories(data);
      if (data.length > 0 && !selectedRepo) {
        setSelectedRepo(data[0]);
      }
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleRepoAdded = () => {
    fetchRepositories();
  };

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="App">
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Commit Tracker - Developer & Tester Analytics
            </Typography>
            <Button 
              color="inherit" 
              component={Link}
              to="/"
              sx={{ mr: 2 }}
              variant={location.pathname === '/' ? 'outlined' : 'text'}
            >
              Dashboard
            </Button>
            <Button 
              color="inherit" 
              component={Link}
              to="/repositories"
              variant={location.pathname === '/repositories' ? 'outlined' : 'text'}
            >
              Repositories
            </Button>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Routes>
            <Route path="/" element={
              <>
                {repositories.length > 0 && (
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth>
                            <InputLabel>Select Repository</InputLabel>
                            <Select
                              value={selectedRepo?.id || ''}
                              onChange={(e) => {
                                const repo = repositories.find(r => r.id === e.target.value);
                                setSelectedRepo(repo);
                              }}
                              label="Select Repository"
                            >
                              {repositories.map((repo) => (
                                <MenuItem key={repo.id} value={repo.id}>
                                  {repo.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">
                            {selectedRepo?.last_analyzed 
                              ? `Last analyzed: ${new Date(selectedRepo.last_analyzed).toLocaleString()}`
                              : 'Not analyzed yet'
                            }
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                )}

                {selectedRepo ? (
                  <Dashboard repository={selectedRepo} />
                ) : (
                  <Card>
                    <CardContent sx={{ textAlign: 'center', py: 8 }}>
                      <Typography variant="h5" gutterBottom>
                        No Repositories Available
                      </Typography>
                      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        Add a repository to start tracking commits and analyzing developer metrics.
                      </Typography>
                      <Button 
                        variant="contained" 
                        component={Link}
                        to="/repositories"
                      >
                        Add Repository
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            } />
            <Route path="/repositories" element={
              <RepositoryManager 
                repositories={repositories}
                onRepoAdded={handleRepoAdded}
              />
            } />
          </Routes>
        </Container>
      </div>
    </ThemeProvider>
  );
}

export default App;
