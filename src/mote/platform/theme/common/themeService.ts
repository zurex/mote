import { IconContribution, IconDefinition } from 'mote/platform/theme/common/iconRegistry';
import { Color } from 'mote/base/common/color';
import { Emitter, Event } from 'mote/base/common/event';
import { Disposable, IDisposable, toDisposable } from 'mote/base/common/lifecycle';
import { IEnvironmentService } from 'mote/platform/environment/common/environment';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';
import { Registry } from 'mote/platform/registry/common/platform';
import { ColorIdentifier } from './colorRegistry';
import { ColorScheme } from './theme';

export const IThemeService = createDecorator<IThemeService>('themeService');

export interface ThemeColor {
	id: string;
}

export namespace ThemeColor {
	export function isThemeColor(obj: any): obj is ThemeColor {
		return obj && typeof obj === 'object' && typeof (<ThemeColor>obj).id === 'string';
	}
}

export function themeColorFromId(id: ColorIdentifier) {
	return { id };
}

// theme icon
export interface ThemeIcon {
	readonly id: string;
	readonly color?: ThemeColor;
}

export function getThemeTypeSelector(type: ColorScheme): string {
	switch (type) {
		case ColorScheme.DARK: return 'mote-dark';
		case ColorScheme.HIGH_CONTRAST_DARK: return 'mote-hc-black';
		case ColorScheme.HIGH_CONTRAST_LIGHT: return 'mote-hc-light';
		default: return 'mote';
	}
}

export interface IColorTheme {

	readonly type: ColorScheme;

	readonly label: string;

	/**
	 * Resolves the color of the given color identifier. If the theme does not
	 * specify the color, the default color is returned unless <code>useDefault</code> is set to false.
	 * @param color the id of the color
	 * @param useDefault specifies if the default color should be used. If not set, the default is used.
	 */
	getColor(color: ColorIdentifier, useDefault?: boolean): Color | undefined;

	/**
	 * Returns whether the theme defines a value for the color. If not, that means the
	 * default color will be used.
	 */
	defines(color: ColorIdentifier): boolean;

	/**
	 * Returns the token style for a given classification. The result uses the <code>MetadataConsts</code> format
	 */
	//getTokenStyleMetadata(type: string, modifiers: string[], modelLanguage: string): ITokenStyle | undefined;

	/**
	 * Defines whether semantic highlighting should be enabled for the theme.
	 */
	readonly semanticHighlighting: boolean;
}


export interface IProductIconTheme {
	/**
	 * Resolves the definition for the given icon as defined by the theme.
	 *
	 * @param iconContribution The icon
	 */
	getIcon(iconContribution: IconContribution): IconDefinition | undefined;
}

export interface ICssStyleCollector {
	addRule(rule: string): void;
}

export interface IThemingParticipant {
	(theme: IColorTheme, collector: ICssStyleCollector, environment: IEnvironmentService): void;
}

export interface IThemeService {
	readonly _serviceBrand: undefined;

	getColorTheme(): IColorTheme;

	readonly onDidColorThemeChange: Event<IColorTheme>;

	getProductIconTheme(): IProductIconTheme;

	readonly onDidProductIconThemeChange: Event<IProductIconTheme>;
}

// static theming participant
export const ThemeExtensions = {
	ThemingContribution: 'base.contributions.theming'
};

export interface IThemingRegistry {

	/**
	 * Register a theming participant that is invoked on every theme change.
	 */
	onColorThemeChange(participant: IThemingParticipant): IDisposable;

	getThemingParticipants(): IThemingParticipant[];

	readonly onThemingParticipantAdded: Event<IThemingParticipant>;
}

class ThemingRegistry implements IThemingRegistry {
	private themingParticipants: IThemingParticipant[] = [];
	private readonly onThemingParticipantAddedEmitter: Emitter<IThemingParticipant>;

	constructor() {
		this.themingParticipants = [];
		this.onThemingParticipantAddedEmitter = new Emitter<IThemingParticipant>();
	}

	public onColorThemeChange(participant: IThemingParticipant): IDisposable {
		this.themingParticipants.push(participant);
		this.onThemingParticipantAddedEmitter.fire(participant);
		return toDisposable(() => {
			const idx = this.themingParticipants.indexOf(participant);
			this.themingParticipants.splice(idx, 1);
		});
	}

	public get onThemingParticipantAdded(): Event<IThemingParticipant> {
		return this.onThemingParticipantAddedEmitter.event;
	}

	public getThemingParticipants(): IThemingParticipant[] {
		return this.themingParticipants;
	}
}

const themingRegistry = new ThemingRegistry();
Registry.add(ThemeExtensions.ThemingContribution, themingRegistry);

export function registerThemingParticipant(participant: IThemingParticipant): IDisposable {
	return themingRegistry.onColorThemeChange(participant);
}

/**
 * Utility base class for all themable components.
 */
export class Themable extends Disposable {
	protected theme: IColorTheme;

	constructor(
		protected themeService: IThemeService
	) {
		super();

		this.theme = themeService.getColorTheme();

		// Hook up to theme changes
		this._register(this.themeService.onDidColorThemeChange(theme => this.onThemeChange(theme)));
	}

	protected onThemeChange(theme: IColorTheme): void {
		this.theme = theme;

		this.updateStyles();
	}

	protected updateStyles(): void {
		// Subclasses to override
	}

	protected getColor(id: string, modify?: (color: Color, theme: IColorTheme) => Color): string | null {
		let color = this.theme.getColor(id);

		if (color && modify) {
			color = modify(color, this.theme);
		}

		return color ? color.toString() : null;
	}
}

export interface IPartsSplash {
	baseTheme: string;
	colorInfo: {
		background: string;
		foreground: string | undefined;
		editorBackground: string | undefined;
		titleBarBackground: string | undefined;
		activityBarBackground: string | undefined;
		sideBarBackground: string | undefined;
		statusBarBackground: string | undefined;
		statusBarNoFolderBackground: string | undefined;
		windowBorder: string | undefined;
	};
	layoutInfo: {
		sideBarSide: string;
		editorPartMinWidth: number;
		titleBarHeight: number;
		activityBarWidth: number;
		sideBarWidth: number;
		statusBarHeight: number;
		windowBorder: boolean;
		windowBorderRadius: string | undefined;
	} | undefined;
}
