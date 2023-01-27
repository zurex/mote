import * as browser from 'mote/base/browser/browser';
import * as platform from 'mote/base/common/platform';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewController } from 'mote/editor/browser/view/viewController';
import { createFastDomNode, FastDomNode } from 'mote/base/browser/fastDomNode';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IVisibleLine } from 'mote/editor/browser/view/viewLayer';
import { IViewLineContributionDescription, ViewLineExtensionsRegistry } from 'mote/editor/browser/viewLineExtensions';
import { IViewLineContribution } from 'mote/editor/browser/editorBrowser';
import { ViewportData } from 'mote/editor/common/viewLayout/viewLinesViewportData';
import { StringBuilder } from 'mote/editor/common/core/stringBuilder';
import { CharacterMapping, DomPosition, ForeignElementType, RenderLineInput, renderViewLine } from 'mote/editor/browser/viewParts/lines/viewLineRenderer';
import { FloatHorizontalRange, VisibleRanges } from 'mote/editor/browser/view/renderingContext';
import { ColorScheme } from 'mote/platform/theme/common/theme';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { EditorFontLigatures, EditorOption } from 'mote/editor/common/config/editorOptions';
import { DomEmitter } from 'mote/base/browser/event';
import { RangeUtil } from 'mote/editor/browser/viewParts/lines/rangeUtil';

let monospaceAssumptionsAreValid = true;

const canUseFastRenderedViewLine = (function () {
	if (platform.isNative) {
		// In VSCode we know very well when the zoom level changes
		return true;
	}

	if (platform.isLinux || browser.isFirefox || browser.isSafari) {
		// On Linux, it appears that zooming affects char widths (in pixels), which is unexpected.
		// --
		// Even though we read character widths correctly, having read them at a specific zoom level
		// does not mean they are the same at the current zoom level.
		// --
		// This could be improved if we ever figure out how to get an event when browsers zoom,
		// but until then we have to stick with reading client rects.
		// --
		// The same has been observed with Firefox on Windows7
		// --
		// The same has been oversved with Safari
		return false;
	}

	return true;
})();

export class DomReadingContext {

	private readonly _domNode: HTMLElement;
	private _clientRectDeltaLeft: number;
	private _clientRectScale: number;
	private _clientRectRead: boolean;

	private readClientRect(): void {
		if (!this._clientRectRead) {
			this._clientRectRead = true;
			const rect = this._domNode.getBoundingClientRect();
			this._clientRectDeltaLeft = rect.left;
			this._clientRectScale = rect.width / this._domNode.offsetWidth;
		}
	}

	public get clientRectDeltaLeft(): number {
		if (!this._clientRectRead) {
			this.readClientRect();
		}
		return this._clientRectDeltaLeft;
	}

	public get clientRectScale(): number {
		if (!this._clientRectRead) {
			this.readClientRect();
		}
		return this._clientRectScale;
	}

	public readonly endNode: HTMLElement;

	constructor(domNode: HTMLElement, endNode: HTMLElement) {
		this._domNode = domNode;
		this._clientRectDeltaLeft = 0;
		this._clientRectScale = 1;
		this._clientRectRead = false;
		this.endNode = endNode;
	}
}

export class ViewLineOptions {
	public readonly themeType: ColorScheme;
	public readonly renderWhitespace: 'none' | 'boundary' | 'selection' | 'trailing' | 'all';
	public readonly renderControlCharacters: boolean;
	public readonly spaceWidth: number;
	public readonly middotWidth: number;
	public readonly wsmiddotWidth: number;
	public readonly useMonospaceOptimizations: boolean;
	public readonly canUseHalfwidthRightwardsArrow: boolean;
	public readonly lineHeight: number;
	public readonly stopRenderingLineAfter: number;
	public readonly fontLigatures: string;

