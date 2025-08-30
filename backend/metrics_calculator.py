from sqlalchemy import func, and_, desc
from models import Commit, Contributor, CommitFile, MetricSnapshot
from datetime import datetime, timedelta
import pandas as pd

class MetricsCalculator:
    def __init__(self, session):
        self.session = session
    
    def get_commit_velocity(self, repository_id, days=30, contributor_id=None):
        """Calculate commits per day over specified period"""
        end_date = datetime.utcnow()
        
        # Handle special cases for date ranges
        if days == 0:  # Lifetime
            query = self.session.query(Commit).filter(
                Commit.repository_id == repository_id
            )
            if contributor_id:
                query = query.filter(Commit.contributor_id == contributor_id)
            
            commits = query.all()
            if not commits:
                return 0
            
            # Calculate actual days between first and last commit
            first_commit = min(commits, key=lambda c: c.commit_date)
            actual_days = (end_date - first_commit.commit_date).days
            return len(commits) / max(actual_days, 1)
        
        elif days == 365:  # Year to date
            start_date = datetime(end_date.year, 1, 1)
        else:  # Regular days back from now
            start_date = end_date - timedelta(days=days)
        
        query = self.session.query(Commit).filter(
            and_(
                Commit.repository_id == repository_id,
                Commit.commit_date >= start_date,
                Commit.commit_date <= end_date
            )
        )
        
        if contributor_id:
            query = query.filter(Commit.contributor_id == contributor_id)
        
        commits = query.all()
        actual_days = (end_date - start_date).days if days != 365 else (end_date - start_date).days + 1
        return len(commits) / max(actual_days, 1)
    
    def get_code_churn(self, repository_id, days=30, contributor_id=None):
        """Calculate lines added vs deleted ratio"""
        end_date = datetime.utcnow()
        
        # Handle special cases for date ranges
        if days == 0:  # Lifetime
            query = self.session.query(
                func.sum(Commit.lines_added).label('total_added'),
                func.sum(Commit.lines_deleted).label('total_deleted')
            ).filter(
                Commit.repository_id == repository_id
            )
        elif days == 365:  # Year to date
            start_date = datetime(end_date.year, 1, 1)
            query = self.session.query(
                func.sum(Commit.lines_added).label('total_added'),
                func.sum(Commit.lines_deleted).label('total_deleted')
            ).filter(
                and_(
                    Commit.repository_id == repository_id,
                    Commit.commit_date >= start_date,
                    Commit.commit_date <= end_date
                )
            )
        else:  # Regular days back from now
            start_date = end_date - timedelta(days=days)
            query = self.session.query(
                func.sum(Commit.lines_added).label('total_added'),
                func.sum(Commit.lines_deleted).label('total_deleted')
            ).filter(
                and_(
                    Commit.repository_id == repository_id,
                    Commit.commit_date >= start_date,
                    Commit.commit_date <= end_date
                )
            )
        
        if contributor_id:
            query = query.filter(Commit.contributor_id == contributor_id)
        
        result = query.first()
        total_added = result.total_added or 0
        total_deleted = result.total_deleted or 0
        
        return {
            'lines_added': total_added,
            'lines_deleted': total_deleted,
            'churn_ratio': total_added / max(total_deleted, 1)
        }
    
    def get_test_coverage_impact(self, repository_id, days=30, contributor_id=None):
        """Calculate ratio of test files to production files committed"""
        end_date = datetime.utcnow()
        
        # Handle special cases for date ranges
        if days == 0:  # Lifetime
            commit_ids_query = self.session.query(Commit.id).filter(
                Commit.repository_id == repository_id
            )
        elif days == 365:  # Year to date
            start_date = datetime(end_date.year, 1, 1)
            commit_ids_query = self.session.query(Commit.id).filter(
                and_(
                    Commit.repository_id == repository_id,
                    Commit.commit_date >= start_date,
                    Commit.commit_date <= end_date
                )
            )
        else:  # Regular days back from now
            start_date = end_date - timedelta(days=days)
            commit_ids_query = self.session.query(Commit.id).filter(
                and_(
                    Commit.repository_id == repository_id,
                    Commit.commit_date >= start_date,
                    Commit.commit_date <= end_date
                )
            )
        
        if contributor_id:
            commit_ids_query = commit_ids_query.filter(Commit.contributor_id == contributor_id)
        
        commit_ids = [row.id for row in commit_ids_query.all()]
        
        if not commit_ids:
            return {'test_files': 0, 'production_files': 0, 'test_ratio': 0}
        
        # Count test vs production files
        test_files = self.session.query(CommitFile).filter(
            and_(
                CommitFile.commit_id.in_(commit_ids),
                CommitFile.is_test_file == True
            )
        ).count()
        
        total_files = self.session.query(CommitFile).filter(
            CommitFile.commit_id.in_(commit_ids)
        ).count()
        
        production_files = total_files - test_files
        
        return {
            'test_files': test_files,
            'production_files': production_files,
            'test_ratio': test_files / max(total_files, 1)
        }
    
    def get_contributor_stats(self, repository_id, days=30):
        """Get statistics for all contributors"""
        end_date = datetime.utcnow()
        
        # Handle special cases for date ranges
        if days == 0:  # Lifetime
            stats = self.session.query(
                Contributor.id,
                Contributor.name,
                Contributor.email,
                Contributor.role,
                Contributor.team,
                func.count(Commit.id).label('commit_count'),
                func.sum(Commit.lines_added).label('lines_added'),
                func.sum(Commit.lines_deleted).label('lines_deleted'),
                func.avg(Commit.files_changed).label('avg_files_per_commit')
            ).join(
                Commit, Commit.contributor_id == Contributor.id
            ).filter(
                Commit.repository_id == repository_id
            ).group_by(Contributor.id).all()
            
            # For lifetime, calculate actual days for velocity
            result = []
            for stat in stats:
                contributor_commits = self.session.query(Commit).filter(
                    and_(
                        Commit.repository_id == repository_id,
                        Commit.contributor_id == stat.id
                    )
                ).all()
                
                if contributor_commits:
                    first_commit = min(contributor_commits, key=lambda c: c.commit_date)
                    actual_days = max((end_date - first_commit.commit_date).days, 1)
                    velocity = stat.commit_count / actual_days
                else:
                    velocity = 0
                
                result.append({
                    'contributor_id': stat.id,
                    'name': stat.name,
                    'email': stat.email,
                    'role': stat.role,
                    'team': stat.team,
                    'commit_count': stat.commit_count,
                    'lines_added': stat.lines_added or 0,
                    'lines_deleted': stat.lines_deleted or 0,
                    'avg_files_per_commit': round(stat.avg_files_per_commit or 0, 2),
                    'velocity': velocity
                })
            return result
            
        elif days == 365:  # Year to date
            start_date = datetime(end_date.year, 1, 1)
            actual_days = (end_date - start_date).days + 1
        else:  # Regular days back from now
            start_date = end_date - timedelta(days=days)
            actual_days = days
        
        stats = self.session.query(
            Contributor.id,
            Contributor.name,
            Contributor.email,
            Contributor.role,
            Contributor.team,
            func.count(Commit.id).label('commit_count'),
            func.sum(Commit.lines_added).label('lines_added'),
            func.sum(Commit.lines_deleted).label('lines_deleted'),
            func.avg(Commit.files_changed).label('avg_files_per_commit')
        ).join(
            Commit, Commit.contributor_id == Contributor.id
        ).filter(
            and_(
                Commit.repository_id == repository_id,
                Commit.commit_date >= start_date,
                Commit.commit_date <= end_date
            )
        ).group_by(Contributor.id).all()
        
        return [{
            'contributor_id': stat.id,
            'name': stat.name,
            'email': stat.email,
            'role': stat.role,
            'team': stat.team,
            'commit_count': stat.commit_count,
            'lines_added': stat.lines_added or 0,
            'lines_deleted': stat.lines_deleted or 0,
            'avg_files_per_commit': round(stat.avg_files_per_commit or 0, 2),
            'velocity': stat.commit_count / actual_days
        } for stat in stats]
    
    def get_commit_type_distribution(self, repository_id, days=30):
        """Get distribution of commit types"""
        end_date = datetime.utcnow()
        
        # Handle special cases for date ranges
        if days == 0:  # Lifetime
            distribution = self.session.query(
                Commit.commit_type,
                func.count(Commit.id).label('count')
            ).filter(
                Commit.repository_id == repository_id
            ).group_by(Commit.commit_type).all()
        elif days == 365:  # Year to date
            start_date = datetime(end_date.year, 1, 1)
            distribution = self.session.query(
                Commit.commit_type,
                func.count(Commit.id).label('count')
            ).filter(
                and_(
                    Commit.repository_id == repository_id,
                    Commit.commit_date >= start_date,
                    Commit.commit_date <= end_date
                )
            ).group_by(Commit.commit_type).all()
        else:  # Regular days back from now
            start_date = end_date - timedelta(days=days)
            distribution = self.session.query(
                Commit.commit_type,
                func.count(Commit.id).label('count')
            ).filter(
                and_(
                    Commit.repository_id == repository_id,
                    Commit.commit_date >= start_date,
                    Commit.commit_date <= end_date
                )
            ).group_by(Commit.commit_type).all()
        
        return {item.commit_type: item.count for item in distribution}
    
    def get_daily_activity(self, repository_id, days=30):
        """Get daily commit activity for charts"""
        end_date = datetime.utcnow()
        
        # Handle special cases for date ranges
        if days == 0:  # Lifetime
            daily_commits = self.session.query(
                func.date(Commit.commit_date).label('date'),
                func.count(Commit.id).label('commit_count'),
                func.sum(Commit.lines_added).label('lines_added'),
                func.sum(Commit.lines_deleted).label('lines_deleted')
            ).filter(
                Commit.repository_id == repository_id
            ).group_by(func.date(Commit.commit_date)).all()
        elif days == 365:  # Year to date
            start_date = datetime(end_date.year, 1, 1)
            daily_commits = self.session.query(
                func.date(Commit.commit_date).label('date'),
                func.count(Commit.id).label('commit_count'),
                func.sum(Commit.lines_added).label('lines_added'),
                func.sum(Commit.lines_deleted).label('lines_deleted')
            ).filter(
                and_(
                    Commit.repository_id == repository_id,
                    Commit.commit_date >= start_date,
                    Commit.commit_date <= end_date
                )
            ).group_by(func.date(Commit.commit_date)).all()
        else:  # Regular days back from now
            start_date = end_date - timedelta(days=days)
            daily_commits = self.session.query(
                func.date(Commit.commit_date).label('date'),
                func.count(Commit.id).label('commit_count'),
                func.sum(Commit.lines_added).label('lines_added'),
                func.sum(Commit.lines_deleted).label('lines_deleted')
            ).filter(
                and_(
                    Commit.repository_id == repository_id,
                    Commit.commit_date >= start_date,
                    Commit.commit_date <= end_date
                )
            ).group_by(func.date(Commit.commit_date)).all()
        
        return [{
            'date': str(item.date),
            'commit_count': item.commit_count,
            'lines_added': item.lines_added or 0,
            'lines_deleted': item.lines_deleted or 0
        } for item in daily_commits]
    
    def get_team_comparison(self, repository_id, days=30):
        """Compare performance across teams"""
        end_date = datetime.utcnow()
        
        # Handle special cases for date ranges
        if days == 0:  # Lifetime
            team_stats = self.session.query(
                Contributor.team,
                func.count(Commit.id).label('total_commits'),
                func.sum(Commit.lines_added).label('total_lines_added'),
                func.sum(Commit.lines_deleted).label('total_lines_deleted'),
                func.count(func.distinct(Contributor.id)).label('team_size')
            ).join(
                Commit, Commit.contributor_id == Contributor.id
            ).filter(
                Commit.repository_id == repository_id
            ).group_by(Contributor.team).all()
        elif days == 365:  # Year to date
            start_date = datetime(end_date.year, 1, 1)
            team_stats = self.session.query(
                Contributor.team,
                func.count(Commit.id).label('total_commits'),
                func.sum(Commit.lines_added).label('total_lines_added'),
                func.sum(Commit.lines_deleted).label('total_lines_deleted'),
                func.count(func.distinct(Contributor.id)).label('team_size')
            ).join(
                Commit, Commit.contributor_id == Contributor.id
            ).filter(
                and_(
                    Commit.repository_id == repository_id,
                    Commit.commit_date >= start_date,
                    Commit.commit_date <= end_date
                )
            ).group_by(Contributor.team).all()
        else:  # Regular days back from now
            start_date = end_date - timedelta(days=days)
            team_stats = self.session.query(
                Contributor.team,
                func.count(Commit.id).label('total_commits'),
                func.sum(Commit.lines_added).label('total_lines_added'),
                func.sum(Commit.lines_deleted).label('total_lines_deleted'),
                func.count(func.distinct(Contributor.id)).label('team_size')
            ).join(
                Commit, Commit.contributor_id == Contributor.id
            ).filter(
                and_(
                    Commit.repository_id == repository_id,
                    Commit.commit_date >= start_date,
                    Commit.commit_date <= end_date
                )
            ).group_by(Contributor.team).all()
        
        return [{
            'team': stat.team,
            'total_commits': stat.total_commits,
            'total_lines_added': stat.total_lines_added or 0,
            'total_lines_deleted': stat.total_lines_deleted or 0,
            'team_size': stat.team_size,
            'avg_commits_per_member': stat.total_commits / max(stat.team_size, 1)
        } for stat in team_stats]
