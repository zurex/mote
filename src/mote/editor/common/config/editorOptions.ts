import * as nls from 'mote/nls';
import * as platform from 'mote/base/common/platform';
import { IConfigurationPropertySchema } from 'mote/platform/configuration/common/configurationRegistry';
import * as arrays from 'mote/base/common/arrays';
import { ScrollbarVisibility } from 'mote/base/common/scrollable';
import { FontInfo } from 'mote/editor/common/config/fontInfo';
import { Constants } from 'mote/base/common/uint';

/**
 * Configuration options for the editor.
 */
export interface IEditorOptions {
	/**
	 * Should the editor be read only. See also `domReadOnly`.
	 * Defaults to false.
	 */
	readOnly?: boolean;

	/**
	 * Control the cursor animation style, possible values are 'blink', 'smooth', 'phase', 'expand' and 'solid'.
	 * Defaults to 'blink'.
	 */
	cursorBlinking?: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';

	/**
	 * Control the cursor style, either 'block' or 'line'.
	 * Defaults to 'line'.
	 */
	cursorStyle?: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin';

	/**
	 * Enable smooth caret animation.
	 * Defaults to 'off'.
	 */
	cursorSmoothCaretAnimation?: 'off' | 'explicit' | 'on';

	/**
	 * Enable that the selection with the mouse and keys is doing column selection.
	 * Defaults to false.
	 */
	columnSelection?: boolean;

	/**
	 * Disable the optimizations for monospace fonts.
	 * Defaults to false.
	 */
	disableMonospaceOptimizations?: boolean;

	/**
	 * Render the editor selection with rounded borders.
	 * Defaults to true.
	 */
	roundedSelection?: boolean;

	/**
	 * Enable experimental whitespace rendering.
	 * Defaults to 'svg'.
	 */
	experimentalWhitespaceRendering?: 'svg' | 'font' | 'off';

	/**
	 * Enable rendering of whitespace.
	 * Defaults to 'selection'.
	 */
	renderWhitespace?: 'none' | 'boundary' | 'selection' | 'trailing' | 'all';
	/**
	 * Enable rendering of control characters.
	 * Defaults to true.
	 */
	renderControlCharacters?: boolean;

	/**
	 * Control the wrapping of the editor.
	 * When `wordWrap` = "off", the lines will never wrap.
	 * When `wordWrap` = "on", the lines will wrap at the viewport width.
	 * When `wordWrap` = "wordWrapColumn", the lines will wrap at `wordWrapColumn`.
	 * When `wordWrap` = "bounded", the lines will wrap at min(viewport width, wordWrapColumn).
	 * Defaults to "off".
	 */
	wordWrap?: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
	/**
	 * Override the `wordWrap` setting.
	 */
	wordWrapOverride1?: 'off' | 'on' | 'inherit';
	/**
	 * Override the `wordWrapOverride1` setting.
	 */
	wordWrapOverride2?: 'off' | 'on' | 'inherit';
	/**
	 * Control the wrapping of the editor.
	 * When `wordWrap` = "off", the lines will never wrap.
	 * When `wordWrap` = "on", the lines will wrap at the viewport width.
	 * When `wordWrap` = "wordWrapColumn", the lines will wrap at `wordWrapColumn`.
	 * When `wordWrap` = "bounded", the lines will wrap at min(viewport width, wordWrapColumn).
	 * Defaults to 80.
	 */
	wordWrapColumn?: number;
	/**
	 * Control indentation of wrapped lines. Can be: 'none', 'same', 'indent' or 'deepIndent'.
	 * Defaults to 'same' in vscode and to 'none' in monaco-editor.
	 */
	wrappingIndent?: 'none' | 'same' | 'indent' | 'deepIndent';
	/**
	 * Controls the wrapping strategy to use.
	 * Defaults to 'simple'.
	 */
	wrappingStrategy?: 'simple' | 'advanced';
	/**
	 * Configure word wrapping characters. A break will be introduced before these characters.
	 */
	wordWrapBreakBeforeCharacters?: string;
	/**
	 * Configure word wrapping characters. A break will be introduced after these characters.
	 */
	wordWrapBreakAfterCharacters?: string;

	/**
	 * Sets whether line breaks appear wherever the text would otherwise overflow its content box.
	 * When wordBreak = 'normal', Use the default line break rule.
	 * When wordBreak = 'keepAll', Word breaks should not be used for Chinese/Japanese/Korean (CJK) text. Non-CJK text behavior is the same as for normal.
	 */
	wordBreak?: 'normal' | 'keepAll';

	/**
	 * Performance guard: Stop rendering a line after x characters.
	 * Defaults to 10000.
	 * Use -1 to never stop rendering
	 */
	stopRenderingLineAfter?: number;

	/**
	 * Control the behavior and rendering of the scrollbars.
	 */
	scrollbar?: IEditorScrollbarOptions;

	/**
	 * The font family
	 */
	fontFamily?: string;

	/**
	 * The font weight
	 */
	fontWeight?: string;
	/**
	 * The font size
	 */
	fontSize?: number;
	/**
	 * The line height
	 */
	lineHeight?: number;
	/**
	 * The letter spacing
	 */
	letterSpacing?: number;

	/**
	 * Enable font variations.
	 * Defaults to false.
	 */
	fontVariations?: boolean | string;

	/**
	 * Enable font ligatures.
	 * Defaults to false.
	 */
	fontLigatures?: boolean | string;

	/**
	 * Controls the spacing around the editor.
	 */
	padding?: IEditorPaddingOptions;
}

/**
 * @internal
 */
export const editorOptionsRegistry: IEditorOption<EditorOption, any>[] = [];


function register<K extends EditorOption, V>(option: IEditorOption<K, V>): IEditorOption<K, V> {
	editorOptionsRegistry[option.id] = option;
	return option;
}

//#region Cursor

/**
 * The kind of animation in which the editor's cursor should be rendered.
 */
export const enum TextEditorCursorBlinkingStyle {
	/**
	 * Hidden
	 */
	Hidden = 0,
	/**
	 * Blinking
	 */
	Blink = 1,
	/**
	 * Blinking with smooth fading
	 */
	Smooth = 2,
	/**
	 * Blinking with prolonged filled state and smooth fading
	 */
	Phase = 3,
	/**
	 * Expand collapse animation on the y axis
	 */
	Expand = 4,
	/**
	 * No-Blinking
	 */
	Solid = 5
}

function _cursorBlinkingStyleFromString(cursorBlinkingStyle: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid'): TextEditorCursorBlinkingStyle {
	switch (cursorBlinkingStyle) {
		case 'blink': return TextEditorCursorBlinkingStyle.Blink;
		case 'smooth': return TextEditorCursorBlinkingStyle.Smooth;
		case 'phase': return TextEditorCursorBlinkingStyle.Phase;
		case 'expand': return TextEditorCursorBlinkingStyle.Expand;
		case 'solid': return TextEditorCursorBlinkingStyle.Solid;
	}
}

/**
 * The style in which the editor's cursor should be rendered.
 */
