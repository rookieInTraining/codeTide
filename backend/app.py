from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
import os
from models import create_database, Repository, Contributor, Commit, CommitFile, MetricSnapshot
from git_analyzer import GitAnalyzer
from metrics_calculator import MetricsCalculator
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'commit-tracker-secret-key'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize database
engine, Session = create_database()
session = Session()

# Initialize analyzers
git_analyzer = GitAnalyzer(session, socketio)
metrics_calculator = MetricsCalculator(session)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()})

@app.route('/api/repositories', methods=['GET'])
def get_repositories():
    """Get all repositories"""
    repos = session.query(Repository).filter_by(is_active=True).all()
    return jsonify([{
        'id': repo.id,
        'name': repo.name,
        'path': repo.path,
        'url': repo.url,
        'created_at': repo.created_at.isoformat() if repo.created_at else None,
        'last_analyzed': repo.last_analyzed.isoformat() if repo.last_analyzed else None
    } for repo in repos])

@app.route('/api/repositories', methods=['POST'])
def add_repository():
    """Add a new repository for tracking"""
    data = request.get_json()
    
    if not data or 'name' not in data:
        return jsonify({'error': 'Repository name is required'}), 400
    
    # Check if repository already exists by name
    existing = session.query(Repository).filter_by(name=data['name']).first()
    if existing:
        return jsonify({'error': 'Repository with this name already exists'}), 409
    
    # Handle different scenarios: local path vs git URL
    local_path = data.get('path', '')
    git_url = data.get('url', '')
    clone_to_path = data.get('clone_to_path', '')
    
    final_path = local_path
    
    # Scenario 1: Local path provided and exists
    if local_path and os.path.exists(local_path) and os.path.exists(os.path.join(local_path, '.git')):
        final_path = local_path
    
    # Scenario 2: Git URL provided, need to clone
    elif git_url:
        # Validate git URL
        is_valid, validation_msg = git_analyzer.validate_git_url(git_url)
        if not is_valid:
            return jsonify({'error': f'Invalid git URL: {validation_msg}'}), 400
        
        # Determine clone destination
        if clone_to_path:
            final_path = clone_to_path
        else:
            # Default clone location
            repo_name = data['name'].replace(' ', '_').lower()
            final_path = os.path.join(os.getcwd(), 'repositories', repo_name)
        
        # Check if destination already exists as a repository
        if os.path.exists(final_path):
            existing_by_path = session.query(Repository).filter_by(path=final_path).first()
            if existing_by_path:
                return jsonify({'error': 'A repository already exists at this path'}), 409
        
        # Create repository record first (before cloning)
        repo = Repository(
            name=data['name'],
            path=final_path,
            url=git_url
        )
        session.add(repo)
        session.commit()
        
        # Start async clone operation
        clone_thread = git_analyzer.clone_repository_async(git_url, final_path)
        
        # Return immediately with clone started status
        return jsonify({
            'id': repo.id,
            'message': 'Clone operation started',
            'cloning': True,
            'clone_path': final_path
        }), 202
    
    # Scenario 3: Local path provided but doesn't exist
    elif local_path:
        return jsonify({'error': 'Local repository path does not exist or is not a valid git repository'}), 400
    
    else:
        return jsonify({'error': 'Either a valid local path or git URL must be provided'}), 400
    
    # Final validation of the repository (for local repos only)
    if not os.path.exists(final_path) or not os.path.exists(os.path.join(final_path, '.git')):
        return jsonify({'error': 'Final repository path is not a valid git repository'}), 400
    
    # Create repository record (for local repos)
    repo = Repository(
        name=data['name'],
        path=final_path,
        url=''
    )
    
    session.add(repo)
    session.commit()
    
    return jsonify({
        'id': repo.id,
        'name': repo.name,
        'path': repo.path,
        'url': repo.url,
        'message': 'Repository added successfully',
        'cloned': False
    }), 201

@app.route('/api/repositories/<int:repo_id>/analyze', methods=['POST'])
def analyze_repository(repo_id):
    """Analyze repository and extract commit data"""
    repo = session.query(Repository).get(repo_id)
    if not repo:
        return jsonify({'error': 'Repository not found'}), 404
    
    try:
        commits_processed = git_analyzer.analyze_repository(repo.path, repo_id)
        
        # Update last analyzed timestamp
        repo.last_analyzed = datetime.utcnow()
        session.commit()
        
        return jsonify({
            'message': f'Analysis complete. Processed {commits_processed} commits.',
            'commits_processed': commits_processed
        })
    
    except Exception as e:
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500

@app.route('/api/repositories/<int:repo_id>/pull', methods=['POST'])
def pull_repository(repo_id):
    repo = session.query(Repository).get(repo_id)
    if not repo:
        return jsonify({'error': 'Repository not found'}), 404
    
    try:
        # Initialize analyzer with socketio for progress tracking
        analyzer = GitAnalyzer(session, socketio)
        
        # Pull latest changes
        success, message, commits_pulled = analyzer.pull_repository(repo.path)
        
        if success:
            return jsonify({
                'message': message,
                'commits_pulled': commits_pulled,
                'repository': {
                    'id': repo.id,
                    'name': repo.name,
                    'path': repo.path
                }
            })
        else:
            return jsonify({'error': message}), 400
            
    except Exception as e:
        return jsonify({'error': f'Failed to pull repository: {str(e)}'}), 500

