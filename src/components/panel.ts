import {
	closeSearchPanel,
	findNext,
	findPrevious,
	getSearchQuery,
	replaceAll,
	replaceNext,
	SearchQuery,
	selectMatches,
	selectSelectionMatches,
	setSearchQuery
} from "@codemirror/search";
import { EditorView, Panel, runScopeHandlers, ViewUpdate } from "@codemirror/view";
import {
	debounce,
	editorInfoField,
	ExtraButtonComponent,
	MarkdownFileInfo,
	Menu,
	SearchComponent,
	TextComponent
} from "obsidian";
import { updateQuery, hideNativeSearch, selectionsToRanges } from "src/utils/editor-utils";
import { RangeBuffer } from "src/utils/range-buffer";
import { createSearch } from "src/components/search-input";
import { bindSearchScope } from "src/scope";
import { searchPanelChange, showReplace } from "src/cm-extensions/search";
import { replaceInSelection, searchAndReplaceCmd, searchCmd } from "src/commands";
import ExtendedFindReplacePlugin from "src/main";
import { primarySelectionAdjust, primarySelectionFallback } from "src/cm-extensions/draw-selection";

interface SearchCounter {
	current: number;
	total: number;
	exceed: boolean;
}

/**
 * Has the same functionality as the built-in one, with some addition
 * features.
 */
export class SearchPanel implements Panel {
	/**
	 * Allowed amount that the counter can count the results recursively.
	 * Needed for performance reason.
	 */
	public readonly maxCount = 9999 as const;

	public get top(): boolean { return true }
	/**
	 * Whether search field is focused.
	 */
	public get searchFocused(): boolean {
		return this.searchField.inputEl == document.activeElement;
	}
	/**
	 * Whether replace field is focused.
	 */
	public get replaceFocused(): boolean {
		return this.replaceField.inputEl == document.activeElement;
	}

	/**
	 * Current `EditorView` this panel attached to.
	 */
	public view: EditorView;
	/**
	 * Current active `SearchQuery` in the editor.
	 */
	public query: SearchQuery;
	/**
	 * Current `MarkdownFileInfo` this panel attached to.
	 */
	public mdInfo: MarkdownFileInfo;
	public plugin: ExtendedFindReplacePlugin;

	public dom: HTMLElement;
	public searchContainerEl: HTMLElement;
	public replaceContainerEl: HTMLElement;
	/**
	 * The element that's responsible for showing the amount of match
	 * results.
	 */
	public counterEl: HTMLElement | null = null;

	public searchField: SearchComponent;
	public replaceField: TextComponent;

	/**
	 * Store temporarily match results' positions in `Uint32Array`. Used
	 * as counter reference.
	 */
	public matchBuffer: RangeBuffer = new RangeBuffer(this.maxCount + 1);
	/**
	 * Indicate current counter state. If `exceed` is `true`, it indicates
	 * that the amount of match results actually exceeds the `maxCount`.
	 */
	public counter: SearchCounter = {
		current: 0,
		total: 0,
		exceed: false
	};

	/**
	 * Whether replace field should be displayed.
	 */
	public showReplace: boolean;

	constructor(view: EditorView, plugin: ExtendedFindReplacePlugin) {
		this.view = view;
		this.query = getSearchQuery(view.state);
		this.mdInfo = view.state.field(editorInfoField);
		this.showReplace = view.state.facet(showReplace);
		this.plugin = plugin;
		
		// Hide native search whenever this panel is going to be displayed.
		hideNativeSearch(this.mdInfo);
		this._drawDOM();
		this._requestCounter();
	}

	/**
	 * Commit search query to the `EditorState`.
	 * 
	 * @param query You can use `SearchQuery` instance or any object that
	 * represents search query config.
	 */
	public commit(query: Partial<Writable<SearchQuery>>): void {
		let appliedQuery = updateQuery(this.query, query);

		if (!appliedQuery.eq(this.query) || appliedQuery.literal != this.query.literal) {
			this._setQuery(appliedQuery, true);
			this.view.dispatch({ effects: setSearchQuery.of(appliedQuery) });
			this.matchBuffer.flush();
			this._requestCounter();
		}
	}

	/**
	 * Keydown handler.
	 */
	public keydown(keyboardEvt: KeyboardEvent): void {
		if (runScopeHandlers(this.view, keyboardEvt, "search-panel"))
			keyboardEvt.preventDefault();
	}

