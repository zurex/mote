import * as platform from 'mote/base/common/platform';
import { EditorFontVariations, EditorOption, EDITOR_FONT_DEFAULTS, FindComputedEditorOptionValueById } from 'mote/editor/common/config/editorOptions';
import { EditorZoom } from 'mote/editor/common/config/editorZoom';

/**
 * Determined from empirical observations.
 * @internal
 */
const GOLDEN_LINE_HEIGHT_RATIO = platform.isMacintosh ? 1.5 : 1.35;

/**
 * @internal
 */
const MINIMUM_LINE_HEIGHT = 8;

/**
 * @internal
 */
export interface IValidatedEditorOptions {
	get<T extends EditorOption>(id: T): FindComputedEditorOptionValueById<T>;
}

export class BareFontInfo {

	/**
	 * @internal
	 */
	public static createFromValidatedSettings(options: IValidatedEditorOptions, pixelRatio: number, ignoreEditorZoom: boolean): BareFontInfo {
		const fontFamily = options.get(EditorOption.FontFamily);
		const fontWeight = options.get(EditorOption.FontWeight);
		const fontSize = options.get(EditorOption.FontSize);
		const fontFeatureSettings = options.get(EditorOption.FontLigatures);
		const fontVariationSettings = options.get(EditorOption.FontVariations);
		const lineHeight = options.get(EditorOption.LineHeight);
		const letterSpacing = options.get(EditorOption.LetterSpacing);
		return BareFontInfo.create(fontFamily, fontWeight, fontSize, fontFeatureSettings, fontVariationSettings, lineHeight, letterSpacing, pixelRatio, ignoreEditorZoom);
	}

	/**
	 * @internal
	 */
	private static create(fontFamily: string, fontWeight: string, fontSize: number, fontFeatureSettings: string, fontVariationSettings: string, lineHeight: number, letterSpacing: number, pixelRatio: number, ignoreEditorZoom: boolean): BareFontInfo {
		if (lineHeight === 0) {
			lineHeight = GOLDEN_LINE_HEIGHT_RATIO * fontSize;
		} else if (lineHeight < MINIMUM_LINE_HEIGHT) {
			// Values too small to be line heights in pixels are in ems.
			lineHeight = lineHeight * fontSize;
		}

		// Enforce integer, minimum constraints
		lineHeight = Math.round(lineHeight);
		if (lineHeight < MINIMUM_LINE_HEIGHT) {
			lineHeight = MINIMUM_LINE_HEIGHT;
		}

		const editorZoomLevelMultiplier = 1 + (ignoreEditorZoom ? 0 : EditorZoom.getZoomLevel() * 0.1);
		fontSize *= editorZoomLevelMultiplier;
		lineHeight *= editorZoomLevelMultiplier;

		if (fontVariationSettings === EditorFontVariations.TRANSLATE) {
			if (fontWeight === 'normal' || fontWeight === 'bold') {
				fontVariationSettings = EditorFontVariations.OFF;
			} else {
				const fontWeightAsNumber = parseInt(fontWeight, 10);
				fontVariationSettings = `'wght' ${fontWeightAsNumber}`;
				fontWeight = 'normal';
			}
		}

		return new BareFontInfo({
			pixelRatio: pixelRatio,
			fontFamily: fontFamily,
			fontWeight: fontWeight,
			fontSize: fontSize,
			fontFeatureSettings: fontFeatureSettings,
			fontVariationSettings,
			lineHeight: lineHeight,
			letterSpacing: letterSpacing
		});
	}

	readonly pixelRatio: number;
	readonly fontFamily: string;
	readonly fontWeight: string;
	readonly fontSize: number;
	readonly fontFeatureSettings: string;
	readonly fontVariationSettings: string;
	readonly lineHeight: number;
	readonly letterSpacing: number;

	protected constructor(opts: {
		pixelRatio: number;
		fontFamily: string;
		fontWeight: string;
		fontSize: number;
		fontFeatureSettings: string;
		fontVariationSettings: string;
		lineHeight: number;
		letterSpacing: number;
	}) {
		this.pixelRatio = opts.pixelRatio;
		this.fontFamily = String(opts.fontFamily);
		this.fontWeight = String(opts.fontWeight);
		this.fontSize = opts.fontSize;
		this.fontFeatureSettings = opts.fontFeatureSettings;
		this.fontVariationSettings = opts.fontVariationSettings;
		this.lineHeight = opts.lineHeight | 0;
		this.letterSpacing = opts.letterSpacing;
	}

	/**
	 * @internal
	 */
	public getId(): string {
		return `${this.pixelRatio}-${this.fontFamily}-${this.fontWeight}-${this.fontSize}-${this.fontFeatureSettings}-${this.fontVariationSettings}-${this.lineHeight}-${this.letterSpacing}`;
	}

	/**
	 * @internal
	 */
	public getMassagedFontFamily(): string {
		const fallbackFontFamily = EDITOR_FONT_DEFAULTS.fontFamily;
		const fontFamily = BareFontInfo._wrapInQuotes(this.fontFamily);
		if (fallbackFontFamily && this.fontFamily !== fallbackFontFamily) {
			return `${fontFamily}, ${fallbackFontFamily}`;
		}
		return fontFamily;
	}

	private static _wrapInQuotes(fontFamily: string): string {
		if (/[,"']/.test(fontFamily)) {
			// Looks like the font family might be already escaped
			return fontFamily;
		}
		if (/[+ ]/.test(fontFamily)) {
			// Wrap a font family using + or <space> with quotes
			return `"${fontFamily}"`;
		}
		return fontFamily;
	}
}

// change this whenever `FontInfo` members are changed
export const SERIALIZED_FONT_INFO_VERSION = 2;

export class FontInfo extends BareFontInfo {
	readonly _editorStylingBrand: void = undefined;

	readonly version: number = SERIALIZED_FONT_INFO_VERSION;

	readonly isTrusted: boolean;
	readonly isMonospace: boolean;
	readonly typicalHalfwidthCharacterWidth: number;
	readonly typicalFullwidthCharacterWidth: number;
	readonly canUseHalfwidthRightwardsArrow: boolean;
	readonly spaceWidth: number;
	readonly middotWidth: number;
	readonly wsmiddotWidth: number;
	readonly maxDigitWidth: number;

	/**
	 * @internal
	 */
	constructor(opts: {
		pixelRatio: number;
		fontFamily: string;
		fontWeight: string;
		fontSize: number;
		fontFeatureSettings: string;
		fontVariationSettings: string;
		lineHeight: number;
		letterSpacing: number;
		isMonospace: boolean;
		typicalHalfwidthCharacterWidth: number;
		typicalFullwidthCharacterWidth: number;
		canUseHalfwidthRightwardsArrow: boolean;
		spaceWidth: number;
		middotWidth: number;
		wsmiddotWidth: number;
		maxDigitWidth: number;
	}, isTrusted: boolean) {
		super(opts);
		this.isTrusted = isTrusted;
		this.isMonospace = opts.isMonospace;
		this.typicalHalfwidthCharacterWidth = opts.typicalHalfwidthCharacterWidth;
		this.typicalFullwidthCharacterWidth = opts.typicalFullwidthCharacterWidth;
		this.canUseHalfwidthRightwardsArrow = opts.canUseHalfwidthRightwardsArrow;
		this.spaceWidth = opts.spaceWidth;
		this.middotWidth = opts.middotWidth;
		this.wsmiddotWidth = opts.wsmiddotWidth;
		this.maxDigitWidth = opts.maxDigitWidth;
	}
}