export enum TextEditorCursorStyle {
	/**
	 * As a vertical line (sitting between two characters).
	 */
	Line = 1,
	/**
	 * As a block (sitting on top of a character).
	 */
	Block = 2,
	/**
	 * As a horizontal line (sitting under a character).
	 */
	Underline = 3,
	/**
	 * As a thin vertical line (sitting between two characters).
	 */
	LineThin = 4,
	/**
	 * As an outlined block (sitting on top of a character).
	 */
	BlockOutline = 5,
	/**
	 * As a thin horizontal line (sitting under a character).
	 */
	UnderlineThin = 6
}

function _cursorStyleFromString(cursorStyle: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin'): TextEditorCursorStyle {
	switch (cursorStyle) {
		case 'line': return TextEditorCursorStyle.Line;
		case 'block': return TextEditorCursorStyle.Block;
		case 'underline': return TextEditorCursorStyle.Underline;
		case 'line-thin': return TextEditorCursorStyle.LineThin;
		case 'block-outline': return TextEditorCursorStyle.BlockOutline;
		case 'underline-thin': return TextEditorCursorStyle.UnderlineThin;
	}
}

//#endregion

const DEFAULT_WINDOWS_FONT_FAMILY = 'Consolas, \'Courier New\', monospace';
const DEFAULT_MAC_FONT_FAMILY = 'Menlo, Monaco, \'Courier New\', monospace';
const DEFAULT_LINUX_FONT_FAMILY = '\'Droid Sans Mono\', \'monospace\', monospace';

/**
 * @internal
 */
export const EDITOR_FONT_DEFAULTS = {
	fontFamily: (
		platform.isMacintosh ? DEFAULT_MAC_FONT_FAMILY : (platform.isLinux ? DEFAULT_LINUX_FONT_FAMILY : DEFAULT_WINDOWS_FONT_FAMILY)
	),
	fontWeight: 'normal',
	fontSize: (
		platform.isMacintosh ? 16 : 14
	),
	lineHeight: 1.5,
	letterSpacing: 0,
};

export const enum EditorOption {
	ReadOnly,
	CursorStyle,
	CursorBlinking,
	CursorSmoothCaretAnimation,
	ColumnSelection,
	DisableMonospaceOptimizations,
	RoundedSelection,
	RenderControlCharacters,
	ExperimentalWhitespaceRendering,
	RenderWhitespace,
	WordBreak,
	WordWrap,
	WordWrapBreakAfterCharacters,
	WordWrapBreakBeforeCharacters,
	WordWrapColumn,
	WordWrapOverride1,
	WordWrapOverride2,
	Scrollbar,
	StopRenderingLineAfter,
	FontFamily,
	FontInfo,
	FontLigatures,
	FontSize,
	FontWeight,
	FontVariations,
	LetterSpacing,
	LineHeight,
	Padding,

	WrappingIndent,
	WrappingStrategy,
	// Leave these at the end (because they have dependencies!)
	LayoutInfo,
	WrappingInfo,
}

/**
 * An event describing that the configuration of the editor has changed.
 */
export class ConfigurationChangedEvent {
	private readonly _values: boolean[];
	/**
	 * @internal
	 */
	constructor(values: boolean[]) {
		this._values = values;
	}
	public hasChanged(id: EditorOption): boolean {
		return this._values[id];
	}
}

/**
 * All computed editor options.
 */
export interface IComputedEditorOptions {
	get<T extends EditorOption>(id: T): FindComputedEditorOptionValueById<T>;
}

//#region IEditorOption

/**
 * @internal
 */
export interface IEnvironmentalOptions {
	//readonly memory: ComputeOptionsMemory | null;
	readonly outerWidth: number;
	readonly outerHeight: number;
	readonly fontInfo: FontInfo;
	readonly extraEditorClassName: string;
	readonly isDominatedByLongLines: boolean;
	readonly viewLineCount: number;
	//readonly lineNumbersDigitCount: number;
	//readonly emptySelectionClipboard: boolean;
	readonly pixelRatio: number;
	//readonly tabFocusMode: boolean;
	//readonly accessibilitySupport: AccessibilitySupport;
}


export interface IEditorOption<K extends EditorOption, V> {
	readonly id: K;
	readonly name: string;
	defaultValue: V;

	/**
	 * @internal
	 */
	validate(input: any): V;
	/**
	 * @internal
	 */
	compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: V): V;

	/**
	 * Might modify `value`.
	*/
	applyUpdate(value: V | undefined, update: V): ApplyUpdateResult<V>;
}

/**
 * @internal
 */
type PossibleKeyName0<V> = { [K in keyof IEditorOptions]: IEditorOptions[K] extends V | undefined ? K : never }[keyof IEditorOptions];
/**
 * @internal
 */
type PossibleKeyName<V> = NonNullable<PossibleKeyName0<V>>;

/**
 * @internal
 */
abstract class BaseEditorOption<K extends EditorOption, T, V> implements IEditorOption<K, V> {

	public readonly id: K;
	public readonly name: string;
	public readonly defaultValue: V;
	public readonly schema: IConfigurationPropertySchema | { [path: string]: IConfigurationPropertySchema } | undefined;

	constructor(id: K, name: PossibleKeyName<T>, defaultValue: V, schema?: IConfigurationPropertySchema | { [path: string]: IConfigurationPropertySchema }) {
		this.id = id;
		this.name = name;
		this.defaultValue = defaultValue;
		this.schema = schema;
	}

	public applyUpdate(value: V | undefined, update: V): ApplyUpdateResult<V> {
		return applyUpdate(value, update);
	}

	public abstract validate(input: any): V;

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: V): V {
		return value;
	}
}

export class ApplyUpdateResult<T> {
	constructor(
		public readonly newValue: T,
		public readonly didChange: boolean
	) { }
}

function applyUpdate<T>(value: T | undefined, update: T): ApplyUpdateResult<T> {
	if (typeof value !== 'object' || typeof update !== 'object' || !value || !update) {
		return new ApplyUpdateResult(update, value !== update);
	}
	if (Array.isArray(value) || Array.isArray(update)) {
		const arrayEquals = Array.isArray(value) && Array.isArray(update) && arrays.equals(value, update);
		return new ApplyUpdateResult(update, !arrayEquals);
	}
	let didChange = false;
	for (const key in update) {
		if ((update as T & object).hasOwnProperty(key)) {
			const result = applyUpdate(value[key], update[key]);
			if (result.didChange) {
				value[key] = result.newValue;
				didChange = true;
			}
		}
	}
	return new ApplyUpdateResult(value, didChange);
}

/**
 * @internal
 */
abstract class ComputedEditorOption<K extends EditorOption, V> implements IEditorOption<K, V> {

	public readonly id: K;
	public readonly name: '_never_';
	public readonly defaultValue: V;

	constructor(id: K) {
		this.id = id;
		this.name = '_never_';
		this.defaultValue = <any>undefined;
	}

	public applyUpdate(value: V | undefined, update: V): ApplyUpdateResult<V> {
		return applyUpdate(value, update);
	}

	public validate(input: any): V {
		return this.defaultValue;
	}

	public abstract compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: V): V;
}

class SimpleEditorOption<K extends EditorOption, V> implements IEditorOption<K, V> {

