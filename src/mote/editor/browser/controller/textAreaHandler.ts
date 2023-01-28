import 'vs/css!./textAreaHandler';
import * as browser from 'mote/base/browser/browser';
import * as platform from 'mote/base/common/platform';

import { ClipboardDataToCopy, ITextAreaInputHost, TextAreaInput, TextAreaWrapper } from 'mote/editor/browser/controller/textAreaInput';
import { ITypeData, TextAreaState, _debugComposition } from 'mote/editor/browser/controller/textAreaState';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { PartFingerprint, PartFingerprints, ViewPart } from 'mote/editor/browser/view/viewPart';
import { Position } from 'mote/editor/common/core/position';
import { createFastDomNode, FastDomNode } from 'mote/base/browser/fastDomNode';
import { EditorOption } from 'mote/editor/common/config/editorOptions';
import { HorizontalPosition, ViewRenderingContext } from 'mote/editor/browser/view/renderingContext';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import * as viewEvents from 'mote/editor/common/viewEvents';
import { Color } from 'mote/base/common/color';
import { ColorId, ITokenPresentation } from 'mote/editor/common/encodedTokenAttributes';
import { ViewController } from 'mote/editor/browser/view/viewController';

export interface IVisibleRangeProvider {
	visibleRangeForPosition(position: Position): HorizontalPosition | null;
}

class VisibleTextAreaData {
	_visibleTextAreaBrand: void = undefined;

	public startPosition: Position | null = null;
	public endPosition: Position | null = null;

	public visibleTextareaStart: HorizontalPosition | null = null;
	public visibleTextareaEnd: HorizontalPosition | null = null;

	/**
	 * When doing composition, the currently composed text might be split up into
	 * multiple tokens, then merged again into a single token, etc. Here we attempt
	 * to keep the presentation of the <textarea> stable by using the previous used
	 * style if multiple tokens come into play. This avoids flickering.
	 */
	private _previousPresentation: ITokenPresentation | null = null;

	constructor(
		private readonly _context: ViewContext,
		public readonly modelLineNumber: number,
		public readonly distanceToModelLineStart: number,
		public readonly widthOfHiddenLineTextBefore: number,
		public readonly distanceToModelLineEnd: number,
	) {
	}

	prepareRender(visibleRangeProvider: IVisibleRangeProvider): void {
		const startModelPosition = new Position(this.modelLineNumber, this.distanceToModelLineStart + 1);
		const endModelPosition = new Position(this.modelLineNumber, this._context.viewModel.model.getLineMaxColumn(this.modelLineNumber) - this.distanceToModelLineEnd);

		this.startPosition = this._context.viewModel.coordinatesConverter.convertModelPositionToViewPosition(startModelPosition);
		this.endPosition = this._context.viewModel.coordinatesConverter.convertModelPositionToViewPosition(endModelPosition);

		if (this.startPosition.lineNumber === this.endPosition.lineNumber) {
			this.visibleTextareaStart = visibleRangeProvider.visibleRangeForPosition(this.startPosition);
			this.visibleTextareaEnd = visibleRangeProvider.visibleRangeForPosition(this.endPosition);
		} else {
			// TODO: what if the view positions are not on the same line?
			this.visibleTextareaStart = null;
			this.visibleTextareaEnd = null;
		}
	}

	definePresentation(tokenPresentation: ITokenPresentation | null): ITokenPresentation {
		if (!this._previousPresentation) {
			// To avoid flickering, once set, always reuse a presentation throughout the entire IME session
			if (tokenPresentation) {
				this._previousPresentation = tokenPresentation;
			} else {
				this._previousPresentation = {
					foreground: ColorId.DefaultForeground,
					italic: false,
					bold: false,
					underline: false,
					strikethrough: false,
				};
			}
		}
		return this._previousPresentation;
	}
}

const canUseZeroSizeTextarea = (browser.isFirefox);

export class TextAreaHandler extends ViewPart {

	private _scrollLeft: number;
	private _scrollTop: number;

	private _textAreaWrapping!: boolean;
	private _textAreaWidth!: number;
	private _contentLeft: number;
	private _contentWidth: number;
	private _contentHeight: number;

	/**
	 * Defined only when the text area is visible (composition case).
	 */
	private _visibleTextArea: VisibleTextAreaData | null;
	private _selections: EditorSelection[];
	private _modelSelections: EditorSelection[];

