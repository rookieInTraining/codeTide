import git
import os
import shutil
from datetime import datetime
from models import Commit, Contributor, CommitFile, Repository
from sqlalchemy.orm import sessionmaker
import re
import threading
from git.remote import RemoteProgress

class CloneProgress(RemoteProgress):
    def __init__(self, socketio=None):
        super().__init__()
        self.socketio = socketio
        self.current_stage = 'Initializing'
        
    def update(self, op_code, cur_count, max_count=None, message=''):
        print(f"Progress update: op_code={op_code}, cur_count={cur_count}, max_count={max_count}, message='{message}'")
        
        if self.socketio:
            # Determine the current stage
            stage_name = 'Processing'
            if op_code & self.COUNTING:
                stage_name = 'Counting objects'
            elif op_code & self.COMPRESSING:
                stage_name = 'Compressing objects'
            elif op_code & self.RECEIVING:
                stage_name = 'Receiving objects'
            elif op_code & self.RESOLVING:
                stage_name = 'Resolving deltas'
            elif op_code & self.CHECKING_OUT:
                stage_name = 'Checking out files'
            elif op_code & self.WRITING:
                stage_name = 'Writing objects'
            
            self.current_stage = stage_name
            
            # Calculate progress percentage
            progress = 20  # Default minimum progress
            if max_count and max_count > 0 and cur_count > 0:
                progress = min(95, max(20, int((cur_count / max_count) * 80) + 20))
            elif cur_count > 0:
                # If no max_count, use cur_count as indicator
                progress = min(80, 20 + (cur_count % 60))
            
            print(f"Emitting progress: stage={stage_name}, progress={progress}%")
            
            # Emit progress update
            self.socketio.emit('clone_progress', {
                'stage': stage_name,
                'progress': progress,
                'current': cur_count,
                'total': max_count,
                'message': message or stage_name
            })

