// =====================================================================
// EXAMIA GLOBAL APPLICATION STATE
// =====================================================================

export const state = {
  currentUser: null,
  activeExam: null,
  examsList: [],
  papersList: [],
  submissionsList: [],
  questionBank: [],
  notifications: [],
  unreadNotificationsCount: 0,
  
  // Student exam session
  currentStudentSession: null,
  activeQuestionIndex: 0,
  studentAnswers: {},
  
  listeners: {},

  subscribe(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  },

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
};
