import * as dom from 'mote/base/browser/dom';
import * as platform from 'mote/base/common/platform';
import * as viewEvents from 'mote/editor/common/viewEvents';

import { Disposable, IDisposable } from 'mote/base/common/lifecycle';
import { MouseTarget, MouseTargetFactory, PointerHandlerLastRenderData } from 'mote/editor/browser/controller/mouseTarget';
import { IMouseTarget, IMouseTargetOutsideEditor, MouseTargetType } from 'mote/editor/browser/editorBrowser';
import { ClientCoordinates, createCoordinatesRelativeToEditor, createEditorPagePosition, EditorMouseEvent, EditorMouseEventFactory, GlobalEditorPointerMoveMonitor, PageCoordinates } from 'mote/editor/browser/editorDom';
import { HorizontalPosition } from 'mote/editor/browser/view/renderingContext';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewController } from 'mote/editor/browser/view/viewController';
import { EditorOption } from 'mote/editor/common/config/editorOptions';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { Position } from 'mote/editor/common/core/position';
import { ViewEventHandler } from 'mote/editor/common/viewEventHandler';
import { NavigationCommandRevealType } from 'mote/editor/browser/command/navigationCommands';

export interface IPointerHandlerHelper {
	viewDomNode: HTMLElement;
	linesContentDomNode: HTMLElement;
	viewLinesDomNode: HTMLElement;

	focusTextArea(): void;
	dispatchTextAreaEvent(event: CustomEvent): void;

	/**
	 * Get the last rendered information for cursors & textarea.
	 */
	getLastRenderData(): PointerHandlerLastRenderData;

	/**
	 * Render right now
	 */
	renderNow(): void;

	shouldSuppressMouseDownOnViewZone(viewZoneId: string): boolean;
	shouldSuppressMouseDownOnWidget(widgetId: string): boolean;

	/**
	 * Decode a position from a rendered dom node
	 */
	getPositionFromDOMInfo(spanNode: HTMLElement, offset: number): Position | null;

	visibleRangeForPosition(lineNumber: number, column: number): HorizontalPosition | null;
	getLineWidth(lineNumber: number): number;
}

export class MouseHandler extends ViewEventHandler {

	protected mouseTargetFactory: MouseTargetFactory;
	protected readonly _mouseDownOperation: MouseDownOperation;
	private lastMouseLeaveTime: number;
	private _height: number;
	private _mouseLeaveMonitor: IDisposable | null = null;

	constructor(
		protected context: ViewContext,
		protected viewController: ViewController,
		protected viewHelper: IPointerHandlerHelper
	) {
		super();

		this.mouseTargetFactory = new MouseTargetFactory(this.context, viewHelper);

		this._mouseDownOperation = this._register(new MouseDownOperation(
			this.context,
			this.viewController,
			this.viewHelper,
			this.mouseTargetFactory,
			(e, testEventTarget) => this._createMouseTarget(e, testEventTarget),
			(e) => this._getMouseColumn(e)
		));

		this.lastMouseLeaveTime = -1;
		this._height = this.context.configuration.options.get(EditorOption.LayoutInfo).height;

		const mouseEvents = new EditorMouseEventFactory(this.viewHelper.viewDomNode);

		this._register(mouseEvents.onMouseMove(this.viewHelper.viewDomNode, (e) => {
			this._onMouseMove(e);

			// See https://github.com/microsoft/vscode/issues/138789
			// When moving the mouse really quickly, the browser sometimes forgets to
			// send us a `mouseleave` or `mouseout` event. We therefore install here
			// a global `mousemove` listener to manually recover if the mouse goes outside
			// the editor. As soon as the mouse leaves outside of the editor, we
			// remove this listener

			if (!this._mouseLeaveMonitor) {
				this._mouseLeaveMonitor = dom.addDisposableListener(document, 'mousemove', (e) => {
					if (!this.viewHelper.viewDomNode.contains(e.target as Node | null)) {
						// went outside the editor!
						this._onMouseLeave(new EditorMouseEvent(e, false, this.viewHelper.viewDomNode));
					}
				});
			}
		}));

		this._register(mouseEvents.onMouseUp(this.viewHelper.viewDomNode, (e) => this._onMouseUp(e)));

		// `pointerdown` events can't be used to determine if there's a double click, or triple click
		// because their `e.detail` is always 0.
		// We will therefore save the pointer id for the mouse and then reuse it in the `mousedown` event
		// for `element.setPointerCapture`.
		const capturePointerId: number = 0;
		this._register(mouseEvents.onMouseDown(this.viewHelper.viewDomNode, (e) => this._onMouseDown(e, capturePointerId)));

		this._register(mouseEvents.onMouseLeave(this.viewHelper.viewDomNode, (e) => this._onMouseLeave(e)));

		this.context.addEventHandler(this);

	}