	public readonly id: K;
	public readonly name: PossibleKeyName<V>;
	public readonly defaultValue: V;
	public readonly schema: IConfigurationPropertySchema | undefined;

	constructor(id: K, name: PossibleKeyName<V>, defaultValue: V, schema?: IConfigurationPropertySchema) {
		this.id = id;
		this.name = name;
		this.defaultValue = defaultValue;
		this.schema = schema;
	}

	public applyUpdate(value: V | undefined, update: V): ApplyUpdateResult<V> {
		return applyUpdate(value, update);
	}

	public validate(input: any): V {
		if (typeof input === 'undefined') {
			return this.defaultValue;
		}
		return input as any;
	}

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: V): V {
		return value;
	}
}

class EditorFloatOption<K extends EditorOption> extends SimpleEditorOption<K, number> {

	public static clamp(n: number, min: number, max: number): number {
		if (n < min) {
			return min;
		}
		if (n > max) {
			return max;
		}
		return n;
	}

	public static float(value: any, defaultValue: number): number {
		if (typeof value === 'number') {
			return value;
		}
		if (typeof value === 'undefined') {
			return defaultValue;
		}
		const r = parseFloat(value);
		return (isNaN(r) ? defaultValue : r);
	}

	public readonly validationFn: (value: number) => number;

	constructor(id: K, name: PossibleKeyName<number>, defaultValue: number, validationFn: (value: number) => number, schema?: IConfigurationPropertySchema) {
		if (typeof schema !== 'undefined') {
			schema.type = 'number';
			schema.default = defaultValue;
		}
		super(id, name, defaultValue, schema);
		this.validationFn = validationFn;
	}

	public override validate(input: any): number {
		return this.validationFn(EditorFloatOption.float(input, this.defaultValue));
	}
}

class EditorStringOption<K extends EditorOption> extends SimpleEditorOption<K, string> {

	public static string(value: any, defaultValue: string): string {
		if (typeof value !== 'string') {
			return defaultValue;
		}
		return value;
	}

	constructor(id: K, name: PossibleKeyName<string>, defaultValue: string, schema: IConfigurationPropertySchema | undefined = undefined) {
		if (typeof schema !== 'undefined') {
			schema.type = 'string';
			schema.default = defaultValue;
		}
		super(id, name, defaultValue, schema);
	}

	public override validate(input: any): string {
		return EditorStringOption.string(input, this.defaultValue);
	}
}


/**
 * @internal
 */
export function stringSet<T>(value: T | undefined, defaultValue: T, allowedValues: ReadonlyArray<T>): T {
	if (typeof value !== 'string') {
		return defaultValue;
	}
	if (allowedValues.indexOf(value) === -1) {
		return defaultValue;
	}
	return value;
}

class EditorStringEnumOption<K extends EditorOption, V extends string> extends SimpleEditorOption<K, V> {

	private readonly _allowedValues: ReadonlyArray<V>;

	constructor(id: K, name: PossibleKeyName<V>, defaultValue: V, allowedValues: ReadonlyArray<V>, schema: IConfigurationPropertySchema | undefined = undefined) {
		if (typeof schema !== 'undefined') {
			schema.type = 'string';
			schema.enum = <any>allowedValues;
			schema.default = defaultValue;
		}
		super(id, name, defaultValue, schema);
		this._allowedValues = allowedValues;
	}

	public override validate(input: any): V {
		return stringSet<V>(input, this.defaultValue, this._allowedValues);
	}
}

class EditorEnumOption<K extends EditorOption, T extends string, V> extends BaseEditorOption<K, T, V> {

	private readonly _allowedValues: T[];
	private readonly _convert: (value: T) => V;

	constructor(id: K, name: PossibleKeyName<T>, defaultValue: V, defaultStringValue: string, allowedValues: T[], convert: (value: T) => V, schema: IConfigurationPropertySchema | undefined = undefined) {
		if (typeof schema !== 'undefined') {
			schema.type = 'string';
			schema.enum = allowedValues;
			schema.default = defaultStringValue;
		}
		super(id, name, defaultValue, schema);
		this._allowedValues = allowedValues;
		this._convert = convert;
	}

	public validate(input: any): V {
		if (typeof input !== 'string') {
			return this.defaultValue;
		}
		if (this._allowedValues.indexOf(<T>input) === -1) {
			return this.defaultValue;
		}
		return this._convert(<any>input);
	}
}


/**
 * @internal
 */
export function boolean(value: any, defaultValue: boolean): boolean {
	if (typeof value === 'undefined') {
		return defaultValue;
	}
	if (value === 'false') {
		// treat the string 'false' as false
		return false;
	}
	return Boolean(value);
}

class EditorBooleanOption<K extends EditorOption> extends SimpleEditorOption<K, boolean> {

	constructor(id: K, name: PossibleKeyName<boolean>, defaultValue: boolean, schema: IConfigurationPropertySchema | undefined = undefined) {
		if (typeof schema !== 'undefined') {
			schema.type = 'boolean';
			schema.default = defaultValue;
		}
		super(id, name, defaultValue, schema);
	}

	public override validate(input: any): boolean {
		return boolean(input, this.defaultValue);
	}
}

/**
 * @internal
 */
export function clampedInt<T>(value: any, defaultValue: T, minimum: number, maximum: number): number | T {
	if (typeof value === 'undefined') {
		return defaultValue;
	}
	let r = parseInt(value, 10);
	if (isNaN(r)) {
		return defaultValue;
	}
	r = Math.max(minimum, r);
	r = Math.min(maximum, r);
	return r | 0;
}

class EditorIntOption<K extends EditorOption> extends SimpleEditorOption<K, number> {

	public static clampedInt<T>(value: any, defaultValue: T, minimum: number, maximum: number): number | T {
		return clampedInt(value, defaultValue, minimum, maximum);
	}

	public readonly minimum: number;
	public readonly maximum: number;

	constructor(id: K, name: PossibleKeyName<number>, defaultValue: number, minimum: number, maximum: number, schema: IConfigurationPropertySchema | undefined = undefined) {
		if (typeof schema !== 'undefined') {
			schema.type = 'integer';
			schema.default = defaultValue;
			schema.minimum = minimum;
			schema.maximum = maximum;
		}
		super(id, name, defaultValue, schema);
		this.minimum = minimum;
		this.maximum = maximum;
	}

	public override validate(input: any): number {
		return EditorIntOption.clampedInt(input, this.defaultValue, this.minimum, this.maximum);
	}
}

//#endregion


//#region layoutInfo

/**
 * @internal
 */
export interface EditorLayoutInfoComputerEnv {
	readonly outerWidth: number;
	readonly outerHeight: number;
	readonly isDominatedByLongLines: boolean;
	readonly viewLineCount: number;
	readonly pixelRatio: number;
	readonly typicalHalfwidthCharacterWidth: number;
}
/**
 * The internal layout details of the editor.
 */
export interface EditorLayoutInfo {

	/**
	 * Left position for the content (actual text)
	 */
	readonly contentLeft: number;
	/**
	 * The width of the content (actual text)
	 */
	readonly contentWidth: number;

