import 'vs/css!./media/editor';
import * as dom from 'mote/base/browser/dom';
import { Disposable, DisposableStore, IDisposable } from 'mote/base/common/lifecycle';
import * as editorBrowser from 'mote/editor/browser/editorBrowser';
import * as editorCommon from 'mote/editor/common/editorCommon';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { IDimension } from 'vs/editor/common/core/dimension';
import { Emitter, EmitterOptions, Event, EventDeliveryQueue } from 'mote/base/common/event';
import BlockStore from 'mote/platform/store/common/blockStore';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { EditorView, IOverlayWidgetData } from 'mote/editor/browser/editorView';
import { ICommandDelegate, ViewController } from 'mote/editor/browser/view/viewController';
import { TextSelection } from 'mote/editor/common/core/rangeUtils';
import { EditorExtensionsRegistry, IEditorContributionDescription } from 'mote/editor/browser/editorExtensions';
import { EditorConfiguration, IEditorConstructionOptions } from 'mote/editor/browser/config/editorConfiguration';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { IContextKey, IContextKeyService } from 'mote/platform/contextkey/common/contextkey';
import { EditorContextKeys } from 'mote/editor/common/editorContextKeys';
import { ViewUserInputEvents } from 'mote/editor/browser/view/viewUserInputEvents';
import { ILogService } from 'vs/platform/log/common/log';
import { ViewModel } from 'mote/editor/common/viewModel/viewModelImpl';
import { TextModel } from 'mote/editor/common/model/textModel';
import { OutgoingViewModelEventKind } from 'mote/editor/common/viewModelEventsCollector';
import { IViewModel } from 'mote/editor/common/viewModel';
import { IMoteEditorService } from 'mote/editor/browser/services/moteEditorService';
import { EditorOption } from 'mote/editor/common/config/editorOptions';
import { ITextModel } from 'mote/editor/common/model';
import { withNullAsUndefined } from 'mote/base/common/types';
import { InternalEditorAction } from 'mote/editor/common/editorAction';
import { DOMLineBreaksComputerFactory } from 'mote/editor/browser/view/domLineBreaksComputerFactory';
import { MonospaceLineBreaksComputerFactory } from 'mote/editor/common/viewModel/monospaceLineBreaksComputer';

let EDITOR_ID = 0;

export interface IMoteEditorWidgetOptions {
	/**
	 * Contributions to instantiate.
	 * Defaults to EditorExtensionsRegistry.getEditorContributions().
	 */
	contributions?: IEditorContributionDescription[];
}

class ModelData implements IDisposable {

	constructor(
		public readonly model: ITextModel,
		public readonly store: BlockStore,
		public readonly viewModel: ViewModel,
		public readonly viewController: ViewController,
		public readonly view: EditorView,
		public readonly hasRealView: boolean,
		public readonly listenersToRemove: DisposableStore
	) {

	}

	dispose() {
		this.listenersToRemove.dispose();
	}
}

export class MoteEditorWidget extends Disposable implements editorBrowser.IMoteEditor {

	private readonly _deliveryQueue = new EventDeliveryQueue();

	private readonly _onDidDispose: Emitter<void> = this._register(new Emitter<void>());
	public readonly onDidDispose: Event<void> = this._onDidDispose.event;

	private readonly _onDidChangeSelection: Emitter<TextSelection> = this._register(new Emitter<TextSelection>({ deliveryQueue: this._deliveryQueue }));
	public readonly onDidChangeSelection: Event<TextSelection> = this._onDidChangeSelection.event;

	private readonly _editorWidgetFocus: BooleanEventEmitter = this._register(new BooleanEventEmitter({ deliveryQueue: this._deliveryQueue }));
	public readonly onDidFocusEditorWidget: Event<void> = this._editorWidgetFocus.onDidChangeToTrue;
	public readonly onDidBlurEditorWidget: Event<void> = this._editorWidgetFocus.onDidChangeToFalse;