	public override onCursorStateChanged(e: viewEvents.ViewCursorStateChangedEvent): boolean {
		this._mouseDownOperation.onCursorStateChanged(e);
		return false;
	}

	public getTargetAtClientPoint(clientX: number, clientY: number): IMouseTarget | null {
		const clientPos = new ClientCoordinates(clientX, clientY);
		const pos = clientPos.toPageCoordinates();
		const editorPos = createEditorPagePosition(this.viewHelper.viewDomNode);

		if (pos.y < editorPos.y || pos.y > editorPos.y + editorPos.height || pos.x < editorPos.x || pos.x > editorPos.x + editorPos.width) {
			return null;
		}

		const relativePos = createCoordinatesRelativeToEditor(this.viewHelper.viewDomNode, editorPos, pos);
		return this.mouseTargetFactory.createMouseTarget(this.viewHelper.getLastRenderData(), editorPos, pos, relativePos, null);
	}

	protected _createMouseTarget(e: EditorMouseEvent, testEventTarget: boolean): IMouseTarget {
		let target = e.target;
		if (!this.viewHelper.viewDomNode.contains(target)) {
			const shadowRoot = dom.getShadowRoot(this.viewHelper.viewDomNode);
			if (shadowRoot) {
				target = (<any>shadowRoot).elementsFromPoint(e.posx, e.posy).find(
					(el: Element) => this.viewHelper.viewDomNode.contains(el)
				);
			}
		}
		return this.mouseTargetFactory.createMouseTarget(this.viewHelper.getLastRenderData(), e.editorPos, e.pos, e.relativePos, testEventTarget ? target : null);
	}

	private _getMouseColumn(e: EditorMouseEvent): number {
		return this.mouseTargetFactory.getMouseColumn(e.relativePos);
	}

	protected _onMouseMove(e: EditorMouseEvent): void {
		const targetIsWidget = false;
		if (!targetIsWidget) {
			e.preventDefault();
		}

		if (this._mouseDownOperation.isActive()) {
			// In selection/drag operation
			return;
		}
		const actualMouseMoveTime = e.timestamp;
		if (actualMouseMoveTime < this.lastMouseLeaveTime) {
			// Due to throttling, this event occurred before the mouse left the editor, therefore ignore it.
			return;
		}

		this.viewController.emitMouseMove({
			event: e,
			target: this._createMouseTarget(e, true)
		});
	}

	protected _onMouseLeave(e: EditorMouseEvent): void {
		if (this._mouseLeaveMonitor) {
			this._mouseLeaveMonitor.dispose();
			this._mouseLeaveMonitor = null;
		}
		this.lastMouseLeaveTime = (new Date()).getTime();
		this.viewController.emitMouseLeave({
			event: e,
			target: null
		});
	}

	protected _onMouseUp(e: EditorMouseEvent): void {
		this.viewController.emitMouseUp({
			event: e,
			target: this._createMouseTarget(e, true)
		});
	}

