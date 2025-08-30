import unittest
from unittest.mock import Mock, MagicMock, patch, call
import tempfile
import os
import shutil
from git_analyzer import GitAnalyzer, CloneProgress
from models import Repository, Commit, Contributor, CommitFile


class TestCloneProgress(unittest.TestCase):
    def setUp(self):
        self.mock_socketio = Mock()
        self.progress = CloneProgress(self.mock_socketio)

    def test_clone_progress_initialization(self):
        """Test CloneProgress initialization"""
        self.assertEqual(self.progress.current_stage, 'Initializing')
        self.assertEqual(self.progress.socketio, self.mock_socketio)

    def test_clone_progress_update_counting(self):
        """Test progress update for counting stage"""
        self.progress.update(self.progress.COUNTING, 50, 100, 'Counting objects')
        
        self.mock_socketio.emit.assert_called_with('clone_progress', {
            'stage': 'Counting objects',
            'progress': 60,  # 20 + (50/100 * 80)
            'current': 50,
            'total': 100,
            'message': 'Counting objects'
        })

    def test_clone_progress_update_receiving(self):
        """Test progress update for receiving stage"""
        self.progress.update(self.progress.RECEIVING, 75, 100, 'Receiving objects')
        
        self.mock_socketio.emit.assert_called_with('clone_progress', {
            'stage': 'Receiving objects',
            'progress': 80,  # 20 + (75/100 * 80)
            'current': 75,
            'total': 100,
            'message': 'Receiving objects'
        })

    def test_clone_progress_no_max_count(self):
        """Test progress update without max_count"""
        self.progress.update(self.progress.WRITING, 25, None, 'Writing objects')
        
        # Should use fallback calculation
        expected_progress = min(80, 20 + (25 % 60))
        self.mock_socketio.emit.assert_called_with('clone_progress', {
            'stage': 'Writing objects',
            'progress': expected_progress,
            'current': 25,
            'total': None,
            'message': 'Writing objects'
        })


