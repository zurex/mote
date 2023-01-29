import { localize } from 'mote/nls';
import { Event } from 'mote/base/common/event';
import { Disposable, DisposableStore, MutableDisposable } from 'mote/base/common/lifecycle';
import { format } from 'mote/base/common/strings';
import { withNullAsUndefined } from 'mote/base/common/types';
import { getMoteEditor, IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { IWorkbenchContribution } from 'mote/workbench/common/contributions';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';
import { runAtThisOrScheduleAtNextAnimationFrame } from 'mote/base/browser/dom';
import { IStatusbarEntry, IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from 'mote/workbench/services/statusbar/browser/statusbar';
import { EditorRange } from 'mote/editor/common/core/editorRange';

interface IEditorSelectionStatus {
	selections?: EditorSelection[];
	charactersSelected?: number;
}

class StateChange {
	indentation: boolean = false;
	selectionStatus: boolean = false;
	languageId: boolean = false;
	languageStatus: boolean = false;
	encoding: boolean = false;
	EOL: boolean = false;
	tabFocusMode: boolean = false;
	columnSelectionMode: boolean = false;
	metadata: boolean = false;

	combine(other: StateChange) {
		this.indentation = this.indentation || other.indentation;
		this.selectionStatus = this.selectionStatus || other.selectionStatus;
		this.languageId = this.languageId || other.languageId;
		this.languageStatus = this.languageStatus || other.languageStatus;
		this.encoding = this.encoding || other.encoding;
		this.EOL = this.EOL || other.EOL;
		this.tabFocusMode = this.tabFocusMode || other.tabFocusMode;
		this.columnSelectionMode = this.columnSelectionMode || other.columnSelectionMode;
		this.metadata = this.metadata || other.metadata;
	}

	hasChanges(): boolean {
		return this.indentation
			|| this.selectionStatus
			|| this.languageId
			|| this.languageStatus
			|| this.encoding
			|| this.EOL
			|| this.tabFocusMode
			|| this.columnSelectionMode
			|| this.metadata;
	}
}

type StateDelta = (
	{ type: 'selectionStatus'; selectionStatus: string | undefined }
	| { type: 'languageId'; languageId: string | undefined }
	| { type: 'encoding'; encoding: string | undefined }
	| { type: 'EOL'; EOL: string | undefined }
	| { type: 'indentation'; indentation: string | undefined }
	| { type: 'tabFocusMode'; tabFocusMode: boolean }
	| { type: 'columnSelectionMode'; columnSelectionMode: boolean }
	| { type: 'metadata'; metadata: string | undefined }
);

class State {

	private _selectionStatus: string | undefined;
	get selectionStatus(): string | undefined { return this._selectionStatus; }

	private _languageId: string | undefined;
	get languageId(): string | undefined { return this._languageId; }

	private _encoding: string | undefined;
	get encoding(): string | undefined { return this._encoding; }

	private _EOL: string | undefined;
	get EOL(): string | undefined { return this._EOL; }

	private _indentation: string | undefined;
	get indentation(): string | undefined { return this._indentation; }

	private _tabFocusMode: boolean | undefined;
	get tabFocusMode(): boolean | undefined { return this._tabFocusMode; }

	private _columnSelectionMode: boolean | undefined;
	get columnSelectionMode(): boolean | undefined { return this._columnSelectionMode; }

	private _metadata: string | undefined;
	get metadata(): string | undefined { return this._metadata; }

	update(update: StateDelta): StateChange {
		const change = new StateChange();

		switch (update.type) {
			case 'selectionStatus':
				if (this._selectionStatus !== update.selectionStatus) {
					this._selectionStatus = update.selectionStatus;
					change.selectionStatus = true;
				}
				break;

			case 'indentation':
				if (this._indentation !== update.indentation) {
					this._indentation = update.indentation;
					change.indentation = true;
				}
				break;

			case 'languageId':
				if (this._languageId !== update.languageId) {
					this._languageId = update.languageId;
					change.languageId = true;
				}
				break;

			case 'encoding':
				if (this._encoding !== update.encoding) {
					this._encoding = update.encoding;
					change.encoding = true;
				}
				break;

			case 'EOL':
				if (this._EOL !== update.EOL) {
					this._EOL = update.EOL;
					change.EOL = true;
				}
				break;

			case 'tabFocusMode':
				if (this._tabFocusMode !== update.tabFocusMode) {
					this._tabFocusMode = update.tabFocusMode;
					change.tabFocusMode = true;
				}
				break;

			case 'columnSelectionMode':
				if (this._columnSelectionMode !== update.columnSelectionMode) {
					this._columnSelectionMode = update.columnSelectionMode;
					change.columnSelectionMode = true;
				}
				break;

			case 'metadata':
				if (this._metadata !== update.metadata) {
					this._metadata = update.metadata;
					change.metadata = true;
				}
				break;
		}

		return change;
	}
}

const nlsSingleSelectionRange = localize('singleSelectionRange', "Ln {0}, Col {1} ({2} selected)");
const nlsSingleSelection = localize('singleSelection', "Ln {0}, Col {1}");
const nlsMultiSelectionRange = localize('multiSelectionRange', "{0} selections ({1} characters selected)");
const nlsMultiSelection = localize('multiSelection', "{0} selections");
const nlsEOLLF = localize('endOfLineLineFeed', "LF");
const nlsEOLCRLF = localize('endOfLineCarriageReturnLineFeed', "CRLF");


export class EditorStatus extends Disposable implements IWorkbenchContribution {

	private readonly selectionElement = this._register(new MutableDisposable<IStatusbarEntryAccessor>());

	private readonly state = new State();
	private readonly activeEditorListeners = this._register(new DisposableStore());
	private readonly delayedRender = this._register(new MutableDisposable());
	private toRender: StateChange | null = null;


	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IStatusbarService private readonly statusbarService: IStatusbarService,
	) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {
		this._register(this.editorService.onDidActiveEditorChange(() => this.updateStatusBar()));
	}

	private updateStatusBar(): void {
		//const activeInput = this.editorService.activeEditor;
		const activeEditorPane = this.editorService.activeEditorPane;
		const activeMoteEditor = activeEditorPane ? withNullAsUndefined(getMoteEditor(activeEditorPane.getControl())) : undefined;

		// Update all states
		this.onSelectionChange(activeMoteEditor);

		// Dispose old active editor listeners
		this.activeEditorListeners.clear();

		// Attach new listeners to active code editor
		if (activeMoteEditor) {
			// Hook Listener for Selection changes
			this.activeEditorListeners.add(Event.defer(activeMoteEditor.onDidChangeCursorPosition)(() => {
				this.onSelectionChange(activeMoteEditor);
				//this.currentProblemStatus.update(activeMoteEditor);
			}));

			// Hook Listener for content changes
			this.activeEditorListeners.add(Event.accumulate(activeMoteEditor.onDidChangeModelContent)(e => {
				//this.onEOLChange(activeMoteEditor);
				//this.currentProblemStatus.update(activeMoteEditor);

				const selections = activeMoteEditor.getSelections();
				if (selections) {
					for (const inner of e) {
						for (const change of inner.changes) {
							if (selections.some(selection => EditorRange.areIntersecting(selection, change.range))) {
								this.onSelectionChange(activeMoteEditor);
								break;
							}
						}
					}
				}
			}));

		}
	}

	private onSelectionChange(editorWidget: IMoteEditor | undefined): void {
		const info: IEditorSelectionStatus = Object.create(null);

		// We only support text based editors
		if (editorWidget) {

			// Compute selection(s)
			info.selections = editorWidget.getSelections() || [];

			// Compute selection length
			info.charactersSelected = 0;
			const textModel = editorWidget.getModel();
			if (textModel) {
				for (const selection of info.selections) {
					if (typeof info.charactersSelected !== 'number') {
						info.charactersSelected = 0;
					}

					info.charactersSelected += textModel.getCharacterCountInRange(selection);
				}
			}

			// Compute the visible column for one selection. This will properly handle tabs and their configured widths
			if (info.selections.length === 1) {
				const editorPosition = editorWidget.getPosition();

				const selectionClone = new EditorSelection(
					info.selections[0].selectionStartLineNumber,
					info.selections[0].selectionStartColumn,
					info.selections[0].positionLineNumber,
					editorPosition ? editorWidget.getStatusbarColumn(editorPosition) : info.selections[0].positionColumn
				);

				info.selections[0] = selectionClone;
			}
		}

		this.updateState({ type: 'selectionStatus', selectionStatus: this.getSelectionLabel(info) });
	}

	private updateElement(element: MutableDisposable<IStatusbarEntryAccessor>, props: IStatusbarEntry, id: string, alignment: StatusbarAlignment, priority: number) {
		if (!element.value) {
			element.value = this.statusbarService.addEntry(props, id, alignment, priority);
		} else {
			element.value.update(props);
		}
	}

	private updateState(update: StateDelta): void {
		const changed = this.state.update(update);
		if (!changed.hasChanges()) {
			return; // Nothing really changed
		}

		if (!this.toRender) {
			this.toRender = changed;

			this.delayedRender.value = runAtThisOrScheduleAtNextAnimationFrame(() => {
				this.delayedRender.clear();

				const toRender = this.toRender;
				this.toRender = null;
				if (toRender) {
					this.doRenderNow(toRender);
				}
			});
		} else {
			this.toRender.combine(changed);
		}
	}

	private doRenderNow(changed: StateChange): void {
		this.updateSelectionElement(this.state.selectionStatus);
	}

	private getSelectionLabel(info: IEditorSelectionStatus): string | undefined {
		if (!info || !info.selections) {
			return undefined;
		}

		if (info.selections.length === 1) {
			if (info.charactersSelected) {
				return format(nlsSingleSelectionRange, info.selections[0].positionLineNumber, info.selections[0].positionColumn, info.charactersSelected);
			}

			return format(nlsSingleSelection, info.selections[0].positionLineNumber, info.selections[0].positionColumn);
		}

		if (info.charactersSelected) {
			return format(nlsMultiSelectionRange, info.selections.length, info.charactersSelected);
		}

		if (info.selections.length > 0) {
			return format(nlsMultiSelection, info.selections.length);
		}

		return undefined;
	}

	private updateSelectionElement(text: string | undefined): void {
		if (!text) {
			this.selectionElement.clear();
			return;
		}

		const props: IStatusbarEntry = {
			name: localize('status.editor.selection', "Editor Selection"),
			text,
			ariaLabel: text,
			tooltip: localize('gotoLine', "Go to Line/Column"),
			command: 'workbench.action.gotoLine'
		};

		this.updateElement(this.selectionElement, props, 'status.editor.selection', StatusbarAlignment.RIGHT, 100.5);
	}
}
