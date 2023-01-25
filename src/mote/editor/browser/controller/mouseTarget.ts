import * as dom from 'mote/base/browser/dom';

import { IPointerHandlerHelper } from 'mote/editor/browser/controller/mouseHandler';
import { IMouseTarget, IMouseTargetContentEmpty, IMouseTargetContentEmptyData, IMouseTargetContentText, IMouseTargetContentTextData, IMouseTargetOutsideEditor, IMouseTargetOverlayWidget, IMouseTargetTextarea, IMouseTargetUnknown, MouseTargetType } from 'mote/editor/browser/editorBrowser';
import { ClientCoordinates, CoordinatesRelativeToEditor, EditorPagePosition, PageCoordinates } from 'mote/editor/browser/editorDom';
import { HorizontalPosition } from 'mote/editor/browser/view/renderingContext';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { PartFingerprint, PartFingerprints } from 'mote/editor/browser/view/viewPart';
import { ViewLine } from 'mote/editor/browser/viewParts/lines/viewLine';
import { IViewCursorRenderData } from 'mote/editor/browser/viewParts/viewCursors/viewCursor';
import { EditorLayoutInfo, EditorOption } from 'mote/editor/common/config/editorOptions';
import { CursorColumns } from 'mote/editor/common/core/cursorColumns';
import { EditorRange } from 'mote/editor/common/core/editorRange';
import { Position } from 'mote/editor/common/core/position';
import { getDataRootInParent } from 'mote/editor/common/htmlElementUtils';
import { PositionAffinity } from 'mote/editor/common/model';
import { InjectedText } from 'mote/editor/common/modelLineProjectionData';
import { IViewModel } from 'mote/editor/common/viewModel';

const enum HitTestResultType {
	Unknown,
	Content,
}

class UnknownHitTestResult {
	readonly type = HitTestResultType.Unknown;
	constructor(
		readonly hitTarget: Element | null = null
	) { }
}

class ContentHitTestResult {
	readonly type = HitTestResultType.Content;
	constructor(
		readonly position: Position,
		readonly spanNode: HTMLElement,
		readonly injectedText: InjectedText | null,
	) { }
}

type HitTestResult = UnknownHitTestResult | ContentHitTestResult;

namespace HitTestResult {
	export function createFromDOMInfo(ctx: HitTestContext, spanNode: HTMLElement, offset: number): HitTestResult {
		const position = ctx.getPositionFromDOMInfo(spanNode, offset);
		if (position) {
			return new ContentHitTestResult(position, spanNode, null);
		}
		return new UnknownHitTestResult(spanNode);
	}
}

export class PointerHandlerLastRenderData {
	constructor(
		public readonly lastViewCursorsRenderData: IViewCursorRenderData[],
		public readonly lastTextareaPosition: Position | null
	) { }
}

export class MouseTarget {

	private static _deduceRage(position: Position): EditorRange;
	private static _deduceRage(position: Position, range: EditorRange | null): EditorRange;
	private static _deduceRage(position: Position | null): EditorRange | null;
	private static _deduceRage(position: Position | null, range: EditorRange | null = null): EditorRange | null {
		if (!range && position) {
			return new EditorRange(position.lineNumber, position.column, position.lineNumber, position.column);
		}
		return range ?? null;
	}

	public static createUnknown(element: Element | null, mouseColumn: number, position: Position | null): IMouseTargetUnknown {
		return { type: MouseTargetType.UNKNOWN, element, mouseColumn, position, range: this._deduceRage(position) };
	}

	public static createTextarea(element: Element | null, mouseColumn: number): IMouseTargetTextarea {
		return { type: MouseTargetType.TEXTAREA, element, mouseColumn, position: null, range: null };
	}

	public static createContentText(element: Element | null, mouseColumn: number, position: Position, range: EditorRange | null, detail: IMouseTargetContentTextData): IMouseTargetContentText {
		return { type: MouseTargetType.CONTENT_TEXT, element, mouseColumn, position, range: this._deduceRage(position, range), detail };
	}

	public static createContentEmpty(element: Element | null, mouseColumn: number, position: Position, detail: IMouseTargetContentEmptyData): IMouseTargetContentEmpty {
		return { type: MouseTargetType.CONTENT_EMPTY, element, mouseColumn, position, range: this._deduceRage(position), detail };
	}

