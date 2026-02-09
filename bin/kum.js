#!/usr/bin/env node

const { program } = require('commander');
const shell = require('shelljs');
const path = require('path');
const fs = require('fs');

// Configuración de versión
program.version('0.1.0').description('KUM CLI - Herramienta de despliegue para KUM');

/**
 * COMANDO: kum create <name>
 * Descarga el template base desde GitHub
 */
program
  .command('create <name>')
  .description('Crea un nuevo proyecto KUM clonando el repositorio base')
  .action((name) => {
    const targetPath = path.join(process.cwd(), name);

    if (fs.existsSync(targetPath)) {
      console.error(`❌ Error: La carpeta '${name}' ya existe.`);
      process.exit(1);
    }

    console.log(`🐦 KUM: Anidando nuevo proyecto en: ${targetPath}...`);

    // Clonamos el repositorio del motor (Template)
    // Cambia esta URL por la URL real de tu repositorio de template
    if (shell.exec(`git clone https://github.com/sosaheri/kum-cms.git "${name}"`).code !== 0) {
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
 * COMANDO: kum validate
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
 * COMANDO: kum build
 * Genera la versión estática monoficha (index-standalone.html)
 */
program
  .command('build')
  .description('Genera el archivo HTML estático con todo inyectado')
  .action(() => {
    console.log('📦 Generando build estático...');
    shell.exec('node scripts/build-standalone.js');
  });

program.parse(process.argv);