	private readonly _editorTextFocus: BooleanEventEmitter = this._register(new BooleanEventEmitter({ deliveryQueue: this._deliveryQueue }));
	public readonly onDidFocusEditorText: Event<void> = this._editorTextFocus.onDidChangeToTrue;
	public readonly onDidBlurEditorText: Event<void> = this._editorTextFocus.onDidChangeToFalse;

	private readonly id: number;
	private readonly configuration: IEditorConfiguration;

	protected contributions: { [key: string]: editorCommon.IEditorContribution };

	protected readonly actions = new Map<string, editorCommon.IEditorAction>();

	private modelData: ModelData | null;

	protected readonly _contextKeyService: IContextKeyService;

	private overlayWidgets: { [key: string]: IOverlayWidgetData };

	constructor(
		private readonly domElement: HTMLElement,
		options: Readonly<IEditorConstructionOptions>,
		moteEditorWidgetOptions: IMoteEditorWidgetOptions,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService private logService: ILogService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IMoteEditorService protected readonly moteEditorService: IMoteEditorService,
	) {
		super();

		this.id = (++EDITOR_ID);
		this.modelData = null;
		this.overlayWidgets = {};
		this.contributions = {};

		this._contextKeyService = this._register(contextKeyService.createScoped(this.domElement));

		this.configuration = this._register(this.createConfiguration(false, {}));
		this.logService.info('[MoteEditorWidget] create with configuration', this.configuration);

		this._register(new EditorContextKeysManager(this, this._contextKeyService));

		let contributions: IEditorContributionDescription[];
		if (Array.isArray(moteEditorWidgetOptions.contributions)) {
			contributions = moteEditorWidgetOptions.contributions;
		} else {
			contributions = EditorExtensionsRegistry.getEditorContributions();
		}

		for (const desc of contributions) {
			if (this.contributions[desc.id]) {
				onUnexpectedError(new Error(`Cannot have two contributions with the same id ${desc.id}`));
				continue;
			}
			try {
				const contribution = this.instantiationService.createInstance(desc.ctor, this);
				this.contributions[desc.id] = contribution;
			} catch (err) {
				onUnexpectedError(err);
			}
		}

		for (const action of EditorExtensionsRegistry.getEditorActions()) {
			if (this.actions.has(action.id)) {
				onUnexpectedError(new Error(`Cannot have two actions with the same id ${action.id}`));
				continue;
			}
			const internalAction = new InternalEditorAction(
				action.id,
				action.label,
				action.alias,
				withNullAsUndefined(action.precondition),
				(): Promise<void> => {
					return this.instantiationService.invokeFunction((accessor) => {
						return Promise.resolve(action.runEditorCommand(accessor, this, null));
					});
				},
				this._contextKeyService
			);
			this.actions.set(internalAction.id, internalAction);
		}

		this.moteEditorService.addMoteEditor(this);
	}

	public get isSimpleWidget(): boolean {
		return false;
	}

	setStore(store: BlockStore) {
		if (store === undefined) {
			return;
		}
		if (null === store && this.modelData === null) {
			return;
		}
		if (this.modelData && this.modelData.store === store) {
			// Current store is the new store
			return;
		}

		this.detachStore();
		this.attachStore(store);
	}

	getStore() {
		return this.modelData?.store || null;
	}

	public getModel(): ITextModel | null {
		if (!this.modelData) {
			return null;
		}
		return this.modelData.model;
	}


	public _getViewModel(): IViewModel | null {
		if (!this.modelData) {
			return null;
		}
		return this.modelData.viewModel;
	}

