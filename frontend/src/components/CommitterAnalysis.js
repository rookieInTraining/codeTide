import React, { useState, useEffect } from 'react';
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

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
  
  return (
    <Card sx={{ height: '100%', position: 'relative' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Box display="flex" alignItems="center" mb={1}>
          <Avatar 
            sx={{ 
              bgcolor: `${color}.main`, 
              width: { xs: 32, sm: 40 }, 
              height: { xs: 32, sm: 40 },
              mr: 2 
            }}
          >
            {icon}
          </Avatar>
          <Typography 
            variant={isMobile ? 'body2' : 'h6'} 
            color="text.secondary"
            sx={{ fontWeight: 500 }}
          >
            {title}
          </Typography>
        </Box>
        <Typography 
          variant={isMobile ? 'h6' : 'h4'} 
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
  const [selectedRepository, setSelectedRepository] = useState(null);
  const [contributors, setContributors] = useState([]);
  const [selectedContributors, setSelectedContributors] = useState([]);
  const [timeRange, setTimeRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [contributorMetrics, setContributorMetrics] = useState({});
  const [comparisonData, setComparisonData] = useState([]);
  const [expandedCards, setExpandedCards] = useState({});
  const [contributorSearch, setContributorSearch] = useState('');
  const [displayedContributorsCount, setDisplayedContributorsCount] = useState(CONTRIBUTORS_PER_PAGE);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    fetchRepositories();
  }, []);

  useEffect(() => {
    if (selectedRepository) {
      fetchContributors();
      // Reset selected contributors when repository changes
      setSelectedContributors([]);
      setContributorMetrics({});
      setComparisonData([]);
    }
  }, [selectedRepository]);

  useEffect(() => {
    if (selectedContributors.length > 0 && selectedRepository) {
      fetchContributorMetrics();
      if (selectedContributors.length > 1) {
        fetchComparisonData();
      }
    }
  }, [selectedContributors, timeRange]);

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

  const fetchContributors = async () => {
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
  };

  const fetchContributorMetrics = async () => {
    if (!selectedRepository) return;
    
    const metrics = {};
    for (const contributorId of selectedContributors) {
      try {
        const response = await fetch(
          `http://localhost:5000/api/contributors/${contributorId}/metrics?repository_id=${selectedRepository.id}&days=${timeRange}`
        );
        if (response.ok) {
          const data = await response.json();
          metrics[contributorId] = data;
        }
      } catch (err) {
        console.error(`Failed to fetch metrics for contributor ${contributorId}:`, err);
      }
    }
    setContributorMetrics(metrics);
  };

  const fetchComparisonData = async () => {
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
  };

  const handleContributorChange = (event) => {
    const value = event.target.value;
    setSelectedContributors(typeof value === 'string' ? value.split(',') : value);
  };

  const handleContributorRemove = (contributorIdToRemove) => {
    setSelectedContributors(prev => prev.filter(id => id !== contributorIdToRemove));
  };

  // Filter, sort, and organize contributors for dropdown
  const filteredContributors = contributors.filter(contributor =>
    contributor.name.toLowerCase().includes(contributorSearch.toLowerCase())
  );
  
  // Sort alphabetically
  const sortedContributors = [...filteredContributors].sort((a, b) => 
    a.name.localeCompare(b.name)
  );
  
  // Separate selected and unselected contributors
  const selectedContributorsList = sortedContributors.filter(contributor => 
    selectedContributors.includes(contributor.id)
  );
  const unselectedContributorsList = sortedContributors.filter(contributor => 
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
      if (prev.includes(contributorId)) {
        return prev.filter(id => id !== contributorId);
      } else {
        return [...prev, contributorId];
      }
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
      case 0: return 'All time';
      default: return `Last ${days} days`;
    }
  };

  const formatActivityData = (contributorId) => {
    const metrics = contributorMetrics[contributorId];
    if (!metrics || !metrics.activity_pattern) return [];
    
    return Object.entries(metrics.activity_pattern).map(([hour, commits]) => ({
      hour: `${hour}:00`,
      commits
    })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  };

  const formatCommitTypeData = (contributorId) => {
    const metrics = contributorMetrics[contributorId];
    if (!metrics || !metrics.commit_types) return [];
    
    return Object.entries(metrics.commit_types).map(([type, count], index) => ({
      name: type,
      value: count,
      fill: COLORS[index % COLORS.length]
    }));
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
            <Grid item xs={12} sm={6} md={3}>
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
            
            <Grid item xs={12} sm={6} md={4}>
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
                          
                          {filteredContributors.length === 0 && (
                            <ListItem>
                              <ListItemText 
                                primary="No contributors found"
                                sx={{ textAlign: 'center', color: 'text.secondary' }}
                              />
                            </ListItem>
                          )}
                          
                          {/* End of list indicator */}
                          {!hasMoreContributors && filteredContributors.length > CONTRIBUTORS_PER_PAGE && (
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
                            {filteredContributors.length !== contributors.length && 
                              ` • ${filteredContributors.length} shown`
                            }
                          </Typography>
                        </Box>
                      </Paper>
                    </Popper>
                  </Box>
                </ClickAwayListener>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth disabled={!selectedRepository}>
                <InputLabel>Time Range</InputLabel>
                <Select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
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
      ) : (
        <>
          {/* Tabs for different views */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs 
              value={tabValue} 
              onChange={(e, newValue) => setTabValue(newValue)}
              variant={isMobile ? "scrollable" : "standard"}
              scrollButtons={isMobile ? "auto" : false}
            >
              <Tab 
                label={isMobile ? "Overview" : "Overview"} 
                icon={<TrendingUpIcon />} 
                iconPosition="start"
              />
              <Tab 
                label={isMobile ? "Compare" : "Comparison"} 
                icon={<CompareIcon />} 
                iconPosition="start"
                disabled={selectedContributors.length < 2}
              />
              <Tab 
                label={isMobile ? "Activity" : "Activity Patterns"} 
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
              
              if (!metrics || !contributor) return null;

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
                      <Grid item xs={6} sm={3}>
                        <MetricCard
                          title="Commits"
                          value={metrics.total_commits}
                          subtitle={`${metrics.commit_velocity} per day`}
                          icon={<CodeIcon />}
                          color="primary"
                        />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <MetricCard
                          title="Lines Added"
                          value={metrics.lines_added.toLocaleString()}
                          subtitle={`${metrics.code_churn_ratio}x churn ratio`}
                          icon={<TrendingUpIcon />}
                          color="success"
                        />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <MetricCard
                          title="Files Modified"
                          value={metrics.files_modified}
                          subtitle={`${metrics.avg_files_per_commit} avg per commit`}
                          icon={<PersonIcon />}
                          color="warning"
                        />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <MetricCard
                          title="Lines Deleted"
                          value={metrics.lines_deleted.toLocaleString()}
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
                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p: 2, height: 300 }}>
                            <Typography variant="h6" gutterBottom>
                              Commit Types
                            </Typography>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={formatCommitTypeData(contributorId)}
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                  {formatCommitTypeData(contributorId).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </Paper>
                        </Grid>

                        {/* Activity Pattern */}
                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p: 2, height: 300 }}>
                            <Typography variant="h6" gutterBottom>
                              Activity by Hour
                            </Typography>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={formatActivityData(contributorId)}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="hour" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="commits" fill="#8884d8" />
                              </BarChart>
                            </ResponsiveContainer>
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
                  <Grid item xs={12} lg={6} key={contributorId}>
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
                        
                        <Box sx={{ height: 300 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={formatActivityData(contributorId)}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="hour" />
                              <YAxis />
                              <Tooltip />
                              <Line 
                                type="monotone" 
                                dataKey="commits" 
                                stroke="#8884d8" 
                                strokeWidth={2}
                              />
                            </LineChart>
                          </ResponsiveContainer>
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
