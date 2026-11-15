// =====================================================================
// EXAMIA DYNAMIC SIDEBAR NAVIGATION COMPONENT
// =====================================================================

import { auth } from '../auth.js';
import { sound } from '../sound.js';

export function renderSidebar(currentPath = "") {
  const user = auth.user || {};

  const links = [
    { path: "#dashboard", label: "Overview", icon: "dashboard" },
    { path: "#ai-generator", label: "AI Generator", icon: "auto_stories" },
    { path: "#exams", label: "Examinations", icon: "assignment" },
    { path: "#papers", label: "Question Papers", icon: "upload_file" },
    { path: "#question-bank", label: "Question Bank", icon: "menu_book" },
    { path: "#my-results", label: "Results & Submissions", icon: "verified" },
    { path: "#analytics", label: "Analytics", icon: "analytics" },
    { path: "#settings", label: "Settings", icon: "settings" }
  ];

  return `
    <aside class="dashboard-sidebar" id="dashboard-sidebar">
      <div class="dashboard-sidebar-header">
        <a href="#dashboard" style="display:flex; align-items:center; gap:0.5rem; text-decoration:none;">
          <div style="width:34px; height:34px; background:var(--accent-primary); border:2px solid #171717; border-radius:8px; display:flex; align-items:center; justify-content:center; box-shadow:2px 2px 0px #171717;">
            <span class="material-symbols-outlined" style="font-size:22px; color:#171717;">school</span>
          </div>
          <span style="font-family:var(--font-heading); font-size:1.25rem; font-weight:800; text-transform:uppercase; letter-spacing:-0.02em;">EXAMIA</span>
        </a>
        <button id="sidebar-toggle-btn" class="neo-btn neo-btn-sm" style="padding:4px 8px; display:none;" onclick="document.getElementById('dashboard-sidebar').classList.toggle('open')">✕</button>
      </div>

      <nav class="dashboard-sidebar-nav">
        <span class="uppercase-label" style="padding:0.25rem 0.75rem; color:var(--text-muted); font-size:0.7rem;">Platform</span>
        ${links.map(l => {
          const isActive = currentPath.startsWith(l.path) || (l.path === "#dashboard" && (currentPath === "" || currentPath === "#" || currentPath.startsWith("#overview") || currentPath.startsWith("#teacher-dashboard") || currentPath.startsWith("#student-dashboard")));
          return `
            <a href="${l.path}" class="dashboard-nav-item ${isActive ? 'active' : ''}">
              <span class="material-symbols-outlined" style="font-size:20px;">${l.icon}</span>
              <span>${l.label}</span>
            </a>
          `;
        }).join('')}
      </nav>

      <div class="dashboard-sidebar-footer">
        <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.75rem;">
          <div style="width:36px; height:36px; border-radius:8px; background:var(--accent-primary); border:2px solid #171717; display:flex; align-items:center; justify-content:center; font-weight:bold; overflow:hidden;">
            ${user.avatar_url ? `<img src="${user.avatar_url}" style="width:100%; height:100%; object-fit:cover;" />` : (user.full_name || 'U')[0]}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${user.full_name || 'User'}</div>
            <div style="display:flex; align-items:center; gap:0.35rem;">
              ${user.username ? `<span style="font-size:0.7rem; color:var(--text-muted); font-family:var(--font-mono); font-weight:700; overflow:hidden; text-overflow:ellipsis;">@${user.username}</span>` : `<span style="font-size:0.7rem; color:var(--text-muted);">${user.school_organization || 'Examia User'}</span>`}
            </div>
          </div>
        </div>
        <button id="btn-logout" class="neo-btn neo-btn-sm neo-btn-white" style="width:100%; justify-content:center;">
          <span class="material-symbols-outlined" style="font-size:18px;">logout</span> Logout
        </button>
      </div>
    </aside>
  `;
}