	private attachStore(store: BlockStore) {

		const commandDelegate: ICommandDelegate = {
			type: (text: string) => {
				this._type('editable', text);
			},
			compositionType: (text: string, replacePrevCharCnt: number, replaceNextCharCnt: number, positionDelta: number) => {
				this._compositionType('editable', text, replacePrevCharCnt, replaceNextCharCnt, positionDelta);
			},
		};

		const textModel = new TextModel(store);
		const viewModel = new ViewModel(
			this.id, this.configuration, textModel,
			DOMLineBreaksComputerFactory.create(),
			MonospaceLineBreaksComputerFactory.create(this.configuration.options),
			(callback) => dom.scheduleAtNextAnimationFrame(callback),
		);

		const viewUserInputEvents = new ViewUserInputEvents(null as any);

		const viewController = new ViewController(this.configuration, viewModel, this.logService, viewUserInputEvents, commandDelegate, store.getContentStore());

		const listenersToRemove = new DisposableStore();

		listenersToRemove.add(viewModel.onEvent((e) => {
			switch (e.kind) {
				case OutgoingViewModelEventKind.SelectionChanged:
					this._onDidChangeSelection.fire(e.selection);
					break;
				case OutgoingViewModelEventKind.FocusChanged:
					this._editorTextFocus.setValue(e.hasFocus);
					break;
			}
		}));

		const [view, hasRealView] = this.createView(viewController, viewModel, store);
		if (hasRealView) {
			this.domElement.appendChild(view.domNode.domNode);

			const keys = Object.keys(this.overlayWidgets);
			for (let i = 0, len = keys.length; i < len; i++) {
				const widgetId = keys[i];
				view.addOverlayWidget(this.overlayWidgets[widgetId]);
			}

			view.render(false, true);
		}

		this.modelData = new ModelData(textModel, store, viewModel, viewController, view, hasRealView, listenersToRemove);
	}

	private detachStore() {
		if (!this.modelData) {
			return;
		}

		const removeDomNode = this.modelData.hasRealView ? this.modelData.view.domNode.domNode : null;

		if (removeDomNode && this.domElement.contains(removeDomNode)) {
			this.domElement.removeChild(removeDomNode);
		}

		this.modelData.dispose();
	}

	private createView(viewController: ViewController, viewModel: IViewModel, pageStore: BlockStore): [EditorView, boolean] {
		const editorView = this.instantiationService.createInstance(
			EditorView, this.configuration, viewController, viewModel, pageStore);
		return [editorView, true];
	}

	trigger(source: string | null | undefined, handlerId: string, payload: any): void {
		payload = payload || {};
		switch (handlerId) {
			case editorCommon.Handler.Decorate:
				this.modelData?.viewController.decorate(payload);
				return;
		}
	}

	getId(): string {
		return this.getEditorType() + ':' + this.id;
	}
	getEditorType(): string {
		return editorCommon.EditorType.IDocumentEditor;
	}

	public override dispose(): void {
		const keys = Object.keys(this.contributions);
		for (let i = 0, len = keys.length; i < len; i++) {
			const contributionId = keys[i];
			this.contributions[contributionId].dispose();
		}
		this.contributions = {};
		this.overlayWidgets = {};

		this._onDidDispose.fire();

		super.dispose();
	}

	public invokeWithinContext<T>(fn: (accessor: ServicesAccessor) => T): T {
		return this.instantiationService.invokeFunction(fn);
	}

	addOverlayWidget(widget: editorBrowser.IOverlayWidget): void {
		const widgetData: IOverlayWidgetData = {
			widget: widget,
			position: widget.getPosition()
		};

		if (this.overlayWidgets.hasOwnProperty(widget.getId())) {
			console.warn('Overwriting an overlay widget with the same id.');
		}

		this.overlayWidgets[widget.getId()] = widgetData;
	}

	onHide(): void {
		throw new Error('Method not implemented.');
	}

	public getContribution<T extends editorCommon.IEditorContribution>(id: string): T | null {
		return <T>(this.contributions[id] || null);
	}

	layout(dimension?: IDimension | undefined): void {
		this.configuration.observeContainer(dimension);
		this.render(false);
	}

	focus(): void {
		throw new Error('Method not implemented.');
	}

	getSelection(): EditorSelection | null {
		if (!this.modelData) {
			return null;
		}
		return this.modelData.viewModel.getSelection();
	}

	public getSelections(): EditorSelection[] | null {
		if (!this.modelData) {
			return null;
		}
		return this.modelData.viewModel.getSelections();
	}

	public render(forceRedraw: boolean = false): void {
		if (!this.modelData || !this.modelData.hasRealView) {
			return;
		}
		this.modelData.view.render(true, forceRedraw);
	}

	private createConfiguration(isSimpleWidget: boolean, options: Readonly<IEditorConstructionOptions>,) {
		return new EditorConfiguration(isSimpleWidget, options, this.domElement);
	}

