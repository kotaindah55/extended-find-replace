import { KeymapEventListener, Modifier, Scope } from "obsidian";
import { SearchPanel } from "src/components/panel";

interface KeymapRecord {
	modifiers: Modifier[] | null;
	key: string | null;
	func: KeymapEventListener
}

/**
 * Retrieve keymap records to be registered for search scope.
 * 
 * @param panel Should be an active search panel in the current editor.
 * @returns Records of retrieved keymaps.
 */
function _getSearchKeymaps(panel: SearchPanel): KeymapRecord[] {
	return [
		// Keymap for closing search panel.
		{ modifiers: [], key: "Escape", func: () => !panel.close() },

		// Native find & replace keymaps.
		{ modifiers: [], key: "F3", func: () => !panel.findNext() },
		{ modifiers: ["Shift"], key: "F3", func: () => !panel.findPrev() },
		{ modifiers: [], key: "Enter", func: () => {
			if (panel.searchFocused) return !panel.findNext();
			if (panel.replaceFocused) return !panel.replaceNext();
		}},
		{ modifiers: ["Shift"], key: "Enter", func: () => !(panel.searchFocused && panel.findPrev()) },
		{ modifiers: ["Alt"], key: "Enter", func: () => !(panel.searchFocused && panel.findAll()) },
		{ modifiers: ["Mod", "Alt"], key: "Enter", func: () => !(panel.replaceFocused && panel.replaceAll()) },

		// Switch focus between search field and replace field.
		{ modifiers: [], key: "Tab", func: () => {
			if (panel.replaceFocused) {
				panel.searchField.inputEl.focus();
				return false;
			}
		}}
	];
}

/**
 * Bind search scope to the `MarkdownView` instance that has search panel
 * being opened.
 * 
 * @param panel Search panel where the `MarkdownView` instance contains.
 */
export function bindSearchScope(panel: SearchPanel): void {
	let searchScope = new Scope(panel.mdInfo.app.scope);

	for (let keymapRec of _getSearchKeymaps(panel)) {
		searchScope.register(
			keymapRec.modifiers,
			keymapRec.key,
			keymapRec.func
		);
	}

	Object.assign(panel.mdInfo, { scope: searchScope });
}