	public static createOverlayWidget(element: Element | null, mouseColumn: number, detail: string): IMouseTargetOverlayWidget {
		return { type: MouseTargetType.OVERLAY_WIDGET, element, mouseColumn, position: null, range: null, detail };
	}

	public static createOutsideEditor(mouseColumn: number, position: Position, outsidePosition: 'above' | 'below' | 'left' | 'right', outsideDistance: number): IMouseTargetOutsideEditor {
		return { type: MouseTargetType.OUTSIDE_EDITOR, element: null, mouseColumn, position, range: this._deduceRage(position), outsidePosition, outsideDistance };
	}
}

class ElementPath {

	public static isTextArea(path: Uint8Array): boolean {
		return (
			path.length === 2
			&& path[0] === PartFingerprint.OverflowGuard
			&& path[1] === PartFingerprint.TextArea
		);
	}

	public static isChildOfViewLines(path: Uint8Array): boolean {
		return (
			path.length >= 4
			&& path[0] === PartFingerprint.OverflowGuard
			&& path[3] === PartFingerprint.ViewLines
		);
	}

	public static isStrictChildOfViewLines(path: Uint8Array): boolean {
		return (
			path.length > 4
			&& path[0] === PartFingerprint.OverflowGuard
			&& path[3] === PartFingerprint.ViewLines
		);
	}

	public static isChildOfOverlayWidgets(path: Uint8Array): boolean {
		return (
			path.length >= 2
			&& path[0] === PartFingerprint.OverflowGuard
			&& path[1] === PartFingerprint.OverlayWidgets
		);
	}
}

export class HitTestContext {

	public readonly viewModel: IViewModel;
	public readonly layoutInfo: EditorLayoutInfo;
	public readonly viewDomNode: HTMLElement;
	public readonly lineHeight: number = 25;
	public readonly typicalHalfwidthCharacterWidth: number = 5;

	constructor(
		private readonly context: ViewContext,
		private readonly viewHelper: IPointerHandlerHelper,
		public readonly lastRenderData: PointerHandlerLastRenderData
	) {
		this.viewModel = context.viewModel;
		const options = context.configuration.options;
		this.layoutInfo = options.get(EditorOption.LayoutInfo);
		this.viewDomNode = viewHelper.viewDomNode;
	}

	public isAfterLines(mouseVerticalOffset: number): boolean {
		return this.context.viewLayout.isAfterLines(mouseVerticalOffset);
	}

	public isInTopPadding(mouseVerticalOffset: number): boolean {
		return false;
	}

	public isInBottomPadding(mouseVerticalOffset: number): boolean {
		return false;
	}


	public getPositionFromDOMInfo(spanNode: HTMLElement, offset: number): Position | null {
		return this.viewHelper.getPositionFromDOMInfo(spanNode, offset);
	}

	public getLineNumberAtVerticalOffset(mouseVerticalOffset: number): number {
		return this.context.viewLayout.getLineNumberAtVerticalOffset(mouseVerticalOffset);
	}

	public getVerticalOffsetForLineNumber(lineNumber: number): number {
		return this.context.viewLayout.getVerticalOffsetForLineNumber(lineNumber);
	}

	public getLineWidth(lineNumber: number): number {
		return this.viewHelper.getLineWidth(lineNumber);
	}

	public visibleRangeForPosition(lineNumber: number, column: number): HorizontalPosition | null {
		return this.viewHelper.visibleRangeForPosition(lineNumber, column);
	}

	public getCurrentScrollTop(): number {
		return this.context.viewLayout.getCurrentScrollTop();
	}

	public getCurrentScrollLeft(): number {
		return this.context.viewLayout.getCurrentScrollLeft();
	}

	public findAttribute(element: Element, attr: string): string | null {
		return HitTestContext.findAttribute(element, attr, this.viewHelper.viewDomNode);
	}

	private static findAttribute(element: Element, attr: string, stopAt: Element): string | null {
		while (element && element !== document.body) {
			if (element.hasAttribute && element.hasAttribute(attr)) {
				return element.getAttribute(attr);
			}
			if (element === stopAt) {
				return null;
			}
			element = <Element>element.parentNode;
		}
		return null;
	}
}

abstract class BareHitTestRequest {

	public readonly mouseVerticalOffset: number;
	public readonly isInMarginArea: boolean;
	public readonly isInContentArea: boolean;
	public readonly mouseContentHorizontalOffset: number;