	constructor(config: IEditorConfiguration, themeType: ColorScheme) {
		this.themeType = themeType;
		const options = config.options;
		const fontInfo = options.get(EditorOption.FontInfo);
		const experimentalWhitespaceRendering = options.get(EditorOption.ExperimentalWhitespaceRendering);
		if (experimentalWhitespaceRendering === 'off') {
			this.renderWhitespace = options.get(EditorOption.RenderWhitespace);
		} else {
			// whitespace is rendered in a different layer
			this.renderWhitespace = 'none';
		}
		this.renderControlCharacters = options.get(EditorOption.RenderControlCharacters);
		this.spaceWidth = fontInfo.spaceWidth;
		this.middotWidth = fontInfo.middotWidth;
		this.wsmiddotWidth = fontInfo.wsmiddotWidth;
		this.useMonospaceOptimizations = (
			fontInfo.isMonospace
			&& !options.get(EditorOption.DisableMonospaceOptimizations)
		);
		this.canUseHalfwidthRightwardsArrow = fontInfo.canUseHalfwidthRightwardsArrow;
		this.lineHeight = options.get(EditorOption.LineHeight);
		this.stopRenderingLineAfter = options.get(EditorOption.StopRenderingLineAfter);
		this.fontLigatures = options.get(EditorOption.FontLigatures);
	}

	public equals(other: ViewLineOptions): boolean {
		return (
			this.themeType === other.themeType
			&& this.renderWhitespace === other.renderWhitespace
			&& this.renderControlCharacters === other.renderControlCharacters
			&& this.spaceWidth === other.spaceWidth
			&& this.middotWidth === other.middotWidth
			&& this.wsmiddotWidth === other.wsmiddotWidth
			&& this.useMonospaceOptimizations === other.useMonospaceOptimizations
			&& this.canUseHalfwidthRightwardsArrow === other.canUseHalfwidthRightwardsArrow
			&& this.lineHeight === other.lineHeight
			&& this.stopRenderingLineAfter === other.stopRenderingLineAfter
			&& this.fontLigatures === other.fontLigatures
		);
	}
}

export class EmptyViewLine extends Disposable {

	private domNode: FastDomNode<HTMLElement> = createFastDomNode(document.createElement('div'));

	public readonly onClick = this._register(new DomEmitter(this.domNode.domNode, 'click')).event;


	constructor(
		private readonly viewController: ViewController,
	) {
		super();
		this.domNode.setClassName('view-line');
		this.domNode.domNode.style.cursor = 'pointer';
		this.onClick((e) => this.viewController.enter());
	}

	renderLine() {
		this.domNode.domNode.innerText = 'Click to continue';
	}

	getDomNode() {
		return this.domNode.domNode;
	}
}

export class ViewLine implements IVisibleLine {
	public static readonly CLASS_NAME = 'view-line';

	private _isMaybeInvalid: boolean = true;
	private _renderedViewLine: IRenderedViewLine | null = null;

