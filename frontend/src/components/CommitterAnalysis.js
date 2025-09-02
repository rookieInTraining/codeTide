import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Tab,
  Tabs,
  Divider,
  Avatar,
  Button,
  Collapse,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Popper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Checkbox,
  Box,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  ClickAwayListener,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody
} from '@mui/material';
import { formStyles } from '../theme/formStyles';
import {
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Code as CodeIcon,
  Timeline as TimelineIcon,
  Compare as CompareIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Search as SearchIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
} from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';

// Custom TabPanel component to avoid @mui/lab dependency
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

// Helper functions for data formatting
const formatCommitTypeData = (commitTypes) => {
  if (!commitTypes || typeof commitTypes !== 'object') return { labels: [], datasets: [] };
  
  const entries = Object.entries(commitTypes);
  if (entries.length === 0) return { labels: [], datasets: [] };
  
  const labels = entries.map(([type]) => type || 'Unknown');
  const counts = entries.map(([, count]) => count || 0);
  
  return {
    labels,
    datasets: [{
      data: counts,
      backgroundColor: [
        '#FF6384',
        '#36A2EB', 
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40'
      ]
    }]
  };
};

const formatActivityData = (data, granularity = 'daily') => {
  if (!data || !Array.isArray(data)) return { labels: [], datasets: [] };
  
  const labels = data.map(item => {
    const date = new Date(item.date);
    if (granularity === 'monthly') {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  
  const commits = data.map(item => item.commits || 0);
  
  return {
    labels,
    datasets: [{
      label: 'Commits',
      data: commits,
      borderColor: '#36A2EB',
      backgroundColor: 'rgba(54, 162, 235, 0.1)',
      tension: 0.1
    }]
  };
};

const getActivityGranularity = (timeRange) => {
  switch (timeRange) {
    case '7d':
    case '30d':
      return 'daily';
    case '3m':
    case 'ytd':
    case 'all':
      return 'monthly';
    default:
      return 'daily';
  }
};

const getActivityAxisLabel = (granularity) => {
  return granularity === 'monthly' ? 'Month' : 'Date';
};

const CONTRIBUTORS_PER_PAGE = 20;

function MetricCard({ title, value, subtitle, isExpanded, onToggle, children }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6" component="h3" sx={{ fontSize: '1rem', fontWeight: 600 }}>
            {title}
          </Typography>
          {children && (
            <IconButton 
              size="small" 
              onClick={onToggle}
              sx={{ 
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          )}
        </Box>
        <Typography 
          variant="h4" 
          component="div" 
          color="primary"
          sx={{ fontWeight: 'bold', mb: 0.5 }}
        >
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function CommitterAnalysis() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [repositories, setRepositories] = useState([]);
  // Persistent state management
  const getStoredState = (key, defaultValue) => {
    try {
      const stored = localStorage.getItem(`committerAnalysis_${key}`);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const setStoredState = (key, value) => {
    try {
      localStorage.setItem(`committerAnalysis_${key}`, JSON.stringify(value));
    } catch {
      // Ignore storage errors
    }
  };

  const [selectedRepository, setSelectedRepository] = useState(() => getStoredState('selectedRepository', null));
  const [contributors, setContributors] = useState([]);
  const [selectedContributors, setSelectedContributors] = useState(() => getStoredState('selectedContributors', []));
  const [timeRange, setTimeRange] = useState(() => getStoredState('timeRange', 0));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(() => getStoredState('tabValue', 0));
  const [contributorMetrics, setContributorMetrics] = useState(() => getStoredState('contributorMetrics', {}));
  const [contributorTimelines, setContributorTimelines] = useState(() => getStoredState('contributorTimelines', {}));
  const [comparisonData, setComparisonData] = useState(() => getStoredState('comparisonData', []));
  const [expandedCards, setExpandedCards] = useState({});
  const [contributorSearch, setContributorSearch] = useState('');
  const [displayedContributorsCount, setDisplayedContributorsCount] = useState(CONTRIBUTORS_PER_PAGE);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    fetchRepositories();
  }, []);

  useEffect(() => {
    if (selectedRepository) {
      fetchContributors();
    }
  }, [selectedRepository]);

  // Remove automatic data fetching - now only triggered by form submission

  const fetchRepositories = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/repositories');
      if (!response.ok) throw new Error('Failed to fetch repositories');
      const data = await response.json();
      setRepositories(data);
    } catch (err) {
      setError('Failed to load repositories. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchContributors = async () => {
    if (!selectedRepository) return;
    
    try {
      const response = await fetch(`http://localhost:5000/api/contributors?repository_id=${selectedRepository.id}`);
      if (!response.ok) throw new Error('Failed to fetch contributors');
      const data = await response.json();
      setContributors(data);
    } catch (err) {
      setError('Failed to load contributors for this repository.');
    }
  };

  const fetchContributorMetrics = useCallback(async () => {
    if (!selectedRepository || selectedContributors.length === 0) return;

    setIsAnalyzing(true);
    try {
      const metricsPromises = selectedContributors.map(async (contributorId) => {
        try {
          const response = await fetch(`http://localhost:5000/api/contributors/${contributorId}/metrics?repository_id=${selectedRepository.id}&days=${timeRange}`);
          if (!response.ok) {
            console.warn(`Failed to fetch metrics for contributor ${contributorId}`);
            return null;
          }
          const data = await response.json();
          return { contributorId, data };
        } catch (error) {
          console.warn(`Error fetching metrics for contributor ${contributorId}:`, error);
          return null;
        }
      });

      const timelinePromises = selectedContributors.map(async (contributorId) => {
        try {
          const response = await fetch(`http://localhost:5000/api/contributors/${contributorId}/activity-timeline?repository_id=${selectedRepository.id}&days=${timeRange}`);
          if (!response.ok) {
            console.warn(`Failed to fetch timeline for contributor ${contributorId}`);
            return null;
          }
          const data = await response.json();
          return { contributorId, data };
        } catch (error) {
          console.warn(`Error fetching timeline for contributor ${contributorId}:`, error);
          return null;
        }
      });

      const [metricsResults, timelineResults] = await Promise.all([Promise.all(metricsPromises), Promise.all(timelinePromises)]);
      
      const metrics = {};
      const timelines = {};
      
      metricsResults.forEach(result => {
        if (result) {
          metrics[result.contributorId] = result.data;
        }
      });

      timelineResults.forEach(result => {
        if (result) {
          timelines[result.contributorId] = result.data;
        }
      });
      
      console.log('Final contributor metrics:', metrics);
      console.log('Final contributor timelines:', timelines);
      setContributorMetrics(metrics);
      setContributorTimelines(timelines);
      setStoredState('contributorMetrics', metrics);
      setStoredState('contributorTimelines', timelines);
    } catch (err) {
      console.error('Failed to fetch contributor data:', err);
      setError('Failed to load contributor data. This may be due to large commit volumes.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedRepository, selectedContributors, timeRange]);

  const fetchComparisonData = useCallback(async () => {
    if (!selectedRepository) return;
    
    try {
      const response = await fetch('http://localhost:5000/api/contributors/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contributor_ids: selectedContributors,
          repository_id: selectedRepository.id,
          days: timeRange
        })
      });
      if (response.ok) {
        const data = await response.json();
        setComparisonData(data);
      }
    } catch (err) {
      console.error('Failed to fetch comparison data:', err);
    }
  }, [selectedRepository, selectedContributors, timeRange]);

  const handleFormSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!selectedRepository || selectedContributors.length === 0) {
      setError('Please select a repository and at least one contributor.');
      return;
    }
    
    setError(null);
    setFormSubmitted(true);
    
    // Run metrics and comparison fetching in parallel
    const promises = [fetchContributorMetrics()];
    if (selectedContributors.length > 1) {
      promises.push(fetchComparisonData());
    }
    
    await Promise.all(promises);
  }, [selectedRepository, selectedContributors, fetchContributorMetrics, fetchComparisonData]);

  const handleContributorChange = useCallback((event) => {
    const value = event.target.value;
    const contributors = typeof value === 'string' ? value.split(',') : value;
    setSelectedContributors(contributors);
    setStoredState('selectedContributors', contributors);
  }, []);

  const handleContributorRemove = useCallback((contributorIdToRemove) => {
    setSelectedContributors(prev => {
      const updated = prev.filter(id => id !== contributorIdToRemove);
      setStoredState('selectedContributors', updated);
      return updated;
    });
  }, []);

  // Memoized filtered and sorted contributors to avoid recalculation on every render
  const filteredAndSortedContributors = useMemo(() => {
    const filtered = contributors.filter(contributor =>
      contributor.name.toLowerCase().includes(contributorSearch.toLowerCase())
    );
    
    // Sort alphabetically
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [contributors, contributorSearch]);

  // Memoized displayed contributors for virtual scrolling
  const displayedContributors = useMemo(() => {
    return filteredAndSortedContributors.slice(0, displayedContributorsCount);
  }, [filteredAndSortedContributors, displayedContributorsCount]);

  const hasMoreContributors = displayedContributorsCount < filteredAndSortedContributors.length;

  const handleContributorListScroll = (event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.target;
    
    // Load more when scrolled to bottom (with 50px threshold)
    if (scrollHeight - scrollTop <= clientHeight + 50 && hasMoreContributors) {
      setDisplayedContributorsCount(prev => prev + CONTRIBUTORS_PER_PAGE);
    }
  };

  const handleContributorToggle = (contributorId) => {
    setSelectedContributors(prev => {
      const updated = prev.includes(contributorId)
        ? prev.filter(id => id !== contributorId)
        : [...prev, contributorId];
      setStoredState('selectedContributors', updated);
      return updated;
    });
  };

  const toggleCardExpansion = (cardId) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  const handleRepositoryChange = (event) => {
    const repoId = event.target.value;
    const repo = repositories.find(r => r.id === repoId);
    setSelectedRepository(repo);
    setStoredState('selectedRepository', repo);
    setSelectedContributors([]);
    setStoredState('selectedContributors', []);
    setContributorMetrics({});
    setStoredState('contributorMetrics', {});
    setContributorTimelines({});
    setStoredState('contributorTimelines', {});
    setComparisonData([]);
    setStoredState('comparisonData', []);
    setFormSubmitted(false);
    setStoredState('formSubmitted', false);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Form Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Committer Analysis Configuration
          </Typography>
          
          <form onSubmit={handleFormSubmit}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <FormControl {...formStyles.formControl}>
                <InputLabel>Select Repository</InputLabel>
                <Select
                  value={selectedRepository?.id || ''}
                  onChange={handleRepositoryChange}
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
            
            <Grid item xs={12} sm={6} md={4} lg={4}>
              <FormControl {...formStyles.formControl} disabled={!selectedRepository}>
                <ClickAwayListener onClickAway={() => {
                  setDropdownOpen(false);
                  setAnchorEl(null);
                }}>
                  <Box>
                    <TextField
                      fullWidth
                      label="Select Contributors"
                      value={selectedContributors.length > 0 ? `${selectedContributors.length} selected` : ''}
                      onClick={(e) => {
                        if (!selectedRepository) return;
                        setAnchorEl(e.currentTarget);
                        setDropdownOpen(!dropdownOpen);
                      }}
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={(e) => {
                                if (!selectedRepository) return;
                                setAnchorEl(e.currentTarget);
                                setDropdownOpen(!dropdownOpen);
                              }}
                              disabled={!selectedRepository}
                            >
                              <KeyboardArrowDownIcon />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                      sx={{
                        cursor: selectedRepository ? 'pointer' : 'default',
                        '& .MuiInputBase-input': {
                          cursor: selectedRepository ? 'pointer' : 'default'
                        }
                      }}
                    />

                    <Popper 
                      open={dropdownOpen && Boolean(anchorEl)} 
                      anchorEl={anchorEl}
                      placement="bottom-start"
                      style={{ zIndex: 1300, width: anchorEl?.offsetWidth || 'auto' }}
                    >
                      <Paper 
                        elevation={8}
                        sx={{ 
                          maxHeight: 300, 
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
                        <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                          <TextField
                            size="small"
                            placeholder="Search contributors..."
                            value={contributorSearch}
                            onChange={(e) => {
                              setContributorSearch(e.target.value);
                              setDisplayedContributorsCount(CONTRIBUTORS_PER_PAGE); // Reset pagination
                            }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchIcon fontSize="small" />
                                </InputAdornment>
                              )
                            }}
                            sx={{ width: '100%' }}
                          />
                        </Box>
                        
                        <List 
                          dense 
                          sx={{ 
                            maxHeight: 200, 
                            overflow: 'auto',
                            py: 0
                          }}
                          onScroll={handleContributorListScroll}
                        >
                          {displayedContributors.map((contributor) => (
                            <ListItem key={contributor.id} disablePadding>
                              <ListItemButton
                                onClick={() => handleContributorToggle(contributor.id)}
                                dense
                              >
                                <Checkbox
                                  edge="start"
                                  checked={selectedContributors.includes(contributor.id)}
                                  tabIndex={-1}
                                  disableRipple
                                  size="small"
                                />
                                <ListItemText 
                                  primary={contributor.name}
                                  secondary={contributor.email}
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                                />
                              </ListItemButton>
                            </ListItem>
                          ))}
                          
                          {hasMoreContributors && (
                            <ListItem>
                              <ListItemText 
                                primary={`Showing ${displayedContributors.length} of ${filteredAndSortedContributors.length} contributors`}
                                primaryTypographyProps={{ 
                                  fontSize: '0.75rem', 
                                  color: 'text.secondary',
                                  textAlign: 'center'
                                }}
                              />
                            </ListItem>
                          )}
                        </List>
                      </Paper>
                    </Popper>
                  </Box>
                </ClickAwayListener>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3} lg={3}>
              <FormControl {...formStyles.formControl} disabled={!selectedRepository}>
                <InputLabel>Time Range</InputLabel>
                <Select
                  value={timeRange}
                  onChange={(e) => {
                    setTimeRange(e.target.value);
                    setStoredState('timeRange', e.target.value);
                  }}
                  label="Time Range"
                >
                  <MenuItem value={7}>Last 7 days</MenuItem>
                  <MenuItem value={30}>Last 30 days</MenuItem>
                  <MenuItem value={90}>Last 3 months</MenuItem>
                  <MenuItem value={365}>Year to date</MenuItem>
                  <MenuItem value={0}>All time</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={1} lg={2}>
              <Button
                type="submit"
                {...formStyles.button.primary}
                disabled={!selectedRepository || selectedContributors.length === 0 || isAnalyzing}
              >
                {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
              </Button>
            </Grid>
          </Grid>
          </form>

          {/* Selected Contributors Display */}
          {selectedContributors.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Selected Contributors ({selectedContributors.length}):
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedContributors.map((contributorId) => {
                  const contributor = contributors.find(c => c.id === contributorId);
                  return contributor ? (
                    <Chip
                      key={contributorId}
                      label={contributor.name}
                      onDelete={() => handleContributorRemove(contributorId)}
                      size="small"
                      variant="outlined"
                    />
                  ) : null;
                })}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {!selectedRepository ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Select a Repository
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose a repository to view committer analysis and performance metrics.
            </Typography>
          </CardContent>
        </Card>
      ) : selectedContributors.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Select Contributors to Analyze
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose one or more contributors from {selectedRepository.name} to view their detailed metrics and performance analysis.
            </Typography>
          </CardContent>
        </Card>
      ) : !formSubmitted ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <TrendingUpIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Ready to Analyze
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Click the "Analyze" button to generate detailed metrics and performance analysis for the selected contributors.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleFormSubmit}
              disabled={isAnalyzing}
              startIcon={isAnalyzing ? <CircularProgress size={20} /> : <TrendingUpIcon />}
            >
              {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tabs for different views */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs 
              value={tabValue} 
              onChange={(e, newValue) => {
                setTabValue(newValue);
                setStoredState('tabValue', newValue);
              }}
              variant={isTablet ? "scrollable" : "standard"}
              scrollButtons={isTablet ? "auto" : false}
            >
              <Tab 
                label={isMobile ? "Overview" : "Overview"} 
                icon={<TrendingUpIcon />} 
                iconPosition="start"
              />
              <Tab 
                label={isMobile ? "Compare" : isTablet ? "Compare" : "Comparison"} 
                icon={<CompareIcon />} 
                iconPosition="start"
                disabled={selectedContributors.length < 2}
              />
              <Tab 
                label={isMobile ? "Activity" : isTablet ? "Patterns" : "Activity Patterns"} 
                icon={<TimelineIcon />} 
                iconPosition="start"
              />
            </Tabs>
          </Box>

          {/* Overview Tab */}
          <TabPanel value={tabValue} index={0}>
            {selectedContributors.map((contributorId) => {
              const metrics = contributorMetrics[contributorId];
              const contributor = contributors.find(c => c.id === contributorId);
              
              if (!metrics || !contributor) {
                console.log(`Missing data for contributor ${contributorId}:`, { metrics, contributor });
                return null;
              }
              
              console.log(`Rendering metrics for ${contributor.name}:`, metrics);

              return (
                <Card key={contributorId} sx={{ mb: 3 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    {/* Contributor Header */}
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar sx={{ width: 48, height: 48, mr: 2 }}>
                        {contributor.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box flexGrow={1}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {contributor.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {contributor.role || 'Developer'} • {contributor.team || 'No Team'} • {contributor.experience_level || 'Unknown Level'}
                        </Typography>
                      </Box>
                      <IconButton
                        onClick={() => toggleCardExpansion(`overview-${contributorId}`)}
                        sx={{
                          transform: expandedCards[`overview-${contributorId}`] ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.3s'
                        }}
                      >
                        <ExpandMoreIcon />
                      </IconButton>
                    </Box>

                    {/* Key Metrics Grid */}
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={6} sm={6} md={3}>
                        <MetricCard
                          title="Commits"
                          value={metrics.total_commits || 0}
                          subtitle={`${metrics.commit_velocity || 0} per day`}
                          icon={<CodeIcon />}
                          color="primary"
                        />
                      </Grid>
                      <Grid item xs={6} sm={6} md={3}>
                        <MetricCard
                          title="Lines Added"
                          value={(metrics.lines_added || 0).toLocaleString()}
                          subtitle={`${metrics.code_churn_ratio || 0}x churn ratio`}
                          icon={<TrendingUpIcon />}
                          color="success"
                        />
                      </Grid>
                      <Grid item xs={6} sm={6} md={3}>
                        <MetricCard
                          title="Files Modified"
                          value={metrics.files_modified || 0}
                          subtitle={`${metrics.avg_files_per_commit || 0} avg per commit`}
                          icon={<PersonIcon />}
                          color="warning"
                        />
                      </Grid>
                      <Grid item xs={6} sm={6} md={3}>
                        <MetricCard
                          title="Lines Deleted"
                          value={(metrics.lines_deleted || 0).toLocaleString()}
                          subtitle="Code cleanup"
                          icon={<ScheduleIcon />}
                          color="error"
                        />
                      </Grid>
                    </Grid>

                    {/* Expandable Details */}
                    <Collapse in={expandedCards[`overview-${contributorId}`]}>
                      <Divider sx={{ my: 2 }} />
                      
                      <Grid container spacing={3}>
                        {/* Commit Types Chart */}
                        <Grid item xs={12} sm={12} md={6}>
                          <Paper sx={{ p: 2, height: { xs: 250, sm: 280, md: 300 } }}>
                            <Typography variant="h6" gutterBottom>
                              Commit Types
                            </Typography>
                            <Box sx={{ height: 250, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              {(() => {
                                const commitTypeData = formatCommitTypeData(metrics.commit_types);
                                return commitTypeData.labels.length > 0 ? (
                                  <Pie 
                                    data={commitTypeData}
                                    options={{
                                      responsive: true,
                                      maintainAspectRatio: false,
                                      plugins: {
                                        legend: {
                                          position: 'bottom'
                                        },
                                        tooltip: {
                                          callbacks: {
                                            label: (context) => {
                                              const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                              const percentage = ((context.raw / total) * 100).toFixed(1);
                                              return `${context.label}: ${context.raw} (${percentage}%)`;
                                            }
                                          }
                                        }
                                      }
                                    }}
                                  />
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    No commit type data available
                                  </Typography>
                                );
                              })()} 
                            </Box>
                          </Paper>
                        </Grid>

                        {/* Activity Pattern */}
                        <Grid item xs={12} sm={12} md={6}>
                          <Paper sx={{ p: 2, height: { xs: 250, sm: 280, md: 300 } }}>
                            <Typography variant="h6" gutterBottom>
                              Activity by Hour
                            </Typography>
                            <Box sx={{ height: 250 }}>
                              {(() => {
                                const timeline = contributorTimelines[contributorId] || [];
                                const granularity = getActivityGranularity(timeRange);
                                const activityData = formatActivityData(timeline, granularity);
                                return (
                                  <Line 
                                    key={`line-${contributorId}-${timeRange}`}
                                    data={activityData}
                                    options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: {
                                      display: false
                                    },
                                    tooltip: {
                                      callbacks: {
                                        title: (context) => {
                                          const granularity = getActivityGranularity(timeRange);
                                          return granularity === 'hour' ? `Hour: ${context[0].label}` : `${context[0].label}`;
                                        },
                                        label: (context) => `Commits: ${context.raw}`
                                      }
                                    }
                                  },
                                  scales: {
                                    y: {
                                      beginAtZero: true,
                                      title: {
                                        display: true,
                                        text: 'Number of Commits'
                                      }
                                    },
                                    x: {
                                      title: {
                                        display: true,
                                        text: getActivityAxisLabel(timeRange)
                                      }
                                    }
                                  }
                                }}
                                  />
                                );
                              })()} 
                            </Box>
                          </Paper>
                        </Grid>
                      </Grid>
                    </Collapse>
                  </CardContent>
                </Card>
              );
            })}
          </TabPanel>

          {/* Comparison Tab */}
          <TabPanel value={tabValue} index={1}>
            {comparisonData.length > 1 && (
              <Grid container spacing={3}>
                {/* Mobile-First Comparison Cards */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                        Side-by-Side Comparison
                      </Typography>
                      
                      {/* Mobile View - Stacked Cards */}
                      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                        {comparisonData.map((contributor, index) => (
                          <Card 
                            key={contributor.contributor_id} 
                            variant="outlined" 
                            sx={{ mb: 2, bgcolor: index % 2 === 0 ? 'grey.50' : 'background.paper' }}
                          >
                            <CardContent sx={{ p: 2 }}>
                              <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
                                <Avatar sx={{ width: 32, height: 32, mr: 2, bgcolor: 'primary.main' }}>
                                  {contributor.name.charAt(0).toUpperCase()}
                                </Avatar>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                  {contributor.name}
                                </Typography>
                              </Box>
                              
                              <Grid container spacing={2}>
                                {[
                                  { key: 'total_commits', label: 'Total Commits', icon: '📊' },
                                  { key: 'lines_added', label: 'Lines Added', icon: '➕' },
                                  { key: 'lines_deleted', label: 'Lines Deleted', icon: '➖' },
                                  { key: 'files_modified', label: 'Files Modified', icon: '📁' },
                                  { key: 'commit_velocity', label: 'Commits/Day', icon: '⚡' },
                                  { key: 'code_churn_ratio', label: 'Churn Ratio', icon: '🔄' }
                                ].map((metric) => (
                                  <Grid item xs={6} key={metric.key}>
                                    <Box sx={{ textAlign: 'center', p: 1, borderRadius: 1, bgcolor: 'background.paper' }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                        {metric.icon} {metric.label}
                                      </Typography>
                                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                        {typeof contributor[metric.key] === 'number' 
                                          ? contributor[metric.key].toLocaleString()
                                          : contributor[metric.key] || 'N/A'
                                        }
                                      </Typography>
                                    </Box>
                                  </Grid>
                                ))}
                              </Grid>
                            </CardContent>
                          </Card>
                        ))}
                      </Box>

                      {/* Desktop View - Table */}
                      <Box sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto' }}>
                        <Table sx={{ minWidth: 650 }}>
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.100' }}>
                              <TableCell sx={{ fontWeight: 600, minWidth: 150 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                  Metric
                                </Typography>
                              </TableCell>
                              {comparisonData.map((contributor) => (
                                <TableCell key={contributor.contributor_id} align="center" sx={{ minWidth: 120 }}>
                                  <Box display="flex" flexDirection="column" alignItems="center">
                                    <Avatar sx={{ width: 40, height: 40, mb: 1, bgcolor: 'primary.main' }}>
                                      {contributor.name.charAt(0).toUpperCase()}
                                    </Avatar>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, textAlign: 'center' }}>
                                      {contributor.name}
                                    </Typography>
                                  </Box>
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {[
                              { key: 'total_commits', label: 'Total Commits', icon: '📊' },
                              { key: 'lines_added', label: 'Lines Added', icon: '➕' },
                              { key: 'lines_deleted', label: 'Lines Deleted', icon: '➖' },
                              { key: 'files_modified', label: 'Files Modified', icon: '📁' },
                              { key: 'commit_velocity', label: 'Commits/Day', icon: '⚡' },
                              { key: 'code_churn_ratio', label: 'Churn Ratio', icon: '🔄' }
                            ].map((metric, index) => (
                              <TableRow 
                                key={metric.key} 
                                sx={{ 
                                  '&:nth-of-type(odd)': { bgcolor: 'grey.50' },
                                  '&:hover': { bgcolor: 'action.hover' }
                                }}
                              >
                                <TableCell sx={{ fontWeight: 500 }}>
                                  <Box display="flex" alignItems="center">
                                    <Typography sx={{ mr: 1, fontSize: '1.2rem' }}>
                                      {metric.icon}
                                    </Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                      {metric.label}
                                    </Typography>
                                  </Box>
                                </TableCell>
                                {comparisonData.map((contributor) => {
                                  const value = contributor[metric.key];
                                  const isHighest = comparisonData.every(c => 
                                    typeof c[metric.key] === 'number' && typeof value === 'number' 
                                      ? c[metric.key] <= value 
                                      : false
                                  );
                                  
                                  return (
                                    <TableCell key={contributor.contributor_id} align="center">
                                      <Typography 
                                        variant="body1" 
                                        sx={{ 
                                          fontWeight: isHighest && typeof value === 'number' ? 700 : 500,
                                          color: isHighest && typeof value === 'number' ? 'primary.main' : 'text.primary',
                                          fontSize: '1rem'
                                        }}
                                      >
                                        {typeof value === 'number' 
                                          ? value.toLocaleString()
                                          : value || 'N/A'
                                        }
                                      </Typography>
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </TabPanel>

          {/* Activity Patterns Tab */}
          <TabPanel value={tabValue} index={2}>
            <Grid container spacing={3}>
              {selectedContributors.map((contributorId) => {
                const metrics = contributorMetrics[contributorId];
                const contributor = contributors.find(c => c.id === contributorId);
                
                if (!metrics || !contributor) return null;

                return (
                  <Grid item xs={12} sm={12} md={6} lg={6} key={contributorId}>
                    <Card>
                      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Box display="flex" alignItems="center" mb={2}>
                          <Avatar sx={{ width: 32, height: 32, mr: 2 }}>
                            {contributor.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="h6">
                            {contributor.name} - Activity Pattern
                          </Typography>
                        </Box>
                        
                        <Box sx={{ height: { xs: 250, sm: 280, md: 300 } }}>
                          {(() => {
                            const timeline = contributorTimelines[contributorId] || [];
                            const granularity = getActivityGranularity(timeRange);
                            const activityData = formatActivityData(timeline, granularity);
                            return activityData.labels.length > 0 ? (
                              <Line 
                                key={`line-${contributorId}-${timeRange}`}
                                data={activityData}
                                options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    display: false
                                  },
                                  tooltip: {
                                    callbacks: {
                                      title: (context) => {
                                        const granularity = getActivityGranularity(timeRange);
                                        return granularity === 'hour' ? `Hour: ${context[0].label}` : `${context[0].label}`;
                                      },
                                      label: (context) => `Commits: ${context.raw}`
                                    }
                                  }
                                },
                                scales: {
                                  y: {
                                    beginAtZero: true,
                                    title: {
                                      display: true,
                                      text: 'Number of Commits'
                                    }
                                  },
                                  x: {
                                    title: {
                                      display: true,
                                      text: getActivityAxisLabel(timeRange)
                                    }
                                  }
                                }
                              }}
                              />
                            ) : (
                              <Box 
                                sx={{ 
                                  height: '100%', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  color: 'text.secondary'
                                }}
                              >
                                <Typography variant="body2">
                                  No activity pattern data available
                                </Typography>
                              </Box>
                            );
                          })()} 
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </TabPanel>
        </>
      )}
    </div>
  );
}

export default CommitterAnalysis;