	/**
	 * The position at which the textarea was rendered.
	 * This is useful for hit-testing and determining the mouse position.
	 */
	private _lastRenderPosition: Position | null;

	public readonly textArea: FastDomNode<HTMLTextAreaElement>;
	public readonly textAreaCover: FastDomNode<HTMLElement>;
	private readonly _textAreaInput: TextAreaInput;

	constructor(context: ViewContext, private readonly viewController: ViewController) {
		super(context);

		this._scrollLeft = 0;
		this._scrollTop = 0;

		const options = this.context.configuration.options;
		const layoutInfo = options.get(EditorOption.LayoutInfo);

		this._contentLeft = layoutInfo.contentLeft;
		this._contentWidth = layoutInfo.contentWidth;
		this._contentHeight = layoutInfo.height;

		this._visibleTextArea = null;
		this._selections = [new EditorSelection(1, 1, 1, 1)];
		this._modelSelections = [new EditorSelection(1, 1, 1, 1)];
		this._lastRenderPosition = null;

		// Text Area (The focus will always be in the textarea when the cursor is blinking)
		this.textArea = createFastDomNode(document.createElement('textarea'));
		PartFingerprints.write(this.textArea, PartFingerprint.TextArea);

		this.textArea.setClassName(`inputarea`);
		this.textArea.setAttribute('autocorrect', 'off');
		this.textArea.setAttribute('autocapitalize', 'off');
		this.textArea.setAttribute('autocomplete', 'off');
		this.textArea.setAttribute('spellcheck', 'false');

		this.textArea.setAttribute('role', 'textbox');
		this.textArea.setAttribute('aria-multiline', 'true');
		this.textArea.setAttribute('aria-haspopup', 'false');
		this.textArea.setAttribute('aria-autocomplete', 'both');

		this.textAreaCover = createFastDomNode(document.createElement('div'));
		this.textAreaCover.setPosition('absolute');


		const textAreaInputHost = this.createTextAreaInputHost();
		const textAreaWrapper = this._register(new TextAreaWrapper(this.textArea.domNode));
		this._textAreaInput = this._register(new TextAreaInput(textAreaInputHost, textAreaWrapper, platform.OS, browser));

		this._register(this._textAreaInput.onType((e: ITypeData) => {
			if (e.replacePrevCharCnt || e.replaceNextCharCnt || e.positionDelta) {
				// must be handled through the new command
				if (_debugComposition) {
					console.log(` => compositionType: <<${e.text}>>, ${e.replacePrevCharCnt}, ${e.replaceNextCharCnt}, ${e.positionDelta}`);
				}
				this.viewController.compositionType(e.text, e.replacePrevCharCnt, e.replaceNextCharCnt, e.positionDelta);
			} else {
				if (_debugComposition) {
					console.log(` => type: <<${e.text}>>`);
				}
				this.viewController.type(e.text);
			}
		}));

		this._register(this._textAreaInput.onKeyDown((e) => {
		}));

		this._register(this._textAreaInput.onFocus(() => {
			this.context.viewModel.setHasFocus(true);
		}));

		this._register(this._textAreaInput.onBlur(() => {
			this.context.viewModel.setHasFocus(false);
		}));
	}

	private createTextAreaInputHost(): ITextAreaInputHost {
		const textAreaInputHost: ITextAreaInputHost = {
			getDataToCopy: (): ClipboardDataToCopy => {
				throw new Error('Function not implemented.');
			},
			getScreenReaderContent: (): TextAreaState => {
				return TextAreaState.EMPTY;
			},
			deduceModelPosition: (viewAnchorPosition: Position, deltaOffset: number, lineFeedCnt: number): Position => {
				throw new Error('Function not implemented.');
			}
		};
		return textAreaInputHost;
	}

	private _primaryCursorPosition: Position = new Position(1, 1);
	private _primaryCursorVisibleRange: HorizontalPosition | null = null;

	public prepareRender(ctx: ViewRenderingContext): void {
		this._primaryCursorPosition = new Position(this._selections[0].positionLineNumber, this._selections[0].positionColumn);
		this._primaryCursorVisibleRange = ctx.visibleRangeForPosition(this._primaryCursorPosition);
		this._visibleTextArea?.prepareRender(ctx);
	}

	public render(): void {
		this._textAreaInput.writeScreenReaderContent('render');
		this._render();
	}

