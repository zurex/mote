import 'mote/css!./viewCursors';
import * as viewEvents from 'mote/editor/common/viewEvents';
import { RestrictedRenderingContext, ViewRenderingContext } from 'mote/editor/browser/view/renderingContext';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewPart } from 'mote/editor/browser/view/viewPart';
import { IViewCursorRenderData, ViewCursor } from 'mote/editor/browser/viewParts/viewCursors/viewCursor';
import { createFastDomNode, FastDomNode } from 'mote/base/browser/fastDomNode';
import { EditorOption, TextEditorCursorBlinkingStyle, TextEditorCursorStyle } from 'mote/editor/common/config/editorOptions';
import { IntervalTimer, TimeoutTimer } from 'mote/base/common/async';
import { registerThemingParticipant } from 'mote/platform/theme/common/themeService';
import { isHighContrast } from 'mote/platform/theme/common/theme';
import { editorCursorBackground, editorCursorForeground } from 'mote/editor/common/core/editorColorRegistry';
import { Position } from 'mote/editor/common/core/position';
import { CursorChangeReason } from 'mote/editor/common/cursorEvents';

export class ViewCursors extends ViewPart {

	static readonly BLINK_INTERVAL = 500;

	private _selectionIsEmpty: boolean;
	private _isComposingInput: boolean;
	private _editorHasFocus: boolean;
	private _readOnly: boolean;
	private _cursorBlinking: TextEditorCursorBlinkingStyle;
	private _cursorStyle: TextEditorCursorStyle;

	private _isVisible: boolean;

	private readonly _domNode: FastDomNode<HTMLElement>;

	private readonly _startCursorBlinkAnimation: TimeoutTimer;
	private readonly _cursorFlatBlinkInterval: IntervalTimer;
	private _blinkingEnabled: boolean;
	private _cursorSmoothCaretAnimation: 'off' | 'explicit' | 'on';

	private readonly _primaryCursor: ViewCursor;
	private readonly _secondaryCursors: ViewCursor[];
	private _renderData: IViewCursorRenderData[];

	constructor(context: ViewContext) {
		super(context);

		const options = this.context.configuration.options;
		this._selectionIsEmpty = true;
		this._isComposingInput = false;
		this._readOnly = options.get(EditorOption.ReadOnly);
		this._cursorStyle = options.get(EditorOption.CursorStyle);
		this._cursorBlinking = options.get(EditorOption.CursorBlinking);
		this._cursorSmoothCaretAnimation = options.get(EditorOption.CursorSmoothCaretAnimation);

		this._isVisible = false;

		this._primaryCursor = new ViewCursor(this.context);
		this._secondaryCursors = [];
		this._renderData = [];

		this._domNode = createFastDomNode(document.createElement('div'));
		this._domNode.setAttribute('role', 'presentation');
		this._domNode.setAttribute('aria-hidden', 'true');
		this._updateDomClassName();

		this._domNode.appendChild(this._primaryCursor.getDomNode());

		this._startCursorBlinkAnimation = new TimeoutTimer();
		this._cursorFlatBlinkInterval = new IntervalTimer();
		this._blinkingEnabled = false;

		this._editorHasFocus = false;

		this._updateBlinking();
	}

	public override dispose(): void {
		super.dispose();
		this._startCursorBlinkAnimation.dispose();
		this._cursorFlatBlinkInterval.dispose();
	}

	public getDomNode(): FastDomNode<HTMLElement> {
		return this._domNode;
	}

	//#region IViewPart implementation

	public prepareRender(ctx: ViewRenderingContext): void {
		this._primaryCursor.prepareRender(ctx);
		for (let i = 0, len = this._secondaryCursors.length; i < len; i++) {
			this._secondaryCursors[i].prepareRender(ctx);
		}
	}

	public render(ctx: RestrictedRenderingContext): void {
		const renderData: IViewCursorRenderData[] = [];
		let renderDataLen = 0;

		const primaryRenderData = this._primaryCursor.render(ctx);
		if (primaryRenderData) {
			renderData[renderDataLen++] = primaryRenderData;
		}

		for (let i = 0, len = this._secondaryCursors.length; i < len; i++) {
			const secondaryRenderData = this._secondaryCursors[i].render(ctx);
			if (secondaryRenderData) {
				renderData[renderDataLen++] = secondaryRenderData;
			}
		}

		this._renderData = renderData;
	}

	public getLastRenderData(): IViewCursorRenderData[] {
		return this._renderData;
	}

	//#endregion

	//#region blinking logic

	private _show(): void {
		this._primaryCursor.show();
		for (let i = 0, len = this._secondaryCursors.length; i < len; i++) {
			this._secondaryCursors[i].show();
		}
		this._isVisible = true;
	}

	private _hide(): void {
		this._primaryCursor.hide();
		for (let i = 0, len = this._secondaryCursors.length; i < len; i++) {
			this._secondaryCursors[i].hide();
		}
		this._isVisible = false;
	}

	private _getCursorBlinking(): TextEditorCursorBlinkingStyle {
		if (this._isComposingInput) {
			// avoid double cursors
			return TextEditorCursorBlinkingStyle.Hidden;
		}
		if (!this._editorHasFocus) {
			return TextEditorCursorBlinkingStyle.Hidden;
		}
		if (this._readOnly) {
			return TextEditorCursorBlinkingStyle.Solid;
		}
		return this._cursorBlinking;
	}

