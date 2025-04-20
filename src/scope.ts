import { App, KeymapEventListener, Modifier, Scope } from "obsidian";
import { SearchPanel } from "src/components/panel";

interface KeymapRecord {
	modifiers: Modifier[] | null;
	key: string | null;
	func: KeymapEventListener
}

function _getSearchKeymaps(panel: SearchPanel): KeymapRecord[] {
	return [
		{ modifiers: [], key: "Escape", func: () => !panel.close() },
		{ modifiers: [], key: "F3", func: () => !panel.findNext() },
		{ modifiers: ["Shift"], key: "F3", func: () => !panel.findPrev() },
		{ modifiers: ["Alt"], key: "Enter", func: () => !(panel.searchFocused && panel.findAll()) },
		{ modifiers: ["Mod", "Alt"], key: "Enter", func: () => !(panel.replaceFocused && panel.replaceAll()) },
		{ modifiers: [], key: "Enter", func: () => {
			if (panel.searchFocused) return !panel.findNext();
			if (panel.replaceFocused) return !panel.replaceNext();
		}},
		{ modifiers: ["Shift"], key: "Enter", func: () => !(panel.searchFocused && panel.findPrev()) },
		{ modifiers: [], key: "Tab", func: () => {
			if (panel.replaceFocused) {
				panel.searchField.inputEl.focus();
				return false;
			}
		}}
	];
}

export function bindSearchScope(app: App, panel: SearchPanel): void {
	let searchScope = new Scope(app.scope);

	for (let keymapRec of _getSearchKeymaps(panel)) {
		searchScope.register(
			keymapRec.modifiers,
			keymapRec.key,
			keymapRec.func
		);
	}

	Object.assign(panel.mdInfo, { scope: searchScope });
}