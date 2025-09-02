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
            ).group_by(Contributor.id).order_by(desc(func.count(Commit.id))).all()
            
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
        ).group_by(Contributor.id).order_by(desc(func.count(Commit.id))).all()
        
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
    
    def get_contributor_detailed_metrics(self, contributor_id, repository_id, days=30):
        """Get detailed metrics for a specific contributor"""
        end_date = datetime.utcnow()
        
        # Handle special cases for date ranges
        if days == 0:  # Lifetime
            commits_query = self.session.query(Commit).filter(
                and_(
                    Commit.contributor_id == contributor_id,
                    Commit.repository_id == repository_id
                )
            )
        elif days == 365:  # Year to date
            start_date = datetime(end_date.year, 1, 1)
            commits_query = self.session.query(Commit).filter(
                and_(
                    Commit.contributor_id == contributor_id,
                    Commit.repository_id == repository_id,
                    Commit.commit_date >= start_date,
                    Commit.commit_date <= end_date
                )
            )
        else:  # Regular days back from now
            start_date = end_date - timedelta(days=days)
            commits_query = self.session.query(Commit).filter(
                and_(
                    Commit.contributor_id == contributor_id,
                    Commit.repository_id == repository_id,
                    Commit.commit_date >= start_date,
                    Commit.commit_date <= end_date
                )
            )
        
        commits = commits_query.all()
        
        if not commits:
            return {
                'contributor_id': contributor_id,
                'total_commits': 0,
                'lines_added': 0,
                'lines_deleted': 0,
                'files_modified': 0,
                'avg_files_per_commit': 0,
                'commit_velocity': 0,
                'code_churn_ratio': 0,
                'commit_types': {},
                'activity_pattern': {},
                'file_expertise': {}
            }
        
        # Basic metrics
        total_commits = len(commits)
        total_lines_added = sum(c.lines_added or 0 for c in commits)
        total_lines_deleted = sum(c.lines_deleted or 0 for c in commits)
        total_files_modified = sum(c.files_changed or 0 for c in commits)
        
        # Calculate velocity
        if days == 0:  # Lifetime
            first_commit = min(commits, key=lambda c: c.commit_date)
            actual_days = max((end_date - first_commit.commit_date).days, 1)
        elif days == 365:
            actual_days = (end_date - datetime(end_date.year, 1, 1)).days + 1
        else:
            actual_days = days
        
        velocity = total_commits / actual_days
        
        # Commit type distribution
        commit_types = {}
        for commit in commits:
            commit_type = commit.commit_type or 'other'
            commit_types[commit_type] = commit_types.get(commit_type, 0) + 1
        
        # Activity pattern (hour of day)
        activity_pattern = {}
        for commit in commits:
            hour = commit.commit_date.hour
            activity_pattern[hour] = activity_pattern.get(hour, 0) + 1
        
        # File expertise (get file types from commit files)
        commit_ids = [c.id for c in commits]
        if commit_ids:
            file_types = self.session.query(
                CommitFile.file_type,
                func.count(CommitFile.id).label('count'),
                func.sum(CommitFile.lines_added + CommitFile.lines_deleted).label('total_changes')
            ).filter(
                CommitFile.commit_id.in_(commit_ids)
            ).group_by(CommitFile.file_type).all()
            
            file_expertise = {
                ft.file_type or 'unknown': {
                    'files_modified': ft.count,
                    'total_changes': ft.total_changes or 0
                } for ft in file_types
            }
        else:
            file_expertise = {}
        
        return {
            'contributor_id': contributor_id,
            'total_commits': total_commits,
            'lines_added': total_lines_added,
            'lines_deleted': total_lines_deleted,
            'files_modified': total_files_modified,
            'avg_files_per_commit': round(total_files_modified / total_commits, 2),
            'commit_velocity': round(velocity, 3),
            'code_churn_ratio': round(total_lines_added / max(total_lines_deleted, 1), 2),
            'commit_types': commit_types,
            'activity_pattern': activity_pattern,
            'file_expertise': file_expertise
        }
    
    def get_contributor_activity_timeline(self, contributor_id, repository_id, days=30):
        """Get daily activity timeline for a contributor"""
        end_date = datetime.utcnow()
        
        # Handle special cases for date ranges
        if days == 0:  # Lifetime
            daily_activity = self.session.query(
                func.date(Commit.commit_date).label('date'),
                func.count(Commit.id).label('commits'),
                func.sum(Commit.lines_added).label('lines_added'),
                func.sum(Commit.lines_deleted).label('lines_deleted'),
                func.sum(Commit.files_changed).label('files_changed')
            ).filter(
                and_(
                    Commit.contributor_id == contributor_id,
                    Commit.repository_id == repository_id
                )
            ).group_by(func.date(Commit.commit_date)).all()
        elif days == 365:  # Year to date
            start_date = datetime(end_date.year, 1, 1)
            daily_activity = self.session.query(
                func.date(Commit.commit_date).label('date'),
                func.count(Commit.id).label('commits'),
                func.sum(Commit.lines_added).label('lines_added'),
                func.sum(Commit.lines_deleted).label('lines_deleted'),
                func.sum(Commit.files_changed).label('files_changed')
            ).filter(
                and_(
                    Commit.contributor_id == contributor_id,
                    Commit.repository_id == repository_id,
                    Commit.commit_date >= start_date,
                    Commit.commit_date <= end_date
                )
            ).group_by(func.date(Commit.commit_date)).all()
        else:  # Regular days back from now
            start_date = end_date - timedelta(days=days)
            daily_activity = self.session.query(
                func.date(Commit.commit_date).label('date'),
                func.count(Commit.id).label('commits'),
                func.sum(Commit.lines_added).label('lines_added'),
                func.sum(Commit.lines_deleted).label('lines_deleted'),
                func.sum(Commit.files_changed).label('files_changed')
            ).filter(
                and_(
                    Commit.contributor_id == contributor_id,
                    Commit.repository_id == repository_id,
                    Commit.commit_date >= start_date,
                    Commit.commit_date <= end_date
                )
            ).group_by(func.date(Commit.commit_date)).all()
        
        return [{
            'date': str(activity.date),
            'commits': activity.commits,
            'lines_added': activity.lines_added or 0,
            'lines_deleted': activity.lines_deleted or 0,
            'files_changed': activity.files_changed or 0
        } for activity in daily_activity]
    
    def compare_contributors(self, contributor_ids, repository_id, days=30):
        """Compare multiple contributors side by side"""
        comparison_data = []
        
        for contributor_id in contributor_ids:
            # Get contributor info
            contributor = self.session.query(Contributor).get(contributor_id)
            if not contributor:
                continue
            
            # Get detailed metrics
            metrics = self.get_contributor_detailed_metrics(contributor_id, repository_id, days)
            
            # Add contributor info to metrics
            metrics.update({
                'name': contributor.name,
                'email': contributor.email,
                'role': contributor.role,
                'team': contributor.team,
                'experience_level': contributor.experience_level
            })
            
            comparison_data.append(metrics)
        
        return comparison_data