	private _render(): void {

		if (!this._primaryCursorVisibleRange) {
			// The primary cursor is outside the viewport => place textarea to the top left
			this._renderAtTopLeft();
			return;
		}

		const left = this._contentLeft + this._primaryCursorVisibleRange.left - this._scrollLeft;
		if (left < this._contentLeft || left > this._contentLeft + this._contentWidth) {
			// cursor is outside the viewport
			this._renderAtTopLeft();
			return;
		}

		const top = this.context.viewLayout.getVerticalOffsetForLineNumber(this._selections[0].positionLineNumber) - this._scrollTop;
		if (top < 0 || top > this._contentHeight) {
			// cursor is outside the viewport
			this._renderAtTopLeft();
			return;
		}

		// The primary cursor is in the viewport (at least vertically) => place textarea on the cursor

		this._doRender({
			lastRenderPosition: this._primaryCursorPosition,
			top: top,
			left: this._textAreaWrapping ? this._contentLeft : left,
			width: this._textAreaWidth,
			height: (canUseZeroSizeTextarea ? 0 : 1),
			useCover: false
		});

	}

	private _renderAtTopLeft(): void {
		// (in WebKit the textarea is 1px by 1px because it cannot handle input to a 0x0 textarea)
		// specifically, when doing Korean IME, setting the textarea to 0x0 breaks IME badly.
		this._doRender({
			lastRenderPosition: null,
			top: 0,
			left: 0,
			width: this._textAreaWidth,
			height: (canUseZeroSizeTextarea ? 0 : 1),
			useCover: true
		});
	}

	private _doRender(renderData: IRenderData): void {
		this._lastRenderPosition = renderData.lastRenderPosition;

		const ta = this.textArea;
		const tac = this.textAreaCover;

		ta.setTop(renderData.top);
		ta.setLeft(renderData.left);
		ta.setWidth(renderData.width);
		ta.setHeight(renderData.height);

		ta.setColor(renderData.color ? Color.Format.CSS.formatHex(renderData.color) : '');
		ta.setFontStyle(renderData.italic ? 'italic' : '');
		if (renderData.bold) {
			// fontWeight is also set by `applyFontInfo`, so only overwrite it if necessary
			ta.setFontWeight('bold');
		}
		ta.setTextDecoration(`${renderData.underline ? ' underline' : ''}${renderData.strikethrough ? ' line-through' : ''}`);

		tac.setTop(renderData.useCover ? renderData.top : 0);
		tac.setLeft(renderData.useCover ? renderData.left : 0);
		tac.setWidth(renderData.useCover ? renderData.width : 0);
		tac.setHeight(renderData.useCover ? renderData.height : 0);

	}

	//#region Event handler

	public override onCursorStateChanged(e: viewEvents.ViewCursorStateChangedEvent): boolean {
		this._selections = e.selections.slice(0);
		this._modelSelections = e.modelSelections.slice(0);
		// We must update the <textarea> synchronously, otherwise long press IME on macos breaks.
		// See https://github.com/microsoft/vscode/issues/165821
		this._textAreaInput.writeScreenReaderContent('selection changed');
		return true;
	}

	public override onLinesChanged(e: viewEvents.ViewLinesChangedEvent): boolean {
		return true;
	}
	public override onLinesDeleted(e: viewEvents.ViewLinesDeletedEvent): boolean {
		return true;
	}
	public override onLinesInserted(e: viewEvents.ViewLinesInsertedEvent): boolean {
		return true;
	}

	public override onScrollChanged(e: viewEvents.ViewScrollChangedEvent): boolean {
		this._scrollLeft = e.scrollLeft;
		this._scrollTop = e.scrollTop;
		return true;
	}

	//#endregion

	//#region view API

	public isFocused(): boolean {
		return this._textAreaInput.isFocused();
	}

	public focusTextArea(): void {
		this._textAreaInput.focusTextArea();
	}

	public refreshFocusState() {
		this._textAreaInput.refreshFocusState();
	}

	public getLastRenderData(): Position | null {
		return this._lastRenderPosition;
	}

	//#endregion
}

interface IRenderData {
	lastRenderPosition: Position | null;
	top: number;
	left: number;
	width: number;
	height: number;
	useCover: boolean;

	color?: Color | null;
	italic?: boolean;
	bold?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
}
