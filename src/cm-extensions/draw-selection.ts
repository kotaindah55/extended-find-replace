import { Compartment } from "@codemirror/state";
import { layer, RectangleMarker } from "@codemirror/view";

/**
 * Based on CodeMirror's `selectionLayer` layer with some modifications.
 * 
 * MIT licensed, copyright (c) by Marijn Haverbeke and others at
 * CodeMirror.
 * 
 * @see https://github.com/codemirror/view/blob/main/src/draw-selection.ts
 */
const primarySelectionLayer = layer({
	above: false,
	markers(view) {
		let mainRange = view.state.selection.main;
		return mainRange.empty
			? []
			: RectangleMarker.forRange(view, "cm-selectionBackground", mainRange);
	},
	update(update) {
		return update.docChanged || update.selectionSet || update.viewportChanged
	},
	class: "cm-selectionLayer"
});

export const primarySelectionFallback = [primarySelectionLayer];

export const primarySelectionAdjust = new Compartment();