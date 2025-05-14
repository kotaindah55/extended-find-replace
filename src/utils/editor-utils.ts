import { SearchQuery, SearchQueryConfig } from "@codemirror/search";
import { EditorRange, EditorSelection, MarkdownFileInfo } from "obsidian";

function _headAtFront(selection: EditorSelection): boolean {
	let { head, anchor } = selection;
	return (
		head.line == anchor.line && head.ch >= anchor.ch ||
		head.line > anchor.line
	);
}

export function hideNativeSearch(mdInfo: MarkdownFileInfo): void {
	let editor = mdInfo.editor;
	editor?.editorComponent?.search.hide();
}

export function updateQuery(query: SearchQuery, config: Partial<SearchQuery>): SearchQuery {
	return new SearchQuery({
		search: config.search ?? query.search,
		replace: config.replace ?? query.replace,
		caseSensitive: config.caseSensitive ?? query.caseSensitive,
		regexp: config.regexp ?? query.regexp,
		wholeWord: config.wholeWord ?? query.wholeWord,
		literal: config.literal ?? query.literal
	});
}

export function getQueryConfig(query: SearchQuery): SearchQueryConfig {
	return {
		search: query.search,
		replace: query.replace,
		caseSensitive: query.caseSensitive,
		regexp: query.regexp,
		wholeWord: query.wholeWord,
		literal: query.literal
	};
}

/** Get an empty search query. */
export function getEmptyQuery(): SearchQuery {
	return new SearchQuery({ search: "" });
}

export function selectionsToRanges(selections: EditorSelection[]): EditorRange[] {
	return selections.map<EditorRange>(sel => {
		let headAtFront = _headAtFront(sel);
		return {
			from: headAtFront ? sel.anchor : sel.head,
			to: headAtFront ? sel.head : sel.anchor
		};
	});
}