	/**
	 * Full editor width.
	 */
	readonly width: number;
	/**
	 * Full editor height.
	 */
	readonly height: number;

	/**
	 * The number of columns (of typical characters) fitting on a viewport line.
	 */
	readonly viewportColumn: number;

	readonly isWordWrapMinified: boolean;
	readonly isViewportWrapping: boolean;
	readonly wrappingColumn: number;

	/**
	 * The width of the vertical scrollbar.
	 */
	readonly verticalScrollbarWidth: number;
	/**
	 * The height of the horizontal scrollbar.
	 */
	readonly horizontalScrollbarHeight: number;
}

class EditorLayoutInfoComputer extends ComputedEditorOption<EditorOption.LayoutInfo, EditorLayoutInfo> {

	constructor() {
		super(EditorOption.LayoutInfo);
	}

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, _: EditorLayoutInfo): EditorLayoutInfo {
		return EditorLayoutInfoComputer.computeLayout(options, {
			outerWidth: env.outerWidth,
			outerHeight: env.outerHeight,
			isDominatedByLongLines: env.isDominatedByLongLines,
			viewLineCount: env.viewLineCount,
			pixelRatio: env.pixelRatio,
			typicalHalfwidthCharacterWidth: env.fontInfo.typicalHalfwidthCharacterWidth,
		});
	}

	public static computeLayout(options: IComputedEditorOptions, env: EditorLayoutInfoComputerEnv): EditorLayoutInfo {
		const outerWidth = env.outerWidth | 0;
		const outerHeight = env.outerHeight | 0;
		const typicalHalfwidthCharacterWidth = env.typicalHalfwidthCharacterWidth;

		const wordWrapOverride2 = options.get(EditorOption.WordWrapOverride2);
		const wordWrapOverride1 = (wordWrapOverride2 === 'inherit' ? options.get(EditorOption.WordWrapOverride1) : wordWrapOverride2);
		const wordWrap = (wordWrapOverride1 === 'inherit' ? options.get(EditorOption.WordWrap) : wordWrapOverride1);

		const wordWrapColumn = options.get(EditorOption.WordWrapColumn);
		const isDominatedByLongLines = env.isDominatedByLongLines;

		const scrollbar = options.get(EditorOption.Scrollbar);
		const verticalScrollbarWidth = scrollbar.verticalScrollbarSize;
		//const verticalScrollbarHasArrows = scrollbar.verticalHasArrows;
		//const scrollbarArrowSize = scrollbar.arrowSize;
		const horizontalScrollbarHeight = scrollbar.horizontalScrollbarSize;

		const contentLeft = 96;
		const contentWidth = outerWidth;

		let isWordWrapMinified = false;
		let isViewportWrapping = false;
		let wrappingColumn = -1;

		if (wordWrapOverride1 === 'inherit' && isDominatedByLongLines) {
			// Force viewport width wrapping if model is dominated by long lines
			isWordWrapMinified = true;
			isViewportWrapping = true;
		} else if (wordWrap === 'on' || wordWrap === 'bounded') {
			isViewportWrapping = true;
		} else if (wordWrap === 'wordWrapColumn') {
			wrappingColumn = wordWrapColumn;
		}

		// (leaving 2px for the cursor to have space after the last character)
		const viewportColumn = Math.max(1, Math.floor((contentWidth - verticalScrollbarWidth - 2) / typicalHalfwidthCharacterWidth));

		//const verticalArrowSize = (verticalScrollbarHasArrows ? scrollbarArrowSize : 0);

		if (isViewportWrapping) {
			// compute the actual wrappingColumn
			wrappingColumn = Math.max(1, viewportColumn);
			if (wordWrap === 'bounded') {
				wrappingColumn = Math.min(wrappingColumn, wordWrapColumn);
			}
		}

		return {
			width: outerWidth,
			height: outerHeight,

			contentLeft: contentLeft,
			contentWidth: contentWidth,

			viewportColumn: viewportColumn,

			isWordWrapMinified: isWordWrapMinified,
			isViewportWrapping: isViewportWrapping,
			wrappingColumn: wrappingColumn,

			verticalScrollbarWidth: verticalScrollbarWidth,
			horizontalScrollbarHeight: horizontalScrollbarHeight,
		};
	}
}


//#endregion

//#region Scrollbar

/**
 * Configuration options for editor scrollbars
 */
export interface IEditorScrollbarOptions {
	/**
	 * The size of arrows (if displayed).
	 * Defaults to 11.
	 * **NOTE**: This option cannot be updated using `updateOptions()`
	 */
	arrowSize?: number;
	/**
	 * Render vertical scrollbar.
	 * Defaults to 'auto'.
	 */
	vertical?: 'auto' | 'visible' | 'hidden';
	/**
	 * Render horizontal scrollbar.
	 * Defaults to 'auto'.
	 */
	horizontal?: 'auto' | 'visible' | 'hidden';
	/**
	 * Cast horizontal and vertical shadows when the content is scrolled.
	 * Defaults to true.
	 * **NOTE**: This option cannot be updated using `updateOptions()`
	 */
	useShadows?: boolean;
	/**
	 * Render arrows at the top and bottom of the vertical scrollbar.
	 * Defaults to false.
	 * **NOTE**: This option cannot be updated using `updateOptions()`
	 */
	verticalHasArrows?: boolean;
	/**
	 * Render arrows at the left and right of the horizontal scrollbar.
	 * Defaults to false.
	 * **NOTE**: This option cannot be updated using `updateOptions()`
	 */
	horizontalHasArrows?: boolean;
	/**
	 * Listen to mouse wheel events and react to them by scrolling.
	 * Defaults to true.
	 */
	handleMouseWheel?: boolean;
	/**
	 * Always consume mouse wheel events (always call preventDefault() and stopPropagation() on the browser events).
	 * Defaults to true.
	 * **NOTE**: This option cannot be updated using `updateOptions()`
	 */
	alwaysConsumeMouseWheel?: boolean;
	/**
	 * Height in pixels for the horizontal scrollbar.
	 * Defaults to 10 (px).
	 */
	horizontalScrollbarSize?: number;
	/**
	 * Width in pixels for the vertical scrollbar.
	 * Defaults to 10 (px).
	 */
	verticalScrollbarSize?: number;
	/**
	 * Width in pixels for the vertical slider.
	 * Defaults to `verticalScrollbarSize`.
	 * **NOTE**: This option cannot be updated using `updateOptions()`
	 */
	verticalSliderSize?: number;
	/**
	 * Height in pixels for the horizontal slider.
	 * Defaults to `horizontalScrollbarSize`.
	 * **NOTE**: This option cannot be updated using `updateOptions()`
	 */
	horizontalSliderSize?: number;
	/**
	 * Scroll gutter clicks move by page vs jump to position.
	 * Defaults to false.
	 */
	scrollByPage?: boolean;
}

export interface InternalEditorScrollbarOptions {
	readonly arrowSize: number;
	readonly vertical: ScrollbarVisibility;
	readonly horizontal: ScrollbarVisibility;
	readonly useShadows: boolean;
	readonly verticalHasArrows: boolean;
	readonly horizontalHasArrows: boolean;
	readonly handleMouseWheel: boolean;
	readonly alwaysConsumeMouseWheel: boolean;
	readonly horizontalScrollbarSize: number;
	readonly horizontalSliderSize: number;
	readonly verticalScrollbarSize: number;
	readonly verticalSliderSize: number;
	readonly scrollByPage: boolean;
}

