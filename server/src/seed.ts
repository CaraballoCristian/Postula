import db from './db';

function getOrCreateCategoria(userId: number, nombre: string): number {
  const existing = db.prepare('SELECT id FROM categorias WHERE user_id = ? AND nombre = ?').get(userId, nombre) as any;
  if (existing) return existing.id;
  return db.prepare('INSERT INTO categorias (user_id, nombre) VALUES (?, ?)').run(userId, nombre).lastInsertRowid as number;
}

function hasTemplate(userId: number, categoria_id: number, idioma: string, tipo: string, nombre: string): boolean {
  return !!db.prepare('SELECT id FROM templates WHERE user_id = ? AND categoria_id = ? AND idioma = ? AND tipo = ? AND nombre = ?')
    .get(userId, categoria_id, idioma, tipo, nombre);
}

function hasConfig(userId: number, clave: string): boolean {
  return !!db.prepare('SELECT id FROM config WHERE user_id = ? AND clave = ?').get(userId, clave);
}

function hasIdioma(userId: number, nombre: string): boolean {
  return !!db.prepare('SELECT id FROM idiomas WHERE user_id = ? AND nombre = ?').get(userId, nombre);
}

function hasTag(userId: number, nombre: string): boolean {
  return !!db.prepare('SELECT id FROM tags WHERE user_id = ? AND nombre = ?').get(userId, nombre);
}

