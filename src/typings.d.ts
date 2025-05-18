import { RegExpCursor, SearchCursor, SearchQueryConfig } from "@codemirror/search";
import { EditorState } from "@codemirror/state";

declare module "@codemirror/search" {
	/**
	 * Actually is an interface of `SearchCursor` value.
	 * 
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
	 * Used internally by search commands to process the matches.
	 * 
	 * MIT licensed, copyright (c) by Marijn Haverbeke and others at
	 * CodeMirror.
	 * 
	 * @see https://github.com/codemirror/search/blob/main/src/search.ts
	 */
	interface QueryType {
		/**
		 * Get replacement string for specific match.
		 * 
		 * @param result Specific match to get the correct replacement.
		 */
		getReplacement(result: SearchResult): string;
	}

	/**
	 * MIT licensed, copyright (c) by Marijn Haverbeke and others at
	 * CodeMirror.
	 * 
	 * @see https://github.com/codemirror/search/blob/main/src/search.ts
	 */
	interface SearchQuery {
		/**
		 * When `literal` is set to `false`, it represents parsed search input,
		 * which any escaped sequence within will be encoded to different
		 * character.
		 */
		readonly unquoted: string;
		/** Create a `QueryType` instance from this query. */
		create(): QueryType;
		getCursor(state: EditorState | Text, from?: number, to?: number): SearchCursor | RegExpCursor;
	}

	type SearchQueryConfig = ConstructorParameters<typeof SearchQuery>[0];
}

declare global {
	type Writable<T> = {
		-readonly [P in keyof T]: T[P];
	}
}

export interface ExtendedFindReplaceSettings {
	lastQuery: SearchQueryConfig;
	rememberLastQuery: boolean;
	sharedQuery: boolean;
}