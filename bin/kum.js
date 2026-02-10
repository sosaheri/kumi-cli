#!/usr/bin/env node

const { program } = require('commander');
const shell = require('shelljs');
const path = require('path');
const fs = require('fs');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const child = require('child_process');

// CLI version and description
program.version('0.1.0').description('KUMI CLI - Deployment tool for KUMI (alias kum kept for compatibility)');

/**
 * COMMAND: create <name>
 * Clone the base template repository to start a new project.
 */
program
  .command('create <name>')
  .description('Creates a new KUMI project by cloning the base repository')
  .action((name) => {
    const targetPath = path.join(process.cwd(), name);

    if (fs.existsSync(targetPath)) {
      console.error(`❌ Error: Directory '${name}' already exists.`);
      process.exit(1);
    }

    console.log(`🐦 KUMI: Creating new project at: ${targetPath}...`);

    // Clone template repository (change URL to your template if needed)
    if (shell.exec(`git clone https://github.com/sosaheri/kumi-cms.git "${name}"`).code !== 0) {
      console.error('❌ Error: Could not clone repository.');
      process.exit(1);
    }

    // Remove .git from template so user starts with a clean repo
    shell.rm('-rf', path.join(targetPath, '.git'));

    console.log(`\n✅ Project '${name}' created successfully!`);
    console.log(`\nNext steps:`);
    console.log(`  1. cd ${name}`);
    console.log(`  2. npm install`);
    console.log(`  3. npm run dev`);
  });

/**
 * COMMAND: validate
 * Validate JSON files in /data using the provided schemas
 */
program
  .command('validate')
  .description('Validate that data in /data matches schemas in /schemas')
  .action(() => {
    const scriptsPath = path.join(process.cwd(), 'scripts', 'validate-data.js');
    if (!fs.existsSync(scriptsPath)) {
        console.error('❌ Error: validation script not found in this project.');
        return;
    }
    shell.exec('node scripts/validate-data.js');
  });

/**
 * COMMAND: build
 * Generate the standalone static HTML
 */
program
  .command('build')
  .description('Generate static HTML file with injected sections')
  .action(() => {
    console.log('📦 Generating static build...');
    shell.exec('node scripts/build-standalone.js');
  });

