import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Button,
  Alert,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  CircularProgress
} from '@mui/material';
import Dashboard from './components/Dashboard';
import RepositoryManager from './components/RepositoryManager';
import CommitterAnalysis from './components/CommitterAnalysis';
import Logo from './components/Logo';
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
  // Persistent state management
  const getStoredState = (key, defaultValue) => {
    try {
      const stored = localStorage.getItem(`app_${key}`);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const setStoredState = (key, value) => {
    try {
      localStorage.setItem(`app_${key}`, JSON.stringify(value));
    } catch {
      // Ignore storage errors
    }
  };

  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(() => getStoredState('selectedRepo', null));
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
      
      // Restore selected repo from storage or default to first
      const storedRepo = getStoredState('selectedRepo', null);
      if (storedRepo) {
        // Find the stored repo in the current list
        const foundRepo = data.find(r => r.id === storedRepo.id);
        if (foundRepo) {
          setSelectedRepo(foundRepo);
        } else if (data.length > 0) {
          // Fallback to first repo if stored repo not found
          setSelectedRepo(data[0]);
          setStoredState('selectedRepo', data[0]);
        }
      } else if (data.length > 0 && !selectedRepo) {
        setSelectedRepo(data[0]);
        setStoredState('selectedRepo', data[0]);
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
            <Logo size={32} color="#ffffff" />
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                flexGrow: 1,
                fontSize: { xs: '1rem', sm: '1.25rem' },
                fontWeight: { xs: 600, sm: 400 }
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                CodeTide - Developer & Tester Analytics
              </Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                CodeTide
              </Box>
            </Typography>
            <Button 
              color="inherit" 
              component={Link}
              to="/"
              sx={{ 
                mr: { xs: 1, sm: 2 },
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                px: { xs: 1, sm: 2 }
              }}
              variant={location.pathname === '/' ? 'outlined' : 'text'}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Dashboard
              </Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                Dash
              </Box>
            </Button>
            <Button 
              color="inherit" 
              component={Link}
              to="/committers"
              sx={{ 
                mr: { xs: 1, sm: 2 },
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                px: { xs: 1, sm: 2 }
              }}
              variant={location.pathname === '/committers' ? 'outlined' : 'text'}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Committers
              </Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                Team
              </Box>
            </Button>
            <Button 
              color="inherit" 
              component={Link}
              to="/repositories"
              sx={{ 
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                px: { xs: 1, sm: 2 }
              }}
              variant={location.pathname === '/repositories' ? 'outlined' : 'text'}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Repositories
              </Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                Repos
              </Box>
            </Button>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 } }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Routes>
            <Route path="/" element={
              <>
                {repositories.length > 0 && (
                  <Card sx={{ mb: { xs: 2, sm: 3 } }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Grid container spacing={{ xs: 2, sm: 2 }} alignItems="center">
                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth>
                            <InputLabel>Select Repository</InputLabel>
                            <Select
                              value={selectedRepo?.id || ''}
                              onChange={(e) => {
                                const repo = repositories.find(r => r.id === e.target.value);
                                setSelectedRepo(repo);
                                setStoredState('selectedRepo', repo);
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
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ 
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              textAlign: { xs: 'center', sm: 'left' }
                            }}
                          >
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
                    <CardContent sx={{ 
                      textAlign: 'center', 
                      py: { xs: 4, sm: 8 },
                      px: { xs: 2, sm: 3 }
                    }}>
                      <Typography 
                        variant="h5" 
                        gutterBottom
                        sx={{ 
                          fontSize: { xs: '1.25rem', sm: '1.5rem' },
                          fontWeight: { xs: 600, sm: 400 }
                        }}
                      >
                        No Repositories Available
                      </Typography>
                      <Typography 
                        variant="body1" 
                        color="text.secondary" 
                        sx={{ 
                          mb: 3,
                          fontSize: { xs: '0.875rem', sm: '1rem' },
                          px: { xs: 1, sm: 0 }
                        }}
                      >
                        Add a repository to start tracking commits and analyzing developer metrics.
                      </Typography>
                      <Button 
                        variant="contained" 
                        component={Link}
                        to="/repositories"
                        sx={{
                          fontSize: { xs: '0.875rem', sm: '1rem' },
                          px: { xs: 3, sm: 4 },
                          py: { xs: 1, sm: 1.5 }
                        }}
                      >
                        Add Repository
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            } />
            <Route path="/committers" element={<CommitterAnalysis />} />
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
