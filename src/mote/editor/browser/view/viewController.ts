import * as viewEvents from 'mote/editor/common/viewEvents';
import { TextSelection, TextSelectionMode } from 'mote/editor/common/core/selectionUtils';
import { Transaction } from 'mote/editor/common/core/transaction';
import BlockStore from 'mote/platform/store/common/blockStore';
import RecordStore from 'mote/platform/store/common/recordStore';
import * as segmentUtils from 'mote/editor/common/segmentUtils';
import { collectValueFromSegment, IAnnotation, ISegment } from 'mote/editor/common/segmentUtils';
import { EditOperation } from 'mote/editor/common/core/editOperation';
import { keepLineTypes, textBasedTypes } from 'mote/editor/common/blockTypes';
import { Markdown } from 'mote/editor/common/markdown';
import { BugIndicatingError } from 'mote/base/common/errors';
import { Segment } from 'mote/editor/common/core/segment';
import { StoreUtils } from 'mote/platform/store/common/storeUtils';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { Disposable } from 'mote/base/common/lifecycle';
import { EditorOption } from 'mote/editor/common/config/editorOptions';
import { BlockTypes } from 'mote/platform/store/common/record';
import { IViewModel } from 'mote/editor/common/viewModel';
import { ViewUserInputEvents } from 'mote/editor/browser/view/viewUserInputEvents';
import { ILogService } from 'mote/platform/log/common/log';
import { IMouseWheelEvent } from 'mote/base/browser/mouseEvent';
import { IEditorMouseEvent, IPartialEditorMouseEvent } from 'mote/editor/browser/editorBrowser';
import { Position } from 'mote/editor/common/core/position';
import { CoreNavigationCommands, NavigationCommandRevealType } from 'mote/editor/browser/command/navigationCommands';
import { ViewModelEventDispatcher, ViewModelEventsCollector } from 'mote/editor/common/viewModelEventDispatcher';
import { IKeyboardEvent } from 'mote/base/browser/keyboardEvent';

export interface IMouseDispatchData {
	position: Position;
	/**
	 * Desired mouse column (e.g. when position.column gets clamped to text length -- clicking after text on a line).
	 */
	mouseColumn: number;
	revealType: NavigationCommandRevealType;
	startedOnLineNumbers: boolean;

	inSelectionMode: boolean;
	mouseDownCount: number;
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;

	leftButton: boolean;
	middleButton: boolean;
	onInjectedText: boolean;
}

export interface ICommandDelegate {
	type(text: string): void;
	compositionType(text: string, replacePrevCharCnt: number, replaceNextCharCnt: number, positionDelta: number): void;
}

export class ViewController extends Disposable {

	private selection: TextSelection;
	private readonly eventDispatcher: ViewModelEventDispatcher;

	constructor(
		private readonly configuration: IEditorConfiguration,
		private readonly viewModel: IViewModel,
		private readonly logService: ILogService,
		private readonly userInputEvents: ViewUserInputEvents,
		private readonly commandDelegate: ICommandDelegate,
		private readonly contentStore: RecordStore<string[]>,
	) {
		super();

		this.selection = { startIndex: 0, endIndex: 0, lineNumber: 0 };
		this.eventDispatcher = (viewModel as any).eventDispatcher;
	}

	//#region command expose to editable

	/**
	 * @deprecated use {@link ViewController#moveTo} instead.
	 * @param selection
	 */
	public select(selection: TextSelection): void {
		console.log(selection);
		this.setSelection(selection);
	}

	public updateProperties(data: any) {
	}

	public insert(text: string): void {
	}

	public type(text: string): void {
		this.commandDelegate.type(text);
	}

	/**
	 * Only used for editable input
	 * @deprecated
	 * @param text
	 */
	public editableType(text: string): void {
		this.executeCursorEdit(eventsCollector => {
			Transaction.createAndCommit((transaction) => {
				const titleStore = this.getTitleStore();
				this.onType(eventsCollector, titleStore, transaction, this.selection, text);
			}, this.contentStore.userId);
		});
	}

	/**
	 * Only used for editable input
	 * @deprecated
	 * @param text
	 */
	public editableCompositionType(text: string, replacePrevCharCnt: number, replaceNextCharCnt: number, positionDelta: number): void {
		this.executeCursorEdit(eventsCollector => {
			Transaction.createAndCommit((transaction) => {
				const titleStore = this.getTitleStore();
				this.onType(eventsCollector, titleStore, transaction, this.selection, text);
			}, this.contentStore.userId);
		});
	}

