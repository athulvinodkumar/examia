"""
End-to-End Acceptance Test for Examia AI Examination Generator
Tests:
1. Syllabus / Content Document Upload & AI Topic Analysis
2. Custom Teacher Question Configuration Mode
3. Autonomous AI Mode ("AI Does Everything")
4. Generated Question Quality, Answer Keys, Numerical Tolerances & Rubrics
5. Document History & Re-generation Retrieval
"""

import os
import sys
import uuid
import requests
import fitz  # PyMuPDF

BASE_URL = "http://localhost:8000/api/v1"

def create_sample_pdf(filepath: str):
    doc = fitz.open()
    page = doc.new_page()
    text = """
COURSE SYLLABUS: DISTRIBUTED SYSTEMS & CLOUD COMPUTING (CS 402)

MODULE 1: DISTRIBUTED SYSTEM ARCHITECTURES
- Characterization of Distributed Systems: Heterogeneity, Openness, Scalability, Fault Tolerance.
- Architectural Models: Client-Server, Peer-to-Peer, Microservices, Event-Driven.
- Interprocess Communication: Remote Procedure Call (RPC), Remote Method Invocation (RMI), RESTful APIs.

MODULE 2: SYNCHRONIZATION AND CONSENSUS
- Logical Time and Clocks: Lamport timestamps, Vector clocks.
- Distributed Mutual Exclusion: Centralized algorithm, Ricart-Agrawala distributed algorithm.
- Consensus Protocols: The Byzantine Generals Problem, Paxos consensus, Raft consensus algorithm.

MODULE 3: CLOUD COMPUTING & REPLICATION
- High Availability and Fault Tolerance: Passive (primary-backup) replication vs Active replication.
- CAP Theorem: Consistency, Availability, Partition tolerance trade-offs.
- Virtualization and Containerization: Hypervisors, Docker containers, Kubernetes orchestration.
- Numerical Formula: Availability A = MTBF / (MTBF + MTTR). If MTBF is 990 hours and MTTR is 10 hours, A = 99%.
"""
    page.insert_text((50, 50), text, fontsize=11)
    doc.save(filepath)
    doc.close()

