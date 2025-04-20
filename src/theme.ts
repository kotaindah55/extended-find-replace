import { EditorView } from "@codemirror/view";

export const defaultTheme = EditorView.theme({
	".cm-searchMatch": {
		backgroundColor: "transparent",
		boxShadow: "0 0 0px 2px var(--background-modifier-border-focus)",
		mixBlendMode: "var(--highlight-mix-blend-mode)",
		borderRadius: "2px",
		transition: "box-shadow 0.1s ease-in-out",
	},

	".cm-searchMatch.cm-searchMatch-selected": {
		backgroundColor: "hsla(var(--color-accent-hsl), 0.3)",
		boxShadow: "none",
	},

	"span.obsidian-search-match-highlight:has(.cm-searchMatch-selected)": {
		transition: "box-shadow 0.1s ease-in-out"
	}
})