	public hasTextFocus(): boolean {
		if (!this.modelData || !this.modelData.hasRealView) {
			return false;
		}
		return this.modelData.view.isFocused();
	}

	public hasWidgetFocus(): boolean {
		return false;
		//return this.focusTracker && this.focusTracker.hasFocus();
	}

	private _type(source: string | null | undefined, text: string): void {
		if (!this.modelData || text.length === 0) {
			return;
		}
		this.modelData.viewModel.type(text, source);
	}

	private _compositionType(source: string | null | undefined, text: string, replacePrevCharCnt: number, replaceNextCharCnt: number, positionDelta: number): void {
		if (!this.modelData) {
			return;
		}
		this.modelData.viewModel.compositionType(text, replacePrevCharCnt, replaceNextCharCnt, positionDelta, source);
	}

	public pushUndoStop(): boolean {
		if (!this.modelData) {
			return false;
		}
		if (this.configuration.options.get(EditorOption.ReadOnly)) {
			// read only editor => sorry!
			return false;
		}
		this.modelData.model.pushStackElement();
		return true;
	}

	public popUndoStop(): boolean {
		if (!this.modelData) {
			return false;
		}
		if (this.configuration.options.get(EditorOption.ReadOnly)) {
			// read only editor => sorry!
			return false;
		}
		this.modelData.model.popStackElement();
		return true;
	}

	public executeCommands(source: string | null | undefined, commands: editorCommon.ICommand[]): void {
		if (!this.modelData) {
			return;
		}
		this.modelData.viewModel.executeCommands(commands, source);
	}
}

const enum BooleanEventValue {
	NotSet,
	False,
	True
}

export class BooleanEventEmitter extends Disposable {
	private readonly _onDidChangeToTrue: Emitter<void> = this._register(new Emitter<void>(this._emitterOptions));
	public readonly onDidChangeToTrue: Event<void> = this._onDidChangeToTrue.event;

	private readonly _onDidChangeToFalse: Emitter<void> = this._register(new Emitter<void>(this._emitterOptions));
	public readonly onDidChangeToFalse: Event<void> = this._onDidChangeToFalse.event;

	private _value: BooleanEventValue;

	constructor(
		private readonly _emitterOptions: EmitterOptions
	) {
		super();
		this._value = BooleanEventValue.NotSet;
	}

	public setValue(_value: boolean) {
		const value = (_value ? BooleanEventValue.True : BooleanEventValue.False);
		if (this._value === value) {
			return;
		}
		this._value = value;
		if (this._value === BooleanEventValue.True) {
			this._onDidChangeToTrue.fire();
		} else if (this._value === BooleanEventValue.False) {
			this._onDidChangeToFalse.fire();
		}
	}
}


class EditorContextKeysManager extends Disposable {
	private readonly _editor: MoteEditorWidget;

	private readonly _textInputFocus: IContextKey<boolean>;
	private readonly _editorTextFocus: IContextKey<boolean>;

	constructor(
		editor: MoteEditorWidget,
		contextKeyService: IContextKeyService
	) {
		super();

		this._editor = editor;

		this._textInputFocus = EditorContextKeys.textInputFocus.bindTo(contextKeyService);
		this._editorTextFocus = EditorContextKeys.editorTextFocus.bindTo(contextKeyService);

		this._register(this._editor.onDidFocusEditorWidget(() => this._updateFromFocus()));
		this._register(this._editor.onDidBlurEditorWidget(() => this._updateFromFocus()));

		this._register(this._editor.onDidFocusEditorText(() => this._updateFromFocus()));
		this._register(this._editor.onDidBlurEditorText(() => this._updateFromFocus()));

		this._updateFromFocus();
	}

	private _updateFromFocus(): void {
		//this._editorFocus.set(this._editor.hasWidgetFocus() && !this._editor.isSimpleWidget);
		this._editorTextFocus.set(this._editor.hasTextFocus() && !this._editor.isSimpleWidget);
		this._textInputFocus.set(this._editor.hasTextFocus());
	}
}
