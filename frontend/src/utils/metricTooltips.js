// Metric tooltip definitions for CodeTide analytics
export const metricTooltips = {
  // Dashboard metrics
  'commits_per_day': {
    title: 'Commits per Day (Velocity)',
    description: 'Average number of commits made per day over the selected time period. This metric indicates the development pace and team activity level.'
  },
  'code_churn_ratio': {
    title: 'Code Churn Ratio',
    description: 'Ratio of lines deleted to lines added. A higher ratio may indicate refactoring, bug fixes, or code cleanup activities. Values above 1.0 suggest more deletion than addition.'
  },
  'test_file_ratio': {
    title: 'Test File Ratio',
    description: 'Percentage of files in the repository that are test files. Higher ratios indicate better test coverage and commitment to quality assurance practices.'
  },
  'active_contributors': {
    title: 'Active Contributors',
    description: 'Number of unique developers who have made commits during the selected time period. Indicates team size and collaboration level.'
  },
  'daily_activity': {
    title: 'Daily Activity',
    description: 'Timeline showing commit count and lines added per day. Helps identify development patterns, sprint cycles, and team productivity trends.'
  },
  'commit_types': {
    title: 'Commit Types Distribution',
    description: 'Breakdown of commits by type (feat, fix, docs, etc.). Based on conventional commit patterns, this shows the nature of development work.'
  },
  'top_contributors': {
    title: 'Top Contributors',
    description: 'Ranking of developers by total commit count during the selected period. Shows individual contribution levels and team dynamics.'
  },

  // Committer Analysis metrics
  'total_commits': {
    title: 'Total Commits',
    description: 'Total number of commits made by this contributor during the selected time period. Primary indicator of contribution volume.'
  },
  'commit_velocity': {
    title: 'Commit Velocity',
    description: 'Average commits per day for this contributor. Calculated as total commits divided by the number of active days in the period.'
  },
  'lines_added': {
    title: 'Lines Added',
    description: 'Total number of code lines added by this contributor. Indicates the volume of new code contribution and feature development.'
  },
  'lines_deleted': {
    title: 'Lines Deleted',
    description: 'Total number of code lines removed by this contributor. May indicate refactoring, bug fixes, code cleanup, or feature removal.'
  },
  'files_modified': {
    title: 'Files Modified',
    description: 'Total number of unique files changed by this contributor. Shows the breadth of their contribution across the codebase.'
  },
  'avg_files_per_commit': {
    title: 'Average Files per Commit',
    description: 'Average number of files changed in each commit. Lower values may indicate more focused, atomic commits; higher values may suggest larger feature implementations.'
  },
  'activity_timeline': {
    title: 'Activity Timeline',
    description: 'Chronological view of commit activity showing patterns, consistency, and productivity trends over time for this contributor.'
  },
  'contributor_commit_types': {
    title: 'Contributor Commit Types',
    description: 'Distribution of commit types for this specific contributor, showing their focus areas (features, fixes, documentation, etc.).'
  }
};

// Helper function to get tooltip content
export const getTooltipContent = (metricKey) => {
  return metricTooltips[metricKey] || {
    title: 'Metric Information',
    description: 'No description available for this metric.'
  };
};
