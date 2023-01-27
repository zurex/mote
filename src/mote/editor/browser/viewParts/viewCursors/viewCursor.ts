import * as strings from 'mote/base/common/strings';
import * as dom from 'mote/base/browser/dom';

import { MOUSE_CURSOR_TEXT_CSS_CLASS_NAME } from 'mote/base/browser/ui/mouseCursor/mouseCursor';
import { RestrictedRenderingContext, ViewRenderingContext } from 'mote/editor/browser/view/renderingContext';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { Position } from 'mote/editor/common/core/position';
import { createFastDomNode, FastDomNode } from 'mote/base/browser/fastDomNode';
import { EditorOption, TextEditorCursorStyle } from 'mote/editor/common/config/editorOptions';
import { EditorRange } from 'mote/editor/common/core/editorRange';

export interface IViewCursorRenderData {
	domNode: HTMLElement;
	position: Position;
	contentLeft: number;
	width: number;
	height: number;
}

class ViewCursorRenderData {
	constructor(
		public readonly top: number,
		public readonly left: number,
		public readonly paddingLeft: number,
		public readonly width: number,
		public readonly height: number,
		public readonly textContent: string,
		public readonly textContentClassName: string
	) { }
}


export class ViewCursor {

	private readonly domNode: FastDomNode<HTMLElement>;

	private _lineCursorWidth: number;
	private _lineHeight: number = 18;
	private _typicalHalfwidthCharacterWidth: number = 8;
	private _cursorStyle: TextEditorCursorStyle;

	private _isVisible: boolean;

	private _position: Position;

	private _lastRenderedContent: string;
	private _renderData: ViewCursorRenderData | null;

	constructor(private readonly context: ViewContext) {
		const options = this.context.configuration.options;
		this._lineCursorWidth = 2;
		this._cursorStyle = options.get(EditorOption.CursorStyle);

		this._isVisible = true;
		// Create the dom node
		this.domNode = createFastDomNode(document.createElement('div'));
		this.domNode.setClassName(`cursor ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`);
		//this.domNode.setHeight(this._lineHeight);
		this.domNode.setTop(0);
		this.domNode.setLeft(0);
		this.domNode.setPaddingBottom(3);
		this.domNode.setPaddingTop(3);

		this.domNode.setDisplay('none');

		this._position = new Position(1, 1);

		this._lastRenderedContent = '';
		this._renderData = null;
	}

	public getDomNode(): FastDomNode<HTMLElement> {
		return this.domNode;
	}

	public getPosition(): Position {
		return this._position;
	}

	public show(): void {
		if (!this._isVisible) {
			this.domNode.setVisibility('inherit');
			this._isVisible = true;
		}
	}

	public hide(): void {
		if (this._isVisible) {
			this.domNode.setVisibility('hidden');
			this._isVisible = false;
		}
	}

	public onCursorPositionChanged(position: Position, pauseAnimation: boolean): boolean {
		if (pauseAnimation) {
			this.domNode.domNode.style.transitionProperty = 'none';
		} else {
			this.domNode.domNode.style.transitionProperty = '';
		}
		this._position = position;
		return true;
	}

	public prepareRender(ctx: ViewRenderingContext): void {
		this._renderData = this._prepareRender(ctx);
	}

	/**
	 * If `this._position` is inside a grapheme, returns the position where the grapheme starts.
	 * Also returns the next grapheme.
	 */
	private _getGraphemeAwarePosition(): [Position, string] {
		const { lineNumber, column } = this._position;
		const lineContent = this.context.viewModel.getLineContent(lineNumber);
		const [startOffset, endOffset] = strings.getCharContainingOffset(lineContent, column - 1);
		return [new Position(lineNumber, startOffset + 1), lineContent.substring(startOffset, endOffset)];
	}