@app.route('/api/repositories/<int:repo_id>', methods=['DELETE'])
def delete_repository(repo_id):
    repo = session.query(Repository).get(repo_id)
    if not repo:
        return jsonify({'error': 'Repository not found'}), 404
    
    try:
        # Delete associated commit files first
        commit_ids = session.query(Commit.id).filter_by(repository_id=repo_id).all()
        commit_ids = [c.id for c in commit_ids]
        
        if commit_ids:
            session.query(CommitFile).filter(CommitFile.commit_id.in_(commit_ids)).delete(synchronize_session=False)
        
        # Delete commits
        session.query(Commit).filter_by(repository_id=repo_id).delete()
        
        # Delete metric snapshots
        session.query(MetricSnapshot).filter_by(repository_id=repo_id).delete()
        
        # Delete repository
        session.delete(repo)
        session.commit()
        
        return jsonify({
            'message': f'Repository "{repo.name}" and all associated data deleted successfully'
        })
    except Exception as e:
        session.rollback()
        return jsonify({'error': f'Failed to delete repository: {str(e)}'}), 500

@app.route('/api/metrics/velocity', methods=['GET'])
def get_velocity_metrics():
    """Get commit velocity metrics"""
    repo_id = request.args.get('repository_id', type=int)
    days = request.args.get('days', 30, type=int)
    contributor_id = request.args.get('contributor_id', type=int)
    
    if not repo_id:
        return jsonify({'error': 'repository_id is required'}), 400
    
    velocity = metrics_calculator.get_commit_velocity(repo_id, days, contributor_id)
    return jsonify({'velocity': velocity, 'period_days': days})

@app.route('/api/metrics/churn', methods=['GET'])
def get_churn_metrics():
    """Get code churn metrics"""
    repo_id = request.args.get('repository_id', type=int)
    days = request.args.get('days', 30, type=int)
    contributor_id = request.args.get('contributor_id', type=int)
    
    if not repo_id:
        return jsonify({'error': 'repository_id is required'}), 400
    
    churn = metrics_calculator.get_code_churn(repo_id, days, contributor_id)
    return jsonify(churn)

@app.route('/api/metrics/test-coverage', methods=['GET'])
def get_test_coverage_metrics():
    """Get test coverage impact metrics"""
    repo_id = request.args.get('repository_id', type=int)
    days = request.args.get('days', 30, type=int)
    contributor_id = request.args.get('contributor_id', type=int)
    
    if not repo_id:
        return jsonify({'error': 'repository_id is required'}), 400
    
    coverage = metrics_calculator.get_test_coverage_impact(repo_id, days, contributor_id)
    return jsonify(coverage)

@app.route('/api/metrics/contributors', methods=['GET'])
def get_contributor_metrics():
    """Get contributor statistics"""
    repo_id = request.args.get('repository_id', type=int)
    days = request.args.get('days', 30, type=int)
    
    if not repo_id:
        return jsonify({'error': 'repository_id is required'}), 400
    
    stats = metrics_calculator.get_contributor_stats(repo_id, days)
    return jsonify(stats)

@app.route('/api/charts/daily-activity', methods=['GET'])
def get_daily_activity_chart():
    """Get daily activity data for charts"""
    repo_id = request.args.get('repository_id', type=int)
    days = request.args.get('days', 30, type=int)
    
    if not repo_id:
        return jsonify({'error': 'repository_id is required'}), 400
    
    activity = metrics_calculator.get_daily_activity(repo_id, days)
    return jsonify(activity)

@app.route('/api/charts/commit-types', methods=['GET'])
def get_commit_types_chart():
    """Get commit type distribution for charts"""
    repo_id = request.args.get('repository_id', type=int)
    days = request.args.get('days', 30, type=int)
    
    if not repo_id:
        return jsonify({'error': 'repository_id is required'}), 400
    
    distribution = metrics_calculator.get_commit_type_distribution(repo_id, days)
    return jsonify(distribution)

@app.route('/api/charts/team-comparison', methods=['GET'])
def get_team_comparison_chart():
    """Get team comparison data for charts"""
    repo_id = request.args.get('repository_id', type=int)
    days = request.args.get('days', 30, type=int)
    
    if not repo_id:
        return jsonify({'error': 'repository_id is required'}), 400
    
    comparison = metrics_calculator.get_team_comparison(repo_id, days)
    return jsonify(comparison)

@app.route('/api/contributors/<int:contributor_id>', methods=['PUT'])
def update_contributor(contributor_id):
    """Update contributor information"""
    data = request.get_json()
    contributor = session.query(Contributor).get(contributor_id)
    
    if not contributor:
        return jsonify({'error': 'Contributor not found'}), 404
    
    # Update fields if provided
    if 'role' in data:
        contributor.role = data['role']
    if 'team' in data:
        contributor.team = data['team']
    if 'experience_level' in data:
        contributor.experience_level = data['experience_level']
    
    session.commit()
    
    return jsonify({
        'id': contributor.id,
        'name': contributor.name,
        'email': contributor.email,
        'role': contributor.role,
        'team': contributor.team,
        'experience_level': contributor.experience_level
    })

@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    print("Starting CodeTide API...")
    print("API will be available at http://localhost:5000")
    print("\nAvailable endpoints:")
    print("- GET  /api/health")
    print("- GET  /api/repositories")
    print("- POST /api/repositories")
    print("- POST /api/repositories/<id>/analyze")
    print("- GET  /api/metrics/velocity")
    print("- GET  /api/metrics/churn")
    print("- GET  /api/metrics/contributors")
    print("- GET  /api/charts/daily-activity")
    print("- GET  /api/charts/commit-types")
    
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
