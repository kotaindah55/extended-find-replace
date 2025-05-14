import { ExtraButtonComponent, IconName, SearchComponent } from "obsidian";

interface CreateSearchSpec {
	parentEl: HTMLElement;
	containerClass?: string[];
	inputClass?: string[];
	placeholder?: string;

	initValue?: string;
	onChange?: (val: string) => unknown;

	decoratorBtns?: {
		iconName?: IconName,
		cls?: string[],
		tooltip?: string,
		isToggle?: boolean,
		initValue?: boolean,
		callback?: (evt: MouseEvent, val?: boolean) => unknown
	}[];
}

export function createSearch(spec: CreateSearchSpec): SearchComponent {
	let {
		parentEl,
		containerClass,
		inputClass,
		placeholder,
		initValue,
		onChange,
		decoratorBtns
	} = spec;
	let searchComp = new SearchComponent(parentEl);

	if (onChange)
		searchComp.onChange(onChange);

	searchComp
		.setPlaceholder(placeholder ?? "")
		.setValue(initValue ?? "")
		.then(searchComp => {
			searchComp.containerEl.addClasses(containerClass ?? []);
			searchComp.inputEl.addClasses(inputClass ?? []);
		});

	searchComp.addRightDecorator(decoratorContainer => {
		decoratorBtns?.forEach(({ iconName, cls, tooltip, isToggle, initValue, callback }) => {
			let btn = new ExtraButtonComponent(decoratorContainer)
				.setIcon(iconName ?? "")
				.setTooltip(tooltip ?? ""),
				btnEl = btn.extraSettingsEl;

			if (cls)
				btn.extraSettingsEl.addClasses(cls);

			if (isToggle !== undefined) {
				btnEl.setAttr("data-value", initValue ?? false);
				btnEl.addEventListener("click", evt => {
					let prevVal = btnEl.getAttr("data-value"),
						changedVal = !(prevVal == "true");
					btnEl.setAttr("data-value", changedVal);
					callback?.(evt, changedVal);
				});
			}

			else if (callback)
				btnEl.addEventListener("click", callback);
		});
	});

	return searchComp;
}