	/**
	 * Listen to editor updates. Responsible for updating search query and
	 * controlling whether the panel should be displayed.
	 */
	public update(update: ViewUpdate): void {
		let resetCounter = false;

		// Search any effect that brings query update.
		for (let tr of update.transactions)
			for (let effect of tr.effects) {
				if (effect.is(setSearchQuery) && !this._compare(effect.value)) {
					this._setQuery(effect.value, false);
					resetCounter = true;
				}
			}

		if (update.docChanged)
			resetCounter = true;

		// Recounting match results.
		if (resetCounter) {
			this.matchBuffer.flush();
			this._requestCounter();
		}

		// Listen for the user action/command that toggles this panel.
		if (update.transactions.some(tr => {
			let config = tr.annotation(searchPanelChange);
			if (config) {
				this.searchField.inputEl.select();
				if (config.showReplace == this.showReplace) return false;
				this.showReplace = config.showReplace;
				return true;
			}
			return false
		})) {
			this._toggleReplaceEl();
		}
	}

	public mount(): void {
		this.searchField.inputEl.select();
		this._toggleReplaceEl();
		this._toggleCounterEl();
		this._attachHandlers();
		this._onMount();
	}

	public destroy(): void {
		if ("scope" in this.mdInfo)
			this.mdInfo.scope = null;
		this._onDestroy();
	}

	/**
	 * Find next match.
	 */
	public findNext(): boolean {
		let succeed = findNext(this.view);
		this._count();
		this._highlight();
		return succeed;
	}

	/**
	 * Find previous match.
	 */
	public findPrev(): boolean {
		let succeed = findPrevious(this.view);
		this._count();
		this._highlight();
		return succeed;
	}

	/**
	 * Find all matches.
	 */
	public findAll(): boolean {
		let succeed = selectMatches(this.view);
		this._highlight();
		return succeed;
	}

	/**
	 * Find all mathces that are match selected text.
	 */
	public findSelected(): boolean {
		return selectSelectionMatches(this.view);
	}

	/**
	 * Replace next match.
	 */
	public replaceNext(): boolean {
		return replaceNext(this.view);
	}

	/**
	 * Replace all matches.
	 */
	public replaceAll(): boolean {
		return replaceAll(this.view);
	}

	/**
	 * Replace all matches that are in selection range.
	 */
	public replaceInSelection(): boolean {
		return replaceInSelection(this.view);
	}

	/**
	 * Close this panel and destroy everythings inside.
	 */
	public close(): boolean {
		return closeSearchPanel(this.view);
	}

	/**
	 * Distinguish current match with different highlight.
	 */
	private _highlight(): void {
		if (!this.mdInfo.editor || !this.counter.total) return;

		let { editor } = this.mdInfo,
			ranges = selectionsToRanges(editor.listSelections());

		// Without this, any embed element such as callout cannot be highlighted,
		// due to, in fact, they are widget decorations.
		editor.addHighlights(ranges, "obsidian-search-match-highlight", true);
	}

	/**
	 * Remove distinguishable highlight from the current match.
	 */
	private _removeHighlight(): void {
		this.mdInfo.editor?.removeHighlights("obsidian-search-match-highlight");
	}

	/**
	 * Compare equality of this query with the another one.
	 */
	private _compare(other: SearchQuery): boolean {
		return (
			this.query.eq(other) &&
			this.query.literal == other.literal
		);
	}

	/**
	 * Replace this query with the another one.
	 * 
	 * @param internal Assign it to `true` if the `query` is produced by
	 * `commit()`, not the editor update.
	 */
	private _setQuery(query: SearchQuery, internal: boolean): void {
		this.query = query;
		this._removeHighlight();
		if (internal) {
			// Internally produced query should be shared and stored.
			let { sharedQuery, rememberLastQuery } = this.plugin.settings;
			if (sharedQuery) this.plugin.shareQuery(query, this.view);
			if (rememberLastQuery) this.plugin.saveQuery(query);
		} else {
			this.searchField.setValue(query.search);
			this.replaceField.setValue(query.replace);
		}
	}

	/**
	 * Count and look for the next current match. Supposedly, current match
	 * has the nearest position to the selection or the cursor.
	 */
	private _count(): void {
		let lastSelection = this.view.state.selection.ranges.at(-1)!,
			index = this.counter.current, // 1-based
			prevIndex = index,
			max = this.counter.total;
		
		if (!max) return;

		// Efficiently trace next current match from previous current match
		// position.
		let curMatch = this.matchBuffer.get(index - 1);
		while (!curMatch || curMatch.to <= lastSelection.from && index < max) {
			this.counter.current = ++index;
			curMatch = this.matchBuffer.get(index - 1);
		}

		if (prevIndex === this.counter.current) {
			while (curMatch && curMatch.from >= lastSelection.to) {
				this.counter.current = --index;
				curMatch = this.matchBuffer.get(index - 1);
			}
		}

		this._drawCounter();
	}