	protected readonly mouseColumn: number;

	constructor(
		ctx: HitTestContext,
		public readonly editorPos: EditorPagePosition,
		public readonly pos: PageCoordinates,
		public readonly relativePos: CoordinatesRelativeToEditor
	) {
		this.mouseVerticalOffset = Math.max(0, ctx.getCurrentScrollTop() + this.relativePos.y);
		this.mouseContentHorizontalOffset = ctx.getCurrentScrollLeft() + this.relativePos.x - ctx.layoutInfo.contentLeft;
		this.isInMarginArea = false;
		this.isInContentArea = !this.isInMarginArea;
		this.mouseColumn = Math.max(0, MouseTargetFactory.getMouseColumn(this.mouseContentHorizontalOffset, ctx.typicalHalfwidthCharacterWidth));;
	}
}

class HitTestRequest extends BareHitTestRequest {

	public readonly target: Element | null;
	public readonly targetPath: Uint8Array;

	constructor(private readonly ctx: HitTestContext, editorPos: EditorPagePosition, pos: PageCoordinates, relativePos: CoordinatesRelativeToEditor, target: Element | null) {
		super(ctx, editorPos, pos, relativePos);

		if (target) {
			this.target = target;
			this.targetPath = PartFingerprints.collect(target, ctx.viewDomNode);
		} else {
			this.target = null;
			this.targetPath = new Uint8Array(0);
		}
	}

	public override toString(): string {
		return `pos(${this.pos.x},${this.pos.y}), editorPos(${this.editorPos.x},${this.editorPos.y}), relativePos(${this.relativePos.x},${this.relativePos.y}), mouseVerticalOffset: ${this.mouseVerticalOffset}, mouseContentHorizontalOffset: ${this.mouseContentHorizontalOffset}\n\ttarget: ${this.target ? (<HTMLElement>this.target).outerHTML : null}`;
	}

	private _getMouseColumn(position: Position | null = null): number {
		const tabSize = 1;
		if (position && position.column < this.ctx.viewModel.getLineMaxColumn(position.lineNumber)) {
			// Most likely, the line contains foreign decorations...
			return CursorColumns.visibleColumnFromColumn(this.ctx.viewModel.getLineContent(position.lineNumber), position.column, tabSize) + 1;
		}
		return this.mouseColumn;
	}

	public fulfillUnknown(position: Position | null = null): IMouseTargetUnknown {
		return MouseTarget.createUnknown(this.target, this._getMouseColumn(position), position);
	}

	public fulfillTextarea(): IMouseTargetTextarea {
		return MouseTarget.createTextarea(this.target, this._getMouseColumn());
	}

	public fulfillContentText(position: Position, range: EditorRange | null, detail: IMouseTargetContentTextData): IMouseTargetContentText {
		return MouseTarget.createContentText(this.target, this._getMouseColumn(position), position, range, detail);
	}

	public fulfillContentEmpty(position: Position, detail: IMouseTargetContentEmptyData): IMouseTargetContentEmpty {
		return MouseTarget.createContentEmpty(this.target, this._getMouseColumn(position), position, detail);
	}

	public fulfillOverlayWidget(detail: string): IMouseTargetOverlayWidget {
		return MouseTarget.createOverlayWidget(this.target, this._getMouseColumn(), detail);
	}

	public withTarget(target: Element | null): HitTestRequest {
		return new HitTestRequest(this.ctx, this.editorPos, this.pos, this.relativePos, target);
	}
}

interface ResolvedHitTestRequest extends HitTestRequest {
	readonly target: Element;
}

const EMPTY_CONTENT_AFTER_LINES: IMouseTargetContentEmptyData = { isAfterLines: true };

function createEmptyContentDataInLines(horizontalDistanceToText: number): IMouseTargetContentEmptyData {
	return {
		isAfterLines: false,
		horizontalDistanceToText: horizontalDistanceToText
	};
}

export class MouseTargetFactory {

	constructor(private readonly context: ViewContext, private readonly viewHelper: IPointerHandlerHelper) { }

