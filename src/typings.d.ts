import { RegExpCursor, SearchCursor, SearchQueryConfig } from "@codemirror/search";
import { EditorState } from "@codemirror/state";

declare module "@codemirror/search" {
	/**
	 * MIT licensed, copyright (c) by Marijn Haverbeke and others at
	 * CodeMirror.
	 * 
	 * @see https://github.com/codemirror/view/blob/main/src/extension.ts
	 */
	interface SearchResult {
		from: number;
		to: number;
	}

	/**
	 * MIT licensed, copyright (c) by Marijn Haverbeke and others at
	 * CodeMirror.
	 * 
	 * @see https://github.com/codemirror/view/blob/main/src/extension.ts
	 */
	interface QueryType {
		getReplacement(result: SearchResult): string;
	}

	/**
	 * MIT licensed, copyright (c) by Marijn Haverbeke and others at
	 * CodeMirror.
	 * 
	 * @see https://github.com/codemirror/view/blob/main/src/extension.ts
	 */
	interface SearchQuery {
		readonly unquoted: string;
		getCursor(state: EditorState | Text, from?: number, to?: number): SearchCursor | RegExpCursor;
		create(): QueryType;
	}

	type SearchQueryConfig = ConstructorParameters<typeof SearchQuery>[0];
}

declare global {
	type Writable<T> = {
		-readonly [P in keyof T]: T[P];
	}
}

export interface ExtendedFindReplaceSettings {
	rememberLastQuery: boolean;
	sharedQuery: boolean;
	lastQuery: SearchQueryConfig;
}