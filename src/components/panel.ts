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
import { createSearch } from "src/components/search";
import { bindSearchScope } from "src/scope";
import { searchPanelChange, showReplace } from "src/cm-extensions/search";
import { replaceInSelection, searchAndReplaceCmd, searchCmd } from "src/commands";
import ExtendedFindReplacePlugin from "src/main";

interface SearchCounter {
	current: number;
	total: number;
	exceed: boolean;
}

export class SearchPanel implements Panel {
	public readonly maxCount = 9999 as const;

	public get top(): boolean { return true }
	public get searchFocused(): boolean {
		return this.searchField.inputEl == document.activeElement;
	}
	public get replaceFocused(): boolean {
		return this.replaceField.inputEl == document.activeElement;
	}

	public view: EditorView;
	public query: SearchQuery;
	public mdInfo: MarkdownFileInfo;
	public plugin: ExtendedFindReplacePlugin;

	public dom: HTMLElement;
	public searchContainerEl: HTMLElement;
	public replaceContainerEl: HTMLElement;
	public counterEl: HTMLElement | null = null;

	public searchField: SearchComponent;
	public replaceField: TextComponent;

	public matchBuffer: RangeBuffer = new RangeBuffer(this.maxCount + 1);
	public counter: SearchCounter = {
		current: 0,
		total: 0,
		exceed: false
	};

	public showReplace: boolean;

	constructor(view: EditorView, plugin: ExtendedFindReplacePlugin) {
		this.view = view;
		this.query = getSearchQuery(view.state);
		this.mdInfo = view.state.field(editorInfoField);
		this.showReplace = view.state.facet(showReplace);
		this.plugin = plugin;
		
		hideNativeSearch(this.mdInfo);
		this._drawDOM();
		this._requestCounter();
	}

	public commit(query: Partial<Writable<SearchQuery>>): void {
		let appliedQuery = updateQuery(this.query, query);

		if (!appliedQuery.eq(this.query) || appliedQuery.literal != this.query.literal) {
			this._setQuery(appliedQuery, true);
			this.view.dispatch({ effects: setSearchQuery.of(appliedQuery) });
			this.matchBuffer.flush();
			this._requestCounter();
		}
	}

	public keydown(keyboardEvt: KeyboardEvent): void {
		if (runScopeHandlers(this.view, keyboardEvt, "search-panel"))
			keyboardEvt.preventDefault();
	}

	public update(update: ViewUpdate): void {
		let resetCounter = false;
		for (let tr of update.transactions)
			for (let effect of tr.effects) {
				if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
					this._setQuery(effect.value, false);
					resetCounter = true;
				}
			}

		if (update.docChanged)
			resetCounter = true;

		if (resetCounter) {
			this.matchBuffer.flush();
			this._requestCounter();
		}

