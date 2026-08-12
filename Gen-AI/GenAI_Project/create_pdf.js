const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

function makeSyllabusPdf(outputPath) {
  const parts = [];
  const header = '%PDF-1.4\n';
  parts.push(header);

  const offsets = [];
  let pos = Buffer.byteLength(header, 'utf8');

  function addObj(content) {
    offsets.push(pos);
    const s = content + '\n';
    parts.push(s);
    pos += Buffer.byteLength(s, 'utf8');
  }

  addObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  addObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  addObj('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj');

  const textLines = [
    "Course Syllabus: Full Stack Web and Generative AI Development (Summer 2026)",
    "Instructor: Phaham | Institution: PEP Academy | Department: Computer Science",
    "Course Overview: 6-week intensive course on modern backend engineering and Generative AI applications.",
    "Week 1: Node.js Core, event loop, libuv, native fs and http modules, asynchronous programming with async/await.",
    "Week 2: Express.js Architecture, routing and middleware, route parameters vs query parameters, and custom logger middleware.",
    "Week 3: Database Design with MongoDB, Mongoose ORM, CRUD operations, aggregation pipelines, JWT auth, and RBAC.",
    "Week 4: Generative AI, LLMs, Google Gemini text-embedding-004, cosine similarity, document chunking, and in-memory vector store RAG.",
    "Week 5: AI Security and Prompt Injection Defense Mechanisms: Layer 1 Query Sanitization, Layer 2 Context Isolation, Layer 3 Output Validation.",
    "Week 6: Capstone Project Deployment, microservices vs monolithic architecture, environment config, and evaluation metrics."
  ];

  const textStream = [
    'BT',
    '/F1 10 Tf',
    '15 TL',
    '40 750 Td',
    ...textLines.map(line => {
      const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      return `(${escaped}) Tj T*`;
    }),
    'ET'
  ].join('\n');

  const streamLen = Buffer.byteLength(textStream, 'utf8');
  addObj(`4 0 obj\n<< /Length ${streamLen} >>\nstream\n${textStream}\nendstream\nendobj`);
  addObj('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

  const startXref = pos;
  let xref = 'xref\n0 ' + (offsets.length + 1) + '\n0000000000 65535 f \n';
  for (const off of offsets) {
    xref += off.toString().padStart(10, '0') + ' 00000 n \n';
  }
  parts.push(xref);
  pos += Buffer.byteLength(xref, 'utf8');

  const trailer = `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  parts.push(trailer);

  const fullPdf = Buffer.from(parts.join(''), 'utf8');
  fs.writeFileSync(outputPath, fullPdf);
  return fullPdf;
}

if (require.main === module) {
  const targetPath = path.join(__dirname, 'course-syllabus.pdf');
  const pdfBuffer = makeSyllabusPdf(targetPath);
  pdfParse(pdfBuffer).then(res => {
    console.log(`[PDF Generator] Successfully generated: ${targetPath}`);
    console.log(`[PDF Generator] Verified parse. Characters extracted: ${res.text.length}`);
  }).catch(err => {
    console.error("Parse check failed:", err);
  });
}

module.exports = makeSyllabusPdf;
