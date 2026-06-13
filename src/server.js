require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('./db');
require('./initDb');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_NAME = process.env.APP_NAME || 'Gene Prospera Academy LMS';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('tiny'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET || 'change-this-secret', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000*60*60*10 }}));
app.use(express.static(path.join(__dirname, '..', 'public')));

function auth(req,res,next){ if(req.session.user) return next(); res.status(401).json({error:'Login required'}); }
function admin(req,res,next){ if(req.session.user?.role==='admin') return next(); res.status(403).json({error:'Admin access required'}); }

app.post('/api/register', (req,res)=>{
  const {name,email,password,phone} = req.body;
  if(!name||!email||!password) return res.status(400).json({error:'Name, email and password are required'});
  try{
    const id = db.prepare('INSERT INTO users (name,email,password_hash,role,phone) VALUES (?,?,?,?,?)').run(name,email,bcrypt.hashSync(password,10),'student',phone||'').lastInsertRowid;
    req.session.user = {id,name,email,role:'student'};
    res.json({user:req.session.user});
  } catch(e){ res.status(400).json({error:'Email already exists or invalid data'}); }
});
app.post('/api/login',(req,res)=>{
  const {email,password}=req.body;
  const u=db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if(!u || !bcrypt.compareSync(password,u.password_hash)) return res.status(401).json({error:'Invalid email or password'});
  req.session.user={id:u.id,name:u.name,email:u.email,role:u.role};
  res.json({user:req.session.user});
});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/me',(req,res)=>res.json({user:req.session.user||null, appName:APP_NAME}));

app.get('/api/courses',(req,res)=> res.json(db.prepare('SELECT * FROM courses WHERE is_published=1 ORDER BY id DESC').all()));
app.get('/api/courses/:id', auth, (req,res)=>{
  const course=db.prepare('SELECT * FROM courses WHERE id=?').get(req.params.id);
  if(!course) return res.status(404).json({error:'Course not found'});
  const modules=db.prepare('SELECT * FROM modules WHERE course_id=? ORDER BY position').all(course.id).map(m=>({ ...m, lessons: db.prepare(`SELECT l.*, COALESCE(lp.completed,0) completed FROM lessons l LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.user_id=? WHERE l.module_id=? ORDER BY l.position`).all(req.session.user.id,m.id)}));
  const quizzes=db.prepare('SELECT * FROM quizzes WHERE course_id=?').all(course.id);
  const assignments=db.prepare('SELECT * FROM assignments WHERE course_id=?').all(course.id);
  const sessions=db.prepare('SELECT * FROM live_sessions WHERE course_id=? ORDER BY session_date,start_time').all(course.id);
  const enrolled=!!db.prepare('SELECT id FROM enrollments WHERE user_id=? AND course_id=?').get(req.session.user.id,course.id);
  res.json({course, modules, quizzes, assignments, sessions, enrolled});
});
app.post('/api/enroll/:courseId', auth, (req,res)=>{
  db.prepare('INSERT OR IGNORE INTO enrollments (user_id,course_id) VALUES (?,?)').run(req.session.user.id, req.params.courseId);
  res.json({ok:true});
});
app.get('/api/my-dashboard', auth, (req,res)=>{
  const enrollments=db.prepare('SELECT c.*, e.enrolled_at FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=? ORDER BY e.id DESC').all(req.session.user.id);
  const courses=enrollments.map(c=>{
    const total=db.prepare('SELECT COUNT(*) c FROM lessons WHERE course_id=?').get(c.id).c;
    const done=db.prepare('SELECT COUNT(*) c FROM lesson_progress lp JOIN lessons l ON l.id=lp.lesson_id WHERE lp.user_id=? AND l.course_id=? AND lp.completed=1').get(req.session.user.id,c.id).c;
    return {...c, progress: total ? Math.round(done*100/total) : 0, completedLessons:done, totalLessons:total};
  });
  const attempts=db.prepare('SELECT qa.*, q.title quiz_title, c.title course_title FROM quiz_attempts qa JOIN quizzes q ON q.id=qa.quiz_id JOIN courses c ON c.id=q.course_id WHERE qa.user_id=? ORDER BY qa.id DESC LIMIT 10').all(req.session.user.id);
  const certificates=db.prepare('SELECT cert.*, c.title course_title FROM certificates cert JOIN courses c ON c.id=cert.course_id WHERE cert.user_id=? ORDER BY cert.id DESC').all(req.session.user.id);
  res.json({courses,attempts,certificates});
});
app.post('/api/lessons/:id/complete', auth, (req,res)=>{
  db.prepare(`INSERT INTO lesson_progress (user_id,lesson_id,completed,completed_at) VALUES (?,?,1,CURRENT_TIMESTAMP) ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed=1, completed_at=CURRENT_TIMESTAMP`).run(req.session.user.id,req.params.id);
  res.json({ok:true});
});

