import unittest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime, timedelta
from metrics_calculator import MetricsCalculator
from models import Commit, Contributor, CommitFile


class TestMetricsCalculator(unittest.TestCase):
    def setUp(self):
        self.mock_session = Mock()
        self.calculator = MetricsCalculator(self.mock_session)
        self.repository_id = 1
        self.contributor_id = 1

    def test_get_commit_velocity_regular_days(self):
        """Test commit velocity calculation for regular days"""
        # Mock commits
        mock_commits = [Mock() for _ in range(5)]
        self.mock_session.query.return_value.filter.return_value.all.return_value = mock_commits
        
        velocity = self.calculator.get_commit_velocity(self.repository_id, days=30)
        
        # 5 commits over 30 days = 0.167 commits per day
        self.assertAlmostEqual(velocity, 5/30, places=3)

    def test_get_commit_velocity_lifetime(self):
        """Test commit velocity calculation for lifetime (days=0)"""
        # Mock commits with dates
        mock_commits = []
        base_date = datetime.utcnow() - timedelta(days=100)
        for i in range(10):
            commit = Mock()
            commit.commit_date = base_date + timedelta(days=i*10)
            mock_commits.append(commit)
        
        self.mock_session.query.return_value.filter.return_value.all.return_value = mock_commits
        
        with patch('metrics_calculator.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime.utcnow()
            velocity = self.calculator.get_commit_velocity(self.repository_id, days=0)
            
        self.assertGreater(velocity, 0)

    def test_get_code_churn_normal_case(self):
        """Test code churn calculation with normal values"""
        # Mock query result
        mock_result = Mock()
        mock_result.total_added = 1000
        mock_result.total_deleted = 200
        
        self.mock_session.query.return_value.filter.return_value.first.return_value = mock_result
        
        result = self.calculator.get_code_churn(self.repository_id, days=30)
        
        expected = {
            'lines_added': 1000,
            'lines_deleted': 200,
            'churn_ratio': 5.0  # 1000/200
        }
        self.assertEqual(result, expected)

    def test_get_code_churn_zero_deleted(self):
        """Test code churn calculation when no lines deleted"""
        mock_result = Mock()
        mock_result.total_added = 1000
        mock_result.total_deleted = 0
        
        self.mock_session.query.return_value.filter.return_value.first.return_value = mock_result
        
        result = self.calculator.get_code_churn(self.repository_id, days=30)
        
        expected = {
            'lines_added': 1000,
            'lines_deleted': 0,
            'churn_ratio': 1000.0  # 1000/max(0,1) = 1000/1
        }
        self.assertEqual(result, expected)

    def test_get_code_churn_none_values(self):
        """Test code churn calculation with None values from database"""
        mock_result = Mock()
        mock_result.total_added = None
        mock_result.total_deleted = None
        
        self.mock_session.query.return_value.filter.return_value.first.return_value = mock_result
        
        result = self.calculator.get_code_churn(self.repository_id, days=30)
        
        expected = {
            'lines_added': 0,
            'lines_deleted': 0,
            'churn_ratio': 0.0  # 0/max(0,1) = 0/1
        }
        self.assertEqual(result, expected)

    def test_get_test_coverage_impact_with_files(self):
        """Test test coverage impact calculation"""
        # Mock commit IDs
        mock_commit_ids = [Mock(id=1), Mock(id=2), Mock(id=3)]
        self.mock_session.query.return_value.filter.return_value.all.return_value = mock_commit_ids
        
        # Mock file counts
        self.mock_session.query.return_value.filter.return_value.count.side_effect = [2, 10]  # test_files, total_files
        
        result = self.calculator.get_test_coverage_impact(self.repository_id, days=30)
        
        expected = {
            'test_files': 2,
            'production_files': 8,  # 10 - 2
            'test_ratio': 0.2  # 2/10
        }
        self.assertEqual(result, expected)

    def test_get_test_coverage_impact_no_commits(self):
        """Test test coverage impact with no commits"""
        self.mock_session.query.return_value.filter.return_value.all.return_value = []
        
        result = self.calculator.get_test_coverage_impact(self.repository_id, days=30)
        
        expected = {
            'test_files': 0,
            'production_files': 0,
            'test_ratio': 0
        }
        self.assertEqual(result, expected)

    def test_get_contributor_stats_regular_days(self):
        """Test contributor statistics calculation"""
        # Mock contributor stats
        mock_stat = Mock()
        mock_stat.id = 1
        mock_stat.name = "John Doe"
        mock_stat.email = "john@example.com"
        mock_stat.role = "Developer"
        mock_stat.team = "Backend"
        mock_stat.commit_count = 15
        mock_stat.lines_added = 500
        mock_stat.lines_deleted = 100
        mock_stat.avg_files_per_commit = 3.5
        
        self.mock_session.query.return_value.join.return_value.filter.return_value.group_by.return_value.all.return_value = [mock_stat]
        
        result = self.calculator.get_contributor_stats(self.repository_id, days=30)
        
        expected = [{
            'contributor_id': 1,
            'name': "John Doe",
            'email': "john@example.com",
            'role': "Developer",
            'team': "Backend",
            'commit_count': 15,
            'lines_added': 500,
            'lines_deleted': 100,
            'avg_files_per_commit': 3.5,
            'velocity': 0.5  # 15/30
        }]
        self.assertEqual(result, expected)

    def test_get_commit_type_distribution(self):
        """Test commit type distribution calculation"""
        # Mock distribution data
        mock_items = [
            Mock(commit_type="feat", count=10),
            Mock(commit_type="fix", count=5),
            Mock(commit_type="docs", count=2)
        ]
        
        self.mock_session.query.return_value.filter.return_value.group_by.return_value.all.return_value = mock_items
        
        result = self.calculator.get_commit_type_distribution(self.repository_id, days=30)
        
        expected = {
            "feat": 10,
            "fix": 5,
            "docs": 2
        }
        self.assertEqual(result, expected)

    def test_get_daily_activity(self):
        """Test daily activity calculation"""
        # Mock daily activity data
        mock_items = [
            Mock(date="2024-01-01", commit_count=5, lines_added=100, lines_deleted=20),
            Mock(date="2024-01-02", commit_count=3, lines_added=50, lines_deleted=10)
        ]
        
        self.mock_session.query.return_value.filter.return_value.group_by.return_value.all.return_value = mock_items
        
        result = self.calculator.get_daily_activity(self.repository_id, days=30)
        
        expected = [
            {'date': '2024-01-01', 'commit_count': 5, 'lines_added': 100, 'lines_deleted': 20},
            {'date': '2024-01-02', 'commit_count': 3, 'lines_added': 50, 'lines_deleted': 10}
        ]
        self.assertEqual(result, expected)

    def test_get_team_comparison(self):
        """Test team comparison calculation"""
        # Mock team stats
        mock_stat = Mock()
        mock_stat.team = "Backend"
        mock_stat.total_commits = 50
        mock_stat.total_lines_added = 2000
        mock_stat.total_lines_deleted = 500
        mock_stat.team_size = 5
        
        self.mock_session.query.return_value.join.return_value.filter.return_value.group_by.return_value.all.return_value = [mock_stat]
        
        result = self.calculator.get_team_comparison(self.repository_id, days=30)
        
        expected = [{
            'team': "Backend",
            'total_commits': 50,
            'total_lines_added': 2000,
            'total_lines_deleted': 500,
            'team_size': 5,
            'avg_commits_per_member': 10.0  # 50/5
        }]
        self.assertEqual(result, expected)

    def test_year_to_date_calculation(self):
        """Test year-to-date date range calculation"""
        mock_result = Mock()
        mock_result.total_added = 500
        mock_result.total_deleted = 100
        
        self.mock_session.query.return_value.filter.return_value.first.return_value = mock_result
        
        with patch('metrics_calculator.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 6, 15)
            mock_datetime.return_value = datetime(2024, 6, 15)
            
            result = self.calculator.get_code_churn(self.repository_id, days=365)
            
        expected = {
            'lines_added': 500,
            'lines_deleted': 100,
            'churn_ratio': 5.0
        }
        self.assertEqual(result, expected)


if __name__ == '__main__':
    unittest.main()
