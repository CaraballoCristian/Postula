import db from './db';

export function seed() {
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categorias').get() as { count: number };
  if (catCount.count > 0) return;

  const insertCategoria = db.prepare('INSERT INTO categorias (nombre) VALUES (?)');
  const techId = insertCategoria.run('Tech').lastInsertRowid as number;
  const mgmtId = insertCategoria.run('Management').lastInsertRowid as number;

  const insertTemplate = db.prepare(`
    INSERT INTO templates (categoria_id, idioma, tipo, nombre, contenido, orden)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const templates = [
    // ── TECH ES ──
    { cat: techId, lang: 'es', type: 'email', name: 'Mail Tech ES',
      content: `Hola {nombre_reclutador},

Te escribo porque vi tu perfil de {puesto_reclutador} en {empresa} y me interesó mucho la oferta de {oferta} que publicaron.

Soy {mi_nombre}, desarrollador con experiencia en tecnologías como TypeScript, Angular, Node.js y SQL. Actualmente estoy buscando nuevos desafíos y creo que mi perfil puede encajar bien con lo que están buscando.

Te dejo mi LinkedIn por si querés chusmear: {mi_linkedin}

Quedo atento a cualquier comentario. ¡Gracias!

Saludos,
{mi_nombre}` },

    { cat: techId, lang: 'es', type: 'mensaje_empresa', name: 'Postulación Empresa Tech ES',
      content: `Estimado equipo de {empresa},

Me dirijo a ustedes para postularme a la posición de {oferta} que vi publicada.

Mi nombre es {mi_nombre} y cuento con experiencia en desarrollo de software, trabajando con tecnologías como TypeScript, Angular, React, Node.js y bases de datos SQL/NoSQL. En mis últimos proyectos me he enfocado en construir aplicaciones escalables y mantener buenas prácticas de código.

Adjunto mi CV y portfolio para que puedan conocer más sobre mi trabajo: {mi_portfolio}

Mi LinkedIn: {mi_linkedin}

Quedo a disposición para coordinar una entrevista. Muchas gracias por su tiempo.

Saludos cordiales,
{mi_nombre}` },

    { cat: techId, lang: 'es', type: 'mensaje_recruiter', name: 'Mensaje Recruiter Tech ES',
      content: `Hola {nombre_reclutador}, ¿cómo estás?

Te contacto porque vi que trabajás como {puesto_reclutador} en {empresa} y quería consultarte si tenés alguna búsqueda activa para desarrolladores.

Soy {mi_nombre}, desarrollador full-stack con foco en TypeScript, Angular y Node.js. Estoy abierto a nuevas oportunidades y me gustaría saber si hay algo que pueda encajar con mi perfil.

Te dejo mi LinkedIn: {mi_linkedin}

¡Gracias y buen día!

{mi_nombre}` },

    // ── TECH EN ──
    { cat: techId, lang: 'en', type: 'email', name: 'Mail Tech EN',
      content: `Hi {nombre_reclutador},

I'm reaching out because I saw your profile as {puesto_reclutador} at {empresa} and I was really interested in the {oferta} opening you posted.

I'm {mi_nombre}, a software developer with experience in TypeScript, Angular, Node.js, and SQL. I'm currently looking for new challenges and I believe my background could be a good fit for what you're looking for.

Here's my LinkedIn if you'd like to take a look: {mi_linkedin}

Looking forward to hearing from you. Thanks!

Best,
{mi_nombre}` },

    { cat: techId, lang: 'en', type: 'mensaje_empresa', name: 'Company Application Tech EN',
      content: `Dear {empresa} team,

I'm writing to apply for the {oferta} position I saw posted.

My name is {mi_nombre} and I have experience in software development, working with TypeScript, Angular, React, Node.js, and SQL/NoSQL databases. In my recent projects I've focused on building scalable applications with solid code practices.

Please find my CV and portfolio here: {mi_portfolio}

My LinkedIn: {mi_linkedin}

I'm available for an interview at your convenience. Thank you for your time.

Best regards,
{mi_nombre}` },

    { cat: techId, lang: 'en', type: 'mensaje_recruiter', name: 'Recruiter Message Tech EN',
      content: `Hi {nombre_reclutador}, how are you?

I'm reaching out because I noticed you work as {puesto_reclutador} at {empresa} and I wanted to ask if you have any active searches for developers at the moment.

I'm {mi_nombre}, a full-stack developer focused on TypeScript, Angular, and Node.js. I'm open to new opportunities and would love to know if there's anything that might fit my profile.

Here's my LinkedIn: {mi_linkedin}

Thanks and have a great day!

{mi_nombre}` },

    // ── MANAGEMENT ES ──
    { cat: mgmtId, lang: 'es', type: 'email', name: 'Mail Management ES',
      content: `Hola {nombre_reclutador},

Te escribo porque vi tu perfil de {puesto_reclutador} en {empresa} y me interesó la oportunidad de {oferta} que tienen abierta.

Soy {mi_nombre}, project manager con experiencia liderando equipos de desarrollo, gestionando stakeholders y llevando proyectos de principio a fin con metodologías ágiles.

Creo que mi experiencia en gestión de equipos técnicos y mi enfoque en resultados puede aportar valor a {empresa}.

Te dejo mi LinkedIn: {mi_linkedin}

Quedo atento a cualquier comentario. ¡Gracias!

Saludos,
{mi_nombre}` },

    { cat: mgmtId, lang: 'es', type: 'mensaje_empresa', name: 'Postulación Empresa Mgmt ES',
      content: `Estimado equipo de {empresa},

Me postulo a la posición de {oferta} que vi publicada recientemente.

Mi nombre es {mi_nombre} y me desempeño como project manager con experiencia en liderazgo de equipos multidisciplinarios, planificación estratégica y ejecución de proyectos de tecnología. Tengo un enfoque orientado a resultados y comunicación efectiva con stakeholders.

He liderado proyectos utilizando metodologías ágiles (Scrum, Kanban) y herramientas como Jira, Notion y GitHub Projects.

Mi portfolio y experiencia detallada: {mi_portfolio}
LinkedIn: {mi_linkedin}

Quedo a disposición para una entrevista. Muchas gracias.

Saludos cordiales,
{mi_nombre}` },

    { cat: mgmtId, lang: 'es', type: 'mensaje_recruiter', name: 'Mensaje Recruiter Mgmt ES',
      content: `Hola {nombre_reclutador}, ¿cómo estás?

Te contacto porque vi que sos {puesto_reclutador} en {empresa} y quería saber si tienen búsquedas activas para roles de management o liderazgo técnico.

Soy {mi_nombre}, project manager con background técnico. Tengo experiencia gestionando equipos de desarrollo y coordinando proyectos end-to-end. Me interesa sumarme a un equipo donde pueda aportar desde la gestión.

LinkedIn: {mi_linkedin}

¡Gracias y saludos!

{mi_nombre}` },

    // ── MANAGEMENT EN ──
    { cat: mgmtId, lang: 'en', type: 'email', name: 'Mail Management EN',
      content: `Hi {nombre_reclutador},

I'm reaching out because I saw your profile as {puesto_reclutador} at {empresa} and was interested in the {oferta} opening you have.

I'm {mi_nombre}, a project manager with experience leading development teams, managing stakeholders, and delivering projects end-to-end using agile methodologies.

I believe my experience in technical team management and results-driven approach can bring value to {empresa}.

Here's my LinkedIn: {mi_linkedin}

Looking forward to hearing from you. Thanks!

Best,
{mi_nombre}` },

    { cat: mgmtId, lang: 'en', type: 'mensaje_empresa', name: 'Company Application Mgmt EN',
      content: `Dear {empresa} team,

I'm applying for the {oferta} position I recently saw posted.

My name is {mi_nombre} and I work as a project manager with experience leading cross-functional teams, strategic planning, and technology project execution. I have a results-oriented approach and effective stakeholder communication.

I've led projects using agile methodologies (Scrum, Kanban) and tools like Jira, Notion, and GitHub Projects.

My portfolio and detailed experience: {mi_portfolio}
LinkedIn: {mi_linkedin}

I'm available for an interview at your convenience. Thank you.

Best regards,
{mi_nombre}` },

    { cat: mgmtId, lang: 'en', type: 'mensaje_recruiter', name: 'Recruiter Message Mgmt EN',
      content: `Hi {nombre_reclutador}, how are you?

I'm reaching out because I saw you work as {puesto_reclutador} at {empresa} and wanted to check if you have any active searches for management or technical leadership roles.

I'm {mi_nombre}, a project manager with a technical background. I have experience managing development teams and coordinating projects end-to-end. I'm interested in joining a team where I can contribute through management.

LinkedIn: {mi_linkedin}

Thanks and best regards!

{mi_nombre}` },
  ];

  const insertMany = db.transaction(() => {
    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      insertTemplate.run(t.cat, t.lang, t.type, t.name, t.content.trim(), i + 1);
    }
  });

  insertMany();

  const insertConfig = db.prepare('INSERT OR IGNORE INTO config (clave, valor) VALUES (?, ?)');
  const configs = [
    ['mi_nombre', ''],
    ['mi_linkedin', ''],
    ['mi_telefono', ''],
    ['mi_portfolio', ''],
    ['mi_email', ''],
  ];
  for (const [k, v] of configs) {
    insertConfig.run(k, v);
  }
}