	private _prepareRender(ctx: ViewRenderingContext): ViewCursorRenderData | null {
		let textContent = '';
		let textContentClassName = '';
		const [position, nextGrapheme] = this._getGraphemeAwarePosition();

		if (this._cursorStyle === TextEditorCursorStyle.Line || this._cursorStyle === TextEditorCursorStyle.LineThin) {
			const visibleRange = ctx.visibleRangeForPosition(position);
			if (!visibleRange || visibleRange.outsideRenderedLine) {
				// Outside viewport
				return null;
			}

			let width: number;
			if (this._cursorStyle === TextEditorCursorStyle.Line) {
				width = dom.computeScreenAwareSize(this._lineCursorWidth > 0 ? this._lineCursorWidth : 2);
				if (width > 2) {
					textContent = nextGrapheme;
					//textContentClassName = this._getTokenClassName(position);
				}
			} else {
				width = dom.computeScreenAwareSize(1);
			}

			let left = visibleRange.left;
			let paddingLeft = 0;
			if (width >= 2 && left >= 1) {
				// shift the cursor a bit between the characters
				paddingLeft = 1;
				left -= paddingLeft;
			}

			const top = ctx.getVerticalOffsetForLineNumber(position.lineNumber) - ctx.bigNumbersDelta;
			const lineHeight = ctx.lineHeightForPosition(position);
			console.log(top, lineHeight);
			return new ViewCursorRenderData(top, left, paddingLeft, width, lineHeight!, textContent, textContentClassName);
		}

		const visibleRangeForCharacter = ctx.linesVisibleRangesForRange(new EditorRange(position.lineNumber, position.column, position.lineNumber, position.column + nextGrapheme.length), false);
		if (!visibleRangeForCharacter || visibleRangeForCharacter.length === 0) {
			// Outside viewport
			return null;
		}

		const firstVisibleRangeForCharacter = visibleRangeForCharacter[0];
		if (firstVisibleRangeForCharacter.outsideRenderedLine || firstVisibleRangeForCharacter.ranges.length === 0) {
			// Outside viewport
			return null;
		}

		const range = firstVisibleRangeForCharacter.ranges[0];
		const width = (
			nextGrapheme === '\t'
				? this._typicalHalfwidthCharacterWidth
				: (range.width < 1
					? this._typicalHalfwidthCharacterWidth
					: range.width)
		);

		if (this._cursorStyle === TextEditorCursorStyle.Block) {
			textContent = nextGrapheme;
			//textContentClassName = this._getTokenClassName(position);
		}

		let top = ctx.getVerticalOffsetForLineNumber(position.lineNumber) - ctx.bigNumbersDelta;
		let height = this._lineHeight;

		// Underline might interfere with clicking
		if (this._cursorStyle === TextEditorCursorStyle.Underline || this._cursorStyle === TextEditorCursorStyle.UnderlineThin) {
			top += this._lineHeight - 2;
			height = 2;
		}

		return new ViewCursorRenderData(top, range.left, 0, width, height, textContent, textContentClassName);
	}

	public render(ctx: RestrictedRenderingContext): IViewCursorRenderData | null {
		if (!this._renderData) {
			this.domNode.setDisplay('none');
			return null;
		}

		if (this._lastRenderedContent !== this._renderData.textContent) {
			this._lastRenderedContent = this._renderData.textContent;
			this.domNode.domNode.textContent = this._lastRenderedContent;
		}

		this.domNode.setClassName(`cursor ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME} ${this._renderData.textContentClassName}`);

		this.domNode.setDisplay('block');
		this.domNode.setTop(this._renderData.top + 3);
		this.domNode.setLeft(this._renderData.left);
		this.domNode.setPaddingLeft(this._renderData.paddingLeft);
		this.domNode.setWidth(this._renderData.width);
		this.domNode.setLineHeight(this._renderData.height - 6);
		this.domNode.setHeight(this._renderData.height - 6);

		return {
			domNode: this.domNode.domNode,
			position: this._position,
			contentLeft: this._renderData.left,
			height: this._renderData.height,
			width: 2
		};
	}
}