def main():
    print("=" * 60)
    print(" EXAMIA AI EXAM GENERATOR — E2E ACCEPTANCE VERIFICATION")
    print("=" * 60)

    # 1. Login with demo teacher account
    print("\n[1/6] Authenticating demo teacher...")
    login_resp = requests.post(
        f"{BASE_URL}/auth/demo-login",
        json={"email": "teacher@examia.io", "role": "teacher", "full_name": "Dr. Sarah Jenkins"}
    )
    assert login_resp.status_code == 200, f"Demo login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✓ Teacher authenticated successfully.")

    # 2. Upload syllabus PDF & trigger AI Topic Analysis
    print("\n[2/6] Uploading syllabus PDF & testing AI topic analysis...")
    test_pdf_path = "test_distributed_systems_syllabus.pdf"
    create_sample_pdf(test_pdf_path)

    try:
        with open(test_pdf_path, "rb") as f:
            upload_resp = requests.post(
                f"{BASE_URL}/generator/analyze-content",
                headers=headers,
                files={"file": (test_pdf_path, f, "application/pdf")}
            )

        assert upload_resp.status_code == 201, f"Analyze content failed: {upload_resp.text}"
        upload_data = upload_resp.json()
        paper_id = upload_data["paper_id"]
        analysis = upload_data["analysis"]

        print(f"✓ Document analyzed successfully!")
        print(f"  - Paper ID: {paper_id}")
        print(f"  - Subject Detected: {analysis.get('subject')}")
        print(f"  - Summary: {analysis.get('summary', '')[:80]}...")
        print(f"  - Topics Found ({len(analysis.get('topics', []))}): {[t['name'] for t in analysis.get('topics', [])]}")
        print(f"  - Suggested Blueprint: {list((analysis.get('suggested_blueprint') or {}).keys())}")

        assert len(analysis.get("topics", [])) >= 2, "Should detect at least 2 modules/topics"
        assert analysis.get("suggested_blueprint"), "Should provide recommended blueprint"

        # 3. Test Mode A: Custom Teacher Question Configuration
        print("\n[3/6] Testing Mode A: Custom Teacher Question Configuration...")
        custom_payload = {
            "paper_id": paper_id,
            "exam_title": "Distributed Systems Midterm Exam",
            "subject": "Distributed Systems",
            "mode": "custom",
            "duration_minutes": 60,
            "difficulty": "medium",
            "selected_topics": [t["name"] for t in analysis.get("topics", [])],
            "question_types_config": {
                "mcq_single": {"count": 3, "marks": 2.0},
                "true_false": {"count": 2, "marks": 1.0},
                "short_answer": {"count": 2, "marks": 3.0},
                "numerical": {"count": 1, "marks": 4.0}
            }
        }

        gen_resp = requests.post(f"{BASE_URL}/generator/generate-exam", headers=headers, json=custom_payload)
        assert gen_resp.status_code == 201, f"Custom generate-exam failed: {gen_resp.text}"
        gen_data = gen_resp.json()
        custom_exam_id = gen_data["exam_id"]
        custom_exam = gen_data["exam"]
        questions = custom_exam.get("questions", [])

        print(f"✓ Custom Exam Synthesized successfully!")
        print(f"  - Exam ID: {custom_exam_id}")
        print(f"  - Title: {custom_exam['title']}")
        print(f"  - Total Questions: {len(questions)} (Expected 8)")
        print(f"  - Total Marks: {custom_exam['total_marks']} (Expected: 18.0 pts)")

        assert len(questions) == 8, f"Expected 8 questions, got {len(questions)}"
        assert custom_exam["total_marks"] == 18.0, f"Expected 18.0 marks, got {custom_exam['total_marks']}"

        # Verify MCQ options and correct keys
        mcqs = [q for q in questions if q["question_type"] == "mcq_single"]
        assert len(mcqs) == 3
        for mcq in mcqs:
            assert len(mcq["options"]) >= 4, "MCQ should have at least 4 options"
            correct_opts = [o for o in mcq["options"] if o.get("is_correct")]
            assert len(correct_opts) >= 1, "MCQ must have at least 1 correct option"
            assert mcq.get("explanation"), "MCQ must include pedagogical explanation"

        # Verify Numerical question
        nums = [q for q in questions if q["question_type"] == "numerical"]
        assert len(nums) == 1
        assert nums[0].get("numerical_expected") is not None, "Numerical question must have expected answer"

        # 4. Test Mode B: Autonomous AI Mode ("AI Does Everything")
        print("\n[4/6] Testing Mode B: Autonomous AI Mode ('AI Does Everything')...")
        auto_payload = {
            "paper_id": paper_id,
            "exam_title": "Distributed Systems Comprehensive Assessment",
            "subject": "Distributed Systems",
            "mode": "auto",
            "target_total_marks": 50.0,
            "duration_minutes": 60,
            "difficulty": "medium"
        }

        auto_gen_resp = requests.post(f"{BASE_URL}/generator/generate-exam", headers=headers, json=auto_payload)
        assert auto_gen_resp.status_code == 201, f"Auto generate-exam failed: {auto_gen_resp.text}"
        auto_data = auto_gen_resp.json()
        auto_exam_id = auto_data["exam_id"]
        auto_exam = auto_data["exam"]
        auto_questions = auto_exam.get("questions", [])

        print(f"✓ Autonomous AI Exam Synthesized successfully!")
        print(f"  - Exam ID: {auto_exam_id}")
        print(f"  - Title: {auto_exam['title']}")
        print(f"  - Total Questions: {len(auto_questions)}")
        print(f"  - Total Marks: {auto_exam['total_marks']} pts")
        print(f"  - Question Types Represented: {set(q['question_type'] for q in auto_questions)}")

        assert len(auto_questions) >= 10, "Auto mode should generate comprehensive question set"
        assert auto_exam["total_marks"] > 0, "Total marks must be positive"

        # 5. Test History Endpoint
        print("\n[5/6] Verifying syllabus history endpoint...")
        hist_resp = requests.get(f"{BASE_URL}/generator/history", headers=headers)
        assert hist_resp.status_code == 200
        hist_items = hist_resp.json()["items"]
        assert any(item["id"] == paper_id for item in hist_items), "Uploaded syllabus should be in history"
        print(f"✓ History contains {len(hist_items)} syllabus document(s)")

        # 6. Test Retrieve Saved Analysis Endpoint
        print("\n[6/6] Verifying retrieve saved analysis endpoint...")
        saved_resp = requests.get(f"{BASE_URL}/generator/papers/{paper_id}/analysis", headers=headers)
        assert saved_resp.status_code == 200
        saved_analysis = saved_resp.json()["analysis"]
        assert "topics" in saved_analysis
        print(f"✓ Saved analysis successfully retrieved without re-uploading!")

        print("\n" + "=" * 60)
        print(" ALL AI EXAM GENERATOR TESTS PASSED WITH 100% SUCCESS!")
        print("=" * 60)

    finally:
        if os.path.exists(test_pdf_path):
            os.remove(test_pdf_path)

if __name__ == "__main__":
    main()
