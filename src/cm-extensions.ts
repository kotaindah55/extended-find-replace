import { getSearchQuery, SearchQuery, setSearchQuery } from "@codemirror/search";
import { Annotation, Compartment, Facet } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import ExtendedFindReplacePlugin from "src/main";

export const showReplace = Facet.define<boolean, boolean>({
	combine(value) {
		return value[0];
	},
});

export const searchPanelConfig = new Compartment();

export const searchPanelChange = Annotation.define<{ showReplace: boolean }>();

export const panelsConfig = new Compartment();

export const restoreLastQuery = function (plugin: ExtendedFindReplacePlugin) {
	return ViewPlugin.define(view => {
		let { rememberLastQuery, lastQuery, sharedQuery } = plugin.settings;

		if (sharedQuery && plugin.activeSharedQuery) {
			let { activeSharedQuery } = plugin;
			setTimeout(() => view.dispatch({
				effects: setSearchQuery.of(activeSharedQuery)
			}));
		}
		
		else if (rememberLastQuery) {
			let query = new SearchQuery(lastQuery);
			setTimeout(() => view.dispatch({
				effects: setSearchQuery.of(query)
			}));

			plugin.activeSharedQuery = query;
		}

		else plugin.activeSharedQuery = getSearchQuery(view.state);

		return {}
	})
};