class GitAnalyzer:
    def __init__(self, session, socketio=None):
        self.session = session
        self.socketio = socketio
        
    def classify_commit_type(self, message):
        """Classify commit type based on commit message"""
        message_lower = message.lower()
        
        if any(keyword in message_lower for keyword in ['test', 'spec', 'unit test', 'integration test']):
            return 'test'
        elif any(keyword in message_lower for keyword in ['fix', 'bug', 'hotfix', 'patch']):
            return 'bugfix'
        elif any(keyword in message_lower for keyword in ['refactor', 'cleanup', 'optimize']):
            return 'refactor'
        elif any(keyword in message_lower for keyword in ['doc', 'readme', 'comment']):
            return 'documentation'
        elif any(keyword in message_lower for keyword in ['feat', 'feature', 'add', 'implement']):
            return 'feature'
        else:
            return 'other'
    
    def is_test_file(self, file_path):
        """Determine if a file is a test file"""
        test_patterns = [
            r'\.test\.',
            r'\.spec\.',
            r'/test/',
            r'/tests/',
            r'_test\.',
            r'test_.*\.py$',
            r'.*Test\.java$',
            r'.*\.test\.js$',
            r'.*\.spec\.ts$'
        ]
        
        for pattern in test_patterns:
            if re.search(pattern, file_path, re.IGNORECASE):
                return True
        return False
    
    def get_file_type(self, file_path):
        """Extract file extension"""
        return os.path.splitext(file_path)[1]
    
    def get_or_create_contributor(self, name, email):
        """Get existing contributor or create new one"""
        contributor = self.session.query(Contributor).filter_by(email=email).first()
        if not contributor:
            contributor = Contributor(
                name=name,
                email=email,
                role='developer',  # Default role
                team='unknown',
                experience_level='unknown'
            )
            self.session.add(contributor)
            self.session.commit()
        return contributor
    
    def pull_repository(self, repo_path):
        """Pull latest changes from remote repository with progress tracking"""
        try:
            print(f"Starting pull operation for: {repo_path}")
            
            # Emit start event
            if self.socketio:
                print("Emitting pull_started event")
                self.socketio.emit('pull_started', {
                    'path': repo_path
                })
            
            # Check if directory exists and is a git repository
            if not os.path.exists(repo_path):
                raise Exception(f"Repository path does not exist: {repo_path}")
            
            if not os.path.exists(os.path.join(repo_path, '.git')):
                raise Exception(f"Not a git repository: {repo_path}")
            
            # Open the repository
            repo = git.Repo(repo_path)
            
            # Check if repository has a remote
            if not repo.remotes:
                raise Exception("Repository has no remote configured")
            
            origin = repo.remotes.origin
            
            # Emit progress update
            if self.socketio:
                self.socketio.emit('pull_progress', {
                    'stage': 'Fetching changes',
                    'progress': 25,
                    'message': 'Fetching latest changes from remote'
                })
            
            # Fetch latest changes
            print("Fetching from remote...")
            fetch_info = origin.fetch()
            
            # Emit progress update
            if self.socketio:
                self.socketio.emit('pull_progress', {
                    'stage': 'Checking for updates',
                    'progress': 50,
                    'message': 'Checking for new commits'
                })
            
            # Get current branch
            current_branch = repo.active_branch
            remote_branch = f"origin/{current_branch.name}"
            
            # Check if there are new commits
            commits_behind = list(repo.iter_commits(f'{current_branch.name}..{remote_branch}'))
            
            if not commits_behind:
                # No new commits
                if self.socketio:
                    self.socketio.emit('pull_completed', {
                        'success': True,
                        'message': 'Repository is already up to date',
                        'commits_pulled': 0
                    })
                return True, "Repository is already up to date", 0
            
            # Emit progress update
            if self.socketio:
                self.socketio.emit('pull_progress', {
                    'stage': 'Pulling changes',
                    'progress': 75,
                    'message': f'Pulling {len(commits_behind)} new commits'
                })
            
            # Pull the changes
            print(f"Pulling {len(commits_behind)} new commits...")
            pull_info = origin.pull()
            
            # Emit completion event
            if self.socketio:
                self.socketio.emit('pull_completed', {
                    'success': True,
                    'message': f'Successfully pulled {len(commits_behind)} new commits',
                    'commits_pulled': len(commits_behind)
                })
            
            print(f"Pull completed successfully. {len(commits_behind)} commits pulled.")
            return True, f"Successfully pulled {len(commits_behind)} new commits", len(commits_behind)
            
        except Exception as e:
            error_str = str(e)
            
            # Provide more user-friendly error messages for common issues
            if "Could not read from remote repository" in error_str:
                if "Permission denied" in error_str or "publickey" in error_str:
                    error_msg = "Authentication failed. Please check your SSH keys or use HTTPS with credentials."
                elif "Network is unreachable" in error_str or "Connection refused" in error_str:
                    error_msg = "Network connection failed. Please check your internet connection and try again."
                else:
                    error_msg = "Cannot access remote repository. This may be due to authentication issues, network problems, or the repository may have been moved/deleted."
            elif "not a git repository" in error_str.lower():
                error_msg = "The specified path is not a valid git repository."
            elif "no such remote" in error_str.lower():
                error_msg = "Remote 'origin' not found. This repository may not have a remote configured."
            elif "merge conflict" in error_str.lower():
                error_msg = "Pull failed due to merge conflicts. Please resolve conflicts manually using git."
            elif "working tree is dirty" in error_str.lower():
                error_msg = "Pull failed because there are uncommitted changes. Please commit or stash your changes first."
            else:
                error_msg = f"Pull failed: {error_str}"
            
            print(f"Pull error: {error_msg}")
            
            if self.socketio:
                self.socketio.emit('pull_completed', {
                    'success': False,
                    'error': error_msg
                })
            
            return False, error_msg, 0

    def clone_repository(self, git_url, local_path):
        """Clone a git repository from remote URL to local path with progress tracking"""
        try:
            print(f"Starting clone operation: {git_url} -> {local_path}")
            
            # Emit start event
            if self.socketio:
                print("Emitting clone_started event")
                self.socketio.emit('clone_started', {
                    'url': git_url,
                    'path': local_path
                })
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            
            # Remove existing directory if it exists
            if os.path.exists(local_path):
                print("Cleaning existing directory")
                if self.socketio:
                    self.socketio.emit('clone_progress', {
                        'stage': 'Cleaning existing directory',
                        'progress': 10,
                        'message': 'Removing existing files'
                    })
                shutil.rmtree(local_path)
            
            # Create progress tracker
            progress = CloneProgress(self.socketio) if self.socketio else None
            print(f"Created progress tracker: {progress is not None}")
            
            # Clone the repository with progress tracking
            print("Starting git clone...")
            repo = git.Repo.clone_from(git_url, local_path, progress=progress)
            print("Git clone completed successfully")
            
            # Emit completion
            if self.socketio:
                print("Emitting clone_completed event (success)")
                self.socketio.emit('clone_completed', {
                    'success': True,
                    'path': local_path,
                    'message': f"Repository cloned successfully to {local_path}"
                })
            
            return True, f"Repository cloned successfully to {local_path}"
            
        except git.exc.GitCommandError as e:
            error_msg = f"Git clone failed: {str(e)}"
            print(f"Git clone error: {error_msg}")
            if self.socketio:
                print("Emitting clone_completed event (error)")
                self.socketio.emit('clone_completed', {
                    'success': False,
                    'error': error_msg
                })
            return False, error_msg
        except Exception as e:
            error_msg = f"Clone operation failed: {str(e)}"
            print(f"General clone error: {error_msg}")
            if self.socketio:
                print("Emitting clone_completed event (error)")
                self.socketio.emit('clone_completed', {
                    'success': False,
                    'error': error_msg
                })
            return False, error_msg
    
    def clone_repository_async(self, git_url, local_path):
        """Clone repository in a separate thread to avoid blocking"""
        def clone_worker():
            try:
                return self.clone_repository(git_url, local_path)
            except Exception as e:
                if self.socketio:
                    self.socketio.emit('clone_completed', {
                        'success': False,
                        'error': f"Clone failed: {str(e)}"
                    })
                return False, str(e)
        
        def progress_simulator():
            """Simulate progress if git progress callback doesn't work"""
            import time
            if self.socketio:
                stages = [
                    ('Initializing clone', 15),
                    ('Connecting to remote', 25),
                    ('Receiving objects', 45),
                    ('Resolving deltas', 70),
                    ('Checking out files', 90)
                ]
                
                for stage, progress in stages:
                    time.sleep(2)  # Wait 2 seconds between updates
                    self.socketio.emit('clone_progress', {
                        'stage': stage,
                        'progress': progress,
                        'message': stage
                    })
        
        # Start progress simulator in parallel
        if self.socketio:
            progress_thread = threading.Thread(target=progress_simulator)
            progress_thread.daemon = True
            progress_thread.start()
        
        thread = threading.Thread(target=clone_worker)
        thread.daemon = True
        thread.start()
        return thread
    
    def validate_git_url(self, git_url):
        """Validate if the provided URL is a valid git repository"""
        try:
            # Basic URL validation
            if not git_url or not isinstance(git_url, str):
                return False, "Invalid URL format"
            
            # Check if URL contains common git hosting patterns
            valid_patterns = [
                'github.com',
                'gitlab.com',
                'bitbucket.org',
                '.git'
            ]
            
            if not any(pattern in git_url.lower() for pattern in valid_patterns):
                return False, "URL doesn't appear to be a git repository"
            
            return True, "Valid git URL"
            
        except Exception as e:
            return False, f"URL validation failed: {str(e)}"
    
    def analyze_repository(self, repo_path, repository_id, max_commits=1000):
        """Analyze git repository and extract commit data"""
        try:
            repo = git.Repo(repo_path)
            commits_processed = 0
            
            # Get commits from all branches
            for commit in repo.iter_commits('--all', max_count=max_commits):
                # Check if commit already exists
                existing_commit = self.session.query(Commit).filter_by(sha=commit.hexsha).first()
                if existing_commit:
                    continue
                
                # Get or create contributor
                contributor = self.get_or_create_contributor(
                    commit.author.name, 
                    commit.author.email
                )
                
                # Calculate commit stats
                stats = commit.stats
                files_changed = len(stats.files)
                lines_added = stats.total['insertions']
                lines_deleted = stats.total['deletions']
                
                # Create commit record
                commit_record = Commit(
                    sha=commit.hexsha,
                    repository_id=repository_id,
                    contributor_id=contributor.id,
                    message=commit.message.strip(),
                    commit_date=datetime.fromtimestamp(commit.committed_date),
                    author_name=commit.author.name,
                    author_email=commit.author.email,
                    files_changed=files_changed,
                    lines_added=lines_added,
                    lines_deleted=lines_deleted,
                    commit_type=self.classify_commit_type(commit.message),
                    is_merge=len(commit.parents) > 1
                )
                
                self.session.add(commit_record)
                self.session.flush()  # Get the commit ID
                
                # Process individual files
                for file_path, file_stats in stats.files.items():
                    commit_file = CommitFile(
                        commit_id=commit_record.id,
                        file_path=file_path,
                        file_type=self.get_file_type(file_path),
                        lines_added=file_stats['insertions'],
                        lines_deleted=file_stats['deletions'],
                        is_test_file=self.is_test_file(file_path)
                    )
                    self.session.add(commit_file)
                
                commits_processed += 1
                if commits_processed % 100 == 0:
                    print(f"Processed {commits_processed} commits...")
                    self.session.commit()
            
            self.session.commit()
            print(f"Analysis complete. Processed {commits_processed} commits.")
            return commits_processed
            
        except Exception as e:
            print(f"Error analyzing repository: {str(e)}")
            self.session.rollback()
            return 0
