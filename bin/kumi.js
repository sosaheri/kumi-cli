#!/usr/bin/env node

const { program } = require('commander');
const shell = require('shelljs');
const path = require('path');
const fs = require('fs');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const child = require('child_process');

// Configuración de versión
program.version('0.1.0').description('KUMI CLI - Herramienta de despliegue para KUMI');

/**
 * COMANDO: create <name>
 * Descarga el template base desde GitHub
 */
program
  .command('create <name>')
  .description('Crea un nuevo proyecto clonando el repositorio base')
  .action((name) => {
    const targetPath = path.join(process.cwd(), name);

    if (fs.existsSync(targetPath)) {
      console.error(`❌ Error: La carpeta '${name}' ya existe.`);
      process.exit(1);
    }

    console.log(`🐦 KUMI: Anidando nuevo proyecto en: ${targetPath}...`);

    // Clonamos el repositorio del motor (Template)
    // Cambia esta URL por la URL real de tu repositorio de template
    if (shell.exec(`git clone https://github.com/sosaheri/kumi-cms.git "${name}"`).code !== 0) {
      console.error('❌ Error: No se pudo clonar el repositorio.');
      process.exit(1);
    }

    // Limpieza de rastros de Git del template para iniciar un repo limpio
    shell.rm('-rf', path.join(targetPath, '.git'));

    console.log(`\n✅ ¡Proyecto '${name}' creado con éxito!`);
    console.log(`\nPasos siguientes:`);
    console.log(`  1. cd ${name}`);
    console.log(`  2. npm install`);
    console.log(`  3. npm run dev`);
  });

/**
 * COMANDO: validate
 * Valida los archivos JSON de la carpeta /data usando los esquemas
 */
program
  .command('validate')
  .description('Valida que los datos en /data cumplan con los esquemas de /schemas')
  .action(() => {
    const scriptsPath = path.join(process.cwd(), 'scripts', 'validate-data.js');
    if (!fs.existsSync(scriptsPath)) {
        console.error('❌ Error: No se encontró el script de validación en el proyecto actual.');
        return;
    }
    shell.exec('node scripts/validate-data.js');
  });

/**
 * COMANDO: build
 * Genera la versión estática monoficha (index-standalone.html)
 */
program
  .command('build')
  .description('Genera el archivo HTML estático con todo inyectado')
  .action(() => {
    console.log('📦 Generando build estático...');
    shell.exec('node scripts/build-standalone.js');
  });

