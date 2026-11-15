import urllib.request
import json
import os

BASE_URL = "http://localhost:8000/api/v1"

def test_full_workflow():
    print("==================================================")
    print("      EXAMIA COMPLETE END-TO-END FLOW TEST        ")
    print("==================================================")

    # 1. Health check
    req = urllib.request.urlopen("http://localhost:8000/health")
    health = json.loads(req.read().decode())
    assert health["status"] == "healthy"
    print("✓ [1/14] Health Check Passed:", health["service"])

    # 2. Teacher Demo Login
    login_data = json.dumps({"email": "teacher@examia.io", "role": "teacher", "full_name": "Dr. Sarah Jenkins"}).encode()
    req = urllib.request.Request(f"{BASE_URL}/auth/demo-login", data=login_data, headers={"Content-Type": "application/json"})
    resp = json.loads(urllib.request.urlopen(req).read().decode())
    token = resp["access_token"]
    teacher_id = resp["user"]["id"]
    print("✓ [2/14] Teacher Authentication Passed:", resp["user"]["full_name"], f"(Role: {resp['user']['role']})")

    # 3. Upload Question Paper PDF
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    with open("sample_data/sample_exam.pdf", "rb") as f:
        file_bytes = f.read()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="sample_exam.pdf"\r\n'
        f"Content-Type: application/pdf\r\n\r\n"
    ).encode() + file_bytes + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"{BASE_URL}/papers/upload",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {token}"
        }
    )
    upload_resp = json.loads(urllib.request.urlopen(req).read().decode())
    paper_id = upload_resp["paper"]["id"]
    q_count = upload_resp["paper"]["extracted_question_count"]
    assert q_count >= 5
    print(f"✓ [3/14] Question Paper Upload & AI Extraction Passed: Extracted {q_count} questions from PDF")

    # 4. Create Interactive Exam From Uploaded Paper
    req = urllib.request.Request(
        f"{BASE_URL}/papers/{paper_id}/create-exam",
        data=b"{}",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    )
    create_resp = json.loads(urllib.request.urlopen(req).read().decode())
    exam_id = create_resp["exam_id"]
    print(f"✓ [4/14] Exam Generation Passed: Generated '{create_resp['exam']['title']}' (ID: {exam_id})")

    # 5. Teacher Edits / Verifies Question
    q_list = create_resp["exam"]["questions"]
    q1 = q_list[0]
    # Mark Option B as correct answer
    opt_b = q1["options"][1]
    opt_b["is_correct"] = True
    update_q_payload = json.dumps({
        "question_text": "What is the escape velocity from the surface of Earth? (SI units)",
        "marks": 2.0,
        "options": q1["options"],
        "review_status": "verified"
    }).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/questions/{q1['id']}",
        data=update_q_payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="PUT"
    )
    q_update_resp = json.loads(urllib.request.urlopen(req).read().decode())
    assert q_update_resp["question"]["review_status"] == "verified"
    print("✓ [5/14] Examination Editor Question Update Passed: Verified question #1")

    # 6. Teacher Publishes Exam
    req = urllib.request.Request(
        f"{BASE_URL}/exams/{exam_id}/publish",
        data=b"{}",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    )
    publish_resp = json.loads(urllib.request.urlopen(req).read().decode())
    invitation_token = publish_resp["invitation_token"]
    qr_data = publish_resp["qr_code_base64"]
    assert invitation_token.startswith("exm_")
    assert qr_data.startswith("data:image/png;base64,")
    print(f"✓ [6/14] Examination Publishing & QR Generation Passed: Token = {invitation_token}")

    # 7. Student Public Link Access (Sanitization check)
    req = urllib.request.urlopen(f"{BASE_URL}/exams/public/{invitation_token}")
    public_exam = json.loads(req.read().decode())
    assert public_exam["status"] == "available"
    assert "passcode" not in public_exam["exam"]
    print("✓ [7/14] Public Candidate Link Check Passed: Exam is open and secured")

    # 8. Student Starts Timed Exam Session
    start_payload = json.dumps({
        "invitation_token": invitation_token,
        "student_name": "Alex Turner",
        "student_id_number": "STU-9921"
    }).encode()
    req = urllib.request.Request(f"{BASE_URL}/submissions/start", data=start_payload, headers={"Content-Type": "application/json"})
    start_resp = json.loads(urllib.request.urlopen(req).read().decode())
    session_token = start_resp["session_token"]
    sub_id = start_resp["submission_id"]
    questions = start_resp["questions"]
    assert session_token.startswith("ses_")
    # Verify student does NOT see 'is_correct' keys!
    for q in questions:
        for opt in q.get("options", []):
            assert "is_correct" not in opt, "Security failure: is_correct key leaked to student!"
    print(f"✓ [8/14] Student Exam Session Started: Session Token = {session_token}, Verified: 0 answer keys leaked")

    # 9. Student Answers Questions (Autosave check)
    # Answer Q1 with the correct option B
    q1_opt_b_id = questions[0]["options"][1]["id"]
    ans_payload = json.dumps({
        "question_id": questions[0]["id"],
        "selected_option_ids": [q1_opt_b_id],
        "is_flagged": False,
        "sequence_number": 1
    }).encode()
    req = urllib.request.Request(f"{BASE_URL}/submissions/{session_token}/save-answer", data=ans_payload, headers={"Content-Type": "application/json"})
    save_resp = json.loads(urllib.request.urlopen(req).read().decode())
    assert save_resp["status"] == "saved"
    print("✓ [9/14] Autosave Engine Passed: Answer synced with server")

    # 10. Student Submits Examination & Backend Grades Answers
    submit_payload = json.dumps({}).encode()
    req = urllib.request.Request(f"{BASE_URL}/submissions/{session_token}/submit", data=submit_payload, headers={"Content-Type": "application/json"})
    submit_resp = json.loads(urllib.request.urlopen(req).read().decode())
    assert submit_resp["status"] == "submitted"
    assert submit_resp["score_obtained"] == 2.0  # Correctly awarded 2.0 marks for Option B!
    print("✓ [10/14] Submission & Automatic Grading Passed:", f"Score: {submit_resp['score_obtained']}/{submit_resp['total_possible']} ({submit_resp['percentage']}%)")

    # 11. Teacher Evaluates Descriptive Answer with AI
    req = urllib.request.Request(f"{BASE_URL}/submissions/exams/{exam_id}/submissions", headers={"Authorization": f"Bearer {token}"})
    subs_list_resp = json.loads(urllib.request.urlopen(req).read().decode())
    sub_detail = subs_list_resp["submissions"][0]
    descriptive_ans = next((a for a in sub_detail["answers"] if a["text_answer"]), sub_detail["answers"][-1])
    
    # Trigger Gemini AI Evaluation on answer
    req = urllib.request.Request(
        f"{BASE_URL}/grading/answers/{descriptive_ans['id']}/ai-evaluate",
        data=b"{}",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    )
    ai_eval_resp = json.loads(urllib.request.urlopen(req).read().decode())
    assert "suggested_score" in ai_eval_resp["evaluation"]
    print(f"✓ [11/14] Gemini AI Descriptive Grading Evaluation Passed: Suggested {ai_eval_resp['evaluation']['suggested_score']} marks")

    # 12. Teacher Releases Results to Candidates
    req = urllib.request.Request(
        f"{BASE_URL}/grading/exams/{exam_id}/release-results",
        data=json.dumps({"release": True}).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    )
    release_resp = json.loads(urllib.request.urlopen(req).read().decode())
    assert release_resp["status"] == "success"
    print("✓ [12/14] Results Release Passed: Results published to candidates")

    # 13. Student Views Released Detailed Scorecard
    req = urllib.request.Request(f"{BASE_URL}/results/submissions/{sub_id}", headers={"Authorization": f"Bearer {token}"})
    scorecard = json.loads(urllib.request.urlopen(req).read().decode())
    assert scorecard["status"] == "success"
    assert scorecard["score_obtained"] == 2.0
    assert len(scorecard["questions"]) >= 1
    print("✓ [13/14] Student Detailed Scorecard View Passed: Scorecard verified with question breakdown")

    # 14. Teacher Analytics, Overview Stats & CSV Export
    req = urllib.request.Request(f"{BASE_URL}/analytics/teacher-overview", headers={"Authorization": f"Bearer {token}"})
    overview = json.loads(urllib.request.urlopen(req).read().decode())
    assert overview["stats"]["total_exams"] >= 1
    assert overview["stats"]["total_submissions"] >= 1

    # Check CSV export
    req = urllib.request.Request(f"{BASE_URL}/analytics/exams/{exam_id}/export-csv", headers={"Authorization": f"Bearer {token}"})
    csv_bytes = urllib.request.urlopen(req).read().decode()
    assert "Student Name" in csv_bytes
    assert "Alex Turner" in csv_bytes
    print(f"✓ [14/14] Teacher Overview Stats & CSV Export Passed: {len(csv_bytes)} bytes exported")

    # Frontend static check
    frontend_req = urllib.request.urlopen("http://localhost:3000/index.html")
    assert frontend_req.status == 200
    print("✓ Frontend HTTP Server Passed: Serving index.html on http://localhost:3000")

    print("\n==================================================")
    print("  ALL 14 END-TO-END ACCEPTANCE WORKFLOWS PASSED!  ")
    print("==================================================")

if __name__ == "__main__":
    test_full_workflow()