function _scrollbarVisibilityFromString(visibility: string | undefined, defaultValue: ScrollbarVisibility): ScrollbarVisibility {
	if (typeof visibility !== 'string') {
		return defaultValue;
	}
	switch (visibility) {
		case 'hidden': return ScrollbarVisibility.Hidden;
		case 'visible': return ScrollbarVisibility.Visible;
		default: return ScrollbarVisibility.Auto;
	}
}

class EditorScrollbar extends BaseEditorOption<EditorOption.Scrollbar, IEditorScrollbarOptions, InternalEditorScrollbarOptions> {

	constructor() {
		const defaults: InternalEditorScrollbarOptions = {
			vertical: ScrollbarVisibility.Auto,
			horizontal: ScrollbarVisibility.Auto,
			arrowSize: 11,
			useShadows: true,
			verticalHasArrows: false,
			horizontalHasArrows: false,
			horizontalScrollbarSize: 12,
			horizontalSliderSize: 12,
			verticalScrollbarSize: 14,
			verticalSliderSize: 14,
			handleMouseWheel: true,
			alwaysConsumeMouseWheel: true,
			scrollByPage: false
		};
		super(
			EditorOption.Scrollbar, 'scrollbar', defaults,
			{
				'editor.scrollbar.vertical': {
					type: 'string',
					enum: ['auto', 'visible', 'hidden'],
					enumDescriptions: [
						nls.localize('scrollbar.vertical.auto', "The vertical scrollbar will be visible only when necessary."),
						nls.localize('scrollbar.vertical.visible', "The vertical scrollbar will always be visible."),
						nls.localize('scrollbar.vertical.fit', "The vertical scrollbar will always be hidden."),
					],
					default: 'auto',
					description: nls.localize('scrollbar.vertical', "Controls the visibility of the vertical scrollbar.")
				},
				'editor.scrollbar.horizontal': {
					type: 'string',
					enum: ['auto', 'visible', 'hidden'],
					enumDescriptions: [
						nls.localize('scrollbar.horizontal.auto', "The horizontal scrollbar will be visible only when necessary."),
						nls.localize('scrollbar.horizontal.visible', "The horizontal scrollbar will always be visible."),
						nls.localize('scrollbar.horizontal.fit', "The horizontal scrollbar will always be hidden."),
					],
					default: 'auto',
					description: nls.localize('scrollbar.horizontal', "Controls the visibility of the horizontal scrollbar.")
				},
				'editor.scrollbar.verticalScrollbarSize': {
					type: 'number',
					default: defaults.verticalScrollbarSize,
					description: nls.localize('scrollbar.verticalScrollbarSize', "The width of the vertical scrollbar.")
				},
				'editor.scrollbar.horizontalScrollbarSize': {
					type: 'number',
					default: defaults.horizontalScrollbarSize,
					description: nls.localize('scrollbar.horizontalScrollbarSize', "The height of the horizontal scrollbar.")
				},
				'editor.scrollbar.scrollByPage': {
					type: 'boolean',
					default: defaults.scrollByPage,
					description: nls.localize('scrollbar.scrollByPage', "Controls whether clicks scroll by page or jump to click position.")
				}
			}
		);
	}

	public validate(_input: any): InternalEditorScrollbarOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as IEditorScrollbarOptions;
		const horizontalScrollbarSize = EditorIntOption.clampedInt(input.horizontalScrollbarSize, this.defaultValue.horizontalScrollbarSize, 0, 1000);
		const verticalScrollbarSize = EditorIntOption.clampedInt(input.verticalScrollbarSize, this.defaultValue.verticalScrollbarSize, 0, 1000);
		return {
			arrowSize: EditorIntOption.clampedInt(input.arrowSize, this.defaultValue.arrowSize, 0, 1000),
			vertical: _scrollbarVisibilityFromString(input.vertical, this.defaultValue.vertical),
			horizontal: _scrollbarVisibilityFromString(input.horizontal, this.defaultValue.horizontal),
			useShadows: boolean(input.useShadows, this.defaultValue.useShadows),
			verticalHasArrows: boolean(input.verticalHasArrows, this.defaultValue.verticalHasArrows),
			horizontalHasArrows: boolean(input.horizontalHasArrows, this.defaultValue.horizontalHasArrows),
			handleMouseWheel: boolean(input.handleMouseWheel, this.defaultValue.handleMouseWheel),
			alwaysConsumeMouseWheel: boolean(input.alwaysConsumeMouseWheel, this.defaultValue.alwaysConsumeMouseWheel),
			horizontalScrollbarSize: horizontalScrollbarSize,
			horizontalSliderSize: EditorIntOption.clampedInt(input.horizontalSliderSize, horizontalScrollbarSize, 0, 1000),
			verticalScrollbarSize: verticalScrollbarSize,
			verticalSliderSize: EditorIntOption.clampedInt(input.verticalSliderSize, verticalScrollbarSize, 0, 1000),
			scrollByPage: boolean(input.scrollByPage, this.defaultValue.scrollByPage),
		};
	}
}

//#endregion

//#region wrappingIndent

/**
 * Describes how to indent wrapped lines.
 */
export const enum WrappingIndent {
	/**
	 * No indentation => wrapped lines begin at column 1.
	 */
	None = 0,
	/**
	 * Same => wrapped lines get the same indentation as the parent.
	 */
	Same = 1,
	/**
	 * Indent => wrapped lines get +1 indentation toward the parent.
	 */
	Indent = 2,
	/**
	 * DeepIndent => wrapped lines get +2 indentation toward the parent.
	 */
	DeepIndent = 3
}

class WrappingIndentOption extends BaseEditorOption<EditorOption.WrappingIndent, 'none' | 'same' | 'indent' | 'deepIndent', WrappingIndent> {

	constructor() {
		super(EditorOption.WrappingIndent, 'wrappingIndent', WrappingIndent.Same,
			{
				'editor.wrappingIndent': {
					type: 'string',
					enum: ['none', 'same', 'indent', 'deepIndent'],
					enumDescriptions: [
						nls.localize('wrappingIndent.none', "No indentation. Wrapped lines begin at column 1."),
						nls.localize('wrappingIndent.same', "Wrapped lines get the same indentation as the parent."),
						nls.localize('wrappingIndent.indent', "Wrapped lines get +1 indentation toward the parent."),
						nls.localize('wrappingIndent.deepIndent', "Wrapped lines get +2 indentation toward the parent."),
					],
					description: nls.localize('wrappingIndent', "Controls the indentation of wrapped lines."),
					default: 'same'
				}
			}
		);
	}

	public validate(input: any): WrappingIndent {
		switch (input) {
			case 'none': return WrappingIndent.None;
			case 'same': return WrappingIndent.Same;
			case 'indent': return WrappingIndent.Indent;
			case 'deepIndent': return WrappingIndent.DeepIndent;
		}
		return WrappingIndent.Same;
	}

