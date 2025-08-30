import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from './Dashboard';

// Mock Chart.js
jest.mock('react-chartjs-2', () => ({
  Line: ({ data, options }) => (
    <div data-testid="line-chart">
      Line Chart: {data.datasets[0]?.label || 'No data'}
    </div>
  ),
  Bar: ({ data, options }) => (
    <div data-testid="bar-chart">
      Bar Chart: {data.datasets[0]?.label || 'No data'}
    </div>
  ),
  Doughnut: ({ data, options }) => (
    <div data-testid="doughnut-chart">
      Doughnut Chart: {data.labels?.join(', ') || 'No data'}
    </div>
  )
}));

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    disconnect: jest.fn()
  }))
}));

const mockRepository = {
  id: 1,
  name: 'Test Repository',
  path: '/path/to/repo',
  last_analyzed: '2024-01-01T00:00:00Z'
};

const mockMetricsData = {
  commit_velocity: 2.5,
  code_churn: {
    lines_added: 1000,
    lines_deleted: 200,
    churn_ratio: 5.0
  },
  test_coverage: {
    test_files: 10,
    production_files: 40,
    test_ratio: 0.2
  },
  contributors: [
    {
      contributor_id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'Developer',
      team: 'Backend',
      commit_count: 25,
      lines_added: 500,
      lines_deleted: 100,
      velocity: 0.83
    }
  ],
  commit_types: {
    feat: 15,
    fix: 8,
    docs: 3,
    refactor: 2
  },
  daily_activity: [
    {
      date: '2024-01-01',
      commit_count: 5,
      lines_added: 100,
      lines_deleted: 20
    },
    {
      date: '2024-01-02',
      commit_count: 3,
      lines_added: 50,
      lines_deleted: 10
    }
  ],
  team_comparison: [
    {
      team: 'Backend',
      total_commits: 50,
      total_lines_added: 2000,
      total_lines_deleted: 400,
      team_size: 3,
      avg_commits_per_member: 16.67
    }
  ]
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('renders dashboard with repository name', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMetricsData
    });

    render(<Dashboard repository={mockRepository} />);
    
    expect(screen.getByText('Test Repository Analytics')).toBeInTheDocument();
    expect(screen.getByText('30 Days')).toBeInTheDocument();
  });

  test('displays loading state initially', () => {
    fetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<Dashboard repository={mockRepository} />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('displays metrics cards with data', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMetricsData
    });

    render(<Dashboard repository={mockRepository} />);
    
    await waitFor(() => {
      expect(screen.getByText('2.5')).toBeInTheDocument(); // Commit velocity
      expect(screen.getByText('5.0')).toBeInTheDocument(); // Churn ratio
      expect(screen.getByText('20%')).toBeInTheDocument(); // Test coverage
    });

    expect(screen.getByText('Commits/Day')).toBeInTheDocument();
    expect(screen.getByText('Churn Ratio')).toBeInTheDocument();
    expect(screen.getByText('Test Coverage')).toBeInTheDocument();
  });

  test('displays contributors table', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMetricsData
    });

    render(<Dashboard repository={mockRepository} />);
    
    await waitFor(() => {
      expect(screen.getByText('Top Contributors')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('Backend')).toBeInTheDocument();
    });
  });

  test('displays charts', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMetricsData
    });

    render(<Dashboard repository={mockRepository} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
    });
  });

  test('handles time period change', async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockMetricsData
    });

    render(<Dashboard repository={mockRepository} />);
    
    await waitFor(() => {
      expect(screen.getByText('30 Days')).toBeInTheDocument();
    });

    // Change to 7 days
    const periodSelect = screen.getByDisplayValue('30 Days');
    await user.click(periodSelect);
    await user.click(screen.getByText('7 Days'));
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('days=7'),
        expect.any(Object)
      );
    });
  });

  test('handles lifetime period selection', async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockMetricsData
    });

    render(<Dashboard repository={mockRepository} />);
    
    await waitFor(() => {
      expect(screen.getByText('30 Days')).toBeInTheDocument();
    });

    // Change to Lifetime
    const periodSelect = screen.getByDisplayValue('30 Days');
    await user.click(periodSelect);
    await user.click(screen.getByText('Lifetime'));
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('days=0'),
        expect.any(Object)
      );
    });
  });

  test('handles API error', async () => {
    fetch.mockRejectedValueOnce(new Error('Failed to fetch metrics'));

    render(<Dashboard repository={mockRepository} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch metrics')).toBeInTheDocument();
    });
  });

  test('displays empty state for no data', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        commit_velocity: 0,
        code_churn: { lines_added: 0, lines_deleted: 0, churn_ratio: 0 },
        test_coverage: { test_files: 0, production_files: 0, test_ratio: 0 },
        contributors: [],
        commit_types: {},
        daily_activity: [],
        team_comparison: []
      })
    });

    render(<Dashboard repository={mockRepository} />);
    
    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument(); // Velocity
      expect(screen.getByText('0%')).toBeInTheDocument(); // Test coverage
    });
  });

  test('formats large numbers correctly', async () => {
    const largeNumbersData = {
      ...mockMetricsData,
      code_churn: {
        lines_added: 10000,
        lines_deleted: 2000,
        churn_ratio: 5.0
      }
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => largeNumbersData
    });

    render(<Dashboard repository={mockRepository} />);
    
    await waitFor(() => {
      expect(screen.getByText('10,000')).toBeInTheDocument(); // Lines added
      expect(screen.getByText('2,000')).toBeInTheDocument(); // Lines deleted
    });
  });

  test('handles mobile responsive layout', async () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 400,
    });

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMetricsData
    });

    render(<Dashboard repository={mockRepository} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Repository Analytics')).toBeInTheDocument();
    });

    // Should still render all components in mobile layout
    expect(screen.getByText('Top Contributors')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  test('updates data when repository changes', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockMetricsData
    });

    const { rerender } = render(<Dashboard repository={mockRepository} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Repository Analytics')).toBeInTheDocument();
    });

    // Change repository
    const newRepository = { ...mockRepository, id: 2, name: 'New Repository' };
    rerender(<Dashboard repository={newRepository} />);
    
    await waitFor(() => {
      expect(screen.getByText('New Repository Analytics')).toBeInTheDocument();
    });

    // Should have made new API call
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('repository_id=2'),
      expect.any(Object)
    );
  });

  test('displays commit type distribution correctly', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMetricsData
    });

    render(<Dashboard repository={mockRepository} />);
    
    await waitFor(() => {
      expect(screen.getByText('Commit Types')).toBeInTheDocument();
      expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
    });
  });

  test('shows team comparison when available', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMetricsData
    });

    render(<Dashboard repository={mockRepository} />);
    
    await waitFor(() => {
      expect(screen.getByText('Team Performance')).toBeInTheDocument();
      expect(screen.getByText('Backend')).toBeInTheDocument();
    });
  });
});