		if (update.transactions.some(tr => {
			let config = tr.annotation(searchPanelChange);
			if (config && config.showReplace != this.showReplace) {
				this.showReplace = config.showReplace;
				return true;
			}
		})) {
			this._toggleReplaceEl();
		}
	}

	public mount(): void {
		this.searchField.inputEl.select();
		this._toggleReplaceEl();
		this._toggleCounterEl();
		this._attachHandlers();
	}

	public destroy(): void {
		if ("scope" in this.mdInfo)
			this.mdInfo.scope = null;
	}

	public findNext(): boolean {
		let succeed = findNext(this.view);
		this._count();
		this._highlight();
		return succeed;
	}

	public findPrev(): boolean {
		let succeed = findPrevious(this.view);
		this._count();
		this._highlight();
		return succeed;
	}

	public findAll(): boolean {
		let succeed = selectMatches(this.view);
		this._highlight();
		return succeed;
	}

	public findSelected(): boolean {
		return selectSelectionMatches(this.view);
	}

	public replaceNext(): boolean {
		return replaceNext(this.view);
	}

	public replaceAll(): boolean {
		return replaceAll(this.view);
	}

	public replaceInSelection(): boolean {
		return replaceInSelection(this.view);
	}

	public close(): boolean {
		return closeSearchPanel(this.view);
	}

	private _highlight() {
		if (!this.mdInfo.editor || !this.counter.total) return;

		let { editor } = this.mdInfo,
			ranges = selectionsToRanges(editor.listSelections());

		editor.addHighlights(ranges, "obsidian-search-match-highlight", true);
	}

	private _removeHighlight() {
		this.mdInfo.editor?.removeHighlights("obsidian-search-match-highlight");
	}

	private _setQuery(query: SearchQuery, internal: boolean): void {
		this.query = query;
		this._removeHighlight();
		if (internal) {
			let { sharedQuery, rememberLastQuery } = this.plugin.settings;
			if (sharedQuery) this.plugin.shareQuery(query, this.view);
			if (rememberLastQuery) this.plugin.saveQuery(query);
		} else {
			this.searchField.setValue(query.search);
			this.replaceField.setValue(query.replace);
		}
	}

	private _count(): void {
		let lastSelection = this.view.state.selection.ranges.at(-1)!,
			index = this.counter.current, // 1-based
			prevIndex = index,
			max = this.counter.total;
		
		if (!max) return;

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

	private _setCounter() {
		this.counter = { total: 0, current: 0, exceed: false };
		if (!this.query.search || !this.query.valid) {
			this._drawCounter();
			return;
		}

		let cursor = this.query.getCursor(this.view.state);

		while (!cursor.next().done && this.counter.total < this.maxCount) {
			this.counter.total++;
			this.matchBuffer.set(this.counter.total - 1, cursor.value);
		}

		if (!cursor.done)
			this.counter.exceed = true;
		this._drawCounter();
	}

	private _drawCounter() {
		if (!this.counterEl) return;
		this.counterEl.innerText =
			`${this.counter.current} / ${this.counter.total}${this.counter.exceed ? "+" : ""}`;
	}

	private _requestCounter = debounce(this._setCounter, 50, true);

	private _drawDOM(): void {
		this.searchContainerEl = document.createElement("div");
		this.searchContainerEl.addClass("document-search");
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

		this.replaceContainerEl = document.createElement("div");
		this.replaceContainerEl.addClass("document-replace");
		this.replaceField = new TextComponent(this.replaceContainerEl)
			.setPlaceholder("Replace...")
			.setValue(this.query.replace)
			.onChange(replace => this.commit({ replace }))
			.then(replaceField => {
				replaceField.inputEl.addClass("document-replace-input");
			});

		this.dom = document.createElement("div");
		this.dom.addClass("cm-search-panel", "document-search-container");
		this.dom.append(this.searchContainerEl, this.replaceContainerEl);
		this.dom.addEventListener("keydown", evt => this.keydown(evt));

		let searchBtnsContainer =
			this.searchContainerEl.createDiv({ cls: ["document-search-buttons"] });

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
			this.replaceContainerEl.createDiv({ cls: ["document-replace-buttons"] });

		new ExtraButtonComponent(replaceBtnsContainer)
			.setIcon("replace")
			.setTooltip("Replace\nEnter", { placement: "top" })
			.onClick(() => this.replaceNext());
		new ExtraButtonComponent(replaceBtnsContainer)
			.setIcon("replace-all")
			.setTooltip("Replace all\nCtrl + Alt + Enter", { placement: "top" })
			.onClick(() => this.replaceAll());
		new ExtraButtonComponent(replaceBtnsContainer)
			.setIcon("text-cursor-input")
			.setTooltip("Replace in selection", { placement: "top" })
			.onClick(() => this.replaceInSelection());
	}

	private _openRuleMenu(evt: MouseEvent) {
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

	private _toggleCounterEl(): void {
		if (this.query.search) {
			if (!this.searchContainerEl.hasClass("show-counter"))
				this.searchContainerEl.addClass("show-counter");
		} else {
			this.searchContainerEl.removeClass("show-counter");
		}
	}

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

	private _attachHandlers(): void {
		bindSearchScope(this.mdInfo.app, this);
	}
}