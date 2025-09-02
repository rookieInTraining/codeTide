import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  useMediaQuery,
  Tooltip,
  IconButton
} from '@mui/material';
import { HelpOutline as HelpIcon } from '@mui/icons-material';
import AnalysisProgressDialog from './AnalysisProgressDialog';
import { formStyles } from '../theme/formStyles';
import { getTooltipContent } from '../utils/metricTooltips';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  ArcElement
);

const Dashboard = ({ repositories, selectedRepository, onRepositoryChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  // Persistent state management
  const getStoredState = (key, defaultValue) => {
    try {
      const stored = localStorage.getItem(`dashboard_${key}`);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const setStoredState = (key, value) => {
    try {
      localStorage.setItem(`dashboard_${key}`, JSON.stringify(value));
    } catch {
      // Ignore storage errors
    }
  };

  const [metrics, setMetrics] = useState(() => getStoredState('metrics', {}));
  const [contributors, setContributors] = useState(() => getStoredState('contributors', []));
  const [dailyActivity, setDailyActivity] = useState(() => getStoredState('dailyActivity', []));
  const [commitTypes, setCommitTypes] = useState(() => getStoredState('commitTypes', {}));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingStates, setLoadingStates] = useState({
    metrics: false,
    contributors: false,
    dailyActivity: false,
    commitTypes: false
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ open: false, repositoryName: '', repositoryId: null });
  const [timePeriod, setTimePeriod] = useState(() => getStoredState('timePeriod', 30));

  useEffect(() => {
    if (selectedRepository) {
      // Check if we have stored data to display immediately
      const hasStoredData = getStoredState('metrics', null) && 
                           getStoredState('contributors', null) && 
                           getStoredState('dailyActivity', null) && 
                           getStoredState('commitTypes', null);
      
      if (hasStoredData) {
        setLoading(false);
      }
    }
  }, [selectedRepository]);

  const fetchAllData = async () => {
    if (!selectedRepository) return;
    
    setLoading(true);
    setError(null);
    
    // Start all calls in parallel but track individual progress
    const promises = [
      fetchMetrics(),
      fetchContributors(),
      fetchDailyActivity(),
      fetchCommitTypes()
    ];
    
    try {
      await Promise.all(promises);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    setLoadingStates(prev => ({ ...prev, metrics: true }));
    try {
      const [velocityRes, churnRes, testCoverageRes] = await Promise.all([
        fetch(`http://localhost:5000/api/metrics/velocity?repository_id=${selectedRepository.id}&days=${timePeriod}`),
        fetch(`http://localhost:5000/api/metrics/churn?repository_id=${selectedRepository.id}&days=${timePeriod}`),
        fetch(`http://localhost:5000/api/metrics/test-coverage?repository_id=${selectedRepository.id}&days=${timePeriod}`)
      ]);

      const velocity = await velocityRes.json();
      const churn = await churnRes.json();
      const testCoverage = await testCoverageRes.json();

      const metricsData = { velocity, churn, testCoverage };
      setMetrics(metricsData);
      setStoredState('metrics', metricsData);
    } finally {
      setLoadingStates(prev => ({ ...prev, metrics: false }));
    }
  };

  const fetchContributors = async () => {
    setLoadingStates(prev => ({ ...prev, contributors: true }));
    try {
      const response = await fetch(`http://localhost:5000/api/metrics/contributors?repository_id=${selectedRepository.id}&days=${timePeriod}`);
      const data = await response.json();
      setContributors(data);
      setStoredState('contributors', data);
    } finally {
      setLoadingStates(prev => ({ ...prev, contributors: false }));
    }
  };

  const fetchDailyActivity = async () => {
    setLoadingStates(prev => ({ ...prev, dailyActivity: true }));
    try {
      const response = await fetch(`http://localhost:5000/api/charts/daily-activity?repository_id=${selectedRepository.id}&days=${timePeriod}`);
      const data = await response.json();
      setDailyActivity(data);
      setStoredState('dailyActivity', data);
    } finally {
      setLoadingStates(prev => ({ ...prev, dailyActivity: false }));
    }
  };

  const fetchCommitTypes = async () => {
    setLoadingStates(prev => ({ ...prev, commitTypes: true }));
    try {
      const response = await fetch(`http://localhost:5000/api/charts/commit-types?repository_id=${selectedRepository.id}&days=${timePeriod}`);
      const data = await response.json();
      setCommitTypes(data);
      setStoredState('commitTypes', data);
    } finally {
      setLoadingStates(prev => ({ ...prev, commitTypes: false }));
    }
  };

  const analyzeRepository = async () => {
    setAnalysisProgress({ 
      open: true, 
      repositoryName: selectedRepository.name, 
      repositoryId: selectedRepository.id 
    });
  };

  const handleAnalysisComplete = (success, commitsProcessed) => {
    setAnalysisProgress({ open: false, repositoryName: '', repositoryId: null });
    
    if (success) {
      // Clear stored data to force fresh fetch
      localStorage.removeItem('dashboard_metrics');
      localStorage.removeItem('dashboard_contributors');
      localStorage.removeItem('dashboard_dailyActivity');
      localStorage.removeItem('dashboard_commitTypes');
      fetchAllData(); // Refresh all data after successful analysis
    }
  };

  const dailyActivityChartData = {
    labels: dailyActivity.map(d => new Date(d.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Commits',
        data: dailyActivity.map(d => d.commit_count),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      },
      {
        label: 'Lines Added',
        data: dailyActivity.map(d => d.lines_added),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        yAxisID: 'y1',
        tension: 0.1
      }
    ]
  };

  const commitTypesChartData = {
    labels: Object.keys(commitTypes),
    datasets: [
      {
        data: Object.values(commitTypes),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40'
        ]
      }
    ]
  };

  const contributorChartData = {
    labels: contributors.slice(0, 10).map(c => c.name),
    datasets: [
      {
        label: 'Commits',
        data: contributors.slice(0, 10).map(c => c.commit_count),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }
    ]
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

      {/* Repository & Dashboard Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ ...formStyles.cardPadding }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Repository & Dashboard Configuration
          </Typography>
          
          <Grid container spacing={formStyles.gridSpacing.container} alignItems="center">
            <Grid item xs={12} sm={6} md={3} lg={2}>
              <FormControl {...formStyles.formControl}>
                <InputLabel>Select Repository</InputLabel>
                <Select
                  value={selectedRepository?.id || ''}
                  onChange={(e) => {
                    const repo = repositories.find(r => r.id === e.target.value);
                    onRepositoryChange(repo);
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
            
            <Grid item xs={12} sm={6} md={2} lg={2}>
              <FormControl {...formStyles.formControl}>
                <InputLabel>Time Period</InputLabel>
                <Select
                  value={timePeriod}
                  onChange={(e) => {
                    setTimePeriod(e.target.value);
                    setStoredState('timePeriod', e.target.value);
                  }}
                  label="Time Period"
                >
                  <MenuItem value={7}>Last 7 days</MenuItem>
                  <MenuItem value={30}>Last 30 days</MenuItem>
                  <MenuItem value={90}>Last 90 days</MenuItem>
                  <MenuItem value={365}>Year to date</MenuItem>
                  <MenuItem value={730}>Last year</MenuItem>
                  <MenuItem value={0}>Lifetime</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3} lg={3}>
              <Button
                {...formStyles.button.primary}
                onClick={fetchAllData}
                disabled={loading || analysisProgress.open}
              >
                {loading ? (
                  <Box display="flex" alignItems="center">
                    <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                    Loading...
                  </Box>
                ) : (
                  'Load Dashboard Data'
                )}
              </Button>
            </Grid>
            
            <Grid item xs={12} sm={6} md={2} lg={3}>
              <Button
                {...formStyles.button.secondary}
                onClick={analyzeRepository}
                disabled={analysisProgress.open}
              >
                {analysisProgress.open ? (
                  <Box display="flex" alignItems="center">
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Analyzing...
                  </Box>
                ) : (
                  'Analyze Repository'
                )}
              </Button>
            </Grid>
            
            <Grid item xs={12} sm={12} md={2} lg={2}>
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ 
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  textAlign: { xs: 'center', sm: 'left' },
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: '56px'
                }}
              >
                {selectedRepository?.last_analyzed 
                  ? `Last analyzed: ${new Date(selectedRepository.last_analyzed).toLocaleString()}`
                  : 'Not analyzed yet'
                }
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>


      {/* Key Metrics */}
      <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }} sx={{ mb: { xs: 3, sm: 3.5, md: 4 } }}>
        <Grid item xs={6} sm={6} md={3}>
          <Card>
            <CardContent sx={{ 
              textAlign: 'center',
              py: { xs: 2, sm: 2.5, md: 3 }
            }}>
              <Typography 
                variant="h4" 
                color="primary"
                sx={{ 
                  fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' },
                  fontWeight: { xs: 600, sm: 500, md: 400 }
                }}
              >
                {metrics.velocity?.velocity?.toFixed(2) || '0'}
              </Typography>
              <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } }}
                >
                  Commits/Day
                </Typography>
                <Tooltip 
                  title={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {getTooltipContent('commits_per_day').title}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {getTooltipContent('commits_per_day').description}
                      </Typography>
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <IconButton size="small" sx={{ p: 0.25 }}>
                    <HelpIcon fontSize="small" sx={{ fontSize: '0.875rem' }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card>
            <CardContent sx={{ 
              textAlign: 'center',
              py: { xs: 2, sm: 2.5, md: 3 }
            }}>
              <Typography 
                variant="h4" 
                color="primary"
                sx={{ 
                  fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' },
                  fontWeight: { xs: 600, sm: 500, md: 400 }
                }}
              >
                {metrics.churn?.churn_ratio?.toFixed(1) || '0'}
              </Typography>
              <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } }}
                >
                  Code Churn Ratio
                </Typography>
                <Tooltip 
                    title={
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {getTooltipContent('code_churn_ratio').title}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {getTooltipContent('code_churn_ratio').description}
                        </Typography>
                      </Box>
                    }
                    arrow
                    placement="top"
                  >
                    <IconButton size="small" sx={{ p: 0.25 }}>
                      <HelpIcon fontSize="small" sx={{ fontSize: '0.875rem' }} />
                    </IconButton>
                  </Tooltip>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card>
            <CardContent sx={{ 
              textAlign: 'center',
              py: { xs: 2, sm: 2.5, md: 3 }
            }}>
              {loadingStates.metrics ? (
                <CircularProgress size={32} />
              ) : (
                <Typography 
                  variant="h4" 
                  color="primary"
                  sx={{ 
                    fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' },
                    fontWeight: { xs: 600, sm: 500, md: 400 }
                  }}
                >
                  {(metrics.testCoverage?.test_ratio * 100)?.toFixed(1) || '0'}%
                </Typography>
              )}
              <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } }}
                >
                  Test File Ratio
                </Typography>
                <Tooltip 
                  title={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {getTooltipContent('test_file_ratio').title}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {getTooltipContent('test_file_ratio').description}
                      </Typography>
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <IconButton size="small" sx={{ p: 0.25 }}>
                    <HelpIcon fontSize="small" sx={{ fontSize: '0.875rem' }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card>
            <CardContent sx={{ 
              textAlign: 'center',
              py: { xs: 2, sm: 2.5, md: 3 }
            }}>
              {loadingStates.contributors ? (
                <CircularProgress size={32} />
              ) : (
                <Typography 
                  variant="h4" 
                  color="primary"
                  sx={{ 
                    fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' },
                    fontWeight: { xs: 600, sm: 500, md: 400 }
                  }}
                >
                  {contributors.length}
                </Typography>
              )}
              <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } }}
                >
                  Active Contributors
                </Typography>
                <Tooltip 
                  title={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {getTooltipContent('active_contributors').title}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {getTooltipContent('active_contributors').description}
                      </Typography>
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <IconButton size="small" sx={{ p: 0.25 }}>
                    <HelpIcon fontSize="small" sx={{ fontSize: '0.875rem' }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Typography 
                  variant="h6" 
                  sx={{ fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' } }}
                >
                  Daily Activity
                </Typography>
                <Tooltip 
                  title={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {getTooltipContent('daily_activity').title}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {getTooltipContent('daily_activity').description}
                      </Typography>
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <IconButton size="small" sx={{ p: 0.25 }}>
                    <HelpIcon fontSize="small" sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Tooltip>
              </Box>
              {loadingStates.dailyActivity ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                  <CircularProgress />
                </Box>
              ) : dailyActivity.length > 0 ? (
                <Line 
                  data={dailyActivityChartData}
                  options={{
                    responsive: true,
                    scales: {
                      y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                      },
                      y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                          drawOnChartArea: false,
                        },
                      },
                    }
                  }}
                />
              ) : (
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ 
                    textAlign: 'center', 
                    py: { xs: 2, sm: 3, md: 4 },
                    fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.875rem' }
                  }}
                >
                  No activity data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Typography 
                  variant="h6" 
                  sx={{ fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' } }}
                >
                  Commit Types
                </Typography>
                <Tooltip 
                  title={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {getTooltipContent('commit_types').title}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {getTooltipContent('commit_types').description}
                      </Typography>
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <IconButton size="small" sx={{ p: 0.25 }}>
                    <HelpIcon fontSize="small" sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Tooltip>
              </Box>
              {loadingStates.commitTypes ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                  <CircularProgress />
                </Box>
              ) : Object.keys(commitTypes).length > 0 ? (
                <Doughnut data={commitTypesChartData} />
              ) : (
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ 
                    textAlign: 'center', 
                    py: { xs: 2, sm: 3, md: 4 },
                    fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.875rem' }
                  }}
                >
                  No commit type data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Typography 
                  variant="h6" 
                  sx={{ fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' } }}
                >
                  Top Contributors
                </Typography>
                <Tooltip 
                  title={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {getTooltipContent('top_contributors').title}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {getTooltipContent('top_contributors').description}
                      </Typography>
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <IconButton size="small" sx={{ p: 0.25 }}>
                    <HelpIcon fontSize="small" sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Tooltip>
              </Box>
              {loadingStates.contributors ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                  <CircularProgress />
                </Box>
              ) : contributors.length > 0 ? (
                <Bar 
                  data={contributorChartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'top',
                      },
                    },
                  }}
                />
              ) : (
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ 
                    textAlign: 'center', 
                    py: { xs: 2, sm: 3, md: 4 },
                    fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.875rem' }
                  }}
                >
                  No contributor data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Analysis Progress Dialog */}
      <AnalysisProgressDialog
        open={analysisProgress.open}
        repositoryName={analysisProgress.repositoryName}
        repositoryId={analysisProgress.repositoryId}
        onClose={() => setAnalysisProgress({ open: false, repositoryName: '', repositoryId: null })}
        onComplete={handleAnalysisComplete}
      />
    </div>
  );
};

export default Dashboard;