app.get('/api/quizzes/:id', auth, (req,res)=>{
  const quiz=db.prepare('SELECT * FROM quizzes WHERE id=?').get(req.params.id);
  const questions=db.prepare('SELECT id,question,option_a,option_b,option_c,option_d FROM questions WHERE quiz_id=?').all(req.params.id);
  res.json({quiz,questions});
});
app.post('/api/quizzes/:id/submit', auth, (req,res)=>{
  const quiz=db.prepare('SELECT * FROM quizzes WHERE id=?').get(req.params.id);
  const questions=db.prepare('SELECT * FROM questions WHERE quiz_id=?').all(req.params.id);
  const answers=req.body.answers||{};
  let score=0; questions.forEach(q=>{ if(answers[q.id]===q.correct_option) score++; });
  const total=questions.length; const percentage= total ? Math.round(score*100/total) : 0; const passed=percentage>=quiz.pass_percentage ? 1 : 0;
  db.prepare('INSERT INTO quiz_attempts (user_id,quiz_id,score,total,percentage,passed) VALUES (?,?,?,?,?,?)').run(req.session.user.id,quiz.id,score,total,percentage,passed);
  res.json({score,total,percentage,passed});
});
app.post('/api/assignments/:id/submit', auth, (req,res)=>{
  const {submission_text,file_url}=req.body;
  db.prepare('INSERT INTO submissions (assignment_id,user_id,submission_text,file_url) VALUES (?,?,?,?)').run(req.params.id,req.session.user.id,submission_text||'',file_url||'');
  res.json({ok:true});
});
app.post('/api/certificates/:courseId', auth, (req,res)=>{
  const courseId=req.params.courseId;
  const cert=db.prepare('SELECT * FROM certificates WHERE user_id=? AND course_id=?').get(req.session.user.id,courseId);
  if(cert) return res.json(cert);
  const course=db.prepare('SELECT title FROM courses WHERE id=?').get(courseId);
  const no='GPB-LMS-'+Date.now()+'-'+req.session.user.id;
  db.prepare('INSERT INTO certificates (user_id,course_id,certificate_no) VALUES (?,?,?)').run(req.session.user.id,courseId,no);
  res.json({certificate_no:no, course_title:course?.title});
});
app.get('/api/certificates/:certificateNo/pdf', auth, (req,res)=>{
  const cert=db.prepare('SELECT cert.*, u.name, c.title course_title FROM certificates cert JOIN users u ON u.id=cert.user_id JOIN courses c ON c.id=cert.course_id WHERE cert.certificate_no=?').get(req.params.certificateNo);
  if(!cert) return res.status(404).send('Certificate not found');
  const doc=new PDFDocument({size:'A4',layout:'landscape',margin:50});
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition',`attachment; filename="${cert.certificate_no}.pdf"`);
  doc.pipe(res);
  doc.fontSize(28).text('Certificate of Completion',{align:'center'});
  doc.moveDown();
  doc.fontSize(18).text('This is proudly presented to',{align:'center'});
  doc.moveDown();
  doc.fontSize(30).text(cert.name,{align:'center'});
  doc.moveDown();
  doc.fontSize(17).text(`for successfully completing the course`,{align:'center'});
  doc.moveDown();
  doc.fontSize(24).text(cert.course_title,{align:'center'});
  doc.moveDown(2);
  doc.fontSize(13).text(`Certificate No: ${cert.certificate_no}`,{align:'center'});
  doc.text(`Issued by Gene Prospera Biotech | Date: ${cert.issued_at.slice(0,10)}`,{align:'center'});
  doc.end();
});

// Admin APIs
app.get('/api/admin/stats', auth, admin, (req,res)=>{
  const students=db.prepare("SELECT COUNT(*) c FROM users WHERE role='student'").get().c;
  const courses=db.prepare('SELECT COUNT(*) c FROM courses').get().c;
  const enrollments=db.prepare('SELECT COUNT(*) c FROM enrollments').get().c;
  const submissions=db.prepare('SELECT COUNT(*) c FROM submissions').get().c;
  res.json({students,courses,enrollments,submissions});
});
app.post('/api/admin/courses', auth, admin, (req,res)=>{
  const c=req.body;
  const id=db.prepare('INSERT INTO courses (title,category,level,duration,price,thumbnail,description,outcomes,is_published) VALUES (?,?,?,?,?,?,?,?,?)').run(c.title,c.category||'',c.level||'',c.duration||'',Number(c.price||0),c.thumbnail||'',c.description||'',c.outcomes||'',1).lastInsertRowid;
  res.json({id});
});
app.post('/api/admin/modules', auth, admin, (req,res)=>{
  const {course_id,title,position}=req.body;
  const id=db.prepare('INSERT INTO modules (course_id,title,position) VALUES (?,?,?)').run(course_id,title,position||1).lastInsertRowid;
  res.json({id});
});
app.post('/api/admin/lessons', auth, admin, (req,res)=>{
  const l=req.body;
  const id=db.prepare('INSERT INTO lessons (module_id,course_id,title,type,video_url,content,resource_url,position,duration_minutes) VALUES (?,?,?,?,?,?,?,?,?)').run(l.module_id,l.course_id,l.title,l.type||'video',l.video_url||'',l.content||'',l.resource_url||'',l.position||1,l.duration_minutes||10).lastInsertRowid;
  res.json({id});
});
app.get('/api/admin/users', auth, admin, (req,res)=> res.json(db.prepare('SELECT id,name,email,role,phone,created_at FROM users ORDER BY id DESC').all()));
app.get('/api/admin/submissions', auth, admin, (req,res)=> res.json(db.prepare('SELECT s.*, a.title assignment_title, u.name student_name, u.email FROM submissions s JOIN assignments a ON a.id=s.assignment_id JOIN users u ON u.id=s.user_id ORDER BY s.id DESC').all()));

app.listen(PORT,()=>console.log(`${APP_NAME} running on http://localhost:${PORT}`));