	public override compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: WrappingIndent): WrappingIndent {
		/*
		const accessibilitySupport = options.get(EditorOption.accessibilitySupport);
		if (accessibilitySupport === AccessibilitySupport.Enabled) {
			// if we know for a fact that a screen reader is attached, we use no indent wrapping to
			// help that the editor's wrapping points match the textarea's wrapping points
			return WrappingIndent.None;
		}
		*/
		return value;
	}
}

//#endregion

//#region WrappingStrategy
class WrappingStrategy extends BaseEditorOption<EditorOption.WrappingStrategy, 'simple' | 'advanced', 'simple' | 'advanced'> {

	constructor() {
		super(EditorOption.WrappingStrategy, 'wrappingStrategy', 'simple',
			{
				'editor.wrappingStrategy': {
					enumDescriptions: [
						nls.localize('wrappingStrategy.simple', "Assumes that all characters are of the same width. This is a fast algorithm that works correctly for monospace fonts and certain scripts (like Latin characters) where glyphs are of equal width."),
						nls.localize('wrappingStrategy.advanced', "Delegates wrapping points computation to the browser. This is a slow algorithm, that might cause freezes for large files, but it works correctly in all cases.")
					],
					type: 'string',
					enum: ['simple', 'advanced'],
					default: 'simple',
					description: nls.localize('wrappingStrategy', "Controls the algorithm that computes wrapping points. Note that when in accessibility mode, advanced will be used for the best experience.")
				}
			}
		);
	}

	public validate(input: any): 'simple' | 'advanced' {
		return stringSet<'simple' | 'advanced'>(input, 'simple', ['simple', 'advanced']);
	}

	public override compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: 'simple' | 'advanced'): 'simple' | 'advanced' {
		/*
		const accessibilitySupport = options.get(EditorOption.accessibilitySupport);
		if (accessibilitySupport === AccessibilitySupport.Enabled) {
			// if we know for a fact that a screen reader is attached, we switch our strategy to advanced to
			// help that the editor's wrapping points match the textarea's wrapping points
			return 'advanced';
		}
		*/
		return value;
	}
}
//#endregion

//#region wrappingInfo

export interface EditorWrappingInfo {
	readonly isDominatedByLongLines: boolean;
	readonly isWordWrapMinified: boolean;
	readonly isViewportWrapping: boolean;
	readonly wrappingColumn: number;
}

class EditorWrappingInfoComputer extends ComputedEditorOption<EditorOption.WrappingInfo, EditorWrappingInfo> {

	constructor() {
		super(EditorOption.WrappingInfo);
	}

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, _: EditorWrappingInfo): EditorWrappingInfo {
		const layoutInfo = options.get(EditorOption.LayoutInfo);

		return {
			isDominatedByLongLines: env.isDominatedByLongLines,
			isWordWrapMinified: layoutInfo.isWordWrapMinified,
			isViewportWrapping: layoutInfo.isViewportWrapping,
			wrappingColumn: layoutInfo.wrappingColumn,
		};
	}
}

//#endregion

//#region fontLigatures

/**
 * @internal
 */
export class EditorFontLigatures extends BaseEditorOption<EditorOption.FontLigatures, boolean | string, string> {

	public static OFF = '"liga" off, "calt" off';
	public static ON = '"liga" on, "calt" on';

	constructor() {
		super(
			EditorOption.FontLigatures, 'fontLigatures', EditorFontLigatures.OFF,
			{
				anyOf: [
					{
						type: 'boolean',
						description: nls.localize('fontLigatures', "Enables/Disables font ligatures ('calt' and 'liga' font features). Change this to a string for fine-grained control of the 'font-feature-settings' CSS property."),
					},
					{
						type: 'string',
						description: nls.localize('fontFeatureSettings', "Explicit 'font-feature-settings' CSS property. A boolean can be passed instead if one only needs to turn on/off ligatures.")
					}
				],
				description: nls.localize('fontLigaturesGeneral', "Configures font ligatures or font features. Can be either a boolean to enable/disable ligatures or a string for the value of the CSS 'font-feature-settings' property."),
				default: false
			}
		);
	}

	public validate(input: any): string {
		if (typeof input === 'undefined') {
			return this.defaultValue;
		}
		if (typeof input === 'string') {
			if (input === 'false') {
				return EditorFontLigatures.OFF;
			}
			if (input === 'true') {
				return EditorFontLigatures.ON;
			}
			return input;
		}
		if (Boolean(input)) {
			return EditorFontLigatures.ON;
		}
		return EditorFontLigatures.OFF;
	}
}

//#endregion

/**
 * @internal
 */
export class EditorFontVariations extends BaseEditorOption<EditorOption.FontVariations, boolean | string, string> {
	// Text is laid out using default settings.
	public static OFF = 'normal';

	// Translate `fontWeight` config to the `font-variation-settings` CSS property.
	public static TRANSLATE = 'translate';

	constructor() {
		super(
			EditorOption.FontVariations, 'fontVariations', EditorFontVariations.OFF,
			{
				anyOf: [
					{
						type: 'boolean',
						description: nls.localize('fontVariations', "Enables/Disables the translation from font-weight to font-variation-settings. Change this to a string for fine-grained control of the 'font-variation-settings' CSS property."),
					},
					{
						type: 'string',
						description: nls.localize('fontVariationSettings', "Explicit 'font-variation-settings' CSS property. A boolean can be passed instead if one only needs to translate font-weight to font-variation-settings.")
					}
				],
				description: nls.localize('fontVariationsGeneral', "Configures font variations. Can be either a boolean to enable/disable the translation from font-weight to font-variation-settings or a string for the value of the CSS 'font-variation-settings' property."),
				default: false
			}
		);
	}

	public validate(input: any): string {
		if (typeof input === 'undefined') {
			return this.defaultValue;
		}
		if (typeof input === 'string') {
			if (input === 'false') {
				return EditorFontVariations.OFF;
			}
			if (input === 'true') {
				return EditorFontVariations.TRANSLATE;
			}
			return input;
		}
		if (Boolean(input)) {
			return EditorFontVariations.TRANSLATE;
		}
		return EditorFontVariations.OFF;
	}

	public override compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: string): string {
		// The value is computed from the fontWeight if it is true.
		// So take the result from env.fontInfo
		return env.fontInfo.fontVariationSettings;
	}
}


class EditorFontInfo extends ComputedEditorOption<EditorOption.FontInfo, FontInfo> {

	constructor() {
		super(EditorOption.FontInfo);
	}

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, _: FontInfo): FontInfo {
		return env.fontInfo;
	}
}

//#region fontSize

class EditorFontSize extends SimpleEditorOption<EditorOption.FontSize, number> {

	constructor() {
		super(
			EditorOption.FontSize, 'fontSize', EDITOR_FONT_DEFAULTS.fontSize,
			{
				type: 'number',
				minimum: 6,
				maximum: 100,
				default: EDITOR_FONT_DEFAULTS.fontSize,
				description: nls.localize('fontSize', "Controls the font size in pixels.")
			}
		);
	}

