import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Paper,
  Avatar,
  Divider,
  useTheme,
  useMediaQuery,
  IconButton,
  Collapse
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Code as CodeIcon,
  Timeline as TimelineIcon,
  Compare as CompareIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon
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
                <InputLabel>Select Contributors</InputLabel>
                <Select
                  multiple
                  value={selectedContributors}
                  onChange={handleContributorChange}
                  input={<OutlinedInput label="Select Contributors" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => {
                        const contributor = contributors.find(c => c.id === value);
                        return (
                          <Chip 
                            key={value} 
                            label={contributor?.name || `ID: ${value}`}
                            size="small"
                            onDelete={() => handleContributorRemove(value)}
                            deleteIcon={<Box component="span">×</Box>}
                          />
                        );
                      })}
                    </Box>
                  )}
                  MenuProps={MenuProps}
                >
                  {contributors.map((contributor) => (
                    <MenuItem key={contributor.id} value={contributor.id}>
                      <Box display="flex" alignItems="center" width="100%">
                        <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '0.75rem' }}>
                          {contributor.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2">{contributor.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {contributor.role || 'Developer'} • {contributor.team || 'No Team'}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
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
                {/* Comparison Metrics */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Typography variant="h6" gutterBottom>
                        Side-by-Side Comparison
                      </Typography>
                      
                      <Box sx={{ overflowX: 'auto' }}>
                        <Box sx={{ minWidth: 600 }}>
                          <Grid container spacing={2}>
                            <Grid item xs={3}>
                              <Typography variant="subtitle2" color="text.secondary">
                                Metric
                              </Typography>
                            </Grid>
                            {comparisonData.map((contributor) => (
                              <Grid item xs={3} key={contributor.contributor_id}>
                                <Box display="flex" alignItems="center">
                                  <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '0.75rem' }}>
                                    {contributor.name.charAt(0).toUpperCase()}
                                  </Avatar>
                                  <Typography variant="subtitle2" noWrap>
                                    {contributor.name}
                                  </Typography>
                                </Box>
                              </Grid>
                            ))}
                          </Grid>
                          
                          <Divider sx={{ my: 2 }} />
                          
                          {[
                            { key: 'total_commits', label: 'Total Commits' },
                            { key: 'lines_added', label: 'Lines Added' },
                            { key: 'lines_deleted', label: 'Lines Deleted' },
                            { key: 'files_modified', label: 'Files Modified' },
                            { key: 'commit_velocity', label: 'Commits/Day' },
                            { key: 'code_churn_ratio', label: 'Churn Ratio' }
                          ].map((metric) => (
                            <Grid container spacing={2} key={metric.key} sx={{ mb: 1 }}>
                              <Grid item xs={3}>
                                <Typography variant="body2">
                                  {metric.label}
                                </Typography>
                              </Grid>
                              {comparisonData.map((contributor) => (
                                <Grid item xs={3} key={contributor.contributor_id}>
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {typeof contributor[metric.key] === 'number' 
                                      ? contributor[metric.key].toLocaleString()
                                      : contributor[metric.key] || 'N/A'
                                    }
                                  </Typography>
                                </Grid>
                              ))}
                            </Grid>
                          ))}
                        </Box>
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
