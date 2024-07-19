const esbuild = require("esbuild");
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode', '@vscode/codicons', '@vscode/webview-ui-toolkit'],
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	});

	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await copyDependencies();
		await ctx.dispose();
	}
}

async function copyDependencies() {
	const cpy = await import('cpy');
	await cpy.default([
		'node_modules/@vscode/codicons/dist/**/*',
		'node_modules/@vscode/webview-ui-toolkit/dist/**/*'
	], path.join('dist', 'node_modules', '@vscode'));
	console.log('Dependencies copied successfully');
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