	protected _onMouseDown(e: EditorMouseEvent, pointerId: number): void {
		const t = this._createMouseTarget(e, true);

		const targetIsContent = (t.type === MouseTargetType.CONTENT_TEXT || t.type === MouseTargetType.CONTENT_EMPTY);
		const targetIsLineNumbers = false;
		const selectOnLineNumbers = false;

		let shouldHandle = e.leftButton || e.middleButton;
		if (platform.isMacintosh && e.leftButton && e.ctrlKey) {
			shouldHandle = false;
		}

		const focus = () => {
			e.preventDefault();
			this.viewHelper.focusTextArea();
		};

		if (shouldHandle && (targetIsContent || (targetIsLineNumbers && selectOnLineNumbers))) {
			focus();
			this._mouseDownOperation.start(t.type, e, pointerId);
		}

		this.viewController.emitMouseDown({
			event: e,
			target: t
		});
	}
}

class MouseDownOperation extends Disposable {

	private _currentSelection: EditorSelection;
	private _isActive: boolean;
	private _lastMouseEvent: EditorMouseEvent | null;

	private readonly _mouseMoveMonitor: GlobalEditorPointerMoveMonitor;
	private readonly _topBottomDragScrolling: TopBottomDragScrolling;
	private readonly _mouseState: MouseDownState;

	constructor(
		private readonly _context: ViewContext,
		private readonly _viewController: ViewController,
		private readonly _viewHelper: IPointerHandlerHelper,
		private readonly _mouseTargetFactory: MouseTargetFactory,
		private readonly createMouseTarget: (e: EditorMouseEvent, testEventTarget: boolean) => IMouseTarget,
		getMouseColumn: (e: EditorMouseEvent) => number
	) {
		super();

		this._mouseState = new MouseDownState();

		this._currentSelection = new EditorSelection(1, 1, 1, 1);
		this._isActive = false;
		this._lastMouseEvent = null;

		this._mouseMoveMonitor = this._register(new GlobalEditorPointerMoveMonitor(this._viewHelper.viewDomNode));
		this._topBottomDragScrolling = this._register(new TopBottomDragScrolling(
			this._context,
			this._viewHelper,
			this._mouseTargetFactory,
			(position, inSelectionMode, revealType) => this.dispatchMouse(position, inSelectionMode, revealType)
		));
	}

	public isActive(): boolean {
		return this._isActive;
	}

	public onCursorStateChanged(e: viewEvents.ViewCursorStateChangedEvent): void {
		this._currentSelection = e.selections[0];
	}

	private onMouseDownThenMove(e: EditorMouseEvent): void {
		this._lastMouseEvent = e;
		this._mouseState.setModifiers(e);

		const position = this._findMousePosition(e, false);
		if (!position) {
			// Ignoring because position is unknown
			return;
		}

		if (this._mouseState.isDragAndDrop) {
			this._viewController.emitMouseDrag({
				event: e,
				target: position
			});
		} else {
			if (position.type === MouseTargetType.OUTSIDE_EDITOR && (position.outsidePosition === 'above' || position.outsidePosition === 'below')) {
				this._topBottomDragScrolling.start(position, e);
			} else {
				this._topBottomDragScrolling.stop();
				this.dispatchMouse(position, true, NavigationCommandRevealType.Minimal);
			}
		}
	}