program
  .command('wizard')
  .description('Interactive wizard to compose a site by selecting sections')
  .action(async () => {
    const rl = readline.createInterface({ input, output });
    const cwd = process.cwd();
    // locate catalog
    let catalogPath = path.join(cwd, 'library', 'catalog.json');
    if (!fs.existsSync(catalogPath)) catalogPath = path.join(cwd, 'catalog.json');
    if (!fs.existsSync(catalogPath)) {
      console.error('library/catalog.json or catalog.json not found in project.');
      rl.close();
      return;
    }
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const components = catalog.components || [];

    console.log('\nKUMI Wizard — guided composition');

    // Select sections in order
    const chosen = [];
    while (true) {
      console.log('\nAvailable sections:');
      components.forEach((c, i) => {
        console.log(` ${i + 1}) ${c.name}  [id: ${c.id}] ${c.tier === 'premium' ? '⚠️ Premium' : ''}`);
      });
      const ans = await rl.question('Enter section id to add (or "done"): ');
      if (!ans || ans.trim().toLowerCase() === 'done') break;
      const id = ans.trim();
      const comp = components.find(c => c.id === id || String(components.indexOf(c) + 1) === id);
      if (!comp) {
        console.log('Unrecognized id. Try again.');
        continue;
      }
      if (comp.tier === 'premium') {
        console.log('⚠️ This is a Premium section. An active license is required for the final build. (Continuing allowed for testing)');
      }
      chosen.push(comp.id);

      // For Features: loop add features
      if (comp.id === 'features-grid') {
        const sectionData = {};
        sectionData.section_title = await rl.question('Section title (e.g., Our Services): ');
        const features = [];
        while (true) {
          const icon = await rl.question('Icon (e.g., star): ');
          const title = await rl.question('Feature title: ');
          const desc = await rl.question('Short description: ');
          features.push({ icon, title, desc });
          const more = await rl.question('Add another feature? (Y/N): ');
          if (!more || !['y','s'].includes(more.trim().toLowerCase())) break;
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
        const plan_name = await rl.question('Plan name (e.g., Pro): ');
        const price = await rl.question('Price (number): ');
        const currency = await rl.question('Currency (e.g., $): ');
        const features = [];
        while (true) {
          const feat = await rl.question('Feature description: ');
          features.push(feat);
          const more = await rl.question('Another feature? (Y/N): ');
          if (!more || !['y','s'].includes(more.trim().toLowerCase())) break;
        }
        const featuresHtml = features.map(f => `<li>${f}</li>`).join('\n');
        const payment_link = await rl.question('Payment link (url): ');
        const sectionsFile = path.join(cwd, 'data', 'sections.json');
        const sections = fs.existsSync(sectionsFile) ? JSON.parse(fs.readFileSync(sectionsFile,'utf8')) : {};
        sections['pricing-base'] = { plan_name, price, currency, features_html: featuresHtml, payment_link };
        fs.writeFileSync(sectionsFile, JSON.stringify(sections, null, 2), 'utf8');
      }

      // For Testimonials
      if (comp.id === 'testimonials-base') {
        const testimonials = [];
        while (true) {
          const quote = await rl.question('Quote/text: ');
          const author = await rl.question('Author (name): ');
          const role = await rl.question('Role/Company: ');
          const avatar = await rl.question('Avatar URL: ');
          testimonials.push({ quote, author, role, avatar });
          const more = await rl.question('Another testimonial? (Y/N): ');
          if (!more || !['y','s'].includes(more.trim().toLowerCase())) break;
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
          const q = await rl.question('Question: ');
          const a = await rl.question('Answer: ');
          faqs.push({ q, a });
          const more = await rl.question('Another question? (Y/N): ');
          if (!more || !['y','s'].includes(more.trim().toLowerCase())) break;
        }
        const faqHtml = faqs.map(item => `<div class="faq-item"><strong>${item.q}</strong><p>${item.a}</p></div>`).join('\n');
        const sectionsFile = path.join(cwd, 'data', 'sections.json');
        const sections = fs.existsSync(sectionsFile) ? JSON.parse(fs.readFileSync(sectionsFile,'utf8')) : {};
        sections['faq-base'] = { faq_html: faqHtml };
        fs.writeFileSync(sectionsFile, JSON.stringify(sections, null, 2), 'utf8');
      }

      // For Contact
      if (comp.id === 'contact-base') {
        const title = await rl.question('Contact title (e.g., Let\'s talk): ');
        const email = await rl.question('Destination email: ');
        const phone = await rl.question('Phone/WhatsApp: ');
        const sectionsFile = path.join(cwd, 'data', 'sections.json');
        const sections = fs.existsSync(sectionsFile) ? JSON.parse(fs.readFileSync(sectionsFile,'utf8')) : {};
        sections['contact-base'] = { title, email, phone };
        fs.writeFileSync(sectionsFile, JSON.stringify(sections, null, 2), 'utf8');
      }

      // For Hero
      if (comp.id === 'hero-standard') {
        const title = await rl.question('H1 title: ');
        const subtitle = await rl.question('Small subtitle: ');
        const desc = await rl.question('Description: ');
        const bg_img = await rl.question('Background image URL: ');
        const cta_text = await rl.question('CTA text: ');
        const cta_link = await rl.question('CTA link: ');
        const sectionsFile = path.join(cwd, 'data', 'sections.json');
        const sections = fs.existsSync(sectionsFile) ? JSON.parse(fs.readFileSync(sectionsFile,'utf8')) : {};
        sections['hero-standard'] = { hero: { title, subtitle, desc, bg_img, cta_text, cta_link } };
        fs.writeFileSync(sectionsFile, JSON.stringify(sections, null, 2), 'utf8');
      }

    }

    // Ask global config
    const siteTitle = await rl.question('\nSite name (site.title): ');
    const siteDesc = await rl.question('Short site description (site.description): ');
    const email = await rl.question('Global contact email: ');
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
      const ans = await r2.question('Do you want to build the site now? (Y/N): ');
      r2.close();
      return ans && ['y','s'].includes(ans.trim().toLowerCase());
    })();

    if (buildNow) {
      console.log('Launching build...');
      try {
        child.execSync('node scripts/assemble-theme.js', { stdio: 'inherit' });
      } catch (e) {
        console.error('Error running assembler:', e.message);
      }
    } else {
      console.log('Wizard finished. Run `node scripts/assemble-theme.js` when you want to generate the site.');
    }
  });

program
  .command('clean-themes')
  .description('Remove generated builds in themes/* (index-standalone.html and assets/)')
  .action(() => {
    const cwd = process.cwd();
    const themesDir = path.join(cwd, 'themes');
    if (!fs.existsSync(themesDir)) {
      console.log('No themes/ directory found. Nothing to clean.');
      return;
    }
    const shell = require('shelljs');
    const glob = path.join(themesDir, '*', 'index-standalone.html');
    shell.rm('-f', glob);
    const assetsGlob = path.join(themesDir, '*', 'assets');
    shell.rm('-rf', assetsGlob);
    console.log('Themes cleaned: removed generated index-standalone.html and assets/ folders.');
  });

program.parse(process.argv);
