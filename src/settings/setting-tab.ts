import { PluginSettingTab, Setting } from "obsidian";
import ExtendedFindReplacePlugin from "src/main";

export class ExtendedFindReplaceSettingTab extends PluginSettingTab {
	public plugin: ExtendedFindReplacePlugin;
	private _onHideListeners?: () => unknown;

	constructor(plugin: ExtendedFindReplacePlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	public display(): void {
		let { containerEl } = this;

		new Setting(containerEl)
			.setName("Shared query")
			.setDesc("Same search query will be shared among all available editors.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.sharedQuery)
				.onChange(val => {
					this.plugin.settings.sharedQuery = val;
					if (val) this._onHideListeners = () => {
						this.plugin.shareQuery();
					};
				})
			);

		new Setting(containerEl)
			.setName("Remember last query")
			.setDesc("Save last input query.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.rememberLastQuery)
				.onChange(val => this.plugin.settings.rememberLastQuery = val)
			);
	}

	public hide(): void {
		super.hide();
		this._onHide();
	}

	private _onHide(): void {
		this._onHideListeners?.();
		this._onHideListeners = undefined;
		this.containerEl.empty();
		this.plugin.saveSettings();
	}
}