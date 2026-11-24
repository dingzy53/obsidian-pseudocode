import { browser, expect } from '@wdio/globals';
import { describe, it } from 'mocha';

async function openNote(notePath: string, mode: 'preview' | 'live-preview'): Promise<void> {
	await browser.executeObsidian(
		async ({ app }, targetPath, viewMode) => {
			const file = app.vault.getFileByPath(targetPath);
			if (!file) throw new Error(`Missing vault file: ${targetPath}`);
			const leaf = app.workspace.getLeaf(false);
			const state = viewMode === 'preview' ? { mode: 'preview' } : { mode: 'source', source: false };
			await leaf.openFile(file, { state });
			app.workspace.setActiveLeaf(leaf, { focus: true });
		},
		notePath,
		mode,
	);
	await browser.waitUntil(
		async () =>
			browser.executeObsidian(({ app, obsidian }, expected) => {
				return app.workspace.getActiveViewOfType(obsidian.MarkdownView)?.file?.path === expected;
			}, notePath),
		{ timeout: 10000, timeoutMsg: `Timed out opening ${notePath}` },
	);
}

describe('Plain Pseudocode E2E', function () {
	it('loads the plain-pseudocode plugin cleanly', async function () {
		const enabled = await browser.executeObsidian(({ app }) => {
			const plugins = (app as unknown as { plugins: { enabledPlugins: Set<string> } }).plugins;
			return plugins.enabledPlugins.has('plain-pseudocode');
		});
		expect(enabled).toBe(true);
	});

	it('renders algo code blocks in Reading view', async function () {
		await openNote('Algorithm.md', 'preview');

		await browser.waitUntil(
			async () =>
				browser.executeObsidian(({ app, obsidian }) => {
					const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
					const root = view?.previewMode?.containerEl;
					return Boolean(root?.querySelector('.algo'));
				}),
			{ timeout: 10000, timeoutMsg: 'Expected .algo block to render in Reading view' },
		);

		const rendered = await browser.executeObsidian(({ app, obsidian }) => {
			const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
			const algo = view?.previewMode?.containerEl?.querySelector('.algo');
			return {
				exists: Boolean(algo),
				text: algo?.textContent ?? '',
				keywords: algo?.querySelectorAll('.algo-kw').length ?? 0,
			};
		});

		expect(rendered.exists).toBe(true);
		expect(rendered.text).toContain('Euclid');
		expect(rendered.keywords).toBeGreaterThan(0);
	});

	it('registers commands and inserts a pseudocode block in Live Preview', async function () {
		await openNote('Algorithm.md', 'live-preview');

		await browser.executeObsidian(({ app, obsidian }) => {
			const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
			view?.editor.setCursor({ line: 0, ch: 0 });
		});

		await browser.executeObsidianCommand('plain-pseudocode:insert-pseudocode-block');

		const docText = await browser.executeObsidian(({ app, obsidian }) => {
			return app.workspace.getActiveViewOfType(obsidian.MarkdownView)?.editor.getValue() ?? '';
		});
		expect(docText).toContain('```algo');
	});
});
