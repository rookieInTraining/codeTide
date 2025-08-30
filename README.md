# CodeTide - Developer & Tester Analytics

A comprehensive application for measuring and analyzing commits made by developers and testers in software projects.

## Features

- **Multi-dimensional Analytics**: Track commits across people, time, code, and commit characteristics
- **Real-time Dashboard**: Interactive visualizations with live data updates
- **Team Performance Metrics**: Individual and team productivity insights
- **Code Quality Tracking**: Test coverage, review metrics, and technical debt analysis
- **Advanced Visualizations**: Heatmaps, network graphs, and trend analysis

## Architecture

- **Backend**: Python Flask API with SQLite database
- **Frontend**: React with Chart.js for visualizations
- **Git Integration**: GitPython for repository analysis
- **Real-time Updates**: WebSocket support for live data

## Quick Start with Conda

### Prerequisites
- Conda (Anaconda or Miniconda)
- Node.js and npm
- Git

### Backend Setup (Conda)
```bash
# Create and activate conda environment
conda env create -f backend/environment.yml
conda activate commit-tracker

# Create sample data
cd backend
python sample_data.py

# Start backend server
python app.py
```

### Frontend Setup
```bash
# In a new terminal
cd frontend
npm install
npm start
```

### Alternative: One-click Setup
```bash
# Windows with conda
start_conda.bat

# Windows with pip
start_demo.bat
```

## Manual Setup Steps

### 1. Backend Environment
```bash
# Create conda environment
conda create -n commit-tracker python=3.9
conda activate commit-tracker

# Install dependencies
cd backend
pip install -r requirements.txt

# Or use conda environment file
conda env create -f environment.yml
conda activate commit-tracker
```

### 2. Initialize Database
```bash
cd backend
python sample_data.py  # Creates sample data
# OR analyze your own repository after starting the server
```

### 3. Start Backend Server
```bash
python app.py
# Server runs at http://localhost:5000
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm start
# Dashboard opens at http://localhost:3000
```

## Add Repository for Analysis

### Via Web Interface
1. Go to **Repositories** tab
2. Click **Add Repository**
3. Enter repository path and name
4. Click **Analyze** to process commits

### Via API
```bash
curl -X POST http://localhost:5000/api/repositories \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/your/git/repo", "name": "My Project"}'
```

## API Endpoints

- `GET /api/metrics/commits` - Get commit statistics
- `GET /api/metrics/contributors` - Get contributor analytics
- `GET /api/charts/velocity` - Get velocity chart data
- `POST /api/repositories` - Add repository for tracking

## Dashboard Views

1. **Executive Summary** - High-level KPIs and trends
2. **Team Performance** - Detailed team and individual metrics
3. **Code Quality** - Test coverage and review metrics
4. **Productivity Insights** - Efficiency patterns and recommendations

## Environment Management

### Conda Commands
```bash
# Create environment from file
conda env create -f backend/environment.yml

# Activate environment
conda activate commit-tracker

# Update environment
conda env update -f backend/environment.yml

# Remove environment
conda env remove -n commit-tracker
```

### Dependencies
- Python 3.9+
- Flask 2.3.3
- GitPython 3.1.37
- SQLAlchemy 2.0.23
- React 18.2.0
- Chart.js 4.4.0
- Material-UI 5.14.0