	public compositionType(text: string, replacePrevCharCnt: number, replaceNextCharCnt: number, positionDelta: number): void {
		this.commandDelegate.compositionType(text, replacePrevCharCnt, replaceNextCharCnt, positionDelta);
	}

	public backspace() {
		this.executeCursorEdit(eventsCollector => {
			Transaction.createAndCommit((transaction) => {
				const titleStore = this.getTitleStore();
				this.onBackspace(eventsCollector, titleStore, transaction, this.selection);
			}, this.contentStore.userId);
		});
	}

	public enter(): boolean {
		// We dont use executeCursorEdit because of some times user trigger this method
		// before the content store has any children
		this.withViewEventsCollector(eventsCollector => {
			Transaction.createAndCommit((transaction) => {
				let lineNumber: number;
				// create first child
				if (this.selection.lineNumber === 0) {
					let child: BlockStore = EditOperation.createBlockStore('text', transaction, this.contentStore);
					child = EditOperation.appendToParent(this.contentStore, child, transaction).child as BlockStore;
					lineNumber = 1;
				} else {
					let type = 'text';
					const lineStore = StoreUtils.createStoreForLineNumber(this.selection.lineNumber, this.contentStore);
					if (keepLineTypes.has(lineStore.getType() || '')) {
						// Some blocks required keep same styles in next line
						// Just like todo, list
						type = lineStore.getType()!;
					}
					let child: BlockStore = EditOperation.createBlockStore(type, transaction, this.contentStore);
					child = EditOperation.insertChildAfterTarget(
						this.contentStore, child, lineStore, transaction).child as BlockStore;
					lineNumber = StoreUtils.getLineNumberForStore(child, this.contentStore);
				}
				// emit the line change event
				eventsCollector.emitViewEvent(new viewEvents.ViewLinesInsertedEvent(lineNumber, lineNumber));
				this.setSelection({ startIndex: 0, endIndex: 0, lineNumber: lineNumber });
			}, this.contentStore.userId);
		});
		return true;
	}

	//#endregion

	/**
	 * The only way to set selection from outside is to use ViewController#select method
	 * setSelection is only works for internal usage
	 * @param selection
	 */
	private setSelection(selection: TextSelection) {
		if (selection.lineNumber < -1) {
			throw new BugIndicatingError('lineNumber should never be negative');
		}
		this.selection = Object.assign({}, this.selection);
		this.selection.startIndex = selection.startIndex;
		this.selection.endIndex = selection.endIndex;
		this.selection.lineNumber = selection.lineNumber ?? this.selection.lineNumber;
	}

	public getSelection() {
		return this.selection;
	}

	public isEmpty(lineNumber: number) {
		let titleStore: RecordStore;
		// header
		if (lineNumber === 0) {
			const pageStore = this.getPageStore();
			titleStore = pageStore.getTitleStore();
		} else {
			const store = StoreUtils.createStoreForLineNumber(lineNumber, this.contentStore);
			titleStore = store.getTitleStore();
		}
		const value: any[] = titleStore.getValue() || [];
		return value.length === 0;
	}

	private executeCursorEdit(callback: (eventsCollector: ViewModelEventsCollector) => void) {
		if (this.selection === null || this.selection.lineNumber < -1) {
			return;
		}
		const contents = this.contentStore.getValue() || [];
		if (this.selection.lineNumber > contents.length) {
			// Bad case, should we throw a BugIndicatingError here?
			return;
		}
		const titleStore = this.getTitleStore();
		if (!titleStore.canEdit() || !titleStore.state.ready) {
			// we couldn't operate on it
			return;
		}
		this.withViewEventsCollector(callback);
	}

	private withViewEventsCollector<T>(callback: (eventsCollector: ViewModelEventsCollector) => T): T {
		try {
			const eventsCollector = (this.viewModel as any).eventDispatcher.beginEmitViewEvents();
			return callback(eventsCollector);
		} finally {
			this.eventDispatcher.endEmitViewEvents();
		}
	}

	private getTitleStore() {
		let titleStore: RecordStore;
		// header
		if (this.selection.lineNumber === 0) {
			const pageStore = this.getPageStore();
			titleStore = pageStore.getTitleStore();
		} else {
			const store = StoreUtils.createStoreForLineNumber(this.selection.lineNumber, this.contentStore);
			titleStore = store.getTitleStore();
		}
		return titleStore;
	}