	public createMouseTarget(lastRenderData: PointerHandlerLastRenderData, editorPos: EditorPagePosition, pos: PageCoordinates, relativePos: CoordinatesRelativeToEditor, target: HTMLElement | null): IMouseTarget {
		const ctx = new HitTestContext(this.context, this.viewHelper, lastRenderData);
		const request = new HitTestRequest(ctx, editorPos, pos, relativePos, target);

		try {
			const r = MouseTargetFactory.createMouseTarget(ctx, request, false);

			return r;
		} catch (err) {
			console.error(err);
			return request.fulfillUnknown();
		}
	}

	public getMouseColumn(relativePos: CoordinatesRelativeToEditor): number {
		return 0;
	}

	public static getMouseColumn(mouseContentHorizontalOffset: number, typicalHalfwidthCharacterWidth: number): number {
		if (mouseContentHorizontalOffset < 0) {
			return 1;
		}
		const chars = Math.round(mouseContentHorizontalOffset / typicalHalfwidthCharacterWidth);
		return (chars + 1);
	}

	private static createMouseTarget(ctx: HitTestContext, request: HitTestRequest, domHitTestExecuted: boolean): IMouseTarget {
		// console.log(`${domHitTestExecuted ? '=>' : ''}CAME IN REQUEST: ${request}`);

		// First ensure the request has a target
		if (request.target === null) {
			if (domHitTestExecuted) {
				// Still no target... and we have already executed hit test...
				return request.fulfillUnknown();
			}

			const hitTestResult = MouseTargetFactory.doHitTest(ctx, request);

			if (hitTestResult.type === HitTestResultType.Content) {
				return MouseTargetFactory.createMouseTargetFromHitTestPosition(ctx, request, hitTestResult.spanNode, hitTestResult.position, hitTestResult.injectedText);
			}

			return this.createMouseTarget(ctx, request.withTarget(hitTestResult.hitTarget), true);
		}

		// we know for a fact that request.target is not null
		const resolvedRequest = <ResolvedHitTestRequest>request;

		let result: IMouseTarget | null = null;

		result = result || MouseTargetFactory.hitTestOverlayWidget(ctx, resolvedRequest);
		result = result || MouseTargetFactory.hitTestViewCursor(ctx, resolvedRequest);
		result = result || MouseTargetFactory.hitTestTextArea(ctx, resolvedRequest);
		result = result || MouseTargetFactory.hitTestViewLines(ctx, resolvedRequest, domHitTestExecuted);

		return (result || request.fulfillUnknown());
	}

	private static hitTestTextArea(ctx: HitTestContext, request: ResolvedHitTestRequest): IMouseTarget | null {
		// Is it the textarea?
		if (ElementPath.isTextArea(request.targetPath)) {
			if (ctx.lastRenderData.lastTextareaPosition) {
				return request.fulfillContentText(ctx.lastRenderData.lastTextareaPosition, null, { mightBeForeignElement: false, injectedText: null });
			}
			return request.fulfillTextarea();
		}
		return null;
	}

	private static hitTestOverlayWidget(ctx: HitTestContext, request: ResolvedHitTestRequest): IMouseTarget | null {
		// Is it an overlay widget?
		if (ElementPath.isChildOfOverlayWidgets(request.targetPath)) {
			const widgetId = ctx.findAttribute(request.target, 'widgetId');
			if (widgetId) {
				return request.fulfillOverlayWidget(widgetId);
			} else {
				return request.fulfillUnknown();
			}
		}
		return null;
	}

	private static hitTestViewCursor(ctx: HitTestContext, request: ResolvedHitTestRequest): IMouseTarget | null {

		if (request.target) {
			// Check if we've hit a painted cursor
			const lastViewCursorsRenderData = ctx.lastRenderData.lastViewCursorsRenderData;

			for (const d of lastViewCursorsRenderData) {

				if (request.target === d.domNode) {
					return request.fulfillContentText(d.position, null, { mightBeForeignElement: false, injectedText: null });
				}
			}
		}

		if (request.isInContentArea) {
			// Edge has a bug when hit-testing the exact position of a cursor,
			// instead of returning the correct dom node, it returns the
			// first or last rendered view line dom node, therefore help it out
			// and first check if we are on top of a cursor

			const lastViewCursorsRenderData = ctx.lastRenderData.lastViewCursorsRenderData;
			const mouseContentHorizontalOffset = request.mouseContentHorizontalOffset;
			const mouseVerticalOffset = request.mouseVerticalOffset;

			for (const d of lastViewCursorsRenderData) {

				if (mouseContentHorizontalOffset < d.contentLeft) {
					// mouse position is to the left of the cursor
					continue;
				}
				if (mouseContentHorizontalOffset > d.contentLeft + d.width) {
					// mouse position is to the right of the cursor
					continue;
				}

				const cursorVerticalOffset = ctx.getVerticalOffsetForLineNumber(d.position.lineNumber);

				if (
					cursorVerticalOffset <= mouseVerticalOffset
					&& mouseVerticalOffset <= cursorVerticalOffset + d.height
				) {
					return request.fulfillContentText(d.position, null, { mightBeForeignElement: false, injectedText: null });
				}
			}
		}

		return null;
	}

