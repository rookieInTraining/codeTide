import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RepositoryManager from './RepositoryManager';

// Mock child components
jest.mock('./CloneProgressDialog', () => {
  return function MockCloneProgressDialog({ open, onComplete }) {
    return open ? (
      <div data-testid="clone-progress-dialog">
        <button onClick={() => onComplete(true)}>Complete Clone</button>
      </div>
    ) : null;
  };
});

jest.mock('./DeleteConfirmDialog', () => {
  return function MockDeleteConfirmDialog({ open, onConfirm, onClose }) {
    return open ? (
      <div data-testid="delete-confirm-dialog">
        <button onClick={onConfirm}>Confirm Delete</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null;
  };
});

jest.mock('./PullProgressDialog', () => {
  return function MockPullProgressDialog({ open, onComplete }) {
    return open ? (
      <div data-testid="pull-progress-dialog">
        <button onClick={() => onComplete(true, 5)}>Complete Pull</button>
      </div>
    ) : null;
  };
});

jest.mock('./AnalysisProgressDialog', () => {
  return function MockAnalysisProgressDialog({ open, onComplete }) {
    return open ? (
      <div data-testid="analysis-progress-dialog">
        <button onClick={() => onComplete(true, 100)}>Complete Analysis</button>
      </div>
    ) : null;
  };
});

const mockRepositories = [
  {
    id: 1,
    name: 'Test Repo 1',
    path: '/path/to/repo1',
    url: 'https://github.com/test/repo1.git',
    last_analyzed: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    name: 'Test Repo 2',
    path: '/path/to/repo2',
    url: null,
    last_analyzed: null
  }
];

describe('RepositoryManager Component', () => {
  const mockOnRepoAdded = jest.fn();

  beforeEach(() => {
    fetch.mockClear();
    mockOnRepoAdded.mockClear();
  });

  test('renders repository manager with title', () => {
    render(<RepositoryManager repositories={[]} onRepoAdded={mockOnRepoAdded} />);
    
    expect(screen.getByText('Repository Management')).toBeInTheDocument();
    expect(screen.getByText('Add Repository')).toBeInTheDocument();
  });

  test('renders empty state when no repositories', () => {
    render(<RepositoryManager repositories={[]} onRepoAdded={mockOnRepoAdded} />);
    
    expect(screen.getByText('No repositories added yet. Click "Add Repository" to get started.')).toBeInTheDocument();
  });

  test('renders repositories in mobile card layout', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query.includes('(max-width: 768px)'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<RepositoryManager repositories={mockRepositories} onRepoAdded={mockOnRepoAdded} />);
    
    expect(screen.getByText('Test Repo 1')).toBeInTheDocument();
    expect(screen.getByText('Test Repo 2')).toBeInTheDocument();
  });

  test('opens add repository dialog', async () => {
    const user = userEvent.setup();
    render(<RepositoryManager repositories={[]} onRepoAdded={mockOnRepoAdded} />);
    
    const addButton = screen.getByText('Add Repository');
    await user.click(addButton);
    
    expect(screen.getByText('Add New Repository')).toBeInTheDocument();
    expect(screen.getByLabelText('Repository Name')).toBeInTheDocument();
  });

  test('submits local repository form', async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Test Repo', cloning: false })
    });

    render(<RepositoryManager repositories={[]} onRepoAdded={mockOnRepoAdded} />);
    
    // Open dialog
    await user.click(screen.getByText('Add Repository'));
    
    // Fill form
    await user.type(screen.getByLabelText('Repository Name'), 'Test Repo');
    await user.type(screen.getByLabelText('Local Path'), '/path/to/repo');
    
    // Submit
    await user.click(screen.getByRole('button', { name: /add repository/i }));
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Repo',
          path: '/path/to/repo'
        })
      });
    });
  });

  test('submits remote repository form', async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Test Repo', cloning: true })
    });

    render(<RepositoryManager repositories={[]} onRepoAdded={mockOnRepoAdded} />);
    
    // Open dialog
    await user.click(screen.getByText('Add Repository'));
    
    // Switch to remote
    await user.click(screen.getByLabelText('Clone from URL'));
    
    // Fill form
    await user.type(screen.getByLabelText('Repository Name'), 'Test Repo');
    await user.type(screen.getByLabelText('Git Repository URL'), 'https://github.com/test/repo.git');
    
    // Submit
    await user.click(screen.getByRole('button', { name: /clone & add repository/i }));
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Repo',
          url: 'https://github.com/test/repo.git'
        })
      });
    });
  });

  test('handles form validation errors', async () => {
    const user = userEvent.setup();
    render(<RepositoryManager repositories={[]} onRepoAdded={mockOnRepoAdded} />);
    
    // Open dialog and try to submit without required fields
    await user.click(screen.getByText('Add Repository'));
    await user.click(screen.getByRole('button', { name: /add repository/i }));
    
    expect(screen.getByText('Repository name is required')).toBeInTheDocument();
  });

  test('handles API errors', async () => {
    const user = userEvent.setup();
    fetch.mockRejectedValueOnce(new Error('API Error'));

    render(<RepositoryManager repositories={[]} onRepoAdded={mockOnRepoAdded} />);
    
    await user.click(screen.getByText('Add Repository'));
    await user.type(screen.getByLabelText('Repository Name'), 'Test Repo');
    await user.type(screen.getByLabelText('Local Path'), '/path/to/repo');
    await user.click(screen.getByRole('button', { name: /add repository/i }));
    
    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  test('handles analyze button click', async () => {
    const user = userEvent.setup();
    render(<RepositoryManager repositories={mockRepositories} onRepoAdded={mockOnRepoAdded} />);
    
    const analyzeButtons = screen.getAllByText('Analyze');
    await user.click(analyzeButtons[0]);
    
    expect(screen.getByTestId('analysis-progress-dialog')).toBeInTheDocument();
  });

  test('handles pull button click', async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    render(<RepositoryManager repositories={mockRepositories} onRepoAdded={mockOnRepoAdded} />);
    
    const pullButtons = screen.getAllByText('Pull');
    await user.click(pullButtons[0]);
    
    expect(screen.getByTestId('pull-progress-dialog')).toBeInTheDocument();
  });

  test('handles delete button click', async () => {
    const user = userEvent.setup();
    render(<RepositoryManager repositories={mockRepositories} onRepoAdded={mockOnRepoAdded} />);
    
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    
    expect(screen.getByTestId('delete-confirm-dialog')).toBeInTheDocument();
  });

  test('completes delete operation', async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Repository deleted successfully' })
    });

    render(<RepositoryManager repositories={mockRepositories} onRepoAdded={mockOnRepoAdded} />);
    
    // Open delete dialog
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    
    // Confirm delete
    await user.click(screen.getByText('Confirm Delete'));
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/repositories/1', {
        method: 'DELETE'
      });
    });
  });

  test('shows success message after operations', async () => {
    const user = userEvent.setup();
    render(<RepositoryManager repositories={[]} onRepoAdded={mockOnRepoAdded} />);
    
    // Simulate clone completion
    await user.click(screen.getByText('Add Repository'));
    await user.click(screen.getByLabelText('Clone from URL'));
    
    // Mock successful clone
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Test Repo', cloning: true })
    });
    
    await user.type(screen.getByLabelText('Repository Name'), 'Test Repo');
    await user.type(screen.getByLabelText('Git Repository URL'), 'https://github.com/test/repo.git');
    await user.click(screen.getByRole('button', { name: /clone & add repository/i }));
    
    await waitFor(() => {
      expect(screen.getByTestId('clone-progress-dialog')).toBeInTheDocument();
    });
  });
});
