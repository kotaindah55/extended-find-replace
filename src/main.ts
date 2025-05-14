import { App, MarkdownView, Plugin } from "obsidian";
import { EditorView } from "@codemirror/view";
import { search, SearchQuery, SearchQueryConfig, setSearchQuery } from "@codemirror/search";
import { restoreLastQuery, panelsConfig, searchPanelConfig, showReplace } from "src/cm-extensions/search";
import { SearchPanel } from "src/components/panel";
import { searchAndReplaceCmd, searchCmd } from "src/commands";
import { defaultTheme } from "src/theme";
import { ExtendedFindReplaceSettings } from "src/typings";
import { DEFAULT_SETTINGS } from "src/settings/config";
import { ExtendedFindReplaceSettingTab } from "src/settings/setting-tab";
import { getEmptyQuery, getQueryConfig } from "src/utils/editor-utils";
import { primarySelectionAdjust } from "src/cm-extensions/draw-selection";

/**
 * Iterate available markdown views and run the given callback on every
 * view that had been passed.
 */
function _iterMarkdownView(app: App, callback: (view: MarkdownView) => unknown): void {
	app.workspace.getLeavesOfType("markdown").forEach(leaf => {
		if (leaf.view instanceof MarkdownView)
			callback(leaf.view);
	});
}

export default class ExtendedFindReplacePlugin extends Plugin {
	public settings: ExtendedFindReplaceSettings;
	/** Stored shared query. */
	public activeSharedQuery?: SearchQuery;

	private _settingTab: ExtendedFindReplaceSettingTab;

	public async onload(): Promise<void> {
		await this.loadSettings();

		this._settingTab = new ExtendedFindReplaceSettingTab(this);
		this.addSettingTab(this._settingTab);

		this.registerEditorExtension([
			restoreLastQuery(this),
			searchPanelConfig.of(showReplace.of(false)),
			panelsConfig.of([]),
			search({
				top: true,
				createPanel: view => new SearchPanel(view, this),
				scrollToMatch: range => EditorView.scrollIntoView(range, { y: "center" })
			}),
			primarySelectionAdjust.of([]),
			defaultTheme
		]);

		this.addCommand(searchCmd);
		this.addCommand(searchAndReplaceCmd);

		console.log("Load Extended Editor Search plugin");
	}

	public onunload(): void {
		console.log("Unload Extended Editor Search plugin");
	}

	public async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	public async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Set the same search query to all available markdown views.
	 * 
	 * @param query if not set and `rememberLastQuery` is enabled, it will be
	 * supplied with the last query.
	 * 
	 * @param exclude `EditorView` instance that's being excluded.
	 */
	public shareQuery(query?: SearchQuery | SearchQueryConfig, exclude?: EditorView): void {
		let { rememberLastQuery, lastQuery } = this.settings,
			sharedQuery = query instanceof SearchQuery
				? query
				: new SearchQuery(query ?? rememberLastQuery
					? lastQuery
					: getEmptyQuery()
				);

		this.activeSharedQuery = sharedQuery;

		_iterMarkdownView(this.app, mdView => {
			let cmView = mdView.editor.cm;
			if (cmView == exclude) return;
			cmView.dispatch({
				effects: setSearchQuery.of(sharedQuery)
			});
		});
	}

	public saveQuery(query: SearchQuery | SearchQueryConfig): void {
		let queryConfig = query instanceof SearchQuery
			? getQueryConfig(query)
			: structuredClone(query);
		
		this.settings.lastQuery = queryConfig;
		this.saveSettings();
	}
}