program
  .command('wizard')
  .description('Wizard interactivo para componer un sitio seleccionando secciones')
  .action(async () => {
    const rl = readline.createInterface({ input, output });
    const cwd = process.cwd();
    // locate catalog
    let catalogPath = path.join(cwd, 'library', 'catalog.json');
    if (!fs.existsSync(catalogPath)) catalogPath = path.join(cwd, 'catalog.json');
    if (!fs.existsSync(catalogPath)) {
      console.error('No se encontró library/catalog.json ni catalog.json en el proyecto.');
      rl.close();
      return;
    }
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const components = catalog.components || [];

    console.log('\nKUMI Wizard — Composición guiada');

    // Select sections in order
    const chosen = [];
    while (true) {
      console.log('\nSecciones disponibles:');
      components.forEach((c, i) => {
        console.log(` ${i + 1}) ${c.name}  [id: ${c.id}] ${c.tier === 'premium' ? '⚠️ Premium' : ''}`);
      });
      const ans = await rl.question('Introduce el id de la sección para añadir (o "done"): ');
      if (!ans || ans.trim().toLowerCase() === 'done') break;
      const id = ans.trim();
      const comp = components.find(c => c.id === id || String(components.indexOf(c) + 1) === id);
      if (!comp) {
        console.log('ID no reconocido. Intenta de nuevo.');
        continue;
      }
      if (comp.tier === 'premium') {
        console.log('⚠️ Esta sección es Premium. Se requiere una licencia activa para el build final. (Se permitirá continuar para pruebas)');
      }
      chosen.push(comp.id);

      // For Features: loop add features
      if (comp.id === 'features-grid') {
        const sectionData = {};
        sectionData.section_title = await rl.question('Título de la sección (ej: Nuestros Servicios): ');
        const features = [];
        while (true) {
          const icon = await rl.question('Icono (ej: star): ');
          const title = await rl.question('Título de la característica: ');
          const desc = await rl.question('Descripción corta: ');
          features.push({ icon, title, desc });
          const more = await rl.question('¿Quieres añadir otra característica? (S/N): ');
          if (!more || more.trim().toLowerCase() !== 's') break;
        }
        // build html
        const featuresHtml = features.map(f => `<div class="feature"><i class="icon-${f.icon}"></i><h3>${f.title}</h3><p>${f.desc}</p></div>`).join('\n');
        // save into sections.json structure
        const sectionsFile = path.join(cwd, 'data', 'sections.json');
        const sections = fs.existsSync(sectionsFile) ? JSON.parse(fs.readFileSync(sectionsFile,'utf8')) : {};
        sections['features-grid'] = { section_title: sectionData.section_title, features_html: featuresHtml };
        fs.writeFileSync(sectionsFile, JSON.stringify(sections, null, 2), 'utf8');
      }

      // For Pricing
      if (comp.id === 'pricing-base') {
        const plan_name = await rl.question('Nombre del plan (ej: Pro): ');
        const price = await rl.question('Precio (número): ');
        const currency = await rl.question('Moneda (ej: $): ');
        const features = [];
        while (true) {
          const feat = await rl.question('Descripción de característica: ');
          features.push(feat);
          const more = await rl.question('¿Otra característica? (S/N): ');
          if (!more || more.trim().toLowerCase() !== 's') break;
        }
        const featuresHtml = features.map(f => `<li>${f}</li>`).join('\n');
        const payment_link = await rl.question('Link de pago (url): ');
        const sectionsFile = path.join(cwd, 'data', 'sections.json');
        const sections = fs.existsSync(sectionsFile) ? JSON.parse(fs.readFileSync(sectionsFile,'utf8')) : {};
        sections['pricing-base'] = { plan_name, price, currency, features_html: featuresHtml, payment_link };
        fs.writeFileSync(sectionsFile, JSON.stringify(sections, null, 2), 'utf8');
      }

      // For Testimonials
      if (comp.id === 'testimonials-base') {
        const testimonials = [];
        while (true) {
          const quote = await rl.question('Cita/Texto del testimonio: ');
          const author = await rl.question('Autor (nombre): ');
          const role = await rl.question('Cargo/Empresa: ');
          const avatar = await rl.question('Avatar URL: ');
          testimonials.push({ quote, author, role, avatar });
          const more = await rl.question('¿Otro testimonio? (S/N): ');
          if (!more || more.trim().toLowerCase() !== 's') break;
        }
        const testimonialsHtml = testimonials.map(t => `<article class="testimonial"><blockquote>${t.quote}</blockquote><p class="author">${t.author} — ${t.role}</p></article>`).join('\n');
        const sectionsFile = path.join(cwd, 'data', 'sections.json');
        const sections = fs.existsSync(sectionsFile) ? JSON.parse(fs.readFileSync(sectionsFile,'utf8')) : {};
        sections['testimonials-base'] = { testimonials_html: testimonialsHtml };
        fs.writeFileSync(sectionsFile, JSON.stringify(sections, null, 2), 'utf8');
      }

      // For FAQ
      if (comp.id === 'faq-base') {
        const faqs = [];
        while (true) {
          const q = await rl.question('Pregunta: ');
          const a = await rl.question('Respuesta: ');
          faqs.push({ q, a });
          const more = await rl.question('¿Otra pregunta? (S/N): ');
          if (!more || more.trim().toLowerCase() !== 's') break;
        }
        const faqHtml = faqs.map(item => `<div class="faq-item"><strong>${item.q}</strong><p>${item.a}</p></div>`).join('\n');
        const sectionsFile = path.join(cwd, 'data', 'sections.json');
        const sections = fs.existsSync(sectionsFile) ? JSON.parse(fs.readFileSync(sectionsFile,'utf8')) : {};
        sections['faq-base'] = { faq_html: faqHtml };
        fs.writeFileSync(sectionsFile, JSON.stringify(sections, null, 2), 'utf8');
      }

      // For Contact
      if (comp.id === 'contact-base') {
        const title = await rl.question('Título de contacto (ej: Hablemos): ');
        const email = await rl.question('Email de destino: ');
        const phone = await rl.question('Teléfono/WhatsApp: ');
        const sectionsFile = path.join(cwd, 'data', 'sections.json');
        const sections = fs.existsSync(sectionsFile) ? JSON.parse(fs.readFileSync(sectionsFile,'utf8')) : {};
        sections['contact-base'] = { title, email, phone };
        fs.writeFileSync(sectionsFile, JSON.stringify(sections, null, 2), 'utf8');
      }

      // For Hero
      if (comp.id === 'hero-standard') {
        const title = await rl.question('Título H1: ');
        const subtitle = await rl.question('Subtítulo pequeño: ');
        const desc = await rl.question('Descripción: ');
        const bg_img = await rl.question('URL de imagen de fondo: ');
        const cta_text = await rl.question('Texto del CTA: ');
        const cta_link = await rl.question('Link del CTA: ');
        const sectionsFile = path.join(cwd, 'data', 'sections.json');
        const sections = fs.existsSync(sectionsFile) ? JSON.parse(fs.readFileSync(sectionsFile,'utf8')) : {};
        sections['hero-standard'] = { hero: { title, subtitle, desc, bg_img, cta_text, cta_link } };
        fs.writeFileSync(sectionsFile, JSON.stringify(sections, null, 2), 'utf8');
      }

    }

    // Ask global config
    const siteTitle = await rl.question('\nNombre del sitio (site.title): ');
    const siteDesc = await rl.question('Descripción corta del sitio (site.description): ');
    const email = await rl.question('Email de contacto global: ');
    const config = { site: { title: siteTitle, description: siteDesc, contact_email: email } };
    const configPath = path.join(cwd, 'data', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

    // Write layout
    const layoutPath = path.join(cwd, 'data', 'layout.json');
    fs.writeFileSync(layoutPath, JSON.stringify({ sections: chosen }, null, 2), 'utf8');

    rl.close();

    const buildNow = await (async () => {
      // simple confirm via readline on console
      const r2 = readline.createInterface({ input, output });
      const ans = await r2.question('¿Deseas construir el sitio ahora? (S/N): ');
      r2.close();
      return ans && ans.trim().toLowerCase() === 's';
    })();

    if (buildNow) {
      console.log('Lanzando build...');
      try {
        child.execSync('node scripts/assemble-theme.js', { stdio: 'inherit' });
      } catch (e) {
        console.error('Error ejecutando el ensamblador:', e.message);
      }
    } else {
      console.log('Wizard finalizado. Ejecuta `node scripts/assemble-theme.js` cuando quieras generar el sitio.');
    }
  });

program.parse(process.argv);
