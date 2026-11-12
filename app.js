const STORAGE_KEY = "attendly-school-data-v1";
const page = document.querySelector("#page-content");
const navLinks = [...document.querySelectorAll("[data-view]")];
const palette = ["avatar-0", "avatar-1", "avatar-2", "avatar-3", "avatar-4", "avatar-5"];
const demoStudents = [
  { id: "STU-2401", name: "Aarav Sharma", email: "aarav.sharma@school.edu", course: "Computer Science", year: "Year 2", joined: "2025-08-12" },
  { id: "STU-2402", name: "Priya Patel", email: "priya.patel@school.edu", course: "Information Technology", year: "Year 1", joined: "2025-08-18" },
  { id: "STU-2403", name: "Ishaan Mehta", email: "ishaan.mehta@school.edu", course: "Computer Science", year: "Year 3", joined: "2024-08-08" },
  { id: "STU-2404", name: "Ananya Rao", email: "ananya.rao@school.edu", course: "Electronics", year: "Year 2", joined: "2025-08-12" },
  { id: "STU-2405", name: "Rohan Das", email: "rohan.das@school.edu", course: "Information Technology", year: "Year 1", joined: "2025-08-18" },
];

const today = dateKey(new Date());
let currentView = "overview";
let attendanceDate = today;
let state;
let toastTimer;

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function prettyDate(value, options = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, options);
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  const parsed = JSON.parse(saved);
  if (!parsed || !Array.isArray(parsed.students) || !Array.isArray(parsed.attendance) || !Array.isArray(parsed.blocks)) {
    throw new Error("Saved school data is invalid. Clear this site's saved data to start again.");
  }
  return parsed;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function hashBlock(block) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure SHA-256 is unavailable in this browser context. Open this site on localhost or HTTPS to write to the ledger.");
  }
  const bytes = new TextEncoder().encode(JSON.stringify(block));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function appendBlock(type, student, details) {
  const previous = state.blocks.at(-1);
  const block = {
    index: state.blocks.length,
    timestamp: new Date().toISOString(),
    type,
    studentId: student.id,
    studentName: student.name,
    details,
    previousHash: previous?.hash ?? "0".repeat(64),
  };
  block.hash = await hashBlock(block);
  state.blocks.push(block);
  saveState();
}

async function createInitialState() {
  const initial = { students: demoStudents, attendance: [], blocks: [] };
  const genesis = {
    index: 0,
    timestamp: new Date().toISOString(),
    type: "GENESIS",
    studentId: "SYSTEM",
    studentName: "Attendly",
    details: "Student attendance ledger created",
    previousHash: "0".repeat(64),
  };
  genesis.hash = await hashBlock(genesis);
  initial.blocks.push(genesis);
  state = initial;
  saveState();
  for (const student of demoStudents) {
    await appendBlock("ADMISSION", student, `Enrolled in ${student.course} · ${student.year}`);
  }
  const sampleMarks = ["present", "present", "late", "present", "absent"];
  for (let index = 0; index < demoStudents.length; index += 1) {
    const student = demoStudents[index];
    const status = sampleMarks[index];
    state.attendance.push({ studentId: student.id, date: today, status, updatedAt: new Date().toISOString() });
    await appendBlock("ATTENDANCE", student, `Marked ${status} for ${today}`);
  }
  saveState();
}

function showToast(message, isError = false) {
  const region = document.querySelector("#toast-region");
  region.innerHTML = `<div class="toast${isError ? " error" : ""}"><span class="toast-icon">${isError ? "!" : "✓"}</span><span>${escapeHtml(message)}</span></div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { region.innerHTML = ""; }, 3400);
}

function studentAvatar(student, index) {
  return `<span class="avatar student-avatar ${palette[index % palette.length]}">${escapeHtml(initials(student.name))}</span>`;
}

function studentCell(student, index) {
  return `<div class="student-cell">${studentAvatar(student, index)}<span class="student-cell-copy"><strong>${escapeHtml(student.name)}</strong><span>${escapeHtml(student.id)}</span></span></div>`;
}

function statusPill(status) {
  const label = status ? status[0].toUpperCase() + status.slice(1) : "Not marked";
  return status ? `<span class="status status-${escapeHtml(status)}">${escapeHtml(label)}</span>` : '<span class="muted">Not marked</span>';
}

function heading(eyebrow, title, subtitle, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="page-subtitle">${subtitle}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ""}</div>`;
}