	/**
	 * Reset the counter to its initial (i.e. empty) state and start
	 * counting the amount of the current match results.
	 * 
	 * @remarks Use `_requestCounter()` instead.
	 */
	private _setCounter(): void {
		this.counter = { total: 0, current: 0, exceed: false };
		if (!this.query.search || !this.query.valid) {
			this._drawCounter();
			return;
		}

		let cursor = this.query.getCursor(this.view.state);

		// Stopped when the cursor reached the end, or the total reached its
		// allowed amount.
		while (!cursor.next().done && this.counter.total < this.maxCount) {
			this.counter.total++;
			this.matchBuffer.set(this.counter.total - 1, cursor.value);
		}

		if (!cursor.done)
			this.counter.exceed = true;
		this._drawCounter();
	}

	/**
	 * Draw the counter to the DOM.
	 */
	private _drawCounter(): void {
		if (!this.counterEl) return;
		this.counterEl.innerText =
			`${this.counter.current} / ${this.counter.total}${this.counter.exceed ? "+" : ""}`;
	}

	/**
	 * Use this to (re)set the counter, preventing multiple rapid executions.
	 */
	private _requestCounter = debounce(this._setCounter, 50, true);

	/**
	 * Draw search panel to the DOM.
	 */
	private _drawDOM(): void {
		this.dom = createDiv(
			{ cls: "cm-search-panel document-search-container" },
			div => div.addEventListener("keydown", evt => this.keydown(evt))
		);

		this.searchContainerEl = this.dom.createDiv({ cls: "document-search" });
		this.searchField = createSearch({
			parentEl: this.searchContainerEl,
			containerClass: ["document-search-input"],
			placeholder: "Find...",
			initValue: this.query.search,
			onChange: search => {
				this.commit({ search });
				this._toggleCounterEl();
			},
			decoratorBtns: [
				{ cls: ["document-search-count"] },
				{
					iconName: "settings",
					cls: ["search-toggle", "search-toggle-show-rules"],
					tooltip: "Open rules",
					callback: evt => this._openRuleMenu(evt)
				}
			]
		});

		this.counterEl = this.searchField.containerEl.querySelector(".document-search-count");
		this.counterEl?.removeClass("clickable-icon");

		this.replaceContainerEl = this.dom.createDiv({ cls: "document-replace" });
		this.replaceField = new TextComponent(this.replaceContainerEl)
			.setPlaceholder("Replace...")
			.setValue(this.query.replace)
			.onChange(replace => this.commit({ replace }))
			.then(replaceField => {
				replaceField.inputEl.addClass("document-replace-input");
			});

		let searchBtnsContainer =
			this.searchContainerEl.createDiv({ cls: "document-search-buttons" });

		// Find previous button
		new ExtraButtonComponent(searchBtnsContainer)
			.setIcon("arrow-up")
			.setTooltip("Previous\nShift + F3", { placement: "top" })
			.then(btn => {
				btn.extraSettingsEl.addEventListener("click", evt => {
					if (!btn.disabled) {
						this.findPrev();
						evt.preventDefault();
					}
				});
			});
		
		// Find next button
		new ExtraButtonComponent(searchBtnsContainer)
			.setIcon("arrow-down")
			.setTooltip("Next\nF3", { placement: "top" })
			.then(btn => {
				btn.extraSettingsEl.addEventListener("click", evt => {
					if (!btn.disabled) {
						this.findNext();
						evt.preventDefault();
					}
				});
			});
		
		// Find all button
		new ExtraButtonComponent(searchBtnsContainer)
			.setIcon("text-select")
			.setTooltip("Find all\nAlt + Enter", { placement: "top" })
			.then(btn => {
				btn.extraSettingsEl.addEventListener("click", evt => {
					if (!btn.disabled) {
						this.findAll();
						evt.preventDefault();
					}
				});
			});

		// Toggle replace button
		new ExtraButtonComponent(this.searchContainerEl)
			.setIcon("chevron-down")
			.setTooltip(this.showReplace ? "Hide replace" : "Show replace", { placement: "top" })
			.onClick(() => {
				if (!this.mdInfo.editor) return;
				if (this.showReplace) {
					searchCmd.editorCallback?.(this.mdInfo.editor, this.mdInfo);
				} else {
					searchAndReplaceCmd.editorCallback?.(this.mdInfo.editor, this.mdInfo);
				}
			})
			.extraSettingsEl.addClass("replace-toggle-btn");

		// Close search button
		new ExtraButtonComponent(this.searchContainerEl)
			.setIcon("x")
			.setTooltip("Exit search", { placement: "top" })
			.onClick(() => this.close());

		let replaceBtnsContainer =
			this.replaceContainerEl.createDiv({ cls: "document-replace-buttons" });

		// Replace button
		new ExtraButtonComponent(replaceBtnsContainer)
			.setIcon("replace")
			.setTooltip("Replace\nEnter", { placement: "top" })
			.onClick(() => this.replaceNext());

		// Replace all button
		new ExtraButtonComponent(replaceBtnsContainer)
			.setIcon("replace-all")
			.setTooltip("Replace all\nCtrl + Alt + Enter", { placement: "top" })
			.onClick(() => this.replaceAll());
		
		// Replace in selection button
		new ExtraButtonComponent(replaceBtnsContainer)
			.setIcon("text-cursor-input")
			.setTooltip("Replace in selection", { placement: "top" })
			.onClick(() => this.replaceInSelection());
	}