	constructor(
		private readonly options: ViewLineOptions,
		private readonly viewContext: ViewContext,
		private readonly viewController: ViewController,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {

	}

	layoutLine(lineNumber: number, deltaTop: number): void {
		if (this._renderedViewLine && this._renderedViewLine.domNode) {
			this._renderedViewLine.domNode.setTop(deltaTop);
			//this._renderedViewLine.domNode.setHeight(this.options.lineHeight);
		}
	}

	onContentChanged(): void {
		this._isMaybeInvalid = true;
	}

	public getDomNode(): HTMLElement | null {
		if (this._renderedViewLine && this._renderedViewLine.domNode) {
			return this._renderedViewLine.domNode.domNode;
		}
		return null;
	}

	public setDomNode(domNode: HTMLElement) {
		if (this._renderedViewLine) {
			this._renderedViewLine.domNode = createFastDomNode(domNode);
		} else {
			throw new Error('I have no rendered view line to set the dom node to...');
		}
	}

	public renderLine(lineNumber: number, deltaTop: number, viewportData: ViewportData, sb: StringBuilder) {
		if (this._isMaybeInvalid === false) {
			// it appears that nothing relevant has changed
			return false;
		}

		this._isMaybeInvalid = false;

		const lineData = viewportData.getViewLineRenderingData(lineNumber);

		const renderLineInput = new RenderLineInput(
			lineData.store,
			lineNumber,
			this.options.useMonospaceOptimizations,
			this.options.canUseHalfwidthRightwardsArrow,
			lineData.content,
			lineData.continuesWithWrappedLine,
			lineData.isBasicASCII,
			lineData.containsRTL,
			lineData.minColumn - 1,
			lineData.tokens,
			lineData.tabSize,
			lineData.startVisibleColumn,
			this.options.spaceWidth,
			this.options.middotWidth,
			this.options.wsmiddotWidth,
			this.options.stopRenderingLineAfter,
			this.options.renderWhitespace,
			this.options.renderControlCharacters,
			this.options.fontLigatures !== EditorFontLigatures.OFF,
			[]
		);

		if (this._renderedViewLine && this._renderedViewLine.input.equals(renderLineInput)) {
			// no need to do anything, we have the same render input
			return false;
		}

		// create IViewLineContribution
		const store = lineData.store;
		const type = store.getType() || 'text';
		const contributions = ViewLineExtensionsRegistry.getViewLineContributions();
		const contribution: IViewLineContributionDescription = contributions.get(type) || contributions.get('text')!;
		const viewBlock: IViewLineContribution = this.instantiationService.createInstance(
			contribution.ctor, lineNumber, this.viewContext, this.viewController, {});

		sb.appendString('<div style="top:');
		sb.appendString(String(deltaTop));
		sb.appendString('px;" class="');
		sb.appendString(ViewLine.CLASS_NAME);
		sb.appendString('" data-index="');
		sb.appendString(lineNumber.toString());
		sb.appendString('" data-block-id="');
		sb.appendString(store.id);
		sb.appendString('">');

		const output = renderViewLine(renderLineInput, viewBlock, sb);

		sb.appendString('</div>');

		let renderedViewLine: IRenderedViewLine | null = null;
		if (monospaceAssumptionsAreValid && canUseFastRenderedViewLine && lineData.isBasicASCII && this.options.useMonospaceOptimizations && output.containsForeignElements === ForeignElementType.None) {
			renderedViewLine = new FastRenderedViewLine(
				this._renderedViewLine ? this._renderedViewLine.domNode : null,
				renderLineInput,
				output.characterMapping
			);
		}

		if (!renderedViewLine) {
			renderedViewLine = createRenderedLine(
				this._renderedViewLine ? this._renderedViewLine.domNode : null,
				renderLineInput,
				output.characterMapping,
				output.containsRTL,
				output.containsForeignElements
			);
		}


		this._renderedViewLine = renderedViewLine;
		return true;
	}

	public getWidth(): number {
		if (!this._renderedViewLine) {
			return 0;
		}
		return this._renderedViewLine.getWidth();
	}

	public getVisibleRangesForRange(lineNumber: number, startColumn: number, endColumn: number, context: DomReadingContext): VisibleRanges | null {
		if (!this._renderedViewLine) {
			return null;
		}

		startColumn = Math.min(this._renderedViewLine.input.lineContent.length + 1, Math.max(1, startColumn));
		endColumn = Math.min(this._renderedViewLine.input.lineContent.length + 1, Math.max(1, endColumn));

		const stopRenderingLineAfter = this._renderedViewLine.input.stopRenderingLineAfter;

		if (stopRenderingLineAfter !== -1 && startColumn > stopRenderingLineAfter + 1 && endColumn > stopRenderingLineAfter + 1) {
			// This range is obviously not visible
			return new VisibleRanges(true, [new FloatHorizontalRange(this.getWidth(), 0)]);
		}

		if (stopRenderingLineAfter !== -1 && startColumn > stopRenderingLineAfter + 1) {
			startColumn = stopRenderingLineAfter + 1;
		}

		if (stopRenderingLineAfter !== -1 && endColumn > stopRenderingLineAfter + 1) {
			endColumn = stopRenderingLineAfter + 1;
		}

		const horizontalRanges = this._renderedViewLine.getVisibleRangesForRange(lineNumber, startColumn, endColumn, context);
		if (horizontalRanges && horizontalRanges.length > 0) {
			if (this._renderedViewLine instanceof FastRenderedViewLine) {
				// horizontalRanges in fast way need add offset
				horizontalRanges[0].left += this.getDomNode()!.offsetLeft;
			}
			return new VisibleRanges(false, horizontalRanges);
		}

		return null;
	}

	public getColumnOfNodeOffset(lineNumber: number, spanNode: HTMLElement, offset: number): number {
		if (!this._renderedViewLine) {
			return 1;
		}
		return this._renderedViewLine.getColumnOfNodeOffset(lineNumber, spanNode, offset);
	}
}

interface IRenderedViewLine {
	domNode: FastDomNode<HTMLElement> | null;
	readonly input: RenderLineInput;
	getWidth(): number;
	getWidthIsFast(): boolean;
	getVisibleRangesForRange(lineNumber: number, startColumn: number, endColumn: number, context: DomReadingContext): FloatHorizontalRange[] | null;
	getColumnOfNodeOffset(lineNumber: number, spanNode: HTMLElement, offset: number): number;
}

const enum Constants {
	/**
	 * It seems that rounding errors occur with long lines, so the purely multiplication based
	 * method is only viable for short lines. For longer lines, we look up the real position of
	 * every 300th character and use multiplication based on that.
	 *
	 * See https://github.com/microsoft/vscode/issues/33178
	 */
	MaxMonospaceDistance = 300
}

/**
 * A rendered line which is guaranteed to contain only regular ASCII and is rendered with a monospace font.
 */
class FastRenderedViewLine implements IRenderedViewLine {