	private _updateBlinking(): void {
		this._startCursorBlinkAnimation.cancel();
		this._cursorFlatBlinkInterval.cancel();

		const blinkingStyle = this._getCursorBlinking();
		// hidden and solid are special as they involve no animations
		const isHidden = (blinkingStyle === TextEditorCursorBlinkingStyle.Hidden);
		const isSolid = (blinkingStyle === TextEditorCursorBlinkingStyle.Solid);

		if (isHidden) {
			this._hide();
		} else {
			this._show();
		}

		this._blinkingEnabled = false;
		this._updateDomClassName();

		if (!isHidden && !isSolid) {
			if (blinkingStyle === TextEditorCursorBlinkingStyle.Blink) {
				// flat blinking is handled by JavaScript to save battery life due to Chromium step timing issue https://bugs.chromium.org/p/chromium/issues/detail?id=361587
				this._cursorFlatBlinkInterval.cancelAndSet(() => {
					if (this._isVisible) {
						this._hide();
					} else {
						this._show();
					}
				}, ViewCursors.BLINK_INTERVAL);
			} else {
				this._startCursorBlinkAnimation.setIfNotSet(() => {
					this._blinkingEnabled = true;
					this._updateDomClassName();
				}, ViewCursors.BLINK_INTERVAL);
			}
		}
	}

	//#endregion

	//#region event handler

	public override onCursorStateChanged(e: viewEvents.ViewCursorStateChangedEvent): boolean {
		const positions: Position[] = [];
		for (let i = 0, len = e.selections.length; i < len; i++) {
			positions[i] = e.selections[i].getPosition();
		}

		this.onCursorPositionChanged(positions[0], positions.slice(1), e.reason);

		const selectionIsEmpty = e.selections[0].isEmpty();
		if (this._selectionIsEmpty !== selectionIsEmpty) {
			this._selectionIsEmpty = selectionIsEmpty;
			this._updateDomClassName();
		}

		return true;
	}

	private onCursorPositionChanged(position: Position, secondaryPositions: Position[], reason: CursorChangeReason): void {
		const pauseAnimation = (
			this._secondaryCursors.length !== secondaryPositions.length
			|| (this._cursorSmoothCaretAnimation === 'explicit' && reason !== CursorChangeReason.Explicit)
		);
		this._primaryCursor.onCursorPositionChanged(position, pauseAnimation);
		this._updateBlinking();

		if (this._secondaryCursors.length < secondaryPositions.length) {
			// Create new cursors
			const addCnt = secondaryPositions.length - this._secondaryCursors.length;
			for (let i = 0; i < addCnt; i++) {
				const newCursor = new ViewCursor(this.context);
				this._domNode.domNode.insertBefore(newCursor.getDomNode().domNode, this._primaryCursor.getDomNode().domNode.nextSibling);
				this._secondaryCursors.push(newCursor);
			}
		} else if (this._secondaryCursors.length > secondaryPositions.length) {
			// Remove some cursors
			const removeCnt = this._secondaryCursors.length - secondaryPositions.length;
			for (let i = 0; i < removeCnt; i++) {
				this._domNode.removeChild(this._secondaryCursors[0].getDomNode());
				this._secondaryCursors.splice(0, 1);
			}
		}

		for (let i = 0; i < secondaryPositions.length; i++) {
			this._secondaryCursors[i].onCursorPositionChanged(secondaryPositions[i], pauseAnimation);
		}

	}

	public override onFocusChanged(e: viewEvents.ViewFocusChangedEvent): boolean {
		this._editorHasFocus = e.isFocused;
		this._updateBlinking();
		return false;
	}

	//#endregion

	private _updateDomClassName(): void {
		this._domNode.setClassName(this._getClassName());
	}

	private _getClassName(): string {
		let result = 'cursors-layer';
		if (!this._selectionIsEmpty) {
			result += ' has-selection';
		}
		switch (this._cursorStyle) {
			case TextEditorCursorStyle.Line:
				result += ' cursor-line-style';
				break;
			case TextEditorCursorStyle.Block:
				result += ' cursor-block-style';
				break;
			case TextEditorCursorStyle.Underline:
				result += ' cursor-underline-style';
				break;
			case TextEditorCursorStyle.LineThin:
				result += ' cursor-line-thin-style';
				break;
			case TextEditorCursorStyle.BlockOutline:
				result += ' cursor-block-outline-style';
				break;
			case TextEditorCursorStyle.UnderlineThin:
				result += ' cursor-underline-thin-style';
				break;
			default:
				result += ' cursor-line-style';
		}

		if (this._blinkingEnabled) {
			switch (this._getCursorBlinking()) {
				case TextEditorCursorBlinkingStyle.Blink:
					result += ' cursor-blink';
					break;
				case TextEditorCursorBlinkingStyle.Smooth:
					result += ' cursor-smooth';
					break;
				case TextEditorCursorBlinkingStyle.Phase:
					result += ' cursor-phase';
					break;
				case TextEditorCursorBlinkingStyle.Expand:
					result += ' cursor-expand';
					break;
				case TextEditorCursorBlinkingStyle.Solid:
					result += ' cursor-solid';
					break;
				default:
					result += ' cursor-solid';
			}
		} else {
			result += ' cursor-solid';
		}

		if (this._cursorSmoothCaretAnimation) {
			result += ' cursor-smooth-caret-animation';
		}

		return result;
	}
}

registerThemingParticipant((theme, collector) => {
	const caret = theme.getColor(editorCursorForeground);
	if (caret) {
		let caretBackground = theme.getColor(editorCursorBackground);
		if (!caretBackground) {
			caretBackground = caret.opposite();
		}
		collector.addRule(`.mote-editor .cursors-layer .cursor { background-color: ${caret}; border-color: ${caret}; color: ${caretBackground}; }`);
		if (isHighContrast(theme.type)) {
			collector.addRule(`.mote-editor .cursors-layer.has-selection .cursor { border-left: 1px solid ${caretBackground}; border-right: 1px solid ${caretBackground}; }`);
		}
	}

});
