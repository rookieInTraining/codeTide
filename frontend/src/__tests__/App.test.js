import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Mock the child components
jest.mock('./components/Dashboard', () => {
  return function MockDashboard({ repository }) {
    return <div data-testid="dashboard">Dashboard for {repository?.name}</div>;
  };
});

jest.mock('./components/RepositoryManager', () => {
  return function MockRepositoryManager({ repositories, onRepoAdded }) {
    return (
      <div data-testid="repository-manager">
        <button onClick={onRepoAdded}>Add Repository</button>
        Repository Manager - {repositories.length} repos
      </div>
    );
  };
});

jest.mock('./components/Logo', () => {
  return function MockLogo() {
    return <div data-testid="logo">Logo</div>;
  };
});

const mockRepositories = [
  {
    id: 1,
    name: 'Test Repo 1',
    last_analyzed: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    name: 'Test Repo 2',
    last_analyzed: null
  }
];

const renderApp = () => {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

describe('App Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('renders loading state initially', () => {
    fetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    renderApp();
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders app with repositories', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRepositories
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText('CodeTide - Developer & Tester Analytics')).toBeInTheDocument();
    });

    expect(screen.getByTestId('logo')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Repositories')).toBeInTheDocument();
  });

  test('renders empty state when no repositories', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText('No Repositories Available')).toBeInTheDocument();
    });

    expect(screen.getByText('Add a repository to start tracking commits and analyzing developer metrics.')).toBeInTheDocument();
  });

  test('handles fetch error', async () => {
    fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

    renderApp();

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
    });
  });

  test('repository selection works', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRepositories
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Repo 1')).toBeInTheDocument();
    });

    // Change repository selection
    const select = screen.getByDisplayValue('Test Repo 1');
    fireEvent.change(select, { target: { value: '2' } });

    expect(screen.getByDisplayValue('Test Repo 2')).toBeInTheDocument();
  });

  test('displays last analyzed date correctly', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRepositories
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/Last analyzed:/)).toBeInTheDocument();
    });
  });

  test('mobile navigation shows abbreviated text', async () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 400,
    });

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRepositories
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText('CodeTide')).toBeInTheDocument();
    });
  });

  test('navigation links work', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRepositories
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    const repoLink = screen.getByText('Repositories');
    expect(repoLink.closest('a')).toHaveAttribute('href', '/repositories');
  });
});