	public domNode: FastDomNode<HTMLElement> | null;
	public readonly input: RenderLineInput;

	private readonly _characterMapping: CharacterMapping;
	private readonly _charWidth: number;
	private readonly _keyColumnPixelOffsetCache: Float32Array | null;
	private _cachedWidth: number = -1;

	constructor(domNode: FastDomNode<HTMLElement> | null, renderLineInput: RenderLineInput, characterMapping: CharacterMapping) {
		this.domNode = domNode;
		this.input = renderLineInput;
		const keyColumnCount = Math.floor(renderLineInput.lineContent.length / Constants.MaxMonospaceDistance);
		if (keyColumnCount > 0) {
			this._keyColumnPixelOffsetCache = new Float32Array(keyColumnCount);
			for (let i = 0; i < keyColumnCount; i++) {
				this._keyColumnPixelOffsetCache[i] = -1;
			}
		} else {
			this._keyColumnPixelOffsetCache = null;
		}

		this._characterMapping = characterMapping;
		this._charWidth = renderLineInput.spaceWidth;
	}

	public getWidth(): number {
		if (!this.domNode || this.input.lineContent.length < Constants.MaxMonospaceDistance) {
			const horizontalOffset = this._characterMapping.getHorizontalOffset(this._characterMapping.length);
			return Math.round(this._charWidth * horizontalOffset);
		}
		if (this._cachedWidth === -1) {
			this._cachedWidth = this._getReadingTarget(this.domNode).offsetWidth;
		}
		return this._cachedWidth;
	}

	public getWidthIsFast(): boolean {
		return (this.input.lineContent.length < Constants.MaxMonospaceDistance);
	}

	public monospaceAssumptionsAreValid(): boolean {
		if (!this.domNode) {
			return monospaceAssumptionsAreValid;
		}
		if (this.input.lineContent.length < Constants.MaxMonospaceDistance) {
			const expectedWidth = this.getWidth();
			const actualWidth = (<HTMLSpanElement>this.domNode.domNode.firstChild).offsetWidth;
			if (Math.abs(expectedWidth - actualWidth) >= 2) {
				// more than 2px off
				console.warn(`monospace assumptions have been violated, therefore disabling monospace optimizations!`);
				monospaceAssumptionsAreValid = false;
			}
		}
		return monospaceAssumptionsAreValid;
	}

	public toSlowRenderedLine(): RenderedViewLine {
		return createRenderedLine(this.domNode, this.input, this._characterMapping, false, ForeignElementType.None);
	}

	public getVisibleRangesForRange(lineNumber: number, startColumn: number, endColumn: number, context: DomReadingContext): FloatHorizontalRange[] | null {
		const startPosition = this._getColumnPixelOffset(lineNumber, startColumn, context);
		const endPosition = this._getColumnPixelOffset(lineNumber, endColumn, context);
		return [new FloatHorizontalRange(startPosition, endPosition - startPosition)];
	}