	public start(targetType: MouseTargetType, e: EditorMouseEvent, pointerId: number): void {
		this._lastMouseEvent = e;

		this._mouseState.setStartButtons(e);
		this._mouseState.setModifiers(e);

		const position = this._findMousePosition(e, true);
		if (!position || !position.position) {
			// Ignoring because position is unknown
			return;
		}

		this._mouseState.trySetCount(e.detail, position.position);

		// Overwrite the detail of the MouseEvent, as it will be sent out in an event and contributions might rely on it.
		e.detail = this._mouseState.count;

		if (e.detail < 2 // only single click on a selection can work
			&& !this._isActive // the mouse is not down yet
			&& !this._currentSelection.isEmpty() // we don't drag single cursor
			&& (position.type === MouseTargetType.CONTENT_TEXT) // single click on text
			&& position.position && this._currentSelection.containsPosition(position.position) // single click on a selection
		) {
			this._mouseState.isDragAndDrop = true;
			this._isActive = true;

			this._mouseMoveMonitor.startMonitoring(
				this._viewHelper.viewLinesDomNode,
				pointerId,
				e.buttons,
				(e) => this.onMouseDownThenMove(e),
				(browserEvent?: MouseEvent | KeyboardEvent) => {
					const position = this._findMousePosition(this._lastMouseEvent!, false);

					if (browserEvent && browserEvent instanceof KeyboardEvent) {
						// cancel
						this._viewController.emitMouseDropCanceled();
					} else {
						this._viewController.emitMouseDrop({
							event: this._lastMouseEvent!,
							target: (position ? this.createMouseTarget(this._lastMouseEvent!, true) : null) // Ignoring because position is unknown, e.g., Content View Zone
						});
					}

					this.stop();
				}
			);

			return;
		}

		this._mouseState.isDragAndDrop = false;

		this.dispatchMouse(position, e.shiftKey, NavigationCommandRevealType.Minimal);

		if (!this._isActive) {
			this._isActive = true;
			this._mouseMoveMonitor.startMonitoring(
				this._viewHelper.viewLinesDomNode,
				pointerId,
				e.buttons,
				(e) => this.onMouseDownThenMove(e),
				() => this.stop()
			);
		}
	}

	private stop(): void {
		this._isActive = false;
		this._topBottomDragScrolling.stop();
	}

	private _findMousePosition(e: EditorMouseEvent, testEventTarget: boolean): IMouseTarget | null {
		const t = this.createMouseTarget(e, testEventTarget);
		const hintedPosition = t.position;
		if (!hintedPosition) {
			return null;
		}

		return t;
	}

	private dispatchMouse(position: IMouseTarget, inSelectionMode: boolean, revealType: NavigationCommandRevealType): void {
		if (!position.position) {
			return;
		}
		this._viewController.dispatchMouse({
			position: position.position,
			mouseColumn: position.mouseColumn,
			startedOnLineNumbers: this._mouseState.startedOnLineNumbers,
			revealType,

			inSelectionMode: inSelectionMode,
			mouseDownCount: this._mouseState.count,
			altKey: this._mouseState.altKey,
			ctrlKey: this._mouseState.ctrlKey,
			metaKey: this._mouseState.metaKey,
			shiftKey: this._mouseState.shiftKey,

			leftButton: this._mouseState.leftButton,
			middleButton: this._mouseState.middleButton,

			onInjectedText: position.type === MouseTargetType.CONTENT_TEXT && position.detail.injectedText !== null
		});
	}
}

class TopBottomDragScrolling extends Disposable {

	private _operation: TopBottomDragScrollingOperation | null;

	constructor(
		private readonly _context: ViewContext,
		private readonly _viewHelper: IPointerHandlerHelper,
		private readonly _mouseTargetFactory: MouseTargetFactory,
		private readonly _dispatchMouse: (position: IMouseTarget, inSelectionMode: boolean, revealType: NavigationCommandRevealType) => void,
	) {
		super();
		this._operation = null;
	}

	public override dispose(): void {
		super.dispose();
		this.stop();
	}

	public start(position: IMouseTargetOutsideEditor, mouseEvent: EditorMouseEvent): void {
		if (this._operation) {
			this._operation.setPosition(position, mouseEvent);
		} else {
			this._operation = new TopBottomDragScrollingOperation(this._context, this._viewHelper, this._mouseTargetFactory, this._dispatchMouse, position, mouseEvent);
		}
	}

	public stop(): void {
		if (this._operation) {
			this._operation.dispose();
			this._operation = null;
		}
	}
}

class TopBottomDragScrollingOperation extends Disposable {

