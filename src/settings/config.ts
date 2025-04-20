import { ExtendedFindReplaceSettings } from "src/typings";

export const DEFAULT_SETTINGS: ExtendedFindReplaceSettings = {
	sharedQuery: false,
	rememberLastQuery: true,
	get lastQuery() { return { search: "" } }
}