function emptyRow(message, columns) {
  return `<tr><td class="table-empty" colspan="${columns}">${message}</td></tr>`;
}

function getAttendance(studentId, date = today) {
  return state.attendance.find((item) => item.studentId === studentId && item.date === date);
}

function latestActivity() {
  return [...state.blocks].filter((block) => block.type !== "GENESIS").reverse().slice(0, 5);
}

function dashboard() {
  const marked = state.students.filter((student) => getAttendance(student.id));
  const present = marked.filter((student) => getAttendance(student.id).status === "present").length;
  const late = marked.filter((student) => getAttendance(student.id).status === "late").length;
  const absent = marked.filter((student) => getAttendance(student.id).status === "absent").length;
  const attendanceRate = state.students.length ? Math.round((present / state.students.length) * 100) : 0;
  const activity = latestActivity();
  const chartDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - 6 + index);
    const key = dateKey(day);
    const count = state.attendance.filter((item) => item.date === key && item.status === "present").length;
    return { day, count };
  });
  const maxCount = Math.max(1, ...chartDays.map((item) => item.count), state.students.length);
  const chartBars = chartDays.map((item) => {
    const percentage = Math.max(3, Math.round((item.count / maxCount) * 100));
    const missing = Math.max(3, 100 - percentage);
    return `<div class="chart-column" title="${prettyDate(dateKey(item.day), { weekday: "long", month: "short", day: "numeric" })}: ${item.count} present"><span class="chart-bar present" style="height:${percentage}%"></span><span class="chart-bar absent" style="height:${missing}%"></span></div>`;
  }).join("");
  return `${heading("SCHOOL OVERVIEW", "Good morning, Admin 👋", "Here’s what’s happening at your school today.", `<a class="button button-secondary" href="#attendance" data-view="attendance"><svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17"/></svg>Take attendance</a><a class="button button-primary" href="#admissions" data-view="admissions"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New admission</a>`)}
    <section class="stats-grid" aria-label="School statistics">
      <article class="stat-card"><div class="stat-top"><span class="stat-label">Total students</span><span class="stat-icon teal"><svg viewBox="0 0 24 24"><path d="M16 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H7.4A3.4 3.4 0 0 0 4 18.4V20"/><circle cx="10" cy="7.5" r="3.5"/></svg></span></div><div class="stat-value">${state.students.length}<span class="stat-meta">students</span></div><div class="stat-foot"><strong>Active</strong> enrollment</div></article>
      <article class="stat-card"><div class="stat-top"><span class="stat-label">Present today</span><span class="stat-icon blue"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.2 4.2L19 7"/></svg></span></div><div class="stat-value">${present}<span class="stat-meta">of ${state.students.length}</span></div><div class="stat-foot"><strong>${attendanceRate}%</strong> attendance rate</div></article>
      <article class="stat-card"><div class="stat-top"><span class="stat-label">Late arrivals</span><span class="stat-icon orange"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg></span></div><div class="stat-value">${late}<span class="stat-meta">today</span></div><div class="stat-foot">Needs a quick follow-up</div></article>
      <article class="stat-card"><div class="stat-top"><span class="stat-label">Ledger records</span><span class="stat-icon purple"><svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.8 7.5 4.3 7.5-4.3"/></svg></span></div><div class="stat-value">${Math.max(0, state.blocks.length - 1)}<span class="stat-meta">blocks</span></div><div class="stat-foot"><strong>Verified</strong> hash chain</div></article>
    </section>
    <section class="dashboard-grid">
      <article class="panel"><div class="panel-header"><div><h2 class="panel-title">Attendance overview</h2><p class="panel-description">Present students over the last 7 days</p></div><div class="chart-legend"><span class="legend-item"><i class="legend-dot present"></i>Present</span><span class="legend-item"><i class="legend-dot absent"></i>Remaining</span></div></div><div class="chart-wrap"><div class="chart"><div class="chart-y"><span>${maxCount}</span><span>${Math.ceil(maxCount * .75)}</span><span>${Math.ceil(maxCount * .5)}</span><span>0</span></div><div class="chart-main"><div class="chart-plot">${chartBars}</div><div class="chart-x">${chartDays.map((item) => `<span>${item.day.toLocaleDateString(undefined, { weekday: "short" })}</span>`).join("")}</div></div></div><p class="chart-note">${state.students.length ? "Attendance entries are recorded by school day." : "Add students to start tracking attendance."}</p></div></article>
      <article class="panel activity-panel"><div class="panel-header"><div><h2 class="panel-title">Recent activity</h2><p class="panel-description">Latest updates from your school</p></div><a class="text-link" href="#ledger" data-view="ledger">View ledger <span>→</span></a></div>
        <div class="activity-list">${activity.length ? activity.map((item, index) => `<div class="activity-item"><span class="avatar activity-avatar ${palette[index % palette.length]}">${escapeHtml(initials(item.studentName))}</span><span class="activity-copy"><strong>${escapeHtml(item.studentName)} · ${item.type === "ADMISSION" ? "admitted" : "attendance updated"}</strong><span>${escapeHtml(item.details)}</span></span><span class="activity-time">${new Date(item.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>`).join("") : '<div class="table-empty">Your school activity will appear here.</div>'}</div>
        <div class="panel-footer"><a class="text-link" href="#ledger" data-view="ledger">See all activity <span>→</span></a></div>
      </article>
    </section>
    <section class="quick-grid section-spacer" aria-label="Quick actions">
      <a class="quick-card" href="#admissions" data-view="admissions"><span class="quick-icon"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span><span><strong>Register a student</strong><span>Start a new admission</span></span></a>
      <a class="quick-card" href="#students" data-view="students"><span class="quick-icon"><svg viewBox="0 0 24 24"><path d="M16 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H7.4A3.4 3.4 0 0 0 4 18.4V20"/><circle cx="10" cy="7.5" r="3.5"/></svg></span><span><strong>Browse students</strong><span>View your student directory</span></span></a>
      <a class="quick-card" href="#ledger" data-view="ledger"><span class="quick-icon"><svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.8 7.5 4.3 7.5-4.3"/></svg></span><span><strong>Check the ledger</strong><span>Verify linked school records</span></span></a>
    </section>
    <section class="panel table-panel"><div class="panel-header"><div><h2 class="panel-title">Today’s attendance</h2><p class="panel-description">${prettyDate(today, { weekday: "long", month: "long", day: "numeric" })} · ${present} present · ${absent} absent</p></div><a class="text-link" href="#attendance" data-view="attendance">Manage attendance <span>→</span></a></div>
      <div class="table-scroll"><table><thead><tr><th>Student</th><th>Course</th><th>Year</th><th>Status</th></tr></thead><tbody>${state.students.slice(0, 5).map((student, index) => { const entry = getAttendance(student.id); return `<tr><td>${studentCell(student, index)}</td><td>${escapeHtml(student.course)}</td><td>${escapeHtml(student.year)}</td><td>${statusPill(entry?.status)}</td></tr>`; }).join("") || emptyRow("No students yet. Add your first student to get started.", 4)}</tbody></table></div>
    </section>`;
}

function studentDirectory() {
  const rows = state.students.map((student, index) => `<tr><td>${studentCell(student, index)}</td><td>${escapeHtml(student.email)}</td><td>${escapeHtml(student.course)}</td><td>${escapeHtml(student.year)}</td><td>${prettyDate(student.joined)}</td><td><span class="status status-enrolled">Enrolled</span></td></tr>`).join("");
  return `${heading("YOUR SCHOOL", "Student directory", "All enrolled students, together in one place.", `<a class="button button-primary" href="#admissions" data-view="admissions"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New admission</a>`)}
    <section class="panel table-panel" style="margin-top:0"><div class="panel-header"><div><h2 class="panel-title">All students <span class="muted">(${state.students.length})</span></h2><p class="panel-description">Search and review your student records</p></div><div class="table-tools"><label class="search-box"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></svg><input id="student-search" type="search" placeholder="Search students..." aria-label="Search students"></label></div></div>
    <div class="table-scroll"><table><thead><tr><th>Student</th><th>Email</th><th>Course</th><th>Year</th><th>Admission date</th><th>Status</th></tr></thead><tbody id="student-rows">${rows || emptyRow("No students yet. Add your first student to get started.", 6)}</tbody></table></div></section>`;
}

function admissionForm() {
  const nextId = `STU-${String(2401 + state.students.length).padStart(4, "0")}`;
  return `${heading("GROW YOUR COMMUNITY", "New admission", "Add a student to your school and create a ledger record.", `<a class="button button-secondary" href="#students" data-view="students"><svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Student directory</a>`)}
    <div class="form-layout"><section class="panel form-panel"><h2>Student information</h2><p>Fields marked with * are required.</p>
      <form id="admission-form"><div class="form-grid">
        <div class="field"><label for="student-name">Full name *</label><input id="student-name" name="name" autocomplete="name" placeholder="e.g. Maya Johnson" required maxlength="80"></div>
        <div class="field"><label for="student-email">Email address *</label><input id="student-email" name="email" type="email" autocomplete="email" placeholder="student@school.edu" required maxlength="120"></div>
        <div class="field"><label for="student-course">Course / department *</label><select id="student-course" name="course" required><option value="">Select a course</option><option>Computer Science</option><option>Information Technology</option><option>Electronics</option><option>Business Administration</option><option>Mechanical Engineering</option><option>Other</option></select></div>
        <div class="field"><label for="student-year">Academic year *</label><select id="student-year" name="year" required><option value="">Select a year</option><option>Year 1</option><option>Year 2</option><option>Year 3</option><option>Year 4</option><option>Postgraduate</option></select></div>
        <div class="field"><label for="student-id">Student ID</label><input id="student-id" name="id" value="${nextId}" readonly aria-describedby="id-help"><span class="muted" id="id-help" style="font-size:9px">Generated automatically</span></div>
        <div class="field"><label for="joined-date">Admission date *</label><input id="joined-date" name="joined" type="date" value="${today}" required></div>
      </div><div class="form-actions"><a class="button button-secondary" href="#overview" data-view="overview">Cancel</a><button class="button button-primary" type="submit"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Register student</button></div></form>
    </section><aside class="info-card"><span class="info-card-icon"><svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12.1V21"/></svg></span><h3>Recorded on the ledger</h3><p>When a student is admitted, an admission record is added to the hash-linked ledger for an auditable history.</p><ul class="info-list"><li><span class="info-check">✓</span> Unique student ID</li><li><span class="info-check">✓</span> SHA-256 linked record</li><li><span class="info-check">✓</span> Saved in this browser</li></ul></aside></div>`;
}