	private _position: IMouseTargetOutsideEditor;
	private _mouseEvent: EditorMouseEvent;
	private _lastTime: number;
	private _animationFrameDisposable: IDisposable;

	constructor(
		private readonly _context: ViewContext,
		private readonly _viewHelper: IPointerHandlerHelper,
		private readonly _mouseTargetFactory: MouseTargetFactory,
		private readonly _dispatchMouse: (position: IMouseTarget, inSelectionMode: boolean, revealType: NavigationCommandRevealType) => void,
		position: IMouseTargetOutsideEditor,
		mouseEvent: EditorMouseEvent
	) {
		super();
		this._position = position;
		this._mouseEvent = mouseEvent;
		this._lastTime = Date.now();
		this._animationFrameDisposable = dom.scheduleAtNextAnimationFrame(() => this._execute());
	}

	public override dispose(): void {
		this._animationFrameDisposable.dispose();
	}

	public setPosition(position: IMouseTargetOutsideEditor, mouseEvent: EditorMouseEvent): void {
		this._position = position;
		this._mouseEvent = mouseEvent;
	}

	/**
	 * update internal state and return elapsed ms since last time
	 */
	private _tick(): number {
		const now = Date.now();
		const elapsed = now - this._lastTime;
		this._lastTime = now;
		return elapsed;
	}

	/**
	 * get the number of lines per second to auto-scroll
	 */
	private _getScrollSpeed(): number {
		const lineHeight = 30;//this._context.configuration.options.get(EditorOption.lineHeight);
		const viewportInLines = this._context.configuration.options.get(EditorOption.LayoutInfo).height / lineHeight;
		const outsideDistanceInLines = this._position.outsideDistance / lineHeight;

		if (outsideDistanceInLines <= 1.5) {
			return Math.max(30, viewportInLines * (1 + outsideDistanceInLines));
		}
		if (outsideDistanceInLines <= 3) {
			return Math.max(60, viewportInLines * (2 + outsideDistanceInLines));
		}
		return Math.max(200, viewportInLines * (7 + outsideDistanceInLines));
	}

	private _execute(): void {
		const lineHeight = 30;//this._context.configuration.options.get(EditorOption.lineHeight);
		const scrollSpeedInLines = this._getScrollSpeed();
		const elapsed = this._tick();
		const scrollInPixels = scrollSpeedInLines * (elapsed / 1000) * lineHeight;
		const scrollValue = (this._position.outsidePosition === 'above' ? -scrollInPixels : scrollInPixels);

		//this._context.viewModel.viewLayout.deltaScrollNow(0, scrollValue);
		//this._viewHelper.renderNow();

		const viewportData = null as any;//this._context.viewLayout.getLinesViewportData();
		const edgeLineNumber = (this._position.outsidePosition === 'above' ? viewportData.startLineNumber : viewportData.endLineNumber);

		// First, try to find a position that matches the horizontal position of the mouse
		let mouseTarget: IMouseTarget;
		{
			const editorPos = createEditorPagePosition(this._viewHelper.viewDomNode);
			const horizontalScrollbarHeight = 10;//this._context.configuration.options.get(EditorOption.LayoutInfo).horizontalScrollbarHeight;
			const pos = new PageCoordinates(this._mouseEvent.pos.x, editorPos.y + editorPos.height - horizontalScrollbarHeight - 0.1);
			const relativePos = createCoordinatesRelativeToEditor(this._viewHelper.viewDomNode, editorPos, pos);
			mouseTarget = this._mouseTargetFactory.createMouseTarget(this._viewHelper.getLastRenderData(), editorPos, pos, relativePos, null);
		}
		if (!mouseTarget.position || mouseTarget.position.lineNumber !== edgeLineNumber) {
			if (this._position.outsidePosition === 'above') {
				mouseTarget = MouseTarget.createOutsideEditor(this._position.mouseColumn, new Position(edgeLineNumber, 1), 'above', this._position.outsideDistance);
			} else {
				mouseTarget = MouseTarget.createOutsideEditor(this._position.mouseColumn, new Position(edgeLineNumber, this._context.viewModel.getLineMaxColumn(edgeLineNumber)), 'below', this._position.outsideDistance);
			}
		}

		this._dispatchMouse(mouseTarget, true, NavigationCommandRevealType.None);
		this._animationFrameDisposable = dom.scheduleAtNextAnimationFrame(() => this._execute());
	}
}