	public override validate(input: any): number {
		const r = EditorFloatOption.float(input, this.defaultValue);
		if (r === 0) {
			return EDITOR_FONT_DEFAULTS.fontSize;
		}
		return EditorFloatOption.clamp(r, 6, 100);
	}
	public override compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: number): number {
		// The final fontSize respects the editor zoom level.
		// So take the result from env.fontInfo
		return env.fontInfo.fontSize;
	}
}

//#endregion

//#region fontWeight

class EditorFontWeight extends BaseEditorOption<EditorOption.FontWeight, string, string> {
	private static SUGGESTION_VALUES = ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
	private static MINIMUM_VALUE = 1;
	private static MAXIMUM_VALUE = 1000;

	constructor() {
		super(
			EditorOption.FontWeight, 'fontWeight', EDITOR_FONT_DEFAULTS.fontWeight,
			{
				anyOf: [
					{
						type: 'number',
						minimum: EditorFontWeight.MINIMUM_VALUE,
						maximum: EditorFontWeight.MAXIMUM_VALUE,
						errorMessage: nls.localize('fontWeightErrorMessage', "Only \"normal\" and \"bold\" keywords or numbers between 1 and 1000 are allowed.")
					},
					{
						type: 'string',
						pattern: '^(normal|bold|1000|[1-9][0-9]{0,2})$'
					},
					{
						enum: EditorFontWeight.SUGGESTION_VALUES
					}
				],
				default: EDITOR_FONT_DEFAULTS.fontWeight,
				description: nls.localize('fontWeight', "Controls the font weight. Accepts \"normal\" and \"bold\" keywords or numbers between 1 and 1000.")
			}
		);
	}

	public validate(input: any): string {
		if (input === 'normal' || input === 'bold') {
			return input;
		}
		return String(EditorIntOption.clampedInt(input, EDITOR_FONT_DEFAULTS.fontWeight, EditorFontWeight.MINIMUM_VALUE, EditorFontWeight.MAXIMUM_VALUE));
	}
}

//#endregion

class EditorLineHeight extends EditorFloatOption<EditorOption.LineHeight> {

	constructor() {
		super(
			EditorOption.LineHeight, 'lineHeight',
			EDITOR_FONT_DEFAULTS.lineHeight,
			x => EditorFloatOption.clamp(x, 0, 150),
			{ markdownDescription: nls.localize('lineHeight', "Controls the line height. \n - Use 0 to automatically compute the line height from the font size.\n - Values between 0 and 8 will be used as a multiplier with the font size.\n - Values greater than or equal to 8 will be used as effective values.") }
		);
	}

	public override compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: number): number {
		// The lineHeight is computed from the fontSize if it is 0.
		// Moreover, the final lineHeight respects the editor zoom level.
		// So take the result from env.fontInfo
		return env.fontInfo.lineHeight;
	}
}

//#region padding

/**
 * Configuration options for editor padding
 */
export interface IEditorPaddingOptions {
	/**
	 * Spacing between top edge of editor and first line.
	 */
	top?: number;
	/**
	 * Spacing between bottom edge of editor and last line.
	 */
	bottom?: number;
}

/**
 * @internal
 */
export type InternalEditorPaddingOptions = Readonly<Required<IEditorPaddingOptions>>;

class EditorPadding extends BaseEditorOption<EditorOption.Padding, IEditorPaddingOptions, InternalEditorPaddingOptions> {

	constructor() {
		super(
			EditorOption.Padding, 'padding', { top: 0, bottom: 0 },
			{
				'editor.padding.top': {
					type: 'number',
					default: 0,
					minimum: 0,
					maximum: 1000,
					description: nls.localize('padding.top', "Controls the amount of space between the top edge of the editor and the first line.")
				},
				'editor.padding.bottom': {
					type: 'number',
					default: 0,
					minimum: 0,
					maximum: 1000,
					description: nls.localize('padding.bottom', "Controls the amount of space between the bottom edge of the editor and the last line.")
				}
			}
		);
	}

	public validate(_input: any): InternalEditorPaddingOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as IEditorPaddingOptions;

		return {
			top: EditorIntOption.clampedInt(input.top, 0, 0, 1000),
			bottom: EditorIntOption.clampedInt(input.bottom, 0, 0, 1000)
		};
	}
}
//#endregion

