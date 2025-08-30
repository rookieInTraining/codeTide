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
  MenuItem
} from '@mui/material';
import AnalysisProgressDialog from './AnalysisProgressDialog';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
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
  Tooltip,
  Legend,
  ArcElement
);

const Dashboard = ({ repository }) => {
  const [metrics, setMetrics] = useState({});
  const [contributors, setContributors] = useState([]);
  const [dailyActivity, setDailyActivity] = useState([]);
  const [commitTypes, setCommitTypes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timePeriod, setTimePeriod] = useState(30);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ open: false, repositoryName: '', repositoryId: null });

  useEffect(() => {
    if (repository) {
      fetchAllData();
    }
  }, [repository, timePeriod]);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchMetrics(),
        fetchContributors(),
        fetchDailyActivity(),
        fetchCommitTypes()
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    const [velocityRes, churnRes, testCoverageRes] = await Promise.all([
      fetch(`http://localhost:5000/api/metrics/velocity?repository_id=${repository.id}&days=${timePeriod}`),
      fetch(`http://localhost:5000/api/metrics/churn?repository_id=${repository.id}&days=${timePeriod}`),
      fetch(`http://localhost:5000/api/metrics/test-coverage?repository_id=${repository.id}&days=${timePeriod}`)
    ]);

    const velocity = await velocityRes.json();
    const churn = await churnRes.json();
    const testCoverage = await testCoverageRes.json();

    setMetrics({ velocity, churn, testCoverage });
  };

  const fetchContributors = async () => {
    const response = await fetch(`http://localhost:5000/api/metrics/contributors?repository_id=${repository.id}&days=${timePeriod}`);
    const data = await response.json();
    setContributors(data);
  };

  const fetchDailyActivity = async () => {
    const response = await fetch(`http://localhost:5000/api/charts/daily-activity?repository_id=${repository.id}&days=${timePeriod}`);
    const data = await response.json();
    setDailyActivity(data);
  };

  const fetchCommitTypes = async () => {
    const response = await fetch(`http://localhost:5000/api/charts/commit-types?repository_id=${repository.id}&days=${timePeriod}`);
    const data = await response.json();
    setCommitTypes(data);
  };

  const analyzeRepository = async () => {
    setAnalysisProgress({ 
      open: true, 
      repositoryName: repository.name, 
      repositoryId: repository.id 
    });
  };

  const handleAnalysisComplete = (success, commitsProcessed) => {
    setAnalysisProgress({ open: false, repositoryName: '', repositoryId: null });
    
    if (success) {
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

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Time Period</InputLabel>
            <Select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value)}
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
        <Grid item xs={12} sm={6}>
          <Button
            variant="contained"
            onClick={analyzeRepository}
            disabled={analysisProgress.open}
            fullWidth
          >
            {analysisProgress.open ? <CircularProgress size={24} /> : 'Analyze Repository'}
          </Button>
        </Grid>
      </Grid>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {metrics.velocity?.velocity?.toFixed(2) || '0'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Commits/Day
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {metrics.churn?.churn_ratio?.toFixed(1) || '0'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Code Churn Ratio
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {(metrics.testCoverage?.test_ratio * 100)?.toFixed(1) || '0'}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Test File Ratio
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {contributors.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Contributors
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Daily Activity
              </Typography>
              {dailyActivity.length > 0 ? (
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
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No activity data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Commit Types
              </Typography>
              {Object.keys(commitTypes).length > 0 ? (
                <Doughnut data={commitTypesChartData} />
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No commit type data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Contributors
              </Typography>
              {contributors.length > 0 ? (
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
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
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