	/**
	 * Open rule options provided by this panel.
	 * 
	 * @param evt `MouseEvent` the menu will be located at.
	 */
	private _openRuleMenu(evt: MouseEvent): void {
		new Menu()
			.addItem(item => {
				item
					.setIcon("case-sensitive")
					.setTitle("Match case")
					.setChecked(this.query.caseSensitive)
					.onClick(() => this.commit({
						caseSensitive: !this.query.caseSensitive
					}));
			})
			.addItem(item => {
				item
					.setIcon("whole-word")
					.setTitle("Match whole word")
					.setChecked(this.query.wholeWord)
					.onClick(() => this.commit({
						wholeWord: !this.query.wholeWord
					}));
			})
			.addItem(item => {
				item
					.setIcon("regex")
					.setTitle("Match regexp")
					.setChecked(this.query.regexp)
					.onClick(() => this.commit({
						regexp: !this.query.regexp
					}));
			})
			.addItem(item => {
				item
					.setIcon("type")
					.setTitle("Literal")
					.setChecked(this.query.literal)
					.onClick(() => this.commit({
						literal: !this.query.literal
					}));
			})
			.showAtMouseEvent(evt);
	}

	/**
	 * Whether display the counter. Will hide it when search query is empty.
	 */
	private _toggleCounterEl(): void {
		if (this.query.search) {
			if (!this.searchContainerEl.hasClass("show-counter"))
				this.searchContainerEl.addClass("show-counter");
		} else {
			this.searchContainerEl.removeClass("show-counter");
		}
	}

	/**
	 * Whether display this panel's replace field.
	 */
	private _toggleReplaceEl(): void {
		if (this.showReplace) {
			this.dom.addClass("mod-replace-mode");
			this.searchContainerEl
				.querySelector<HTMLElement>(".replace-toggle-btn")
				?.setAttr("aria-label", "Hide replace");
		} else {
			this.dom.removeClass("mod-replace-mode");
			this.searchContainerEl
				.querySelector<HTMLElement>(".replace-toggle-btn")
				?.setAttr("aria-label", "Show replace");
		}
	}

	/**
	 * Attach search keymaps to the `mdInfo`.
	 */
	private _attachHandlers(): void {
		bindSearchScope(this);
	}

	/**
	 * Onmount handler.
	 */
	private _onMount(): void {
		setTimeout(() => {
			// Use DOM element for the primary selection. Keep the primary selection
			// rendered while the search/replace input is focused.
			this.view.dispatch({
				effects: primarySelectionAdjust.reconfigure(primarySelectionFallback)
			});
			this.mdInfo.editor?.editorComponent?.editorEl.addClass("has-search-panel");
		});
	}

	/**
	 * Ondestroy handler.
	 */
	private _onDestroy(): void {
		setTimeout(() => {
			// Restore primary selection fallback with the native one.
			this.view.dispatch({
				effects: primarySelectionAdjust.reconfigure([])
			});
			this.mdInfo.editor?.editorComponent?.editorEl.removeClass("has-search-panel");
		});
	}
}