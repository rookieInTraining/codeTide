"""
Sample data generator for testing the CodeTide application
"""
import os
import sys
from datetime import datetime, timedelta
import random
from backend.models import create_database, Repository, Contributor, Commit, CommitFile

def create_sample_data():
    """Create sample data for testing"""
    engine, Session = create_database('sample_commit_tracker.db')
    session = Session()
    
    # Create sample repository
    repo = Repository(
        name="Sample Project",
        path="/sample/project/path",
        url="https://github.com/sample/project.git",
        last_analyzed=datetime.utcnow()
    )
    session.add(repo)
    session.flush()
    
    # Create sample contributors
    contributors = [
        Contributor(name="Alice Johnson", email="alice@company.com", role="developer", team="frontend", experience_level="senior"),
        Contributor(name="Bob Smith", email="bob@company.com", role="developer", team="backend", experience_level="mid"),
        Contributor(name="Carol Davis", email="carol@company.com", role="tester", team="qa", experience_level="senior"),
        Contributor(name="David Wilson", email="david@company.com", role="developer", team="backend", experience_level="junior"),
        Contributor(name="Eve Brown", email="eve@company.com", role="tester", team="qa", experience_level="mid"),
        Contributor(name="Frank Miller", email="frank@company.com", role="developer", team="frontend", experience_level="senior"),
    ]
    
    for contributor in contributors:
        session.add(contributor)
    session.flush()
    
    # Generate sample commits over the last 90 days
    commit_types = ['feature', 'bugfix', 'refactor', 'test', 'documentation']
    file_extensions = ['.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cpp', '.html', '.css']
    
    start_date = datetime.utcnow() - timedelta(days=90)
    
    for day in range(90):
        current_date = start_date + timedelta(days=day)
        
        # Skip weekends for more realistic data
        if current_date.weekday() >= 5:
            continue
            
        # Generate 2-8 commits per day
        daily_commits = random.randint(2, 8)
        
        for _ in range(daily_commits):
            contributor = random.choice(contributors)
            commit_type = random.choice(commit_types)
            
            # Adjust commit patterns based on contributor role
            if contributor.role == 'tester':
                commit_type = random.choice(['test', 'bugfix', 'documentation'])
            
            # Generate commit time during working hours
            commit_time = current_date.replace(
                hour=random.randint(9, 17),
                minute=random.randint(0, 59),
                second=random.randint(0, 59)
            )
            
            files_changed = random.randint(1, 5)
            lines_added = random.randint(5, 200)
            lines_deleted = random.randint(0, lines_added // 2)
            
            commit = Commit(
                sha=f"abc{random.randint(100000, 999999)}def{random.randint(100000, 999999)}",
                repository_id=repo.id,
                contributor_id=contributor.id,
                message=f"{commit_type.title()}: {generate_commit_message(commit_type)}",
                commit_date=commit_time,
                author_name=contributor.name,
                author_email=contributor.email,
                files_changed=files_changed,
                lines_added=lines_added,
                lines_deleted=lines_deleted,
                commit_type=commit_type,
                branch_name=random.choice(['main', 'develop', 'feature/new-ui', 'bugfix/login-issue']),
                is_merge=random.random() < 0.1  # 10% merge commits
            )
            
            session.add(commit)
            session.flush()
            
            # Generate file changes for this commit
            for i in range(files_changed):
                file_ext = random.choice(file_extensions)
                is_test = random.random() < 0.3 and commit_type in ['test', 'bugfix']
                
                if is_test:
                    file_path = f"tests/test_{random.choice(['auth', 'api', 'ui', 'utils'])}{file_ext}"
                else:
                    file_path = f"src/{random.choice(['components', 'services', 'utils', 'models'])}/{random.choice(['auth', 'api', 'ui', 'data'])}{file_ext}"
                
                file_lines_added = random.randint(1, lines_added // max(files_changed, 1))
                file_lines_deleted = random.randint(0, file_lines_added // 2)
                
                commit_file = CommitFile(
                    commit_id=commit.id,
                    file_path=file_path,
                    file_type=file_ext,
                    lines_added=file_lines_added,
                    lines_deleted=file_lines_deleted,
                    is_test_file=is_test
                )
                session.add(commit_file)
    
    session.commit()
    print(f"Sample data created successfully!")
    print(f"- Repository: {repo.name}")
    print(f"- Contributors: {len(contributors)}")
    print(f"- Commits: {session.query(Commit).count()}")
    print(f"- Database: sample_commit_tracker.db")
    
    session.close()

def generate_commit_message(commit_type):
    """Generate realistic commit messages"""
    messages = {
        'feature': [
            "Add user authentication system",
            "Implement dashboard analytics",
            "Create responsive navigation menu",
            "Add file upload functionality",
            "Implement search filters"
        ],
        'bugfix': [
            "Fix login redirect issue",
            "Resolve memory leak in data processing",
            "Fix responsive layout on mobile",
            "Correct validation error handling",
            "Fix API timeout handling"
        ],
        'refactor': [
            "Refactor authentication middleware",
            "Clean up database queries",
            "Optimize component rendering",
            "Restructure API endpoints",
            "Improve error handling logic"
        ],
        'test': [
            "Add unit tests for auth service",
            "Create integration tests for API",
            "Add end-to-end tests for login flow",
            "Update test fixtures",
            "Add performance tests"
        ],
        'documentation': [
            "Update API documentation",
            "Add setup instructions",
            "Document deployment process",
            "Update changelog",
            "Add code comments"
        ]
    }
    
    return random.choice(messages.get(commit_type, ["Update code"]))

if __name__ == "__main__":
    create_sample_data()