	private static hitTestViewLines(ctx: HitTestContext, request: ResolvedHitTestRequest, domHitTestExecuted: boolean): IMouseTarget | null {
		if (!ElementPath.isChildOfViewLines(request.targetPath)) {
			return null;
		}

		if (ctx.isInTopPadding(request.mouseVerticalOffset)) {
			return request.fulfillContentEmpty(new Position(1, 1), EMPTY_CONTENT_AFTER_LINES);
		}

		// Check if it is below any lines and any view zones
		if (ctx.isAfterLines(request.mouseVerticalOffset) || ctx.isInBottomPadding(request.mouseVerticalOffset)) {
			// This most likely indicates it happened after the last view-line
			const lineCount = ctx.viewModel.getLineCount();
			const maxLineColumn = ctx.viewModel.getLineMaxColumn(lineCount - 1);
			return request.fulfillContentEmpty(new Position(lineCount, maxLineColumn), EMPTY_CONTENT_AFTER_LINES);
		}

		if (domHitTestExecuted) {
			// Check if we are hitting a view-line (can happen in the case of inline decorations on empty lines)
			// See https://github.com/microsoft/vscode/issues/46942
			if (ElementPath.isStrictChildOfViewLines(request.targetPath)) {
				const lineNumber = ctx.getLineNumberAtVerticalOffset(request.mouseVerticalOffset);
				if (ctx.viewModel.getLineLength(lineNumber) === 0) {
					const lineWidth = ctx.getLineWidth(lineNumber);
					const detail = createEmptyContentDataInLines(request.mouseContentHorizontalOffset - lineWidth);
					return request.fulfillContentEmpty(new Position(lineNumber, 1), detail);
				}

				const lineWidth = ctx.getLineWidth(lineNumber);
				if (request.mouseContentHorizontalOffset >= lineWidth) {
					const detail = createEmptyContentDataInLines(request.mouseContentHorizontalOffset - lineWidth);
					const pos = new Position(lineNumber, ctx.viewModel.getLineMaxColumn(lineNumber));
					return request.fulfillContentEmpty(pos, detail);
				}
			}

			// We have already executed hit test...
			return request.fulfillUnknown();
		}

		const hitTestResult = MouseTargetFactory.doHitTest(ctx, request);

		if (hitTestResult.type === HitTestResultType.Content) {
			return MouseTargetFactory.createMouseTargetFromHitTestPosition(ctx, request, hitTestResult.spanNode, hitTestResult.position, hitTestResult.injectedText);
		}

		return this.createMouseTarget(ctx, request.withTarget(hitTestResult.hitTarget), true);
	}

	private static doHitTest(ctx: HitTestContext, request: BareHitTestRequest): HitTestResult {
		let result: HitTestResult = new UnknownHitTestResult();
		if (typeof (<any>document).caretRangeFromPoint === 'function') {
			result = this.doHitTestWithCaretRangeFromPoint(ctx, request);
		} else if ((<any>document).caretPositionFromPoint) {
			result = this.doHitTestWithCaretPositionFromPoint(ctx, request.pos.toClientCoordinates());
		}
		if (result.type === HitTestResultType.Content) {
			const injectedText = null;//ctx.viewModel.getInjectedTextAt(result.position);

			const normalizedPosition = ctx.viewModel.normalizePosition(result.position, PositionAffinity.None);
			if (injectedText || !normalizedPosition.equals(result.position)) {
				result = new ContentHitTestResult(normalizedPosition, result.spanNode, injectedText);
			}
		}
		return result;
	}