	private getPageStore() {
		return this.contentStore.recordStoreParentStore as BlockStore;
	}

	//#region line handle

	/**
	 *
	 * @param eventsCollector
	 * @param store titleStore
	 * @param transaction
	 * @param selection
	 */
	private onBackspace(eventsCollector: ViewModelEventsCollector, store: RecordStore, transaction: Transaction, selection: TextSelection) {
		if (0 !== selection.startIndex || 0 !== selection.endIndex) {
			let newSelection: TextSelection;
			if (selection.startIndex === selection.endIndex) {
				newSelection = { startIndex: selection.startIndex - 1, endIndex: selection.endIndex, lineNumber: selection.lineNumber };
			} else {
				newSelection = selection;
			}
			this.delete(transaction, store, newSelection);
		} else {
			const blockStore = StoreUtils.getParentBlockStore(store);
			if (blockStore) {
				const record = blockStore.getValue();
				if (record) {
					if (textBasedTypes.has(record.type)) {
						EditOperation.turnInto(blockStore, BlockTypes.text as any, transaction);
						eventsCollector.emitViewEvent(new viewEvents.ViewLinesChangedEvent(selection.lineNumber, 1));
					} else {
						EditOperation.removeChild(this.contentStore, store, transaction);
						const deletedLineNumber = this.selection.lineNumber;
						const newLineNumber = this.selection.lineNumber - 1;
						if (this.selection.lineNumber > 0) {
							const prevStore = StoreUtils.createStoreForLineNumber(newLineNumber, this.contentStore);
							const content = collectValueFromSegment(prevStore.getTitleStore().getValue());
							this.setSelection({ startIndex: content.length, endIndex: content.length, lineNumber: newLineNumber });
						} else {
							// reset to uninitialized state, don't manually set it in other case, use setSelection instead
							this.selection.lineNumber = -1;
							this.selection.startIndex = -1;
							this.selection.endIndex = -1;
						}
						eventsCollector.emitViewEvent(new viewEvents.ViewLinesDeletedEvent(deletedLineNumber, deletedLineNumber));
					}
				}
			}
		}
	}

	private onType(eventsCollector: ViewModelEventsCollector, store: RecordStore, transaction: Transaction, selection: TextSelection, newValue: string) {

		if (newValue === '\n') {
			this.enter();
		} else {
			EditOperation.addSetOperationForStore(
				store,
				[[newValue]],
				transaction
			);
		}
	}

	private _insert(eventsCollector: ViewModelEventsCollector, content: string, transaction: Transaction, store: RecordStore, selection: TextSelection, selectionMode: TextSelectionMode) {
		const userId = transaction.userId;
		if (TextSelectionMode.Editing !== selectionMode) {
			return;
		}

		this.delete(transaction, store, selection);

		if (content.length > 0) {
			const segment = segmentUtils.combineArray(content, []) as ISegment;

			const storeValue = store.getValue();

			const newSelection: TextSelection = {
				startIndex: selection.startIndex + content.length,
				endIndex: selection.endIndex + content.length,
				lineNumber: selection.lineNumber
			};

			this.setSelection(newSelection);

			EditOperation.addSetOperationForStore(
				store,
				segmentUtils.merge(storeValue, [segment], selection.startIndex),
				transaction
			);

			// Markdown part
			transaction.postSubmitActions.push(() => {
				const transaction = Transaction.create(userId);
				const contentChanged = Markdown.parse({
					delete: this.delete.bind(this),
					setSelection: this.setSelection.bind(this),
					store: store,
					transaction: transaction,
					selection: selection
				});
				if (contentChanged) {
					eventsCollector.emitViewEvent(new viewEvents.ViewLinesChangedEvent(selection.lineNumber, 1));
				}
				transaction.commit();
			});

			// Slash command

		}
	}

	private delete(transaction: Transaction, store: RecordStore, selection: TextSelection) {
		if (selection.startIndex !== selection.endIndex) {
			const storeValue = store.getValue();
			const newRecord = segmentUtils.remove(storeValue, selection.startIndex, selection.endIndex);

			const newSelection: TextSelection = {
				startIndex: selection.startIndex,
				endIndex: selection.startIndex,
				lineNumber: selection.lineNumber
			};

			this.setSelection(newSelection);
			console.log('newSelection:', newSelection);


			EditOperation.addSetOperationForStore(store, newRecord, transaction);

			const rootStore = store.getRecordStoreAtRootPath();
			if ('block' === rootStore.table) {
				segmentUtils.slice(storeValue, selection.startIndex, selection.endIndex);
			}


		} else {
			this.setSelection(selection);
		}
	}