	private _getColumnPixelOffset(lineNumber: number, column: number, context: DomReadingContext): number {
		if (column <= Constants.MaxMonospaceDistance) {
			const horizontalOffset = this._characterMapping.getHorizontalOffset(column);
			return this._charWidth * horizontalOffset;
		}

		const keyColumnOrdinal = Math.floor((column - 1) / Constants.MaxMonospaceDistance) - 1;
		const keyColumn = (keyColumnOrdinal + 1) * Constants.MaxMonospaceDistance + 1;
		let keyColumnPixelOffset = -1;
		if (this._keyColumnPixelOffsetCache) {
			keyColumnPixelOffset = this._keyColumnPixelOffsetCache[keyColumnOrdinal];
			if (keyColumnPixelOffset === -1) {
				keyColumnPixelOffset = this._actualReadPixelOffset(lineNumber, keyColumn, context);
				this._keyColumnPixelOffsetCache[keyColumnOrdinal] = keyColumnPixelOffset;
			}
		}

		if (keyColumnPixelOffset === -1) {
			// Could not read actual key column pixel offset
			const horizontalOffset = this._characterMapping.getHorizontalOffset(column);
			return this._charWidth * horizontalOffset;
		}

		const keyColumnHorizontalOffset = this._characterMapping.getHorizontalOffset(keyColumn);
		const horizontalOffset = this._characterMapping.getHorizontalOffset(column);
		return keyColumnPixelOffset + this._charWidth * (horizontalOffset - keyColumnHorizontalOffset);
	}

	private _getReadingTarget(myDomNode: FastDomNode<HTMLElement>): HTMLElement {
		return <HTMLSpanElement>myDomNode.domNode.firstChild;
	}

	private _actualReadPixelOffset(lineNumber: number, column: number, context: DomReadingContext): number {
		if (!this.domNode) {
			return -1;
		}
		const domPosition = this._characterMapping.getDomPosition(column);
		const r = RangeUtil.readHorizontalRanges(this._getReadingTarget(this.domNode), domPosition.partIndex, domPosition.charIndex, domPosition.partIndex, domPosition.charIndex, context.clientRectDeltaLeft, context.clientRectScale, context.endNode);
		if (!r || r.length === 0) {
			return -1;
		}
		return r[0].left;
	}

	public getColumnOfNodeOffset(lineNumber: number, spanNode: HTMLElement, offset: number): number {
		const spanNodeTextContentLength = spanNode.textContent!.length;

		let spanIndex = -1;
		while (spanNode) {
			spanNode = <HTMLElement>spanNode.previousSibling;
			spanIndex++;
		}

		return this._characterMapping.getColumn(new DomPosition(spanIndex, offset), spanNodeTextContentLength);
	}
}

/**
 * Every time we render a line, we save what we have rendered in an instance of this class.
 */
class RenderedViewLine implements IRenderedViewLine {

	public domNode: FastDomNode<HTMLElement> | null;
	public readonly input: RenderLineInput;

	protected readonly _characterMapping: CharacterMapping;
	private readonly _isWhitespaceOnly: boolean;
	private readonly _containsForeignElements: ForeignElementType;
	private _cachedWidth: number;

	/**
	 * This is a map that is used only when the line is guaranteed to have no RTL text.
	 */
	private readonly _pixelOffsetCache: Float32Array | null;

	constructor(domNode: FastDomNode<HTMLElement> | null, renderLineInput: RenderLineInput, characterMapping: CharacterMapping, containsRTL: boolean, containsForeignElements: ForeignElementType) {
		this.domNode = domNode;
		this.input = renderLineInput;
		this._characterMapping = characterMapping;
		this._isWhitespaceOnly = /^\s*$/.test(renderLineInput.lineContent);
		this._containsForeignElements = containsForeignElements;
		this._cachedWidth = -1;

		this._pixelOffsetCache = null;
		if (!containsRTL || this._characterMapping.length === 0 /* the line is empty */) {
			this._pixelOffsetCache = new Float32Array(Math.max(2, this._characterMapping.length + 1));
			for (let column = 0, len = this._characterMapping.length; column <= len; column++) {
				this._pixelOffsetCache[column] = -1;
			}
		}
	}

	// --- Reading from the DOM methods

	protected _getReadingTarget(myDomNode: FastDomNode<HTMLElement>): HTMLElement {
		return <HTMLSpanElement>myDomNode.domNode.firstChild;
	}