	/**
	 * Most probably WebKit browsers and Edge
	 */
	private static doHitTestWithCaretRangeFromPoint(ctx: HitTestContext, request: BareHitTestRequest): HitTestResult {

		// In Chrome, especially on Linux it is possible to click between lines,
		// so try to adjust the `hity` below so that it lands in the center of a line
		const lineNumber = ctx.getLineNumberAtVerticalOffset(request.mouseVerticalOffset);
		const lineStartVerticalOffset = ctx.getVerticalOffsetForLineNumber(lineNumber);
		const lineEndVerticalOffset = lineStartVerticalOffset + ctx.lineHeight;

		const isBelowLastLine = (
			lineNumber === ctx.viewModel.getLineCount()
			&& request.mouseVerticalOffset > lineEndVerticalOffset
		);

		if (!isBelowLastLine) {
			// TODO: Add lineCenteredVerticalOffset later
			const lineCenteredVerticalOffset = request.mouseVerticalOffset;//Math.floor((lineStartVerticalOffset + lineEndVerticalOffset) / 2);
			let adjustedPageY = request.pos.y + (lineCenteredVerticalOffset - request.mouseVerticalOffset);

			if (adjustedPageY <= request.editorPos.y) {
				adjustedPageY = request.editorPos.y + 1;
			}
			if (adjustedPageY >= request.editorPos.y + request.editorPos.height) {
				adjustedPageY = request.editorPos.y + request.editorPos.height - 1;
			}

			const adjustedPage = new PageCoordinates(request.pos.x, adjustedPageY);

			const r = this.actualDoHitTestWithCaretRangeFromPoint(ctx, adjustedPage.toClientCoordinates());
			if (r.type === HitTestResultType.Content) {
				return r;
			}
		}

		// Also try to hit test without the adjustment (for the edge cases that we are near the top or bottom)
		return this.actualDoHitTestWithCaretRangeFromPoint(ctx, request.pos.toClientCoordinates());
	}

	/**
	 * Most probably Gecko
	 */
	private static doHitTestWithCaretPositionFromPoint(ctx: HitTestContext, coords: ClientCoordinates): HitTestResult {
		const hitResult: { offsetNode: Node; offset: number } = (<any>document).caretPositionFromPoint(coords.clientX, coords.clientY);

		if (hitResult.offsetNode.nodeType === hitResult.offsetNode.TEXT_NODE) {
			// offsetNode is expected to be the token text
			const parent1 = hitResult.offsetNode.parentNode; // expected to be the token span
			const parent2 = parent1 ? parent1.parentNode : null; // expected to be the view line container span
			const parent3 = parent2 ? parent2.parentNode : null; // expected to be the view line div
			const parent3ClassName = parent3 && parent3.nodeType === parent3.ELEMENT_NODE ? (<HTMLElement>parent3).className : null;

			if (parent3ClassName === ViewLine.CLASS_NAME) {
				return HitTestResult.createFromDOMInfo(ctx, <HTMLElement>hitResult.offsetNode.parentNode, hitResult.offset);
			} else {
				return new UnknownHitTestResult(<HTMLElement>hitResult.offsetNode.parentNode);
			}
		}

		// For inline decorations, Gecko sometimes returns the `<span>` of the line and the offset is the `<span>` with the inline decoration
		// Some other times, it returns the `<span>` with the inline decoration
		if (hitResult.offsetNode.nodeType === hitResult.offsetNode.ELEMENT_NODE) {
			const parent1 = hitResult.offsetNode.parentNode;
			const parent1ClassName = parent1 && parent1.nodeType === parent1.ELEMENT_NODE ? (<HTMLElement>parent1).className : null;
			const parent2 = parent1 ? parent1.parentNode : null;
			const parent2ClassName = parent2 && parent2.nodeType === parent2.ELEMENT_NODE ? (<HTMLElement>parent2).className : null;

			if (parent1ClassName === ViewLine.CLASS_NAME) {
				// it returned the `<span>` of the line and the offset is the `<span>` with the inline decoration
				const tokenSpan = hitResult.offsetNode.childNodes[Math.min(hitResult.offset, hitResult.offsetNode.childNodes.length - 1)];
				if (tokenSpan) {
					return HitTestResult.createFromDOMInfo(ctx, <HTMLElement>tokenSpan, 0);
				}
			} else if (parent2ClassName === ViewLine.CLASS_NAME) {
				// it returned the `<span>` with the inline decoration
				return HitTestResult.createFromDOMInfo(ctx, <HTMLElement>hitResult.offsetNode, 0);
			}
		}

		return new UnknownHitTestResult(<HTMLElement>hitResult.offsetNode);
	}

