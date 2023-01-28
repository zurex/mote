import { ColorScheme } from 'mote/platform/theme/common/theme';
import { IColorTheme, IProductIconTheme, IThemeService } from 'mote/platform/theme/common/themeService';
import { Event, Emitter } from 'mote/base/common/event';
import { Disposable } from 'mote/base/common/lifecycle';
import { IHostColorSchemeService } from 'mote/platform/theme/common/hostColorSchemeService';
import { createStyleSheet } from 'mote/base/browser/dom';
import { getIconsStyleSheet } from 'mote/platform/theme/browser/iconsStyleSheet';
import { RunOnceScheduler } from 'vs/base/common/async';
import { IconTheme } from 'mote/platform/theme/common/iconTheme';

export class BrowserThemeService extends Disposable implements IThemeService {

	declare _serviceBrand: undefined;

	private readonly _onDidColorThemeChange: Emitter<IColorTheme> = this._register(new Emitter<IColorTheme>());
	onDidColorThemeChange: Event<IColorTheme> = this._onDidColorThemeChange.event;

	private readonly _onDidProductIconThemeChange: Emitter<IProductIconTheme> = this._register(new Emitter<IProductIconTheme>());

	onDidProductIconThemeChange: Event<IProductIconTheme> = this._onDidProductIconThemeChange.event;

	private currentColorTheme!: IColorTheme;
	private currentProductIconTheme: IProductIconTheme = new IconTheme();

	private colorThemeRegistry: Map<ColorScheme, IColorTheme>;

	constructor(
		@IHostColorSchemeService private readonly hostColorSchemeService: IHostColorSchemeService,
	) {
		super();
		this.colorThemeRegistry = new Map();
		this.hostColorSchemeService.onDidChangeColorScheme(() => this.handlePreferredSchemeUpdated());

		const codiconStyleSheet = createStyleSheet();
		codiconStyleSheet.id = 'codiconStyles';

		const iconsStyleSheet = getIconsStyleSheet(this);
		function updateAll() {
			codiconStyleSheet.textContent = iconsStyleSheet.getCSS();
		}

		const delayer = new RunOnceScheduler(updateAll, 0);
		iconsStyleSheet.onDidChange(() => delayer.schedule());
		delayer.schedule();
	}
	getProductIconTheme(): IProductIconTheme {
		return this.currentProductIconTheme;
	}

	/*
	private installPreferredSchemeListener() {
		this.hostColorSchemeService.onDidChangeColorScheme(() => this.handlePreferredSchemeUpdated());
	}
	*/

	private handlePreferredSchemeUpdated() {
		const scheme = this.getPreferredColorScheme();
		return this.applyPreferredColorTheme(scheme);
	}

	private getPreferredColorScheme(): ColorScheme {
		if (this.hostColorSchemeService.highContrast) {
			return this.hostColorSchemeService.dark ? ColorScheme.HIGH_CONTRAST_DARK : ColorScheme.HIGH_CONTRAST_LIGHT;
		}

		return this.hostColorSchemeService.dark ? ColorScheme.DARK : ColorScheme.LIGHT;
	}

	private async applyPreferredColorTheme(type: ColorScheme) {
		this.currentColorTheme = this.colorThemeRegistry.get(type)!;
	}


	getColorTheme(): IColorTheme {
		return this.currentColorTheme;
	}

}