	/**
	 * Width of the line in pixels
	 */
	public getWidth(): number {
		if (!this.domNode) {
			return 0;
		}
		if (this._cachedWidth === -1) {
			this._cachedWidth = this._getReadingTarget(this.domNode).offsetWidth;
		}
		return this._cachedWidth;
	}

	public getWidthIsFast(): boolean {
		if (this._cachedWidth === -1) {
			return false;
		}
		return true;
	}

	/**
	 * Visible ranges for a model range
	 */
	public getVisibleRangesForRange(lineNumber: number, startColumn: number, endColumn: number, context: DomReadingContext): FloatHorizontalRange[] | null {
		if (!this.domNode) {
			return null;
		}
		if (this._pixelOffsetCache !== null) {
			// the text is LTR
			const startOffset = this._readPixelOffset(this.domNode, lineNumber, startColumn, context);
			if (startOffset === -1) {
				return null;
			}

			const endOffset = this._readPixelOffset(this.domNode, lineNumber, endColumn, context);
			if (endOffset === -1) {
				return null;
			}

			return [new FloatHorizontalRange(startOffset, endOffset - startOffset)];
		}

		return this._readVisibleRangesForRange(this.domNode, lineNumber, startColumn, endColumn, context);
	}

	protected _readVisibleRangesForRange(domNode: FastDomNode<HTMLElement>, lineNumber: number, startColumn: number, endColumn: number, context: DomReadingContext): FloatHorizontalRange[] | null {
		if (startColumn === endColumn) {
			const pixelOffset = this._readPixelOffset(domNode, lineNumber, startColumn, context);
			if (pixelOffset === -1) {
				return null;
			} else {
				return [new FloatHorizontalRange(pixelOffset, 0)];
			}
		} else {
			return this._readRawVisibleRangesForRange(domNode, startColumn, endColumn, context);
		}
	}

	protected _readPixelOffset(domNode: FastDomNode<HTMLElement>, lineNumber: number, column: number, context: DomReadingContext): number {
		if (this._characterMapping.length === 0) {
			// This line has no content
			if (this._containsForeignElements === ForeignElementType.None) {
				// We can assume the line is really empty
				return 0;
			}
			if (this._containsForeignElements === ForeignElementType.After) {
				// We have foreign elements after the (empty) line
				return 0;
			}
			if (this._containsForeignElements === ForeignElementType.Before) {
				// We have foreign elements before the (empty) line
				return this.getWidth();
			}
			// We have foreign elements before & after the (empty) line
			const readingTarget = this._getReadingTarget(domNode);
			if (readingTarget.firstChild) {
				return (<HTMLSpanElement>readingTarget.firstChild).offsetWidth;
			} else {
				return 0;
			}
		}

		if (this._pixelOffsetCache !== null) {
			// the text is LTR

			const cachedPixelOffset = this._pixelOffsetCache[column];
			if (cachedPixelOffset !== -1) {
				return cachedPixelOffset;
			}

			const result = this._actualReadPixelOffset(domNode, lineNumber, column, context);
			this._pixelOffsetCache[column] = result;
			return result;
		}

		return this._actualReadPixelOffset(domNode, lineNumber, column, context);
	}

	private _actualReadPixelOffset(domNode: FastDomNode<HTMLElement>, lineNumber: number, column: number, context: DomReadingContext): number {
		if (this._characterMapping.length === 0) {
			// This line has no content
			const r = RangeUtil.readHorizontalRanges(this._getReadingTarget(domNode), 0, 0, 0, 0, context.clientRectDeltaLeft, context.clientRectScale, context.endNode);
			if (!r || r.length === 0) {
				return -1;
			}
			return r[0].left;
		}

		if (column === this._characterMapping.length && this._isWhitespaceOnly && this._containsForeignElements === ForeignElementType.None) {
			// This branch helps in the case of whitespace only lines which have a width set
			return this.getWidth();
		}

		const domPosition = this._characterMapping.getDomPosition(column);

		const r = RangeUtil.readHorizontalRanges(this._getReadingTarget(domNode), domPosition.partIndex, domPosition.charIndex, domPosition.partIndex, domPosition.charIndex, context.clientRectDeltaLeft, context.clientRectScale, context.endNode);
		if (!r || r.length === 0) {
			return -1;
		}
		const result = r[0].left;
		if (this.input.isBasicASCII) {
			const horizontalOffset = this._characterMapping.getHorizontalOffset(column);
			const expectedResult = Math.round(this.input.spaceWidth * horizontalOffset);
			if (Math.abs(expectedResult - result) <= 1) {
				return expectedResult;
			}
		}
		return result;
	}