	private static actualDoHitTestWithCaretRangeFromPoint(ctx: HitTestContext, coords: ClientCoordinates): HitTestResult {
		const shadowRoot = dom.getShadowRoot(ctx.viewDomNode);
		let range: Range;
		if (shadowRoot) {
			if (typeof (<any>shadowRoot).caretRangeFromPoint === 'undefined') {
				range = shadowCaretRangeFromPoint(shadowRoot, coords.clientX, coords.clientY);
			} else {
				range = (<any>shadowRoot).caretRangeFromPoint(coords.clientX, coords.clientY);
			}
		} else {
			range = (<any>document).caretRangeFromPoint(coords.clientX, coords.clientY);
		}

		if (!range || !range.startContainer) {
			return new UnknownHitTestResult();
		}

		// Chrome always hits a TEXT_NODE, while Edge sometimes hits a token span
		const startContainer = range.startContainer;

		if (startContainer.nodeType === startContainer.TEXT_NODE) {
			// startContainer is expected to be the token text
			const parent1 = startContainer.parentNode; // expected to be the token span
			const parent2 = parent1 ? parent1.parentNode : null; // expected to be the view line container span
			const parent3 = parent2 ? parent2.parentNode : null; // expected to be the view line div
			const parent3ClassName = parent3 && parent3.nodeType === parent3.ELEMENT_NODE ? (<HTMLElement>parent3).className : null;

			//TODO: if (parent3ClassName === ViewLine.CLASS_NAME) {
			const dataRoot = getDataRootInParent(startContainer);
			const dataRootClassName = (<HTMLElement>dataRoot).className;
			if (dataRootClassName === ViewLine.CLASS_NAME) {
				return HitTestResult.createFromDOMInfo(ctx, <HTMLElement>parent1, range.startOffset);
			} else {
				return new UnknownHitTestResult(<HTMLElement>startContainer.parentNode);
			}
		} else if (startContainer.nodeType === startContainer.ELEMENT_NODE) {
			// startContainer is expected to be the token span
			const parent1 = startContainer.parentNode; // expected to be the view line container span
			const parent2 = parent1 ? parent1.parentNode : null; // expected to be the view line div
			const parent2ClassName = parent2 && parent2.nodeType === parent2.ELEMENT_NODE ? (<HTMLElement>parent2).className : null;

			if (parent2ClassName === ViewLine.CLASS_NAME) {
				return HitTestResult.createFromDOMInfo(ctx, <HTMLElement>startContainer, (<HTMLElement>startContainer).textContent!.length);
			} else {
				return new UnknownHitTestResult(<HTMLElement>startContainer);
			}
		}

		return new UnknownHitTestResult();
	}

	private static createMouseTargetFromHitTestPosition(ctx: HitTestContext, request: HitTestRequest, spanNode: HTMLElement, pos: Position, injectedText: InjectedText | null): IMouseTarget {
		const lineNumber = pos.lineNumber;
		const column = pos.column;

		const lineWidth = ctx.getLineWidth(lineNumber);

		if (request.mouseContentHorizontalOffset > lineWidth) {
			const detail = createEmptyContentDataInLines(request.mouseContentHorizontalOffset - lineWidth);
			return request.fulfillContentEmpty(pos, detail);
		}

		const visibleRange = ctx.visibleRangeForPosition(lineNumber, column);

		if (!visibleRange) {
			return request.fulfillUnknown(pos);
		}

		const columnHorizontalOffset = visibleRange.left;

		if (Math.abs(request.mouseContentHorizontalOffset - columnHorizontalOffset) < 1) {
			return request.fulfillContentText(pos, null, { mightBeForeignElement: !!injectedText, injectedText });
		}

		// Let's define a, b, c and check if the offset is in between them...
		interface OffsetColumn { offset: number; column: number }

		const points: OffsetColumn[] = [];
		points.push({ offset: visibleRange.left, column: column });
		if (column > 1) {
			const visibleRange = ctx.visibleRangeForPosition(lineNumber, column - 1);
			if (visibleRange) {
				points.push({ offset: visibleRange.left, column: column - 1 });
			}
		}
		const lineMaxColumn = ctx.viewModel.getLineMaxColumn(lineNumber);
		if (column < lineMaxColumn) {
			const visibleRange = ctx.visibleRangeForPosition(lineNumber, column + 1);
			if (visibleRange) {
				points.push({ offset: visibleRange.left, column: column + 1 });
			}
		}

		points.sort((a, b) => a.offset - b.offset);

		const mouseCoordinates = request.pos.toClientCoordinates();
		const spanNodeClientRect = spanNode.getBoundingClientRect();
		const mouseIsOverSpanNode = (spanNodeClientRect.left <= mouseCoordinates.clientX && mouseCoordinates.clientX <= spanNodeClientRect.right);

		let rng: EditorRange | null = null;

		for (let i = 1; i < points.length; i++) {
			const prev = points[i - 1];
			const curr = points[i];
			if (prev.offset <= request.mouseContentHorizontalOffset && request.mouseContentHorizontalOffset <= curr.offset) {
				rng = new EditorRange(lineNumber, prev.column, lineNumber, curr.column);

				// See https://github.com/microsoft/vscode/issues/152819
				// Due to the use of zwj, the browser's hit test result is skewed towards the left
				// Here we try to correct that if the mouse horizontal offset is closer to the right than the left

				const prevDelta = Math.abs(prev.offset - request.mouseContentHorizontalOffset);
				const nextDelta = Math.abs(curr.offset - request.mouseContentHorizontalOffset);

				pos = (
					prevDelta < nextDelta
						? new Position(lineNumber, prev.column)
						: new Position(lineNumber, curr.column)
				);

				break;
			}
		}

		return request.fulfillContentText(pos, rng, { mightBeForeignElement: !mouseIsOverSpanNode || !!injectedText, injectedText });
	}
}