class MouseDownState {

	private static readonly CLEAR_MOUSE_DOWN_COUNT_TIME = 400; // ms

	private _altKey: boolean;
	public get altKey(): boolean { return this._altKey; }

	private _ctrlKey: boolean;
	public get ctrlKey(): boolean { return this._ctrlKey; }

	private _metaKey: boolean;
	public get metaKey(): boolean { return this._metaKey; }

	private _shiftKey: boolean;
	public get shiftKey(): boolean { return this._shiftKey; }

	private _leftButton: boolean;
	public get leftButton(): boolean { return this._leftButton; }

	private _middleButton: boolean;
	public get middleButton(): boolean { return this._middleButton; }

	private _startedOnLineNumbers: boolean;
	public get startedOnLineNumbers(): boolean { return this._startedOnLineNumbers; }

	private _lastMouseDownPosition: Position | null;
	private _lastMouseDownPositionEqualCount: number;
	private _lastMouseDownCount: number;
	private _lastSetMouseDownCountTime: number;
	public isDragAndDrop: boolean;

	constructor() {
		this._altKey = false;
		this._ctrlKey = false;
		this._metaKey = false;
		this._shiftKey = false;
		this._leftButton = false;
		this._middleButton = false;
		this._startedOnLineNumbers = false;
		this._lastMouseDownPosition = null;
		this._lastMouseDownPositionEqualCount = 0;
		this._lastMouseDownCount = 0;
		this._lastSetMouseDownCountTime = 0;
		this.isDragAndDrop = false;
	}

	public get count(): number {
		return this._lastMouseDownCount;
	}

	public setModifiers(source: EditorMouseEvent) {
		this._altKey = source.altKey;
		this._ctrlKey = source.ctrlKey;
		this._metaKey = source.metaKey;
		this._shiftKey = source.shiftKey;
	}

	public setStartButtons(source: EditorMouseEvent) {
		this._leftButton = source.leftButton;
		this._middleButton = source.middleButton;
	}

	public setStartedOnLineNumbers(startedOnLineNumbers: boolean): void {
		this._startedOnLineNumbers = startedOnLineNumbers;
	}

	public trySetCount(setMouseDownCount: number, newMouseDownPosition: Position): void {
		// a. Invalidate multiple clicking if too much time has passed (will be hit by IE because the detail field of mouse events contains garbage in IE10)
		const currentTime = (new Date()).getTime();
		if (currentTime - this._lastSetMouseDownCountTime > MouseDownState.CLEAR_MOUSE_DOWN_COUNT_TIME) {
			setMouseDownCount = 1;
		}
		this._lastSetMouseDownCountTime = currentTime;

		// b. Ensure that we don't jump from single click to triple click in one go (will be hit by IE because the detail field of mouse events contains garbage in IE10)
		if (setMouseDownCount > this._lastMouseDownCount + 1) {
			setMouseDownCount = this._lastMouseDownCount + 1;
		}

		// c. Invalidate multiple clicking if the logical position is different
		if (this._lastMouseDownPosition && this._lastMouseDownPosition.equals(newMouseDownPosition)) {
			this._lastMouseDownPositionEqualCount++;
		} else {
			this._lastMouseDownPositionEqualCount = 1;
		}
		this._lastMouseDownPosition = newMouseDownPosition;

		// Finally set the lastMouseDownCount
		this._lastMouseDownCount = Math.min(setMouseDownCount, this._lastMouseDownPositionEqualCount);
	}

}