export const EditorOptions = {
	readOnly: register(new EditorBooleanOption(
		EditorOption.ReadOnly, 'readOnly', false,
	)),
	cursorStyle: register(new EditorEnumOption(
		EditorOption.CursorStyle, 'cursorStyle',
		TextEditorCursorStyle.Line, 'line',
		['line', 'block', 'underline', 'line-thin', 'block-outline', 'underline-thin'],
		_cursorStyleFromString,
		{ description: nls.localize('cursorStyle', "Controls the cursor style.") }
	)),
	cursorBlinking: register(new EditorEnumOption(
		EditorOption.CursorBlinking, 'cursorBlinking',
		TextEditorCursorBlinkingStyle.Blink, 'blink',
		['blink', 'smooth', 'phase', 'expand', 'solid'],
		_cursorBlinkingStyleFromString,
		{ description: nls.localize('cursorBlinking', "Control the cursor animation style.") }
	)),
	cursorSmoothCaretAnimation: register(new EditorStringEnumOption(
		EditorOption.CursorSmoothCaretAnimation, 'cursorSmoothCaretAnimation',
		'off' as 'off' | 'explicit' | 'on',
		['off', 'explicit', 'on'] as const,
		{
			enumDescriptions: [
				nls.localize('cursorSmoothCaretAnimation.off', "Smooth caret animation is disabled."),
				nls.localize('cursorSmoothCaretAnimation.explicit', "Smooth caret animation is enabled only when the user moves the cursor with an explicit gesture."),
				nls.localize('cursorSmoothCaretAnimation.on', "Smooth caret animation is always enabled.")
			],
			description: nls.localize('cursorSmoothCaretAnimation', "Controls whether the smooth caret animation should be enabled.")
		}
	)),
	columnSelection: register(new EditorBooleanOption(
		EditorOption.ColumnSelection, 'columnSelection', false,
		{ description: nls.localize('columnSelection', "Enable that the selection with the mouse and keys is doing column selection.") }
	)),
	disableMonospaceOptimizations: register(new EditorBooleanOption(
		EditorOption.DisableMonospaceOptimizations, 'disableMonospaceOptimizations', false
	)),
	roundedSelection: register(new EditorBooleanOption(
		EditorOption.RoundedSelection, 'roundedSelection', true,
		{ description: nls.localize('roundedSelection', "Controls whether selections should have rounded corners.") }
	)),
	renderControlCharacters: register(new EditorBooleanOption(
		EditorOption.RenderControlCharacters, 'renderControlCharacters', true,
		{ description: nls.localize('renderControlCharacters', "Controls whether the editor should render control characters."), restricted: true }
	)),
	renderWhitespace: register(new EditorStringEnumOption(
		EditorOption.RenderWhitespace, 'renderWhitespace',
		'selection' as 'selection' | 'none' | 'boundary' | 'trailing' | 'all',
		['none', 'boundary', 'selection', 'trailing', 'all'] as const,
		{
			enumDescriptions: [
				'',
				nls.localize('renderWhitespace.boundary', "Render whitespace characters except for single spaces between words."),
				nls.localize('renderWhitespace.selection', "Render whitespace characters only on selected text."),
				nls.localize('renderWhitespace.trailing', "Render only trailing whitespace characters."),
				''
			],
			description: nls.localize('renderWhitespace', "Controls how the editor should render whitespace characters.")
		}
	)),
	stopRenderingLineAfter: register(new EditorIntOption(
		EditorOption.StopRenderingLineAfter, 'stopRenderingLineAfter',
		10000, -1, Constants.MAX_SAFE_SMALL_INTEGER,
	)),
	experimentalWhitespaceRendering: register(new EditorStringEnumOption(
		EditorOption.ExperimentalWhitespaceRendering, 'experimentalWhitespaceRendering',
		'svg' as 'svg' | 'font' | 'off',
		['svg', 'font', 'off'] as const,
		{
			enumDescriptions: [
				nls.localize('experimentalWhitespaceRendering.svg', "Use a new rendering method with svgs."),
				nls.localize('experimentalWhitespaceRendering.font', "Use a new rendering method with font characters."),
				nls.localize('experimentalWhitespaceRendering.off', "Use the stable rendering method."),
			],
			description: nls.localize('experimentalWhitespaceRendering', "Controls whether whitespace is rendered with a new, experimental method.")
		}
	)),
	wordBreak: register(new EditorStringEnumOption(
		EditorOption.WordBreak, 'wordBreak',
		'normal' as 'normal' | 'keepAll',
		['normal', 'keepAll'] as const,
		{
			markdownEnumDescriptions: [
				nls.localize('wordBreak.normal', "Use the default line break rule."),
				nls.localize('wordBreak.keepAll', "Word breaks should not be used for Chinese/Japanese/Korean (CJK) text. Non-CJK text behavior is the same as for normal."),
			],
			description: nls.localize('wordBreak', "Controls the word break rules used for Chinese/Japanese/Korean (CJK) text.")
		}
	)),
	wordWrap: register(new EditorStringEnumOption(
		EditorOption.WordWrap, 'wordWrap',
		'off' as 'off' | 'on' | 'wordWrapColumn' | 'bounded',
		['off', 'on', 'wordWrapColumn', 'bounded'] as const,
		{
			markdownEnumDescriptions: [
				nls.localize('wordWrap.off', "Lines will never wrap."),
				nls.localize('wordWrap.on', "Lines will wrap at the viewport width."),
				nls.localize({
					key: 'wordWrap.wordWrapColumn',
					comment: [
						'- `editor.wordWrapColumn` refers to a different setting and should not be localized.'
					]
				}, "Lines will wrap at `#editor.wordWrapColumn#`."),
				nls.localize({
					key: 'wordWrap.bounded',
					comment: [
						'- viewport means the edge of the visible window size.',
						'- `editor.wordWrapColumn` refers to a different setting and should not be localized.'
					]
				}, "Lines will wrap at the minimum of viewport and `#editor.wordWrapColumn#`."),
			],
			description: nls.localize({
				key: 'wordWrap',
				comment: [
					'- \'off\', \'on\', \'wordWrapColumn\' and \'bounded\' refer to values the setting can take and should not be localized.',
					'- `editor.wordWrapColumn` refers to a different setting and should not be localized.'
				]
			}, "Controls how lines should wrap.")
		}
	)),
	wordWrapBreakAfterCharacters: register(new EditorStringOption(
		EditorOption.WordWrapBreakAfterCharacters, 'wordWrapBreakAfterCharacters',
		// allow-any-unicode-next-line
		' \t})]?|/&.,;¢°′″‰℃、。｡､￠，．：；？！％・･ゝゞヽヾーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ々〻ｧｨｩｪｫｬｭｮｯｰ”〉》」』】〕）］｝｣',
	)),
	wordWrapBreakBeforeCharacters: register(new EditorStringOption(
		EditorOption.WordWrapBreakBeforeCharacters, 'wordWrapBreakBeforeCharacters',
		// allow-any-unicode-next-line
		'([{‘“〈《「『【〔（［｛｢£¥＄￡￥+＋'
	)),
	wordWrapColumn: register(new EditorIntOption(
		EditorOption.WordWrapColumn, 'wordWrapColumn',
		80, 1, Constants.MAX_SAFE_SMALL_INTEGER,
		{
			markdownDescription: nls.localize({
				key: 'wordWrapColumn',
				comment: [
					'- `editor.wordWrap` refers to a different setting and should not be localized.',
					'- \'wordWrapColumn\' and \'bounded\' refer to values the different setting can take and should not be localized.'
				]
			}, "Controls the wrapping column of the editor when `#editor.wordWrap#` is `wordWrapColumn` or `bounded`.")
		}
	)),
	wordWrapOverride1: register(new EditorStringEnumOption(
		EditorOption.WordWrapOverride1, 'wordWrapOverride1',
		'inherit' as 'off' | 'on' | 'inherit',
		['off', 'on', 'inherit'] as const
	)),
	wordWrapOverride2: register(new EditorStringEnumOption(
		EditorOption.WordWrapOverride2, 'wordWrapOverride2',
		'inherit' as 'off' | 'on' | 'inherit',
		['off', 'on', 'inherit'] as const
	)),
	fontFamily: register(new EditorStringOption(
		EditorOption.FontFamily, 'fontFamily', EDITOR_FONT_DEFAULTS.fontFamily,
		{ description: nls.localize('fontFamily', "Controls the font family.") }
	)),
	fontInfo: register(new EditorFontInfo()),
	fontLigatures: register(new EditorFontLigatures()),
	fontSize: register(new EditorFontSize()),
	fontWeight: register(new EditorFontWeight()),
	fontVariations: register(new EditorFontVariations()),
	letterSpacing: register(new EditorFloatOption(
		EditorOption.LetterSpacing, 'letterSpacing',
		EDITOR_FONT_DEFAULTS.letterSpacing, x => EditorFloatOption.clamp(x, -5, 20),
		{ description: nls.localize('letterSpacing', "Controls the letter spacing in pixels.") }
	)),
	lineHeight: register(new EditorLineHeight()),
	scrollbar: register(new EditorScrollbar()),
	padding: register(new EditorPadding()),

	// Leave these at the end (because they have dependencies!)
	layoutInfo: register(new EditorLayoutInfoComputer()),
	wrappingInfo: register(new EditorWrappingInfoComputer()),
	wrappingIndent: register(new WrappingIndentOption()),
	wrappingStrategy: register(new WrappingStrategy())
};

type EditorOptionsType = typeof EditorOptions;
type FindEditorOptionsKeyById<T extends EditorOption> = { [K in keyof EditorOptionsType]: EditorOptionsType[K]['id'] extends T ? K : never }[keyof EditorOptionsType];
type ComputedEditorOptionValue<T extends IEditorOption<any, any>> = T extends IEditorOption<any, infer R> ? R : never;
export type FindComputedEditorOptionValueById<T extends EditorOption> = NonNullable<ComputedEditorOptionValue<EditorOptionsType[FindEditorOptionsKeyById<T>]>>;