function attendancePage() {
  const selectedDate = attendanceDate;
  const counts = { present: 0, late: 0, absent: 0 };
  const rows = state.students.map((student, index) => {
    const entry = getAttendance(student.id, selectedDate);
    if (entry) counts[entry.status] += 1;
    return `<tr><td>${studentCell(student, index)}</td><td>${escapeHtml(student.course)}</td><td>${escapeHtml(student.year)}</td><td>${entry ? `<span class="muted">${new Date(entry.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>` : '<span class="muted">—</span>'}</td><td><select class="mark-select" data-attendance-id="${escapeHtml(student.id)}" aria-label="Attendance for ${escapeHtml(student.name)}"><option value="">Not marked</option><option value="present"${entry?.status === "present" ? " selected" : ""}>Present</option><option value="late"${entry?.status === "late" ? " selected" : ""}>Late</option><option value="absent"${entry?.status === "absent" ? " selected" : ""}>Absent</option></select></td></tr>`;
  }).join("");
  return `${heading("DAILY REGISTER", "Attendance", "Mark and manage daily attendance. Every change is added to the ledger.", `<input class="date-input" id="attendance-date" type="date" value="${selectedDate}" aria-label="Attendance date">`)}
    <section class="panel" style="margin-top:0"><div class="panel-header"><div><h2 class="panel-title">Class register</h2><p class="panel-description">Select a status beside each student to record attendance</p></div><button class="button button-secondary button-small" id="mark-all-present" type="button">Mark all present</button></div>
      <div class="attendance-summary"><span class="summary-item"><i class="summary-bullet green"></i><strong>${counts.present}</strong> Present</span><span class="summary-item"><i class="summary-bullet amber"></i><strong>${counts.late}</strong> Late</span><span class="summary-item"><i class="summary-bullet red"></i><strong>${counts.absent}</strong> Absent</span><span class="summary-item"><strong>${state.students.length - Object.values(counts).reduce((sum, count) => sum + count, 0)}</strong> Unmarked</span></div>
      <div class="table-scroll"><table><thead><tr><th>Student</th><th>Course</th><th>Year</th><th>Last updated</th><th>Attendance status</th></tr></thead><tbody>${rows || emptyRow('No students enrolled yet. <a class="text-link" href="#admissions" data-view="admissions">Add a student →</a>', 5)}</tbody></table></div></section>
    <div class="notice"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg><span><strong>Attendance integrity:</strong> Each new mark is linked to the preceding record using SHA-256. Changes are stored in this browser’s local storage; this prototype is not connected to a distributed blockchain.</span></div>`;
}

function ledgerPage() {
  const blocks = [...state.blocks].reverse();
  const latest = state.blocks.at(-1);
  const valid = state.ledgerValid !== false;
  const rows = blocks.map((block) => `<tr><td><div class="ledger-block"><span class="block-number">${block.index === 0 ? "GEN" : `#${block.index}`}</span><span class="block-copy"><strong>${escapeHtml(block.type === "GENESIS" ? "Ledger created" : block.type === "ADMISSION" ? "Student admitted" : "Attendance updated")}</strong><span>${new Date(block.timestamp).toLocaleString()}</span></span></div></td><td>${escapeHtml(block.studentName)}<br><span class="muted">${escapeHtml(block.studentId)}</span></td><td>${escapeHtml(block.details)}</td><td><span class="hash-value" title="${escapeHtml(block.hash)}">${escapeHtml(block.hash)}</span></td><td><span class="chain-status">Linked</span></td></tr>`).join("");
  return `${heading("AUDIT TRAIL", "Blockchain ledger", "A chronological, hash-linked record of admissions and attendance.", `<button class="button button-secondary" type="button" id="verify-ledger"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>Verify chain</button>`)}
    <section class="ledger-summary"><article class="ledger-stat"><span>Total records</span><strong>${state.blocks.length}</strong></article><article class="ledger-stat"><span>Chain integrity</span><strong style="font-size:13px;color:${valid ? "#23885f" : "#c45155"}">${valid ? "● Verified" : "● Integrity issue"}</strong></article><article class="ledger-stat"><span>Latest block</span><strong>${latest ? `#${latest.index}` : "—"}</strong></article></section>
    <section class="panel" style="margin-top:0"><div class="panel-header"><div><h2 class="panel-title">Ledger records</h2><p class="panel-description">Each block includes a SHA-256 hash and the previous block’s hash.</p></div><span class="chain-status">${valid ? "Chain verified" : "Verification failed"}</span></div>
      <div class="table-scroll"><table><thead><tr><th>Block</th><th>Student</th><th>Record details</th><th>SHA-256 hash</th><th>Integrity</th></tr></thead><tbody>${rows || emptyRow("Ledger records will appear here.", 5)}</tbody></table></div></section>
    <div class="notice"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg><span><strong>Prototype notice:</strong> This browser-only demo uses a SHA-256 hash chain to illustrate record integrity. It is not a distributed blockchain, does not provide independent validation, and local browser data can be changed or deleted.</span></div>`;
}

function render(view = currentView) {
  currentView = view;
  const renderers = { overview: dashboard, students: studentDirectory, admissions: admissionForm, attendance: attendancePage, ledger: ledgerPage };
  const labels = { overview: "Overview", students: "Students", admissions: "Admissions", attendance: "Attendance", ledger: "Blockchain ledger" };
  page.innerHTML = (renderers[view] || dashboard)();
  document.querySelector("#breadcrumb-current").textContent = labels[view] || labels.overview;
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === view));
  document.querySelector("#student-nav-count").textContent = state.students.length;
  document.title = `${labels[view] || labels.overview} · Attendly`;
  document.querySelector("#sidebar").classList.remove("open");
  if (view === "ledger") verifyLedger({ quiet: true });
}

async function verifyLedger(options = {}) {
  try {
    for (let index = 0; index < state.blocks.length; index += 1) {
      const block = state.blocks[index];
      const expectedPrevious = index === 0 ? "0".repeat(64) : state.blocks[index - 1].hash;
      const { hash, ...contents } = block;
      if (block.index !== index || block.previousHash !== expectedPrevious || await hashBlock(contents) !== hash) {
        state.ledgerValid = false;
        if (!options.quiet) showToast("Ledger verification failed: a record or link does not match.", true);
        if (currentView === "ledger") renderLedgerIntegrity();
        return false;
      }
    }
    state.ledgerValid = true;
    if (!options.quiet) showToast("Ledger verified. All record links are intact.");
    if (currentView === "ledger") renderLedgerIntegrity();
    return true;
  } catch (error) {
    state.ledgerValid = false;
    if (!options.quiet) showToast(error.message || "Could not verify the ledger.", true);
    if (currentView === "ledger") renderLedgerIntegrity();
    return false;
  }
}

function renderLedgerIntegrity() {
  const summary = page.querySelector(".ledger-summary .ledger-stat:last-child strong");
  const status = page.querySelector(".ledger-summary .ledger-stat:nth-child(2) strong");
  const pill = page.querySelector(".panel-header .chain-status");
  if (status) {
    status.textContent = state.ledgerValid ? "● Verified" : "● Integrity issue";
    status.style.color = state.ledgerValid ? "#23885f" : "#c45155";
  }
  if (pill) {
    pill.textContent = state.ledgerValid ? "Chain verified" : "Verification failed";
    pill.style.color = state.ledgerValid ? "" : "#c45155";
  }
  if (summary) summary.textContent = state.blocks.at(-1) ? `#${state.blocks.at(-1).index}` : "—";
}

async function saveAttendance(student, status, date) {
  const existing = getAttendance(student.id, date);
  if (existing?.status === status) return;
  await appendBlock("ATTENDANCE", student, `Marked ${status} for ${date}`);
  if (existing) {
    existing.status = status;
    existing.updatedAt = new Date().toISOString();
  } else {
    state.attendance.push({ studentId: student.id, date, status, updatedAt: new Date().toISOString() });
  }
  saveState();
}

function filterStudents(query) {
  const body = page.querySelector("#student-rows");
  if (!body) return;
  const normalized = query.trim().toLowerCase();
  const filtered = state.students.filter((student) => [student.name, student.id, student.email, student.course, student.year].some((value) => value.toLowerCase().includes(normalized)));
  body.innerHTML = filtered.map((student) => {
    const index = state.students.indexOf(student);
    return `<tr><td>${studentCell(student, index)}</td><td>${escapeHtml(student.email)}</td><td>${escapeHtml(student.course)}</td><td>${escapeHtml(student.year)}</td><td>${prettyDate(student.joined)}</td><td><span class="status status-enrolled">Enrolled</span></td></tr>`;
  }).join("") || emptyRow("No students match your search.", 6);
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-view]");
  if (link) {
    event.preventDefault();
    const view = link.dataset.view;
    window.location.hash = view;
    render(view);
    return;
  }
  if (event.target.closest("#mark-all-present")) {
    markAllPresent();
    return;
  }
  if (event.target.closest("#verify-ledger")) verifyLedger();
});

document.addEventListener("input", (event) => {
  if (event.target.id === "student-search") filterStudents(event.target.value);
});

document.addEventListener("change", async (event) => {
  if (event.target.matches("[data-attendance-id]")) {
    const student = state.students.find((item) => item.id === event.target.dataset.attendanceId);
    const date = page.querySelector("#attendance-date")?.value || today;
    if (!student || !event.target.value) return;
    const select = event.target;
    select.disabled = true;
    try {
      await saveAttendance(student, select.value, date);
      showToast(`${student.name} marked ${select.value}.`);
      render("attendance");
    } catch (error) {
      showToast(error.message || "Could not save attendance.", true);
      select.disabled = false;
    }
  }
  if (event.target.id === "attendance-date") {
    attendanceDate = event.target.value;
    updateAttendanceDate(attendanceDate);
  }
});

function updateAttendanceDate(date) {
  const summary = page.querySelector(".panel-description");
  if (summary) summary.textContent = `Select a status beside each student to record attendance · ${prettyDate(date)}`;
  page.querySelectorAll("[data-attendance-id]").forEach((select) => {
    const entry = getAttendance(select.dataset.attendanceId, date);
    select.value = entry?.status || "";
    const row = select.closest("tr");
    const timeCell = row?.children[3];
    if (timeCell) timeCell.innerHTML = entry ? `<span class="muted">${new Date(entry.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>` : '<span class="muted">—</span>';
  });
  const counts = { present: 0, late: 0, absent: 0 };
  state.students.forEach((student) => {
    const entry = getAttendance(student.id, date);
    if (entry) counts[entry.status] += 1;
  });
  const items = page.querySelectorAll(".attendance-summary .summary-item strong");
  [counts.present, counts.late, counts.absent, state.students.length - counts.present - counts.late - counts.absent].forEach((count, index) => {
    if (items[index]) items[index].textContent = count;
  });
}

async function markAllPresent() {
  const date = page.querySelector("#attendance-date")?.value || today;
  const button = page.querySelector("#mark-all-present");
  if (button) button.disabled = true;
  try {
    for (const student of state.students) await saveAttendance(student, "present", date);
    showToast("All students marked present.");
    render("attendance");
  } catch (error) {
    showToast(error.message || "Could not save attendance.", true);
    if (button) button.disabled = false;
  }
}

document.addEventListener("submit", async (event) => {
  if (event.target.getAttribute("id") !== "admission-form") return;
  event.preventDefault();
  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const name = String(formData.get("name")).trim();
  const email = String(formData.get("email")).trim().toLowerCase();
  const duplicate = state.students.some((student) => student.email.toLowerCase() === email);
  if (duplicate) {
    showToast("A student with this email address is already registered.", true);
    return;
  }
  const student = {
    id: `STU-${String(2401 + state.students.length).padStart(4, "0")}`,
    name,
    email,
    course: String(formData.get("course")),
    year: String(formData.get("year")),
    joined: String(formData.get("joined")),
  };
  submitButton.disabled = true;
  try {
    await appendBlock("ADMISSION", student, `Enrolled in ${student.course} · ${student.year}`);
    state.students.push(student);
    saveState();
    showToast(`${student.name} added successfully.`);
    window.location.hash = "students";
    render("students");
  } catch (error) {
    submitButton.disabled = false;
    showToast(error.message || "Could not register this student.", true);
  }
});

document.querySelector("#menu-toggle").addEventListener("click", () => {
  document.querySelector("#sidebar").classList.toggle("open");
});
window.addEventListener("hashchange", () => {
  const view = window.location.hash.slice(1);
  render(["overview", "students", "admissions", "attendance", "ledger"].includes(view) ? view : "overview");
});

async function start() {
  document.querySelector("#today-label").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  try {
    state = loadState();
    if (!state) await createInitialState();
    render(window.location.hash.slice(1) || "overview");
    if (window.location.protocol === "file:") {
      showToast("For secure ledger hashing, run this site on localhost or HTTPS.", true);
    }
  } catch (error) {
    page.innerHTML = `<section class="panel" style="padding:24px"><h1>Could not load Attendly</h1><p class="page-subtitle">${escapeHtml(error.message || "An unexpected error occurred.")}</p><p class="page-subtitle">Check browser storage permissions and reload the page.</p></section>`;
  }
}

start();