	private _readRawVisibleRangesForRange(domNode: FastDomNode<HTMLElement>, startColumn: number, endColumn: number, context: DomReadingContext): FloatHorizontalRange[] | null {

		if (startColumn === 1 && endColumn === this._characterMapping.length) {
			// This branch helps IE with bidi text & gives a performance boost to other browsers when reading visible ranges for an entire line

			return [new FloatHorizontalRange(0, this.getWidth())];
		}

		const startDomPosition = this._characterMapping.getDomPosition(startColumn);
		const endDomPosition = this._characterMapping.getDomPosition(endColumn);

		return RangeUtil.readHorizontalRanges(this._getReadingTarget(domNode), startDomPosition.partIndex, startDomPosition.charIndex, endDomPosition.partIndex, endDomPosition.charIndex, context.clientRectDeltaLeft, context.clientRectScale, context.endNode);
	}

	/**
	 * Returns the column for the text found at a specific offset inside a rendered dom node
	 */
	public getColumnOfNodeOffset(lineNumber: number, spanNode: HTMLElement, offset: number): number {
		const spanNodeTextContentLength = spanNode.textContent!.length;

		let spanIndex = -1;
		while (spanNode) {
			spanNode = <HTMLElement>spanNode.previousSibling;
			spanIndex++;
		}

		return this._characterMapping.getColumn(new DomPosition(spanIndex, offset), spanNodeTextContentLength);
	}
}

class WebKitRenderedViewLine extends RenderedViewLine {
	protected override _readVisibleRangesForRange(domNode: FastDomNode<HTMLElement>, lineNumber: number, startColumn: number, endColumn: number, context: DomReadingContext): FloatHorizontalRange[] | null {
		const output = super._readVisibleRangesForRange(domNode, lineNumber, startColumn, endColumn, context);

		if (!output || output.length === 0 || startColumn === endColumn || (startColumn === 1 && endColumn === this._characterMapping.length)) {
			return output;
		}

		// WebKit is buggy and returns an expanded range (to contain words in some cases)
		// The last client rect is enlarged (I think)
		if (!this.input.containsRTL) {
			// This is an attempt to patch things up
			// Find position of last column
			const endPixelOffset = this._readPixelOffset(domNode, lineNumber, endColumn, context);
			if (endPixelOffset !== -1) {
				const lastRange = output[output.length - 1];
				if (lastRange.left < endPixelOffset) {
					// Trim down the width of the last visible range to not go after the last column's position
					lastRange.width = endPixelOffset - lastRange.left;
				}
			}
		}

		return output;
	}
}

const createRenderedLine: (domNode: FastDomNode<HTMLElement> | null, renderLineInput: RenderLineInput, characterMapping: CharacterMapping, containsRTL: boolean, containsForeignElements: ForeignElementType) => RenderedViewLine = (function () {
	if (browser.isWebKit) {
		return createWebKitRenderedLine;
	}
	return createNormalRenderedLine;
})();

function createWebKitRenderedLine(domNode: FastDomNode<HTMLElement> | null, renderLineInput: RenderLineInput, characterMapping: CharacterMapping, containsRTL: boolean, containsForeignElements: ForeignElementType): RenderedViewLine {
	return new WebKitRenderedViewLine(domNode, renderLineInput, characterMapping, containsRTL, containsForeignElements);
}

function createNormalRenderedLine(domNode: FastDomNode<HTMLElement> | null, renderLineInput: RenderLineInput, characterMapping: CharacterMapping, containsRTL: boolean, containsForeignElements: ForeignElementType): RenderedViewLine {
	return new RenderedViewLine(domNode, renderLineInput, characterMapping, containsRTL, containsForeignElements);
}
