import git
import os
import shutil
import time
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
        self.last_update_time = time.time()
        self.idle_timeout = 300  # 5 minutes idle timeout
        
    def update(self, op_code, cur_count, max_count=None, message=''):
        """Update progress and emit to frontend via socketio"""
        # Update last activity time
        self.last_update_time = time.time()
        
        if not self.socketio:
            return
            
        # Map git operation codes to readable stages
        stage_map = {
            self.COUNTING: 'Counting objects',
            self.COMPRESSING: 'Compressing objects', 
            self.WRITING: 'Writing objects',
            self.RECEIVING: 'Receiving objects',
            self.RESOLVING: 'Resolving deltas'
        }
        
        stage_name = stage_map.get(op_code & self.OP_MASK, 'Processing')
        
        # Calculate progress percentage (20% base + 80% for actual progress)
        if max_count and max_count > 0:
            progress = 20 + int((cur_count / max_count) * 80)
        else:
            # Fallback calculation when max_count is not available
            progress = min(20 + (cur_count % 100), 95)
            
        print(f"Progress update: op_code={op_code}, cur_count={cur_count}, max_count={max_count}, message='{message}'")
        print(f"Emitting progress: stage={stage_name}, progress={progress}%")
        
        # Store last progress for idle monitoring
        self.last_progress = progress
        
        # Emit progress update
        self.socketio.emit('clone_progress', {
            'stage': stage_name,
            'progress': progress,
            'current': cur_count,
            'total': max_count,
            'message': message or stage_name
        })
        
    def check_idle_timeout(self):
        """Check if operation has been idle for too long"""
        return time.time() - self.last_update_time > self.idle_timeout

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
            
            # Clone the repository with progress tracking and idle monitoring
            print("Starting git clone...")
            
            # Start idle timeout monitoring in a separate thread
            def monitor_idle_timeout():
                while True:
                    time.sleep(30)  # Check every 30 seconds
                    if progress and progress.check_idle_timeout():
                        print("Clone operation appears to be idle for too long")
                        if self.socketio:
                            self.socketio.emit('clone_progress', {
                                'stage': 'Operation may be stuck',
                                'progress': progress.last_progress if hasattr(progress, 'last_progress') else 50,
                                'message': 'Clone operation has been idle for 5 minutes. This may indicate network issues.'
                            })
                        break
            
            if progress:
                monitor_thread = threading.Thread(target=monitor_idle_timeout)
                monitor_thread.daemon = True
                monitor_thread.start()
            
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
    
    def analyze_repository(self, repo_path, repository_id, max_commits=None):
        """Analyze git repository and extract commit data with optimized batch processing"""
        try:
            repo = git.Repo(repo_path)
            commits_processed = 0
            
            # Emit analysis started event
            if self.socketio:
                self.socketio.emit('analysis_started', {
                    'repository_id': repository_id,
                    'path': repo_path
                })
            
            # Optimize for large repositories (30k+ commits)
            if max_commits is None or max_commits > 10000:
                # For large repos, use faster commit counting and larger batches
                try:
                    # Fast commit count using git command
                    import subprocess
                    result = subprocess.run(['git', 'rev-list', '--count', '--all'], 
                                          cwd=repo_path, capture_output=True, text=True, timeout=30)
                    total_commits = int(result.stdout.strip()) if result.returncode == 0 else 0
                    if max_commits:
                        total_commits = min(total_commits, max_commits)
                except:
                    # Fallback to iterator count with limit
                    total_commits = sum(1 for _ in repo.iter_commits('--all', max_count=min(max_commits or 50000, 50000)))
            else:
                total_commits = sum(1 for _ in repo.iter_commits('--all', max_count=max_commits))
            
            # Pre-fetch existing commit SHAs and check for missing branch names
            existing_shas = set()
            commits_needing_update = set()
            existing_commits = self.session.query(Commit.sha, Commit.branch_name).filter_by(repository_id=repository_id).all()
            for sha, branch_name in existing_commits:
                existing_shas.add(sha)
                # Mark commits with NULL branch names for update
                if branch_name is None:
                    commits_needing_update.add(sha)
            
            # Cache contributors to avoid repeated database queries
            contributor_cache = {}
            existing_contributors = self.session.query(Contributor).all()
            for contrib in existing_contributors:
                contributor_cache[contrib.email] = contrib
            
            # Get default branch name for performance
            default_branch_name = 'main'
            try:
                # Try to get the active/current branch
                if hasattr(repo, 'active_branch'):
                    default_branch_name = repo.active_branch.name
                else:
                    # Fallback: check for common main branch names
                    for branch_name in ['main', 'master', 'develop']:
                        try:
                            if branch_name in [b.name for b in repo.branches]:
                                default_branch_name = branch_name
                                break
                        except Exception:
                            continue
            except Exception:
                pass
            
            # Dynamic batch sizing based on repository size
            if total_commits > 30000:
                batch_size = 500  # Larger batches for big repos
            elif total_commits > 10000:
                batch_size = 250
            else:
                batch_size = 100
            commit_batch = []
            file_batch = []
            
            # Get commits from all branches
            for commit in repo.iter_commits('--all', max_count=max_commits):
                # Skip if commit already exists and doesn't need updates
                if commit.hexsha in existing_shas and commit.hexsha not in commits_needing_update:
                    continue
                
                # Use default branch name for performance (simple approach)
                branch_name = default_branch_name
                
                # Check if this is an update or new commit
                is_update = commit.hexsha in commits_needing_update
                
                if is_update:
                    # Update existing commit with branch name
                    existing_commit = self.session.query(Commit).filter_by(
                        sha=commit.hexsha, 
                        repository_id=repository_id
                    ).first()
                    if existing_commit:
                        existing_commit.branch_name = branch_name
                        commits_processed += 1
                        
                        # Emit progress updates for updates too
                        if commits_processed % 100 == 0:
                            print(f"Updated {commits_processed} commits...")
                            if self.socketio and total_commits > 0:
                                progress = min(95, int((commits_processed / total_commits) * 90) + 5)
                                self.socketio.emit('analysis_progress', {
                                    'repository_id': repository_id,
                                    'stage': f'Updating commits ({commits_processed}/{total_commits})',
                                    'progress': progress,
                                    'commits_processed': commits_processed,
                                    'total_commits': total_commits
                                })
                    continue
                
                # Get or create contributor (use cache)
                contributor_email = commit.author.email
                if contributor_email in contributor_cache:
                    contributor = contributor_cache[contributor_email]
                else:
                    contributor = Contributor(
                        name=commit.author.name,
                        email=contributor_email,
                        role='developer',
                        team='unknown',
                        experience_level='unknown'
                    )
                    self.session.add(contributor)
                    self.session.flush()  # Get ID
                    contributor_cache[contributor_email] = contributor
                
                # Calculate commit stats (optimized for large repos)
                try:
                    stats = commit.stats
                    files_changed = len(stats.files)
                    lines_added = stats.total['insertions']
                    lines_deleted = stats.total['deletions']
                except Exception:
                    # Fallback for problematic commits
                    files_changed = 0
                    lines_added = 0
                    lines_deleted = 0
                    stats = type('MockStats', (), {'files': {}})()
                
                # Handle commit date conversion with validation
                try:
                    commit_timestamp = commit.committed_date
                    commit_date = datetime.fromtimestamp(commit_timestamp)
                    
                    # Validate reasonable date range (1970-2100)
                    if commit_date.year < 1970 or commit_date.year > 2100:
                        if commit_date.year < 1970:
                            commit_date = datetime.fromtimestamp(0)
                        elif commit_date.year > 2100:
                            commit_date = datetime.utcnow()
                            
                except (ValueError, OSError):
                    commit_date = datetime.utcnow()
                
                # Create commit record for batch
                commit_record = Commit(
                    sha=commit.hexsha,
                    repository_id=repository_id,
                    contributor_id=contributor.id,
                    message=commit.message.strip(),
                    commit_date=commit_date,
                    author_name=commit.author.name,
                    author_email=commit.author.email,
                    files_changed=files_changed,
                    lines_added=lines_added,
                    lines_deleted=lines_deleted,
                    commit_type=self.classify_commit_type(commit.message),
                    branch_name=branch_name,
                    is_merge=len(commit.parents) > 1
                )
                
                commit_batch.append((commit_record, stats.files))
                commits_processed += 1
                
                # Process batch when it reaches batch_size
                if len(commit_batch) >= batch_size:
                    self._process_commit_batch(commit_batch, file_batch)
                    commit_batch = []
                    
                    # Dynamic progress update frequency based on repo size
                    progress_interval = 500 if total_commits > 30000 else 250 if total_commits > 10000 else 100
                    
                    # Emit progress updates
                    if commits_processed % progress_interval == 0:
                        print(f"Processed {commits_processed} commits...")
                        if self.socketio and total_commits > 0:
                            progress = min(95, int((commits_processed / total_commits) * 90) + 5)
                            self.socketio.emit('analysis_progress', {
                                'repository_id': repository_id,
                                'stage': f'Processing commits ({commits_processed}/{total_commits})',
                                'progress': progress,
                                'commits_processed': commits_processed,
                                'total_commits': total_commits
                            })
            
            # Process remaining commits in batch
            if commit_batch:
                self._process_commit_batch(commit_batch, file_batch)
            
            # Final commit
            self.session.commit()
            
            # Emit completion event
            if self.socketio:
                self.socketio.emit('analysis_completed', {
                    'repository_id': repository_id,
                    'success': True,
                    'commits_processed': commits_processed,
                    'message': f'Analysis complete. Processed {commits_processed} commits.'
                })
            
            print(f"Analysis complete. Processed {commits_processed} commits.")
            return commits_processed
            
        except Exception as e:
            error_msg = f"Error analyzing repository: {str(e)}"
            print(error_msg)
            
            # Emit error event
            if self.socketio:
                self.socketio.emit('analysis_completed', {
                    'repository_id': repository_id,
                    'success': False,
                    'error': error_msg
                })
            
            self.session.rollback()
            return 0
    
    def _process_commit_batch(self, commit_batch, file_batch):
        """Process a batch of commits and their files efficiently with bulk operations"""
        try:
            # Add all commits to session
            commit_records = []
            for commit_record, file_stats in commit_batch:
                self.session.add(commit_record)
                commit_records.append((commit_record, file_stats))
            
            # Flush to get commit IDs
            self.session.flush()
            
            # Bulk insert files for better performance on large batches
            file_objects = []
            for commit_record, file_stats in commit_records:
                # Limit files per commit for very large commits (performance)
                file_items = list(file_stats.items())
                # if len(file_items) > 1000:  # Skip processing commits with >1000 files
                #     print(f"Skipping file processing for large commit {commit_record.sha[:8]} with {len(file_items)} files")
                #     continue
                    
                for file_path, file_stat_dict in file_items:
                    file_objects.append(CommitFile(
                        commit_id=commit_record.id,
                        file_path=file_path,
                        file_type=self.get_file_type(file_path),
                        lines_added=file_stat_dict['insertions'],
                        lines_deleted=file_stat_dict['deletions'],
                        is_test_file=self.is_test_file(file_path)
                    ))
            
            # Bulk add file objects
            if file_objects:
                self.session.bulk_save_objects(file_objects)
            
            # Commit the batch
            self.session.commit()
            
        except Exception as e:
            print(f"Error in batch processing: {e}")
            self.session.rollback()
            # Fallback to individual processing
            for commit_record, file_stats in commit_batch:
                try:
                    self.session.add(commit_record)
                    self.session.flush()
                    
                    # Process files individually as fallback
                    for file_path, file_stat_dict in list(file_stats.items())[:100]:  # Limit to 100 files
                        commit_file = CommitFile(
                            commit_id=commit_record.id,
                            file_path=file_path,
                            file_type=self.get_file_type(file_path),
                            lines_added=file_stat_dict['insertions'],
                            lines_deleted=file_stat_dict['deletions'],
                            is_test_file=self.is_test_file(file_path)
                        )
                        self.session.add(commit_file)
                    
                    self.session.commit()
                except Exception as inner_e:
                    print(f"Error processing individual commit: {inner_e}")
                    self.session.rollback()