/** Seeds de datos por defecto para un usuario. Idempotente: no duplica si ya existen. */
export function seedForUser(userId: number) {
  const techId = getOrCreateCategoria(userId, 'Tech');
  const mgmtId = getOrCreateCategoria(userId, 'Management');

  const insertTemplate = db.prepare(`
    INSERT INTO templates (user_id, categoria_id, idioma, tipo, nombre, contenido, orden)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const templates = [
    // ── TECH ES ──
    { cat: techId, lang: 'ESP', type: 'email', name: 'Mail Tech ES',
      content: `Hola {nombre_empleado},

Te escribo porque vi tu perfil de {puesto_empleado} en {empresa} y me interesó mucho la oferta de {oferta_laboral} que publicaron.

Soy {Nombre}, desarrollador con experiencia en tecnologías como TypeScript, Angular, Node.js y SQL. Actualmente estoy buscando nuevos desafíos y creo que mi perfil puede encajar bien con lo que están buscando.

Te dejo mi LinkedIn por si querés chusmear: {Linkedin}

Quedo atento a cualquier comentario. ¡Gracias!

Saludos,
{Nombre}` },

    { cat: techId, lang: 'ESP', type: 'mensaje_empresa', name: 'Postulación Empresa Tech ES',
      content: `Estimado equipo de {empresa},

Me dirijo a ustedes para postularme a la posición de {oferta_laboral} que vi publicada.

Mi nombre es {Nombre} y cuento con experiencia en desarrollo de software, trabajando con tecnologías como TypeScript, Angular, React, Node.js y bases de datos SQL/NoSQL. En mis últimos proyectos me he enfocado en construir aplicaciones escalables y mantener buenas prácticas de código.

Adjunto mi CV y portfolio para que puedan conocer más sobre mi trabajo: {Portfolio}

Mi LinkedIn: {Linkedin}

Quedo a disposición para coordinar una entrevista. Muchas gracias por su tiempo.

Saludos cordiales,
{Nombre}` },

    { cat: techId, lang: 'ESP', type: 'mensaje_recruiter', name: 'Mensaje Recruiter Tech ES',
      content: `Hola {nombre_empleado}, ¿cómo estás?

Te contacto porque vi que trabajás como {puesto_empleado} en {empresa} y quería consultarte si tenés alguna búsqueda activa para desarrolladores.

Soy {Nombre}, desarrollador full-stack con foco en TypeScript, Angular y Node.js. Estoy abierto a nuevas oportunidades y me gustaría saber si hay algo que pueda encajar con mi perfil.

Te dejo mi LinkedIn: {Linkedin}

¡Gracias y buen día!

{Nombre}` },

    // ── TECH EN ──
    { cat: techId, lang: 'ENG', type: 'email', name: 'Mail Tech EN',
      content: `Hi {nombre_empleado},

I'm reaching out because I saw your profile as {puesto_empleado} at {empresa} and I was really interested in the {oferta_laboral} opening you posted.

I'm {Nombre}, a software developer with experience in TypeScript, Angular, Node.js, and SQL. I'm currently looking for new challenges and I believe my background could be a good fit for what you're looking for.

Here's my LinkedIn if you'd like to take a look: {Linkedin}

Looking forward to hearing from you. Thanks!

Best,
{Nombre}` },

    { cat: techId, lang: 'ENG', type: 'mensaje_empresa', name: 'Company Application Tech EN',
      content: `Dear {empresa} team,

I'm writing to apply for the {oferta_laboral} position I saw posted.

My name is {Nombre} and I have experience in software development, working with TypeScript, Angular, React, Node.js, and SQL/NoSQL databases. In my recent projects I've focused on building scalable applications with solid code practices.

Please find my CV and portfolio here: {Portfolio}

My LinkedIn: {Linkedin}

I'm available for an interview at your convenience. Thank you for your time.

Best regards,
{Nombre}` },

    { cat: techId, lang: 'ENG', type: 'mensaje_recruiter', name: 'Recruiter Message Tech EN',
      content: `Hi {nombre_empleado}, how are you?

I'm reaching out because I noticed you work as {puesto_empleado} at {empresa} and I wanted to ask if you have any active searches for developers at the moment.

I'm {Nombre}, a full-stack developer focused on TypeScript, Angular, and Node.js. I'm open to new opportunities and would love to know if there's anything that might fit my profile.

Here's my LinkedIn: {Linkedin}

Thanks and have a great day!

{Nombre}` },

    // ── MANAGEMENT ES ──
    { cat: mgmtId, lang: 'ESP', type: 'email', name: 'Mail Management ES',
      content: `Hola {nombre_empleado},

Te escribo porque vi tu perfil de {puesto_empleado} en {empresa} y me interesó la oportunidad de {oferta_laboral} que tienen abierta.

Soy {Nombre}, project manager con experiencia liderando equipos de desarrollo, gestionando stakeholders y llevando proyectos de principio a fin con metodologías ágiles.

Creo que mi experiencia en gestión de equipos técnicos y mi enfoque en resultados puede aportar valor a {empresa}.

Te dejo mi LinkedIn: {Linkedin}

Quedo atento a cualquier comentario. ¡Gracias!

Saludos,
{Nombre}` },

    { cat: mgmtId, lang: 'ESP', type: 'mensaje_empresa', name: 'Postulación Empresa Mgmt ES',
      content: `Estimado equipo de {empresa},

Me postulo a la posición de {oferta_laboral} que vi publicada recientemente.

Mi nombre es {Nombre} y me desempeño como project manager con experiencia en liderazgo de equipos multidisciplinarios, planificación estratégica y ejecución de proyectos de tecnología. Tengo un enfoque orientado a resultados y comunicación efectiva con stakeholders.

He liderado proyectos utilizando metodologías ágiles (Scrum, Kanban) y herramientas como Jira, Notion y GitHub Projects.

Mi portfolio y experiencia detallada: {Portfolio}
LinkedIn: {Linkedin}

Quedo a disposición para una entrevista. Muchas gracias.

Saludos cordiales,
{Nombre}` },

    { cat: mgmtId, lang: 'ESP', type: 'mensaje_recruiter', name: 'Mensaje Recruiter Mgmt ES',
      content: `Hola {nombre_empleado}, ¿cómo estás?

Te contacto porque vi que sos {puesto_empleado} en {empresa} y quería saber si tienen búsquedas activas para roles de management o liderazgo técnico.

Soy {Nombre}, project manager con background técnico. Tengo experiencia gestionando equipos de desarrollo y coordinando proyectos end-to-end. Me interesa sumarme a un equipo donde pueda aportar desde la gestión.

LinkedIn: {Linkedin}

¡Gracias y saludos!

{Nombre}` },

    // ── MANAGEMENT EN ──
    { cat: mgmtId, lang: 'ENG', type: 'email', name: 'Mail Management EN',
      content: `Hi {nombre_empleado},

I'm reaching out because I saw your profile as {puesto_empleado} at {empresa} and was interested in the {oferta_laboral} opening you have.

I'm {Nombre}, a project manager with experience leading development teams, managing stakeholders, and delivering projects end-to-end using agile methodologies.

I believe my experience in technical team management and results-driven approach can bring value to {empresa}.

Here's my LinkedIn: {Linkedin}

Looking forward to hearing from you. Thanks!

Best,
{Nombre}` },

    { cat: mgmtId, lang: 'ENG', type: 'mensaje_empresa', name: 'Company Application Mgmt EN',
      content: `Dear {empresa} team,

I'm applying for the {oferta_laboral} position I recently saw posted.

My name is {Nombre} and I work as a project manager with experience leading cross-functional teams, strategic planning, and technology project execution. I have a results-oriented approach and effective stakeholder communication.

I've led projects using agile methodologies (Scrum, Kanban) and tools like Jira, Notion, and GitHub Projects.

My portfolio and detailed experience: {Portfolio}
LinkedIn: {Linkedin}

I'm available for an interview at your convenience. Thank you.

Best regards,
{Nombre}` },

    { cat: mgmtId, lang: 'ENG', type: 'mensaje_recruiter', name: 'Recruiter Message Mgmt EN',
      content: `Hi {nombre_empleado}, how are you?

I'm reaching out because I saw you work as {puesto_empleado} at {empresa} and wanted to check if you have any active searches for management or technical leadership roles.

I'm {Nombre}, a project manager with a technical background. I have experience managing development teams and coordinating projects end-to-end. I'm interested in joining a team where I can contribute through management.

LinkedIn: {Linkedin}

Thanks and best regards!

{Nombre}` },
  ];

  db.transaction(() => {
    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      if (!hasTemplate(userId, t.cat, t.lang, t.type, t.name)) {
        insertTemplate.run(userId, t.cat, t.lang, t.type, t.name, t.content.trim(), i + 1);
      }
    }
  })();

  const configs = [
    ['Nombre', ''],
    ['Linkedin', ''],
    ['Telefono', ''],
    ['Portfolio', ''],
    ['Email', ''],
  ];
  const insertConfig = db.prepare('INSERT INTO config (user_id, clave, valor) VALUES (?, ?, ?)');
  for (const [k, v] of configs) {
    if (!hasConfig(userId, k)) insertConfig.run(userId, k, v);
  }
  if (!hasConfig(userId, 'default_categoria_id')) insertConfig.run(userId, 'default_categoria_id', String(techId));
  if (!hasConfig(userId, 'default_idioma')) insertConfig.run(userId, 'default_idioma', 'ESP');

  const insertIdioma = db.prepare('INSERT INTO idiomas (user_id, nombre) VALUES (?, ?)');
  for (const nombre of ['ESP', 'ENG']) {
    if (!hasIdioma(userId, nombre)) insertIdioma.run(userId, nombre);
  }

  const insertTag = db.prepare('INSERT INTO tags (user_id, nombre, color) VALUES (?, ?, ?)');
  for (const [nombre, color] of [
    ['solicitado', 'var(--surface-hover)'],
    ['mensajeado', '#16a34a'],
    ['en_proceso', '#2563eb'],
    ['rechazado', '#dc2626'],
    ['pendiente', '#d97706'],
  ] as [string, string][]) {
    if (!hasTag(userId, nombre)) insertTag.run(userId, nombre, color);
  }
}
