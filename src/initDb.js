require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      phone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT,
      level TEXT,
      duration TEXT,
      price INTEGER DEFAULT 0,
      thumbnail TEXT,
      description TEXT,
      outcomes TEXT,
      is_published INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      position INTEGER DEFAULT 1,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'video',
      video_url TEXT,
      content TEXT,
      resource_url TEXT,
      position INTEGER DEFAULT 1,
      duration_minutes INTEGER DEFAULT 10,
      FOREIGN KEY(module_id) REFERENCES modules(id) ON DELETE CASCADE,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      enrolled_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, course_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lesson_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      lesson_id INTEGER NOT NULL,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      UNIQUE(user_id, lesson_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      pass_percentage INTEGER DEFAULT 60,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option TEXT NOT NULL,
      FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      quiz_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      total INTEGER NOT NULL,
      percentage REAL NOT NULL,
      passed INTEGER NOT NULL,
      attempted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      instructions TEXT NOT NULL,
      due_date TEXT,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      submission_text TEXT,
      file_url TEXT,
      status TEXT DEFAULT 'submitted',
      grade TEXT,
      feedback TEXT,
      submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS live_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER,
      title TEXT NOT NULL,
      session_date TEXT NOT NULL,
      start_time TEXT,
      meeting_link TEXT,
      status TEXT DEFAULT 'upcoming',
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      certificate_no TEXT UNIQUE NOT NULL,
      issued_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  const adminEmail = process.env.ADMIN_EMAIL || 'geneprosperabiotech@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';
  if (!db.prepare('SELECT id FROM users WHERE email=?').get(adminEmail)) {
    db.prepare('INSERT INTO users (name,email,password_hash,role,phone) VALUES (?,?,?,?,?)')
      .run('Gene Prospera Admin', adminEmail, bcrypt.hashSync(adminPassword, 10), 'admin', '');
  }

  const demoEmail = 'student@example.com';
  if (!db.prepare('SELECT id FROM users WHERE email=?').get(demoEmail)) {
    db.prepare('INSERT INTO users (name,email,password_hash,role,phone) VALUES (?,?,?,?,?)')
      .run('Demo Student', demoEmail, bcrypt.hashSync('student123', 10), 'student', '');
  }

  if (db.prepare('SELECT COUNT(*) c FROM courses').get().c === 0) {
    const course = db.prepare('INSERT INTO courses (title, category, level, duration, price, thumbnail, description, outcomes) VALUES (?,?,?,?,?,?,?,?)');
    const c1 = course.run('Molecular Biology Techniques Accelerator', 'Biotechnology', 'Beginner to Intermediate', '4 weeks', 0, '', 'Learn DNA isolation, PCR, gel electrophoresis, interpretation, documentation and lab-ready workflows.', 'DNA isolation|PCR workflow|Gel interpretation|Scientific documentation|Certificate').lastInsertRowid;
    const c2 = course.run('AI in Biotechnology Starter Program', 'AI + Biotechnology', 'Beginner', '3 weeks', 0, '', 'Use AI tools for literature search, data analysis, report writing, bioinformatics and research productivity.', 'Prompt engineering|AI literature workflow|Biotech data analysis|Project portfolio|Certificate').lastInsertRowid;
    const c3 = course.run('Microbiology Practical & Industry Readiness', 'Microbiology', 'UG Level', '6 weeks', 1500, '', 'Practice-oriented microbiology LMS course for staining, culture techniques, QC microbiology and biofertilizer basics.', 'Culture techniques|Staining|QC documentation|Industry readiness|Certificate').lastInsertRowid;

    const mod = db.prepare('INSERT INTO modules (course_id,title,position) VALUES (?,?,?)');
    const lesson = db.prepare('INSERT INTO lessons (module_id, course_id, title, type, video_url, content, resource_url, position, duration_minutes) VALUES (?,?,?,?,?,?,?,?,?)');
    [c1,c2,c3].forEach((cid, idx) => {
      const m1 = mod.run(cid, 'Orientation & Learning Path', 1).lastInsertRowid;
      lesson.run(m1, cid, 'Welcome and course roadmap', 'video', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'Overview, outcomes, assessment method and certificate rules.', '', 1, 8);
      lesson.run(m1, cid, 'Downloadable study material', 'document', '', 'Add your PDF note link in the admin panel. Students can use this section for notes and assignments.', '', 2, 10);
      const m2 = mod.run(cid, 'Core Practical Module', 2).lastInsertRowid;
      lesson.run(m2, cid, 'Core concept lecture', 'video', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'Replace this demo video with your own unlisted YouTube/Vimeo/Bunny Stream link.', '', 1, 20);
      lesson.run(m2, cid, 'Hands-on project task', 'project', '', 'Complete the assigned practical/project and submit your observation or report.', '', 2, 30);
    });

    const q1 = db.prepare('INSERT INTO quizzes (course_id,title,pass_percentage) VALUES (?,?,?)').run(c1, 'Molecular Biology Basics Quiz', 60).lastInsertRowid;
    const q2 = db.prepare('INSERT INTO quizzes (course_id,title,pass_percentage) VALUES (?,?,?)').run(c2, 'AI in Biotechnology Quiz', 60).lastInsertRowid;
    const ques = db.prepare('INSERT INTO questions (quiz_id,question,option_a,option_b,option_c,option_d,correct_option) VALUES (?,?,?,?,?,?,?)');
    ques.run(q1,'Which method is commonly used to amplify DNA?','ELISA','PCR','SDS-PAGE','Gram staining','B');
    ques.run(q1,'Agarose gel electrophoresis separates DNA mainly based on:','Colour','Size','Taste','Smell','B');
    ques.run(q2,'Prompt engineering means:','Writing better instructions for AI','Making PCR primers only','Cleaning glassware','Running gel electrophoresis','A');
    ques.run(q2,'AI can help researchers in:','Literature search','Data analysis','Drafting reports','All of the above','D');

    db.prepare('INSERT INTO assignments (course_id,title,instructions,due_date) VALUES (?,?,?,?)').run(c1,'Submit DNA isolation workflow','Upload/write the stepwise DNA isolation workflow with safety precautions.','');
    db.prepare('INSERT INTO assignments (course_id,title,instructions,due_date) VALUES (?,?,?,?)').run(c2,'AI-assisted literature summary','Prepare a 500-word AI-assisted literature summary with references.','');
    db.prepare('INSERT INTO live_sessions (course_id,title,session_date,start_time,meeting_link,status) VALUES (?,?,?,?,?,?)').run(c1,'Live doubt-clearing session', new Date().toISOString().slice(0,10), '19:00', 'https://meet.google.com/', 'upcoming');
  }
  console.log('LMS database initialized.');
}
init();
