import { getSearchQuery, openSearchPanel } from "@codemirror/search";
import { ChangeSpec } from "@codemirror/state";
import { panels, Command as CMCommand, EditorView } from "@codemirror/view";
import { Command as ObsidianCommand, Editor } from "obsidian";
import { panelsConfig, searchPanelChange, searchPanelConfig, showReplace } from "src/cm-extensions";

export const searchCmd: ObsidianCommand = {
	id: "open-editor-search",
	name: "Open editor search for current note",
	editorCallback(editor: Editor): void {
		let cmView = editor.cm,
			editorEl = editor.editorComponent?.editorEl;
		cmView.dispatch({
			effects: [
				searchPanelConfig.reconfigure([
					showReplace.of(false)
				]),
				panelsConfig.reconfigure(
					panels({ topContainer: editorEl })
				)
			],
			annotations: searchPanelChange.of({ showReplace: false })
		});
		openSearchPanel(cmView);
	}
}

export const searchAndReplaceCmd: ObsidianCommand = {
	id: "open-editor-search-and-replace",
	name: "Open editor search & replace for current note",
	editorCallback(editor: Editor): void {
		let cmView = editor.cm,
			editorEl = editor.editorComponent?.editorEl;
		cmView.dispatch({
			effects: [
				searchPanelConfig.reconfigure([
					showReplace.of(true)
				]),
				panelsConfig.reconfigure(
					panels({ topContainer: editorEl })
				)
			],
			annotations: searchPanelChange.of({ showReplace: true })
		});
		openSearchPanel(cmView);
	}
}

export const replaceInSelection: CMCommand = function (target: EditorView) {
	let { state } = target,
		{ ranges } = state.selection,
		query = getSearchQuery(state);

	if (!query.valid || !query.replace) return false;

	let cursor = query.getCursor(state, ranges[0].from, ranges.at(-1)!.to).next();
	if (cursor.done) return false;

	let changes: ChangeSpec[] = [],
		queryType = query.create(),
		rangeI = 0;

	while (!cursor.done && rangeI < ranges.length) {
		let { from, to } = cursor.value;
		if (from < ranges[rangeI].from) { cursor.next(); continue }
		if (to > ranges[rangeI].to) { rangeI++; continue }
		let replacement = queryType.getReplacement(cursor.value);
		changes.push({ from, to, insert: replacement });
		cursor.next();
	}

	target.dispatch({ changes });
	return true;
}