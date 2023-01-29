import { nativeTheme } from 'electron';
import { Emitter, Event } from 'mote/base/common/event';
import { IColorScheme } from "mote/platform/window/common/window";
import { createDecorator } from "mote/platform/instantiation/common/instantiation";
import { IPartsSplash } from "mote/platform/theme/common/themeService";
import { Disposable } from 'mote/base/common/lifecycle';
import { isLinux, isMacintosh, isWindows } from 'mote/base/common/platform';
import { IStateMainService } from 'mote/platform/state/electron-main/state';

const DEFAULT_BG_LIGHT = '#FFFFFF';
const DEFAULT_BG_DARK = '#1E1E1E';
const DEFAULT_BG_HC_BLACK = '#000000';
const DEFAULT_BG_HC_LIGHT = '#FFFFFF';

const THEME_STORAGE_KEY = 'theme';
const THEME_BG_STORAGE_KEY = 'themeBackground';
//const THEME_WINDOW_SPLASH = 'windowSplash';

export const IThemeMainService = createDecorator<IThemeMainService>('themeMainService');

export interface IThemeMainService {

	readonly _serviceBrand: undefined;

	readonly onDidChangeColorScheme: Event<IColorScheme>;

	getBackgroundColor(): string;

	saveWindowSplash(windowId: number | undefined, splash: IPartsSplash): void;
	getWindowSplash(): IPartsSplash | undefined;

	getColorScheme(): IColorScheme;
}

export class ThemeMainService extends Disposable implements IThemeMainService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeColorScheme = this._register(new Emitter<IColorScheme>());
	readonly onDidChangeColorScheme = this._onDidChangeColorScheme.event;

	constructor(
		@IStateMainService private stateMainService: IStateMainService,
		//@IConfigurationService private configurationService: IConfigurationService
	) {
		super();

		// Color Scheme changes
		nativeTheme.on('updated', () => {
			this._onDidChangeColorScheme.fire(this.getColorScheme());
		});
	}
	getBackgroundColor(): string {
		const colorScheme = this.getColorScheme();
		//if (colorScheme.highContrast && this.configurationService.getValue('window.autoDetectHighContrast')) {
		if (colorScheme.highContrast) {
			return colorScheme.dark ? DEFAULT_BG_HC_BLACK : DEFAULT_BG_HC_LIGHT;
		}

		let background = this.stateMainService.getItem<string | null>(THEME_BG_STORAGE_KEY, null);
		if (!background) {
			const baseTheme = this.stateMainService.getItem<string>(THEME_STORAGE_KEY, 'vs-dark').split(' ')[0];
			switch (baseTheme) {
				case 'vs': background = DEFAULT_BG_LIGHT; break;
				case 'hc-black': background = DEFAULT_BG_HC_BLACK; break;
				case 'hc-light': background = DEFAULT_BG_HC_LIGHT; break;
				default: background = DEFAULT_BG_DARK;
			}
		}

		if (isMacintosh && background.toUpperCase() === DEFAULT_BG_DARK) {
			background = '#171717'; // https://github.com/electron/electron/issues/5150
		}

		return background;
	}
	saveWindowSplash(windowId: number | undefined, splash: IPartsSplash): void {
		throw new Error('Method not implemented.');
	}

	getColorScheme(): IColorScheme {
		if (isWindows) {
			// high contrast is refelected by the shouldUseInvertedColorScheme property
			if (nativeTheme.shouldUseHighContrastColors) {
				// shouldUseInvertedColorScheme is dark, !shouldUseInvertedColorScheme is light
				return { dark: nativeTheme.shouldUseInvertedColorScheme, highContrast: true };
			}
		} else if (isMacintosh) {
			// high contrast is set if one of shouldUseInvertedColorScheme or shouldUseHighContrastColors is set, reflecting the 'Invert colours' and `Increase contrast` settings in MacOS
			if (nativeTheme.shouldUseInvertedColorScheme || nativeTheme.shouldUseHighContrastColors) {
				// when the colors are inverted, negate shouldUseDarkColors
				return { dark: nativeTheme.shouldUseDarkColors !== nativeTheme.shouldUseInvertedColorScheme, highContrast: true };
			}
		} else if (isLinux) {
			// ubuntu gnome seems to have 3 states, light dark and high contrast
			if (nativeTheme.shouldUseHighContrastColors) {
				return { dark: true, highContrast: true };
			}
		}
		return {
			dark: nativeTheme.shouldUseDarkColors,
			highContrast: false
		};
	}

	getWindowSplash(): IPartsSplash | undefined {
		return undefined;
	}
}
