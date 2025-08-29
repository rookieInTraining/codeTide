from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

Base = declarative_base()

class Repository(Base):
    __tablename__ = 'repositories'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    path = Column(String(500), nullable=False)
    url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    last_analyzed = Column(DateTime)
    is_active = Column(Boolean, default=True)

class Contributor(Base):
    __tablename__ = 'contributors'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    role = Column(String(50))  # developer, tester, devops, etc.
    team = Column(String(100))
    experience_level = Column(String(20))  # junior, mid, senior
    created_at = Column(DateTime, default=datetime.utcnow)

class Commit(Base):
    __tablename__ = 'commits'
    
    id = Column(Integer, primary_key=True)
    sha = Column(String(40), nullable=False, unique=True)
    repository_id = Column(Integer, nullable=False)
    contributor_id = Column(Integer, nullable=False)
    message = Column(Text)
    commit_date = Column(DateTime, nullable=False)
    author_name = Column(String(255))
    author_email = Column(String(255))
    
    # Commit characteristics
    files_changed = Column(Integer, default=0)
    lines_added = Column(Integer, default=0)
    lines_deleted = Column(Integer, default=0)
    commit_type = Column(String(50))  # feature, bugfix, refactor, test, docs
    branch_name = Column(String(255))
    is_merge = Column(Boolean, default=False)
    
    # Analysis fields
    created_at = Column(DateTime, default=datetime.utcnow)

class CommitFile(Base):
    __tablename__ = 'commit_files'
    
    id = Column(Integer, primary_key=True)
    commit_id = Column(Integer, nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50))  # .py, .js, .test.js, etc.
    lines_added = Column(Integer, default=0)
    lines_deleted = Column(Integer, default=0)
    is_test_file = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class MetricSnapshot(Base):
    __tablename__ = 'metric_snapshots'
    
    id = Column(Integer, primary_key=True)
    repository_id = Column(Integer, nullable=False)
    contributor_id = Column(Integer)
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Float, nullable=False)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# Database setup
def create_database(db_path='sample_commit_tracker.db'):
    engine = create_engine(f'sqlite:///{db_path}')
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return engine, Session
