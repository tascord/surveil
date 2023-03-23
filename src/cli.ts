#!/usr/bin/env node
import { execSync } from 'child_process';
import { Command } from 'commander';
import { prompt } from 'enquirer';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import Listr from 'listr';
import { resolve } from 'path';
const program = new Command;
const package_info = require('../package.json');

const supported_pkg_managers = ['npm', 'yarn', 'pnpm'];

program
    .name('surveil')
    .version(package_info.version)
    .description('Setup and management utility for surveil')

program.command('init')
    .description('Initialize basic surveil application')
    .argument('[path]', 'Path to initialize surveil application', undefined)
    .option('-p, --pkg <manager>', 'Package manager to use', 'npm')
    .action(async (given_path, options) => {

        const install = (pkg: string) => {
            switch (options.pkg) {
                case 'yarn':
                    return `yarn add ${pkg}`;
                case 'pnpm':
                    return `pnpm add ${pkg}`;
                default:
                    return `npm install ${pkg}`;
            }
        }

        const fail = (reason?: string, hide = false) => {

            console.log(`\n• [Surveil] Setup failed!`)

            if (!hide) {
                console.log(
                    `  Please ensure that you have the following installed:\n` +
                    `  • Node.js (https://nodejs.org/en/download/)\n` +
                    `  • Git (https://git-scm.com/downloads)\n` +
                    `  • ${options.pkg} (https://www.npmjs.com/package/${options.pkg})\n`
                )
            }

            if (reason) {
                console.log(
                    `\n  [Error]\n` +
                    `  ${reason}\n`
                )
            }

            process.exit(1);
        }

        console.log(`\n• [Surveil] Setup!\n`)

        // Select package manager if unsupported
        if (!supported_pkg_managers.includes(options.pkg)) options.pgk = await (await prompt<{ pkg: string }>({
            type: 'select',
            name: 'pkg',
            message: `Package manager '${options.pkg}' is not supported. Select package manager to use`,
            choices: supported_pkg_managers,
        })).pkg;


        // Select path to initialize surveil application if not given
        if (!given_path) given_path = (await prompt<{ path: string }>({
            type: 'input',
            name: 'path',
            message: 'Path to initialize surveil application',
        })).path;

        const in_cwd = given_path === '.';
        const wd = in_cwd ? process.cwd() : resolve(given_path);
        if (!existsSync(wd)) return fail(`Path '${given_path}' does not exist`, true);

        let tasks: Listr.ListrTask[] = [
            {
                title: 'Clone surveil repository',
                task: () => void execSync(`git clone --no-checkout ${package_info.repository.url} ${wd}`)
            },
            {
                title: 'Setup repository sparsely',
                task: () => void execSync(`git sparse-checkout init --cone`, { cwd: wd })
            },
            {
                title: 'Add example files to sparse checkout',
                task: () => void execSync(`git sparse-checkout set example/`, { cwd: wd })
            },
            {
                title: 'Install dependencies',
                task: () => void execSync(install('surveil'), { cwd: wd })
            }
        ];

        if (existsSync(wd) && readdirSync(wd).length > 0) return fail(`Path '${given_path}' is not empty`, true);
        if (!in_cwd && !existsSync(wd)) tasks.unshift({
            title: `Creating directory '${given_path}'`,
            task: () => mkdirSync(wd)
        });

        console.log(`\n• [Surveil] Initializing surveil application in '${given_path}'\n`)
        new Listr(tasks).run()
            .then(() => console.log(`\n• [Surveil] Setup complete!`))
            .catch(fail);

        console.log(given_path);

    })


program.parse();