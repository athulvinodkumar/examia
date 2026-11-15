"""
Tests for AI Exam Generator from Syllabus / Content
Verifies topic analysis, blueprint resolution, question synthesis,
and custom vs autonomous AI generation modes.
"""

import os
import pytest
from app.services.ai_exam_generator import AIExamGenerator
from app.models.exam import Exam
from app.models.question import Question

SAMPLE_SYLLABUS = """
COMPUTER SCIENCE 301: OPERATING SYSTEMS & DISTRIBUTED COMPUTING

Module 1: Process Management & CPU Scheduling
- Concepts: Process Control Block (PCB), Context Switching, Process States (New, Ready, Running, Waiting, Terminated).
- Scheduling Algorithms: First-Come First-Served (FCFS), Shortest Job First (SJF), Round Robin (RR), Priority Scheduling.
- Process Synchronization: Race conditions, Critical Section Problem, Peterson's Solution, Semaphores, Mutex locks.

Module 2: Deadlocks & Resource Allocation
- Necessary conditions for deadlock: Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait.
- Deadlock Handling: Deadlock Prevention, Banker's Algorithm for Deadlock Avoidance, Detection and Recovery.

Module 3: Memory Management & Virtual Memory
- Contiguous memory allocation, Fragmentation (Internal vs External), Paging, Segmentation.
- Virtual Memory: Demand Paging, Page Faults, Page Replacement Algorithms (FIFO, LRU, Optimal).
- Numerical formula: Effective Memory Access Time EMAT = (1 - p) * ma + p * page_fault_time.

Module 4: Storage & File Systems
- Disk Scheduling: FCFS, SSTF, SCAN, C-SCAN, LOOK.
- File system implementation, Directory structures, Allocation methods (Contiguous, Linked, Indexed).
"""

def test_analyze_syllabus_content():
    analysis = AIExamGenerator.analyze_syllabus_content(SAMPLE_SYLLABUS, "OS_Syllabus.pdf")
    
    assert "subject" in analysis
    assert "topics" in analysis
    assert len(analysis["topics"]) >= 2
    assert "suggested_blueprint" in analysis
    assert "mcq_single" in analysis["suggested_blueprint"]
    assert analysis["suggested_total_marks"] > 0


def test_resolve_blueprint_custom_mode():
    config = {
        "mode": "custom",
        "question_types_config": {
            "mcq_single": {"count": 4, "marks": 2.0},
            "true_false": {"count": 2, "marks": 1.0},
            "short_answer": {"count": 3, "marks": 3.0},
            "numerical": {"count": 1, "marks": 5.0}
        }
    }
    blueprint = AIExamGenerator._resolve_blueprint(config, SAMPLE_SYLLABUS)
    assert blueprint["mcq_single"]["count"] == 4
    assert blueprint["mcq_single"]["marks_per_question"] == 2.0
    assert blueprint["true_false"]["count"] == 2
    assert blueprint["short_answer"]["count"] == 3
    assert blueprint["numerical"]["count"] == 1


def test_resolve_blueprint_auto_mode():
    config = {
        "mode": "auto",
        "target_total_marks": 50
    }
    blueprint = AIExamGenerator._resolve_blueprint(config, SAMPLE_SYLLABUS)
    assert "mcq_single" in blueprint
    assert "short_answer" in blueprint
    assert sum(spec["count"] * spec["marks_per_question"] for spec in blueprint.values()) == pytest.approx(50.0, 5.0)


def test_generate_exam_from_content():
    from app.database import SessionLocal, init_db
    from app.models.user import Profile
    import uuid

    init_db()
    db = SessionLocal()
    teacher_id = str(uuid.uuid4())
    try:
        # Create a mock teacher profile
        teacher = Profile(
            id=teacher_id,
            email=f"gen_teacher_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Generator Test Teacher",
            role="teacher"
        )
        db.add(teacher)
        db.commit()

        config = {
            "mode": "custom",
            "exam_title": "Operating Systems Midterm",
            "duration_minutes": 60,
            "difficulty": "medium",
            "question_types_config": {
                "mcq_single": {"count": 3, "marks": 2.0},
                "true_false": {"count": 2, "marks": 1.0},
                "short_answer": {"count": 2, "marks": 3.0},
                "numerical": {"count": 1, "marks": 5.0}
            }
        }

        exam, questions = AIExamGenerator.generate_exam_from_content(
            text=SAMPLE_SYLLABUS,
            config=config,
            teacher_id=teacher_id,
            db=db
        )

        assert exam is not None
        assert exam.id is not None
        assert "Operating Systems Midterm" in exam.title
        assert len(questions) == 8  # 3 + 2 + 2 + 1
        assert exam.total_marks == (3 * 2.0) + (2 * 1.0) + (2 * 3.0) + (1 * 5.0)  # 6 + 2 + 6 + 5 = 19.0

        # Verify questions in database
        db_questions = db.query(Question).filter(Question.exam_id == exam.id).all()
        assert len(db_questions) == 8

        # Verify MCQ options and answer keys
        mcq_questions = [q for q in db_questions if q.question_type == "mcq_single"]
        assert len(mcq_questions) == 3
        for mcq in mcq_questions:
            assert len(mcq.options) >= 2
            assert any(opt.is_correct for opt in mcq.options)
            assert mcq.review_status == "verified"

        # Verify Numerical question
        num_questions = [q for q in db_questions if q.question_type == "numerical"]
        assert len(num_questions) == 1
        assert num_questions[0].numerical_expected is not None

        # Verify Short Answer question
        sa_questions = [q for q in db_questions if q.question_type == "short_answer"]
        assert len(sa_questions) == 2
        for sa in sa_questions:
            assert sa.sample_solution is not None
            assert sa.descriptive_rubric is not None
    finally:
        # Cleanup
        try:
            db.query(Question).filter(Question.exam_id == exam.id).delete()
            db.query(Exam).filter(Exam.id == exam.id).delete()
            db.query(Profile).filter(Profile.id == teacher_id).delete()
            db.commit()
        except Exception:
            pass
        db.close()
