import git
import os
import shutil
from datetime import datetime
from models import Commit, Contributor, CommitFile, Repository
from sqlalchemy.orm import sessionmaker
import re

class GitAnalyzer:
    def __init__(self, session):
        self.session = session
        
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
    
    def clone_repository(self, git_url, local_path):
        """Clone a git repository from remote URL to local path"""
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            
            # Remove existing directory if it exists
            if os.path.exists(local_path):
                shutil.rmtree(local_path)
            
            # Clone the repository
            repo = git.Repo.clone_from(git_url, local_path)
            return True, f"Repository cloned successfully to {local_path}"
            
        except git.exc.GitCommandError as e:
            return False, f"Git clone failed: {str(e)}"
        except Exception as e:
            return False, f"Clone operation failed: {str(e)}"
    
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
