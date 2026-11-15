import uuid
from typing import Generator
from sqlalchemy import create_engine, TypeDecorator, String, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB as PG_JSONB

from app.config import settings

class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise uses CHAR(36), storing as stringified hex.
    """
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == "postgresql":
            return str(value)
        else:
            if isinstance(value, uuid.UUID):
                return str(value)
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return str(value)

# Connect args
connect_args = {}
db_url = settings.effective_database_url
if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    db_url,
    connect_args=connect_args,
    echo=False,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    import app.models  # Ensure all models are registered
    Base.metadata.create_all(bind=engine)
    
    # Run safe column migrations for existing tables
    from sqlalchemy import inspect, text
    try:
        inspector = inspect(engine)
        if "questions" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("questions")]
            with engine.connect() as conn:
                if "confidence_score" not in columns:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN confidence_score FLOAT DEFAULT 0.95"))
                if "subquestions" not in columns:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN subquestions JSON"))
                if "source_metadata" not in columns:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN source_metadata JSON"))
                conn.commit()

        if "uploaded_papers" in inspector.get_table_names():
            paper_columns = [c["name"] for c in inspector.get_columns("uploaded_papers")]
            with engine.connect() as conn:
                if "document_type" not in paper_columns:
                    conn.execute(text("ALTER TABLE uploaded_papers ADD COLUMN document_type VARCHAR(50) DEFAULT 'question_paper'"))
                conn.commit()

        if "profiles" in inspector.get_table_names():
            profile_columns = [c["name"] for c in inspector.get_columns("profiles")]
            with engine.connect() as conn:
                if "username" not in profile_columns:
                    conn.execute(text("ALTER TABLE profiles ADD COLUMN username VARCHAR(100)"))
                if "password_hash" not in profile_columns:
                    conn.execute(text("ALTER TABLE profiles ADD COLUMN password_hash VARCHAR(255)"))
                if "department" not in profile_columns:
                    conn.execute(text("ALTER TABLE profiles ADD COLUMN department VARCHAR(100)"))
                if "phone" not in profile_columns:
                    conn.execute(text("ALTER TABLE profiles ADD COLUMN phone VARCHAR(50)"))
                if "is_onboarded" not in profile_columns:
                    conn.execute(text("ALTER TABLE profiles ADD COLUMN is_onboarded BOOLEAN DEFAULT 0"))
                conn.commit()
    except Exception as e:
        # Tables might be freshly created or engine in read-only mode
        pass
