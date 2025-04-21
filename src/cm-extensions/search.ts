import { Editor, editorInfoField } from "obsidian";
import { getSearchQuery, SearchQuery, setSearchQuery } from "@codemirror/search";
import { Annotation, Compartment, Facet, StateEffect } from "@codemirror/state";
import { EditorView, panels, ViewPlugin } from "@codemirror/view";
import ExtendedFindReplacePlugin from "src/main";

/**
 * Ensure that update is only dispatched after the CM view have being
 * fully initialized. Therefore, we use setTimeout instead of calling it
 * directly which can emit an Error.
 */
function _onEditorInit(view: EditorView, editor?: Editor, query?: SearchQuery): void {
	let effects: StateEffect<unknown>[] = [
		panelsConfig.reconfigure(panels({
			topContainer: editor?.editorComponent?.editorEl
		}))
	];

	if (query) effects.push(setSearchQuery.of(query));
	setTimeout(() => view.dispatch({ effects }));
}

/**
 * Facet determines that the replace field should be expanded alongside
 * the search panel.
 */
export const showReplace = Facet.define<boolean, boolean>({
	combine(value) {
		return value[0];
	},
});

/** Wrapper that's used to reconfigure `showReplace`. */
export const searchPanelConfig = new Compartment();

/** Tell the CM view that searchPanelConfig was changed. */
export const searchPanelChange = Annotation.define<{ showReplace: boolean }>();

/**
 * Wrapper that's used to attach the panel to the `editorEl`, by wrapping
 * `panels` function. Intended to be dispatched once at CM view
 * initialization.
 */
export const panelsConfig = new Compartment();

/**
 * Used to pick available shared or the last saved query then dispatch it
 * to the CM view. Suppose to run once at CM view initialization.
 */
export const restoreLastQuery = function (plugin: ExtendedFindReplacePlugin) {
	return ViewPlugin.define(view => {
		let { rememberLastQuery, lastQuery, sharedQuery } = plugin.settings,
			editor = view.state.field(editorInfoField).editor,
			query: SearchQuery | undefined;

		// When this isn't the first CM view being initialized and sharedQuery
		// was enabled.
		if (sharedQuery && plugin.activeSharedQuery)
			query = plugin.activeSharedQuery;
		// When rememberLastQuery was enabled.
		else if (rememberLastQuery) {
			query = new SearchQuery(lastQuery);
			plugin.activeSharedQuery = query;
		}
		else plugin.activeSharedQuery = getSearchQuery(view.state);

		_onEditorInit(view, editor, query);
		return {}
	})
};