	//#endregion

	//#region user input event

	public emitKeyDown(e: IKeyboardEvent): void {
		this.userInputEvents.emitKeyDown(e);
	}

	public emitKeyUp(e: IKeyboardEvent): void {
		this.userInputEvents.emitKeyUp(e);
	}

	public emitContextMenu(e: IEditorMouseEvent): void {
		this.userInputEvents.emitContextMenu(e);
	}

	public emitMouseMove(e: IEditorMouseEvent): void {
		this.userInputEvents.emitMouseMove(e);
	}

	public emitMouseLeave(e: IPartialEditorMouseEvent): void {
		this.userInputEvents.emitMouseLeave(e);
	}

	public emitMouseUp(e: IEditorMouseEvent): void {
		//this.logService.debug('[ViewController] emitMouseUp', e);
		this.userInputEvents.emitMouseUp(e);
	}

	public emitMouseDown(e: IEditorMouseEvent): void {
		//this.logService.debug('[ViewController] emitMouseDown', e);
		this.userInputEvents.emitMouseDown(e);
	}

	public emitMouseDrag(e: IEditorMouseEvent): void {
		this.userInputEvents.emitMouseDrag(e);
	}

	public emitMouseDrop(e: IPartialEditorMouseEvent): void {
		this.userInputEvents.emitMouseDrop(e);
	}

	public emitMouseDropCanceled(): void {
		this.userInputEvents.emitMouseDropCanceled();
	}

	public emitMouseWheel(e: IMouseWheelEvent): void {
		this.userInputEvents.emitMouseWheel(e);
	}

	private hasMulticursorModifier(data: IMouseDispatchData): boolean {
		return false;
	}

	public dispatchMouse(data: IMouseDispatchData): void {
		const options = this.configuration.options;
		const selectionClipboardIsOn = false;
		const columnSelection = options.get(EditorOption.ColumnSelection);

		if (data.middleButton && !selectionClipboardIsOn) {

		} else if (data.startedOnLineNumbers) {

		} else if (data.mouseDownCount >= 4) {

		} else if (data.mouseDownCount === 3) {

		} else if (data.mouseDownCount === 2) {

		} else {
			if (this.hasMulticursorModifier(data)) {

			} else {
				if (data.inSelectionMode) {
					if (data.altKey) {

					} else {
						if (columnSelection) {
							this.columnSelect(data.position, data.mouseColumn, true);
						} else {
							this.moveToSelect(data.position, data.revealType);
						}
					}
				} else {
					this.moveTo(data.position, data.revealType);
				}
			}
		}
	}

	public moveTo(viewPosition: Position, revealType: NavigationCommandRevealType): void {
		CoreNavigationCommands.MoveTo.runCoreEditorCommand(this.viewModel, this.usualArgs(viewPosition, revealType));
	}

	private moveToSelect(viewPosition: Position, revealType: NavigationCommandRevealType): void {
		CoreNavigationCommands.MoveToSelect.runCoreEditorCommand(this.viewModel, this.usualArgs(viewPosition, revealType));
	}

	private columnSelect(viewPosition: Position, mouseColumn: number, doColumnSelect: boolean): void {
		viewPosition = this.validateViewColumn(viewPosition);
		CoreNavigationCommands.ColumnSelect.runCoreEditorCommand(this.viewModel, {
			source: 'mouse',
			position: this.convertViewToModelPosition(viewPosition),
			viewPosition: viewPosition,
			mouseColumn: mouseColumn,
			doColumnSelect: doColumnSelect
		});
	}

	private convertViewToModelPosition(viewPosition: Position): Position {
		return this.viewModel.coordinatesConverter.convertViewPositionToModelPosition(viewPosition);
	}

	private usualArgs(viewPosition: Position, revealType: NavigationCommandRevealType): CoreNavigationCommands.MoveCommandOptions {
		viewPosition = this.validateViewColumn(viewPosition);
		return {
			source: 'mouse',
			position: this.convertViewToModelPosition(viewPosition),
			viewPosition,
			revealType
		};
	}

	private validateViewColumn(viewPosition: Position): Position {
		const minColumn = this.viewModel.getLineMinColumn(viewPosition.lineNumber);
		if (viewPosition.column < minColumn) {
			return new Position(viewPosition.lineNumber, minColumn);
		}
		return viewPosition;
	}
	//#endregion
}