function shadowCaretRangeFromPoint(shadowRoot: ShadowRoot, x: number, y: number): Range {
	const range = document.createRange();

	// Get the element under the point
	let el: Element | null = (<any>shadowRoot).elementFromPoint(x, y);

	if (el !== null) {
		// Get the last child of the element until its firstChild is a text node
		// This assumes that the pointer is on the right of the line, out of the tokens
		// and that we want to get the offset of the last token of the line
		while (el && el.firstChild && el.firstChild.nodeType !== el.firstChild.TEXT_NODE && el.lastChild && el.lastChild.firstChild) {
			el = <Element>el.lastChild;
		}

		// Grab its rect
		const rect = el.getBoundingClientRect();

		// And its font
		const font = window.getComputedStyle(el, null).getPropertyValue('font');

		// And also its txt content
		const text = (el as any).innerText;

		// Position the pixel cursor at the left of the element
		let pixelCursor = rect.left;
		let offset = 0;
		let step: number;

		// If the point is on the right of the box put the cursor after the last character
		if (x > rect.left + rect.width) {
			offset = text.length;
		} else {
			const charWidthReader = CharWidthReader.getInstance();
			// Goes through all the characters of the innerText, and checks if the x of the point
			// belongs to the character.
			for (let i = 0; i < text.length + 1; i++) {
				// The step is half the width of the character
				step = charWidthReader.getCharWidth(text.charAt(i), font) / 2;
				// Move to the center of the character
				pixelCursor += step;
				// If the x of the point is smaller that the position of the cursor, the point is over that character
				if (x < pixelCursor) {
					offset = i;
					break;
				}
				// Move between the current character and the next
				pixelCursor += step;
			}
		}

		// Creates a range with the text node of the element and set the offset found
		range.setStart(el.firstChild!, offset);
		range.setEnd(el.firstChild!, offset);
	}

	return range;
}

class CharWidthReader {
	private static _INSTANCE: CharWidthReader | null = null;

	public static getInstance(): CharWidthReader {
		if (!CharWidthReader._INSTANCE) {
			CharWidthReader._INSTANCE = new CharWidthReader();
		}
		return CharWidthReader._INSTANCE;
	}

	private readonly _cache: { [cacheKey: string]: number };
	private readonly _canvas: HTMLCanvasElement;

	private constructor() {
		this._cache = {};
		this._canvas = document.createElement('canvas');
	}

	public getCharWidth(char: string, font: string): number {
		const cacheKey = char + font;
		if (this._cache[cacheKey]) {
			return this._cache[cacheKey];
		}

		const context = this._canvas.getContext('2d')!;
		context.font = font;
		const metrics = context.measureText(char);
		const width = metrics.width;
		this._cache[cacheKey] = width;
		return width;
	}
}
