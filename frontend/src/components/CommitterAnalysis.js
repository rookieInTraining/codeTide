import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
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
  ListItemText,
  Checkbox,
  CircularProgress,
  ClickAwayListener,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
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


const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const CONTRIBUTORS_PER_PAGE = 10;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`committer-tabpanel-${index}`}
      aria-labelledby={`committer-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon, color = 'primary' }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  return (
    <Card sx={{ height: '100%', position: 'relative' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Box display="flex" alignItems="center" mb={1}>
          <Avatar 
            sx={{ 
              bgcolor: `${color}.main`, 
              width: { xs: 32, sm: 36, md: 40 }, 
              height: { xs: 32, sm: 36, md: 40 },
              mr: 2 
            }}
          >
            {icon}
          </Avatar>
          <Typography 
            variant={isMobile ? 'body2' : isTablet ? 'subtitle1' : 'h6'} 
            color="text.secondary"
            sx={{ fontWeight: 500 }}
          >
            {title}
          </Typography>
        </Box>
        <Typography 
          variant={isMobile ? 'h6' : isTablet ? 'h5' : 'h4'} 
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
  const [timeRange, setTimeRange] = useState(() => getStoredState('timeRange', 30));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(() => getStoredState('tabValue', 0));
  const [contributorMetrics, setContributorMetrics] = useState(() => getStoredState('contributorMetrics', {}));
  const [comparisonData, setComparisonData] = useState(() => getStoredState('comparisonData', []));
  const [expandedCards, setExpandedCards] = useState({});
  const [contributorSearch, setContributorSearch] = useState('');
  const [displayedContributorsCount, setDisplayedContributorsCount] = useState(CONTRIBUTORS_PER_PAGE);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [formSubmitted, setFormSubmitted] = useState(() => getStoredState('formSubmitted', false));
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
      
      // Auto-select first repository if none selected
      if (data.length > 0 && !selectedRepository) {
        setSelectedRepository(data[0]);
      }
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchContributors = useCallback(async () => {
    if (!selectedRepository) return;
    
    try {
      const response = await fetch(`http://localhost:5000/api/contributors?repository_id=${selectedRepository.id}`);
      if (!response.ok) throw new Error('Failed to fetch contributors');
      const data = await response.json();
      setContributors(data);
      
      // Auto-select first contributor if none selected
      if (data.length > 0 && selectedContributors.length === 0) {
        setSelectedContributors([data[0].id]);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [selectedRepository, selectedContributors.length]);

  const fetchContributorMetrics = useCallback(async () => {
    if (!selectedRepository) return;
    
    setIsAnalyzing(true);
    
    try {
      // Batch API calls with timeout to prevent hanging
      const TIMEOUT_MS = 30000; // 30 second timeout
      
      const metricsPromises = selectedContributors.map(async (contributorId) => {
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_MS)
          );
          
          const fetchPromise = Promise.all([
            fetch(`http://localhost:5000/api/contributors/${contributorId}/metrics?repository_id=${selectedRepository.id}&days=${timeRange}`),
            fetch(`http://localhost:5000/api/contributors/${contributorId}/activity-timeline?repository_id=${selectedRepository.id}&days=${timeRange}`)
          ]);
          
          const [metricsResponse, timelineResponse] = await Promise.race([fetchPromise, timeoutPromise]);
          
          const metricsData = metricsResponse.ok ? await metricsResponse.json() : null;
          const timelineData = timelineResponse.ok ? await timelineResponse.json() : null;
          
          console.log(`Metrics data for contributor ${contributorId}:`, metricsData);
          console.log(`Timeline data for contributor ${contributorId}:`, timelineData);
          
          if (metricsData && timelineData) {
            metricsData.activity_timeline = timelineData;
            return { contributorId, data: metricsData };
          }
          return null;
        } catch (err) {
          console.error(`Failed to fetch metrics for contributor ${contributorId}:`, err);
          return null;
        }
      });
      
      const results = await Promise.all(metricsPromises);
      const metrics = {};
      
      results.forEach(result => {
        if (result) {
          metrics[result.contributorId] = result.data;
        }
      });
      
      console.log('Final contributor metrics:', metrics);
      setContributorMetrics(metrics);
      setStoredState('contributorMetrics', metrics);
    } catch (err) {
      console.error('Failed to fetch contributor metrics:', err);
      setError('Failed to load contributor metrics. This may be due to large commit volumes.');
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
        setStoredState('comparisonData', data);
      }
    } catch (err) {
      console.error('Failed to fetch comparison data:', err);
    }
  }, [selectedRepository, selectedContributors, timeRange]);

  const handleFormSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!selectedRepository || selectedContributors.length === 0) {
      setError('Please select a repository and at least one contributor');
      return;
    }
    
    setError(null);
    setFormSubmitted(true);
    setStoredState('formSubmitted', true);
    
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
  
  // Separate selected and unselected contributors
  const selectedContributorsList = filteredAndSortedContributors.filter(contributor => 
    selectedContributors.includes(contributor.id)
  );
  const unselectedContributorsList = filteredAndSortedContributors.filter(contributor => 
    !selectedContributors.includes(contributor.id)
  );
  
  // Combine with selected first
  const organizedContributors = [...selectedContributorsList, ...unselectedContributorsList];
  
  const displayedContributors = organizedContributors.slice(0, displayedContributorsCount);
  const hasMoreContributors = displayedContributorsCount < organizedContributors.length;

  const handleContributorSearchChange = (event) => {
    setContributorSearch(event.target.value);
    setDisplayedContributorsCount(CONTRIBUTORS_PER_PAGE); // Reset displayed count when searching
  };

  const handleScroll = (event) => {
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

  const getTimeRangeLabel = (days) => {
    switch (days) {
      case 7: return 'Last 7 days';
      case 30: return 'Last 30 days';
      case 90: return 'Last 3 months';
      case 365: return 'Year to date';
      case 0: return 'Lifetime';
      default: return `Last ${days} days`;
    }
  };

  const getActivityGranularity = (days) => {
    if (days === 0) return 'month'; // Lifetime
    if (days === 365) return 'month'; // Year to date
    if (days <= 7) return 'hour';
    if (days <= 30) return 'day';
    if (days <= 90) return 'week';
    return 'month';
  };

  const getActivityAxisLabel = (days) => {
    const granularity = getActivityGranularity(days);
    console.log('Time range:', days, 'Granularity:', granularity);
    switch (granularity) {
      case 'hour': return 'Hour of Day';
      case 'day': return 'Day';
      case 'week': return 'Week';
      case 'month': return 'Month';
      default: return 'Time Period';
    }
  };

  // Memoized function to format activity data - prevents unnecessary recalculations
  const formatActivityData = useCallback((contributorId) => {
    const metrics = contributorMetrics[contributorId];
    
    if (!metrics) {
      return { labels: [], datasets: [] };
    }
    
    const granularity = getActivityGranularity(timeRange);
    
    // For hourly granularity, use activity_pattern (hour of day)
    if (granularity === 'hour') {
      if (!metrics.activity_pattern) {
        return { labels: [], datasets: [] };
      }
      
      const entries = Object.entries(metrics.activity_pattern);
      
      if (entries.length === 0) {
        return { labels: [], datasets: [] };
      }
      
      // Sort by hour for proper display
      entries.sort(([a], [b]) => parseInt(a) - parseInt(b));
      
      return {
        labels: entries.map(([hour]) => `${hour}:00`),
        datasets: [{
          label: 'Commits',
          data: entries.map(([, commits]) => commits),
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1
        }]
      };
    } else {
      // For other granularities, use activity_timeline (actual dates)
      if (!metrics.activity_timeline || metrics.activity_timeline.length === 0) {
        return { labels: [], datasets: [] };
      }
      
      // Sort timeline by date
      const sortedTimeline = [...metrics.activity_timeline].sort((a, b) => new Date(a.date) - new Date(b.date));
      
      let labels = [];
      let data = [];
      
      if (granularity === 'day') {
        // Use actual daily data
        labels = sortedTimeline.map(item => {
          const date = new Date(item.date);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        data = sortedTimeline.map(item => item.commits);
      } else if (granularity === 'week') {
        // Aggregate by week
        const weeklyData = new Map();
        sortedTimeline.forEach(item => {
          const date = new Date(item.date);
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
          const weekKey = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          if (!weeklyData.has(weekKey)) {
            weeklyData.set(weekKey, 0);
          }
          weeklyData.set(weekKey, weeklyData.get(weekKey) + item.commits);
        });
        
        labels = Array.from(weeklyData.keys());
        data = Array.from(weeklyData.values());
      } else if (granularity === 'month') {
        // Aggregate by month
        const monthlyData = new Map();
        sortedTimeline.forEach(item => {
          const date = new Date(item.date);
          const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
          
          if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, 0);
          }
          monthlyData.set(monthKey, monthlyData.get(monthKey) + item.commits);
        });
        
        labels = Array.from(monthlyData.keys());
        data = Array.from(monthlyData.values());
      }
      
      return {
        labels,
        datasets: [{
          label: 'Commits',
          data,
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1
        }]
      };
    }
  }, [contributorMetrics, timeRange]);

  const formatCommitTypeData = (contributorId) => {
    const metrics = contributorMetrics[contributorId];
    if (!metrics || !metrics.commit_types) return { labels: [], datasets: [] };
    
    const entries = Object.entries(metrics.commit_types);
    return {
      labels: entries.map(([type]) => type.charAt(0).toUpperCase() + type.slice(1)),
      datasets: [{
        data: entries.map(([, count]) => count),
        backgroundColor: [
          '#FF6384',
          '#36A2EB', 
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40'
        ],
        borderWidth: 1
      }]
    };
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography 
            variant={isMobile ? 'h6' : 'h5'} 
            gutterBottom
            sx={{ fontWeight: 600 }}
          >
            Committer Analysis
          </Typography>
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <FormControl fullWidth>
                <InputLabel>Select Repository</InputLabel>
                <Select
                  value={selectedRepository?.id || ''}
                  onChange={(e) => {
                    const repo = repositories.find(r => r.id === e.target.value);
                    setSelectedRepository(repo);
                  }}
                  label="Select Repository"
                >
                  {repositories.map((repo) => (
                    <MenuItem key={repo.id} value={repo.id}>
                      <Box>
                        <Typography variant="body2">{repo.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {repo.last_analyzed 
                            ? `Last analyzed: ${new Date(repo.last_analyzed).toLocaleDateString()}`
                            : 'Not analyzed yet'
                          }
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4} lg={4}>
              <FormControl fullWidth disabled={!selectedRepository}>
                <ClickAwayListener onClickAway={() => {
                  setDropdownOpen(false);
                  setAnchorEl(null);
                }}>
                  <Box>
                    <TextField
                      label="Select Contributors"
                      value={selectedContributors.length > 0 ? `${selectedContributors.length} contributors selected` : ""}
                      onClick={(event) => {
                        setAnchorEl(event.currentTarget);
                        setDropdownOpen(!dropdownOpen);
                      }}
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton size="small">
                              {dropdownOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                      placeholder={selectedContributors.length === 0 ? "Click to select contributors" : ""}
                      sx={{ cursor: 'pointer' }}
                    />
                    
                    <Popper
                      open={dropdownOpen}
                      anchorEl={anchorEl}
                      placement="bottom-start"
                      style={{ zIndex: 1300, width: anchorEl ? anchorEl.offsetWidth : 400 }}
                    >
                      <Paper sx={{ mt: 1, maxHeight: 400, overflow: 'hidden' }}>
                        {/* Search Field */}
                        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                          <TextField
                            fullWidth
                            size="small"
                            placeholder="Search contributors..."
                            value={contributorSearch}
                            onChange={handleContributorSearchChange}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchIcon />
                                </InputAdornment>
                              ),
                            }}
                          />
                        </Box>

                        {/* Contributors List with Infinite Scroll */}
                        <List 
                          sx={{ 
                            maxHeight: 280, 
                            overflow: 'auto',
                            '&::-webkit-scrollbar': {
                              width: '6px',
                            },
                            '&::-webkit-scrollbar-track': {
                              background: '#f1f1f1',
                              borderRadius: '3px',
                            },
                            '&::-webkit-scrollbar-thumb': {
                              background: '#c1c1c1',
                              borderRadius: '3px',
                            },
                            '&::-webkit-scrollbar-thumb:hover': {
                              background: '#a8a8a8',
                            },
                          }}
                          onScroll={handleScroll}
                        >
                          {displayedContributors.map((contributor) => {
                            const isSelected = selectedContributors.includes(contributor.id);
                            return (
                              <ListItem
                                key={contributor.id}
                                button
                                onClick={() => {
                                  const newSelected = isSelected
                                    ? selectedContributors.filter(id => id !== contributor.id)
                                    : [...selectedContributors, contributor.id];
                                  setSelectedContributors(newSelected);
                                }}
                                sx={{
                                  backgroundColor: isSelected ? 'primary.light' : 'transparent',
                                  '&:hover': {
                                    backgroundColor: isSelected ? 'primary.main' : 'action.hover',
                                  },
                                  opacity: isSelected ? 1 : 0.8,
                                  borderLeft: isSelected ? '3px solid' : 'none',
                                  borderLeftColor: 'primary.main'
                                }}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  tabIndex={-1}
                                  disableRipple
                                  color="primary"
                                />
                                <ListItemText 
                                  primary={contributor.name}
                                  sx={{
                                    '& .MuiListItemText-primary': {
                                      fontWeight: isSelected ? 600 : 400,
                                      color: isSelected ? 'primary.contrastText' : 'text.primary'
                                    }
                                  }}
                                />
                              </ListItem>
                            );
                          })}
                          
                          {/* Loading indicator when more items are being loaded */}
                          {hasMoreContributors && (
                            <ListItem sx={{ justifyContent: 'center', py: 2 }}>
                              <CircularProgress size={20} />
                              <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                                Loading more contributors...
                              </Typography>
                            </ListItem>
                          )}
                          
                          {filteredAndSortedContributors.length === 0 && (
                            <ListItem>
                              <ListItemText 
                                primary="No contributors found"
                                sx={{ textAlign: 'center', color: 'text.secondary' }}
                              />
                            </ListItem>
                          )}
                          
                          {/* End of list indicator */}
                          {!hasMoreContributors && filteredAndSortedContributors.length > CONTRIBUTORS_PER_PAGE && (
                            <ListItem sx={{ justifyContent: 'center', py: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                All contributors loaded
                              </Typography>
                            </ListItem>
                          )}
                        </List>

                        {/* Footer with selection info */}
                        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
                          <Typography variant="caption" color="text.secondary">
                            {selectedContributors.length} of {contributors.length} contributors selected
                            {filteredAndSortedContributors.length !== contributors.length && 
                              ` • ${filteredAndSortedContributors.length} shown`
                            }
                          </Typography>
                        </Box>
                      </Paper>
                    </Popper>
                  </Box>
                </ClickAwayListener>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3} lg={3}>
              <FormControl fullWidth disabled={!selectedRepository}>
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
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                onClick={handleFormSubmit}
                disabled={!selectedRepository || selectedContributors.length === 0 || isAnalyzing}
                sx={{ height: 56 }}
              >
                {isAnalyzing ? (
                  <Box display="flex" alignItems="center">
                    <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                    Analyzing...
                  </Box>
                ) : (
                  'Analyze'
                )}
              </Button>
            </Grid>
          </Grid>
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
                              <Pie 
                                data={formatCommitTypeData(contributorId)}
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
                                const activityData = formatActivityData(contributorId);
                                return (
                                  <Bar 
                                    key={`bar-${contributorId}-${timeRange}`}
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
                            const activityData = formatActivityData(contributorId);
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
    </Box>
  );
}

export default CommitterAnalysis;