class TestGitAnalyzer(unittest.TestCase):
    def setUp(self):
        self.mock_session = Mock()
        self.mock_socketio = Mock()
        self.analyzer = GitAnalyzer(self.mock_session, self.mock_socketio)
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    @patch('git_analyzer.git.Repo.clone_from')
    def test_clone_repository_success(self, mock_clone):
        """Test successful repository cloning"""
        mock_repo = Mock()
        mock_clone.return_value = mock_repo
        
        result = self.analyzer.clone_repository(
            'https://github.com/test/repo.git',
            self.temp_dir,
            'test-repo'
        )
        
        self.assertTrue(result['success'])
        self.assertEqual(result['path'], self.temp_dir)
        mock_clone.assert_called_once()

    @patch('git_analyzer.git.Repo.clone_from')
    def test_clone_repository_failure(self, mock_clone):
        """Test repository cloning failure"""
        mock_clone.side_effect = Exception("Clone failed")
        
        result = self.analyzer.clone_repository(
            'https://github.com/test/repo.git',
            self.temp_dir,
            'test-repo'
        )
        
        self.assertFalse(result['success'])
        self.assertIn('Clone failed', result['error'])

    @patch('git_analyzer.git.Repo')
    def test_pull_repository_success(self, mock_repo_class):
        """Test successful repository pull"""
        mock_repo = Mock()
        mock_origin = Mock()
        mock_repo.remotes.origin = mock_origin
        mock_repo_class.return_value = mock_repo
        
        # Mock commit objects before and after pull
        mock_commit_before = Mock()
        mock_commit_before.hexsha = 'abc123'
        mock_commit_after = Mock()
        mock_commit_after.hexsha = 'def456'
        
        mock_repo.head.commit = mock_commit_before
        mock_origin.pull.return_value = None
        
        # After pull, change the head commit
        def side_effect():
            mock_repo.head.commit = mock_commit_after
        mock_origin.pull.side_effect = side_effect
        
        result = self.analyzer.pull_repository(self.temp_dir, 'test-repo')
        
        self.assertTrue(result['success'])
        mock_origin.pull.assert_called_once()

    @patch('git_analyzer.git.Repo')
    def test_pull_repository_failure(self, mock_repo_class):
        """Test repository pull failure"""
        mock_repo_class.side_effect = Exception("Pull failed")
        
        result = self.analyzer.pull_repository(self.temp_dir, 'test-repo')
        
        self.assertFalse(result['success'])
        self.assertIn('Pull failed', result['error'])

    def test_classify_commit_type_feat(self):
        """Test commit type classification for feature"""
        commit_type = self.analyzer.classify_commit_type("feat: add new dashboard component")
        self.assertEqual(commit_type, "feat")

    def test_classify_commit_type_fix(self):
        """Test commit type classification for fix"""
        commit_type = self.analyzer.classify_commit_type("fix: resolve authentication bug")
        self.assertEqual(commit_type, "fix")

    def test_classify_commit_type_docs(self):
        """Test commit type classification for documentation"""
        commit_type = self.analyzer.classify_commit_type("docs: update API documentation")
        self.assertEqual(commit_type, "docs")

    def test_classify_commit_type_other(self):
        """Test commit type classification for unrecognized pattern"""
        commit_type = self.analyzer.classify_commit_type("random commit message")
        self.assertEqual(commit_type, "other")

    def test_is_test_file_true_cases(self):
        """Test test file detection for various test file patterns"""
        test_files = [
            "test_example.py",
            "example.test.js",
            "ExampleTest.java",
            "example_spec.rb",
            "tests/test_helper.py",
            "__tests__/component.test.jsx"
        ]
        
        for file_path in test_files:
            with self.subTest(file_path=file_path):
                self.assertTrue(self.analyzer.is_test_file(file_path))

    def test_is_test_file_false_cases(self):
        """Test test file detection for non-test files"""
        non_test_files = [
            "example.py",
            "component.js",
            "style.css",
            "README.md",
            "config.json"
        ]
        
        for file_path in non_test_files:
            with self.subTest(file_path=file_path):
                self.assertFalse(self.analyzer.is_test_file(file_path))

    def test_determine_role_from_email(self):
        """Test role determination from email patterns"""
        test_cases = [
            ("test@example.com", "Developer"),
            ("qa@company.com", "Tester"),
            ("quality@company.com", "Tester"),
            ("testing@company.com", "Tester"),
            ("admin@company.com", "Developer")
        ]
        
        for email, expected_role in test_cases:
            with self.subTest(email=email):
                role = self.analyzer.determine_role_from_email(email)
                self.assertEqual(role, expected_role)

    def test_determine_team_from_email(self):
        """Test team determination from email patterns"""
        test_cases = [
            ("frontend@company.com", "Frontend"),
            ("backend@company.com", "Backend"),
            ("mobile@company.com", "Mobile"),
            ("devops@company.com", "DevOps"),
            ("user@company.com", "General")
        ]
        
        for email, expected_team in test_cases:
            with self.subTest(email=email):
                team = self.analyzer.determine_team_from_email(email)
                self.assertEqual(team, expected_team)

    @patch('git_analyzer.git.Repo')
    def test_analyze_repository_basic_flow(self, mock_repo_class):
        """Test basic repository analysis flow"""
        # Setup mock repository
        mock_repo = Mock()
        mock_repo_class.return_value = mock_repo
        
        # Mock commits
        mock_commit = Mock()
        mock_commit.hexsha = 'abc123'
        mock_commit.author.name = 'John Doe'
        mock_commit.author.email = 'john@example.com'
        mock_commit.committed_datetime = datetime.now()
        mock_commit.message = 'feat: add new feature'
        mock_commit.stats.total = {'lines': 10, 'files': 2, 'insertions': 8, 'deletions': 2}
        
        # Mock file changes
        mock_file = Mock()
        mock_file.a_path = 'src/component.js'
        mock_file.change_type = 'M'
        mock_file.insertions = 5
        mock_file.deletions = 1
        mock_commit.stats.files = {'src/component.js': {'insertions': 5, 'deletions': 1}}
        
        mock_repo.iter_commits.return_value = [mock_commit]
        
        # Mock database queries
        self.mock_session.query.return_value.filter.return_value.first.return_value = None
        self.mock_session.add = Mock()
        self.mock_session.commit = Mock()
        
        # Run analysis
        result = self.analyzer.analyze_repository(1, self.temp_dir)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['commits_processed'], 1)

    @patch('git_analyzer.git.Repo')
    def test_analyze_repository_with_existing_contributor(self, mock_repo_class):
        """Test repository analysis with existing contributor"""
        # Setup mock repository
        mock_repo = Mock()
        mock_repo_class.return_value = mock_repo
        
        # Mock existing contributor
        mock_contributor = Mock()
        mock_contributor.id = 1
        mock_contributor.name = 'John Doe'
        mock_contributor.email = 'john@example.com'
        
        self.mock_session.query.return_value.filter.return_value.first.return_value = mock_contributor
        
        # Mock commit
        mock_commit = Mock()
        mock_commit.hexsha = 'abc123'
        mock_commit.author.name = 'John Doe'
        mock_commit.author.email = 'john@example.com'
        mock_commit.committed_datetime = datetime.now()
        mock_commit.message = 'fix: bug fix'
        mock_commit.stats.total = {'lines': 5, 'files': 1, 'insertions': 3, 'deletions': 2}
        mock_commit.stats.files = {}
        
        mock_repo.iter_commits.return_value = [mock_commit]
        
        result = self.analyzer.analyze_repository(1, self.temp_dir)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['commits_processed'], 1)

    def test_analyze_repository_invalid_path(self):
        """Test repository analysis with invalid path"""
        result = self.analyzer.analyze_repository(1, '/nonexistent/path')
        
        self.assertFalse(result['success'])
        self.assertIn('error', result)


if __name__ == '__main__':
    unittest.main()
