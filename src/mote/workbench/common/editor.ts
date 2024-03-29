import { localize } from 'mote/nls';
import { Event } from 'mote/base/common/event';
import BlockStore from 'mote/platform/store/common/blockStore';
import RecordCacheStore from 'mote/platform/store/common/recordCacheStore';
import { IStoreService } from 'mote/platform/store/common/store';
import { GUEST_USER } from 'mote/platform/user/common/user';
import { IComposite, ICompositeControl } from 'mote/workbench/common/composite';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { IUserService } from 'mote/workbench/services/user/common/user';
import { IEditorGroup } from 'mote/workbench/services/editor/common/editorGroupsService';
import { URI } from 'mote/base/common/uri';
import { BrandedService, IConstructorSignature, IInstantiationService, ServicesAccessor } from 'mote/platform/instantiation/common/instantiation';
import { IPathData } from 'mote/platform/window/common/window';
import { Disposable, IDisposable, toDisposable } from 'mote/base/common/lifecycle';
import { IEditorOptions } from 'mote/platform/editor/common/editor';
import { Registry } from 'mote/platform/registry/common/platform';
import { IContextKeyService } from 'mote/platform/contextkey/common/contextkey';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';
import { IEditor } from 'mote/editor/common/editorCommon';

export type GroupIdentifier = number;


// Static values for editor contributions
export const EditorExtensions = {
	EditorPane: 'workbench.contributions.editors',
	EditorFactory: 'workbench.contributions.editor.inputFactories'
};

// Static information regarding the text editor
export const DEFAULT_EDITOR_ASSOCIATION = {
	id: 'default',
	displayName: localize('promptOpenWith.defaultEditor.displayName', "Text Editor"),
	providerDisplayName: localize('builtinProviderDisplayName', "Built-in")
};

/**
 * Marker interface for the control inside an editor pane. Callers
 * have to cast the control to work with it, e.g. via methods
 * such as `isCodeEditor(control)`.
 */
export interface IEditorControl extends ICompositeControl { }

/**
 * The editor pane is the container for workbench editors.
 */
export interface IEditorPane extends IComposite {

	/**
	 * The context key service for this editor. Should be overridden by
	 * editors that have their own ScopedContextKeyService
	 */
	readonly scopedContextKeyService: IContextKeyService | undefined;

	/**
	 * Returns the underlying control of this editor. Callers need to cast
	 * the control to a specific instance as needed, e.g. by using the
	 * `isCodeEditor` helper method to access the text code editor.
	 *
	 * Use the `onDidChangeControl` event to track whenever the control
	 * changes.
	 */
	getControl(): IEditorControl | undefined;

	/**
	 * Returns the current view state of the editor if any.
	 *
	 * This method is optional to override for the editor pane
	 * and should only be overridden when the pane can deal with
	 * `IEditorOptions.viewState` to be applied when opening.
	 */
	getViewState(): object | undefined;

	/**
	 * An optional method to return the current selection in
	 * the editor pane in case the editor pane has a selection
	 * concept.
	 *
	 * Clients of this method will typically react to the
	 * `onDidChangeSelection` event to receive the current
	 * selection as needed.
	 */
	getSelection?(): IEditorPaneSelection | undefined;

	/**
	 * Finds out if this editor is visible or not.
	 */
	isVisible(): boolean;
}

export const enum EditorPaneSelectionChangeReason {

	/**
	 * The selection was changed as a result of a programmatic
	 * method invocation.
	 *
	 * For a text editor pane, this for example can be a selection
	 * being restored from previous view state automatically.
	 */
	PROGRAMMATIC = 1,

	/**
	 * The selection was changed by the user.
	 *
	 * This typically means the user changed the selection
	 * with mouse or keyboard.
	 */
	USER,

	/**
	 * The selection was changed as a result of editing in
	 * the editor pane.
	 *
	 * For a text editor pane, this for example can be typing
	 * in the text of the editor pane.
	 */
	EDIT,

	/**
	 * The selection was changed as a result of a navigation
	 * action.
	 *
	 * For a text editor pane, this for example can be a result
	 * of selecting an entry from a text outline view.
	 */
	NAVIGATION,

	/**
	 * The selection was changed as a result of a jump action
	 * from within the editor pane.
	 *
	 * For a text editor pane, this for example can be a result
	 * of invoking "Go to definition" from a symbol.
	 */
	JUMP
}

export interface IEditorPaneSelectionChangeEvent {

	/**
	 * More details for how the selection was made.
	 */
	reason: EditorPaneSelectionChangeReason;
}

export interface IEditorPaneSelection {

	/**
	 * Asks to compare this selection to another selection.
	 */
	compare(otherSelection: IEditorPaneSelection): EditorPaneSelectionCompareResult;

	/**
	 * Asks to massage the provided `options` in a way
	 * that the selection can be restored when the editor
	 * is opened again.
	 *
	 * For a text editor this means to apply the selected
	 * line and column as text editor options.
	 */
	restore(options: IEditorOptions): IEditorOptions;

	/**
	 * Only used for logging to print more info about the selection.
	 */
	log?(): string;
}

export const enum EditorPaneSelectionCompareResult {

	/**
	 * The selections are identical.
	 */
	IDENTICAL = 1,

	/**
	 * The selections are similar.
	 *
	 * For a text editor this can mean that the one
	 * selection is in close proximity to the other
	 * selection.
	 *
	 * Upstream clients may decide in this case to
	 * not treat the selection different from the
	 * previous one because it is not distinct enough.
	 */
	SIMILAR = 2,

	/**
	 * The selections are entirely different.
	 */
	DIFFERENT = 3
}

export interface IEditorPaneWithSelection extends IEditorPane {

	readonly onDidChangeSelection: Event<IEditorPaneSelectionChangeEvent>;

	getSelection(): IEditorPaneSelection | undefined;
}

export function isEditorPaneWithSelection(editorPane: IEditorPane | undefined): editorPane is IEditorPaneWithSelection {
	const candidate = editorPane as IEditorPaneWithSelection | undefined;

	return !!candidate && typeof candidate.getSelection === 'function' && !!candidate.onDidChangeSelection;
}

/**
 * Try to retrieve the view state for the editor pane that
 * has the provided editor input opened, if at all.
 *
 * This method will return `undefined` if the editor input
 * is not visible in any of the opened editor panes.
 */
export function findViewStateForEditor(input: EditorInput, group: GroupIdentifier, editorService: IEditorService): object | undefined {
	for (const editorPane of editorService.visibleEditorPanes) {
		if (editorPane.group.id === group && input.matches(editorPane.input)) {
			return editorPane.getViewState();
		}
	}

	return undefined;
}

/**
 * Overrides `IEditorPane` where `input` and `group` are known to be set.
 */
export interface IVisibleEditorPane extends IEditorPane {
	readonly input: EditorInput;
	readonly group: IEditorGroup;
}

/**
 * The text editor pane is the container for workbench text editors.
 */
export interface ITextEditorPane extends IEditorPane {

	/**
	 * Returns the underlying text editor widget of this editor.
	 */
	getControl(): IEditor | undefined;
}

export interface IEditorFactoryRegistry {
	/**
	 * Registers a editor serializer for the given editor to the registry.
	 * An editor serializer is capable of serializing and deserializing editor
	 * from string data.
	 *
	 * @param editorTypeId the type identifier of the editor
	 * @param serializer the editor serializer for serialization/deserialization
	 */
	registerEditorSerializer<Services extends BrandedService[]>(editorTypeId: string, ctor: { new(...Services: Services): IEditorSerializer }): IDisposable;

	/**
	 * Returns the editor serializer for the given editor.
	 */
	getEditorSerializer(editor: EditorInput): IEditorSerializer | undefined;
	getEditorSerializer(editorTypeId: string): IEditorSerializer | undefined;

	/**
	 * Starts the registry by providing the required services.
	 */
	start(accessor: ServicesAccessor): void;
}

export interface IEditorSerializer {
	/**
	 * Determines whether the given editor can be serialized by the serializer.
	 */
	canSerialize(editor: EditorInput): boolean;

	/**
	 * Returns a string representation of the provided editor that contains enough information
	 * to deserialize back to the original editor from the deserialize() method.
	 */
	serialize(editor: EditorInput): string | undefined;

	/**
	 * Returns an editor from the provided serialized form of the editor. This form matches
	 * the value returned from the serialize() method.
	 */
	deserialize(instantiationService: IInstantiationService, serializedEditor: string): EditorInput | undefined;
}

export const enum Verbosity {
	SHORT,
	MEDIUM,
	LONG
}

export const enum SaveReason {

	/**
	 * Explicit user gesture.
	 */
	EXPLICIT = 1,

	/**
	 * Auto save after a timeout.
	 */
	AUTO = 2,

	/**
	 * Auto save after editor focus change.
	 */
	FOCUS_CHANGE = 3,

	/**
	 * Auto save after window change.
	 */
	WINDOW_CHANGE = 4
}

export type SaveSource = string;

interface ISaveSourceDescriptor {
	source: SaveSource;
	label: string;
}

class SaveSourceFactory {

	private readonly mapIdToSaveSource = new Map<SaveSource, ISaveSourceDescriptor>();

	/**
	 * Registers a `SaveSource` with an identifier and label
	 * to the registry so that it can be used in save operations.
	 */
	registerSource(id: string, label: string): SaveSource {
		let sourceDescriptor = this.mapIdToSaveSource.get(id);
		if (!sourceDescriptor) {
			sourceDescriptor = { source: id, label };
			this.mapIdToSaveSource.set(id, sourceDescriptor);
		}

		return sourceDescriptor.source;
	}

	getSourceLabel(source: SaveSource): string {
		return this.mapIdToSaveSource.get(source)?.label ?? source;
	}
}

export const SaveSourceRegistry = new SaveSourceFactory();


export interface ISaveOptions {

	/**
	 * An indicator how the save operation was triggered.
	 */
	reason?: SaveReason;

	/**
	 * An indicator about the source of the save operation.
	 *
	 * Must use `SaveSourceRegistry.registerSource()` to obtain.
	 */
	readonly source?: SaveSource;

	/**
	 * Forces to save the contents of the working copy
	 * again even if the working copy is not dirty.
	 */
	readonly force?: boolean;

	/**
	 * Instructs the save operation to skip any save participants.
	 */
	readonly skipSaveParticipants?: boolean;

	/**
	 * A hint as to which file systems should be available for saving.
	 */
	readonly availableFileSystems?: string[];
}

export interface IRevertOptions {

	/**
	 * Forces to load the contents of the working copy
	 * again even if the working copy is not dirty.
	 */
	readonly force?: boolean;

	/**
	 * A soft revert will clear dirty state of a working copy
	 * but will not attempt to load it from its persisted state.
	 *
	 * This option may be used in scenarios where an editor is
	 * closed and where we do not require to load the contents.
	 */
	readonly soft?: boolean;
}

export interface IMoveResult {
	editor: EditorInput;
	options?: IEditorOptions;
}

export const enum EditorInputCapabilities {

	/**
	 * Signals no specific capability for the input.
	 */
	None = 0,

	/**
	 * Signals that the input is readonly.
	 */
	Readonly = 1 << 1,

	/**
	 * Signals that the input is untitled.
	 */
	Untitled = 1 << 2,

	/**
	 * Signals that the input can only be shown in one group
	 * and not be split into multiple groups.
	 */
	Singleton = 1 << 3,

	/**
	 * Signals that the input requires workspace trust.
	 */
	RequiresTrust = 1 << 4,

	/**
	 * Signals that the editor can split into 2 in the same
	 * editor group.
	 */
	CanSplitInGroup = 1 << 5,

	/**
	 * Signals that the editor wants it's description to be
	 * visible when presented to the user. By default, a UI
	 * component may decide to hide the description portion
	 * for brevity.
	 */
	ForceDescription = 1 << 6,

	/**
	 * Signals that the editor supports dropping into the
	 * editor by holding shift.
	 */
	CanDropIntoEditor = 1 << 7,

	/**
	 * Signals that the editor is composed of multiple editors
	 * within.
	 */
	MultipleEditors = 1 << 8
}

export interface IEditorDescriptor<T extends IEditorPane> {
	/**
	 * The unique type identifier of the editor. All instances
	 * of the same `IEditorPane` should have the same type
	 * identifier.
	 */
	readonly typeId: string;

	/**
	 * The display name of the editor.
	 */
	readonly name: string;

	/**
	 * Instantiates the editor pane using the provided services.
	 */
	instantiate(instantiationService: IInstantiationService): T;

	/**
	 * Whether the descriptor is for the provided editor pane.
	 */
	describes(editorPane: T): boolean;
}

/**
 * Context passed into `EditorPane#setInput` to give additional
 * context information around why the editor was opened.
 */
export interface IEditorOpenContext {

	/**
	 * An indicator if the editor input is new for the group the editor is in.
	 * An editor is new for a group if it was not part of the group before and
	 * otherwise was already opened in the group and just became the active editor.
	 *
	 * This hint can e.g. be used to decide whether to restore view state or not.
	 */
	newInGroup?: boolean;
}

export interface IEditorIdentifier {
	groupId: GroupIdentifier;
	editor: EditorInput;
}

export function isEditorIdentifier(identifier: unknown): identifier is IEditorIdentifier {
	const candidate = identifier as IEditorIdentifier | undefined;

	return typeof candidate?.groupId === 'number' && isEditorInput(candidate.editor);
}

/**
 * The editor commands context is used for editor commands (e.g. in the editor title)
 * and we must ensure that the context is serializable because it potentially travels
 * to the extension host!
 */
export interface IEditorCommandsContext {
	groupId: GroupIdentifier;
	editorIndex?: number;

	preserveFocus?: boolean;
}

/**
 * More information around why an editor was closed in the model.
 */
export enum EditorCloseContext {

	/**
	 * No specific context for closing (e.g. explicit user gesture).
	 */
	UNKNOWN,

	/**
	 * The editor closed because it was replaced with another editor.
	 * This can either happen via explicit replace call or when an
	 * editor is in preview mode and another editor opens.
	 */
	REPLACE,

	/**
	 * The editor closed as a result of moving it to another group.
	 */
	MOVE,

	/**
	 * The editor closed because another editor turned into preview
	 * and this used to be the preview editor before.
	 */
	UNPIN
}

export interface IEditorCloseEvent extends IEditorIdentifier {

	/**
	 * More information around why the editor was closed.
	 */
	readonly context: EditorCloseContext;

	/**
	 * The index of the editor before closing.
	 */
	readonly index: number;

	/**
	 * Whether the editor was sticky or not.
	 */
	readonly sticky: boolean;
}

export interface IActiveEditorChangeEvent {

	/**
	 * The new active editor or `undefined` if the group is empty.
	 */
	editor: EditorInput | undefined;
}

export interface IEditorWillMoveEvent extends IEditorIdentifier {

	/**
	 * The target group of the move operation.
	 */
	readonly target: GroupIdentifier;
}

export interface IEditorWillOpenEvent extends IEditorIdentifier { }


export const enum GroupModelChangeKind {

	/* Group Changes */
	GROUP_ACTIVE,
	GROUP_INDEX,
	GROUP_LOCKED,

	/* Editor Changes */
	EDITOR_OPEN,
	EDITOR_CLOSE,
	EDITOR_MOVE,
	EDITOR_ACTIVE,
	EDITOR_LABEL,
	EDITOR_CAPABILITIES,
	EDITOR_PIN,
	EDITOR_STICKY,
	EDITOR_DIRTY,
	EDITOR_WILL_DISPOSE
}

export interface IWorkbenchEditorConfiguration {
	workbench?: {
		editor?: IEditorPartConfiguration;
		iconTheme?: string;
	};
}

interface IEditorPartConfiguration {
	showTabs?: boolean;
	wrapTabs?: boolean;
	scrollToSwitchTabs?: boolean;
	highlightModifiedTabs?: boolean;
	tabCloseButton?: 'left' | 'right' | 'off';
	tabSizing?: 'fit' | 'shrink';
	pinnedTabSizing?: 'normal' | 'compact' | 'shrink';
	titleScrollbarSizing?: 'default' | 'large';
	focusRecentEditorAfterClose?: boolean;
	showIcons?: boolean;
	enablePreview?: boolean;
	enablePreviewFromQuickOpen?: boolean;
	enablePreviewFromCodeNavigation?: boolean;
	closeOnFileDelete?: boolean;
	openPositioning?: 'left' | 'right' | 'first' | 'last';
	openSideBySideDirection?: 'right' | 'down';
	closeEmptyGroups?: boolean;
	autoLockGroups?: Set<string>;
	revealIfOpen?: boolean;
	mouseBackForwardToNavigate?: boolean;
	labelFormat?: 'default' | 'short' | 'medium' | 'long';
	restoreViewState?: boolean;
	splitInGroupLayout?: 'vertical' | 'horizontal';
	splitSizing?: 'split' | 'distribute';
	splitOnDragAndDrop?: boolean;
	limit?: {
		enabled?: boolean;
		excludeDirty?: boolean;
		value?: number;
		perEditorGroup?: boolean;
	};
	decorations?: {
		badges?: boolean;
		colors?: boolean;
	};
}

export interface IEditorPartOptions extends IEditorPartConfiguration {
	hasIcons?: boolean;
}

export interface IEditorPartOptionsChangeEvent {
	oldPartOptions: IEditorPartOptions;
	newPartOptions: IEditorPartOptions;
}

export enum SideBySideEditor {
	PRIMARY = 1,
	SECONDARY = 2,
	BOTH = 3,
	ANY = 4
}

export interface IMatchEditorOptions {

	/**
	 * Whether to consider a side by side editor as matching.
	 * By default, side by side editors will not be considered
	 * as matching, even if the editor is opened in one of the sides.
	 */
	supportSideBySide?: SideBySideEditor.ANY | SideBySideEditor.BOTH;

	/**
	 * Only consider an editor to match when the
	 * `candidate === editor` but not when
	 * `candidate.matches(editor)`.
	 */
	strictEquals?: boolean;
}


export async function pathToEditor(path: IPathData, accessor: ServicesAccessor) {
	if (!path) {
		return undefined;
	}
	const resource = URI.revive(path.fileUri);
	if (!resource) {
		return;
	}

	if (resource.path.length !== 42) {
		return;
	}

	//const remoteService = accessor.get(IRemoteService);
	const userService = accessor.get(IUserService);
	const pointer = { table: 'page', id: resource.path.substring(6) };
	// Set to guest as default behavior
	let userId = GUEST_USER;
	if (userService.currentProfile) {
		userId = userService.currentProfile.id;
	}
	const blockStore = new BlockStore(
		pointer,
		userId,
		[],
		RecordCacheStore.Default,
		accessor.get(IStoreService)
	);
	return Promise.resolve({ resource, store: blockStore });
}

export abstract class AbstractEditorInput extends Disposable {
	// Marker class for implementing `isEditorInput`
}

export function isEditorInput(editor: unknown): editor is EditorInput {
	return editor instanceof AbstractEditorInput;
}

export interface EditorInputWithPreferredResource {

	/**
	 * An editor may provide an additional preferred resource alongside
	 * the `resource` property. While the `resource` property serves as
	 * unique identifier of the editor that should be used whenever we
	 * compare to other editors, the `preferredResource` should be used
	 * in places where e.g. the resource is shown to the user.
	 *
	 * For example: on Windows and macOS, the same URI with different
	 * casing may point to the same file. The editor may chose to
	 * "normalize" the URIs so that only one editor opens for different
	 * URIs. But when displaying the editor label to the user, the
	 * preferred URI should be used.
	 *
	 * Not all editors have a `preferredResource`. The `EditorResourceAccessor`
	 * utility can be used to always get the right resource without having
	 * to do instanceof checks.
	 */
	readonly preferredResource: URI;
}

export function isEditorInputWithPreferredResource(editor: unknown): editor is EditorInputWithPreferredResource {
	const candidate = editor as EditorInputWithPreferredResource | undefined;

	return URI.isUri(candidate?.preferredResource);
}

export interface ISideBySideEditorInput extends EditorInput {

	/**
	 * The primary editor input is shown on the right hand side.
	 */
	primary: EditorInput;

	/**
	 * The secondary editor input is shown on the left hand side.
	 */
	secondary: EditorInput;
}

export function isSideBySideEditorInput(editor: unknown): editor is ISideBySideEditorInput {
	const candidate = editor as ISideBySideEditorInput | undefined;

	return isEditorInput(candidate?.primary) && isEditorInput(candidate?.secondary);
}

export interface EditorInputWithOptions {
	editor: EditorInput;
	options?: IEditorOptions;
}

export function isEditorInputWithOptions(editor: unknown): editor is EditorInputWithOptions {
	const candidate = editor as EditorInputWithOptions | undefined;

	return isEditorInput(candidate?.editor);
}

export interface EditorInputWithOptionsAndGroup extends EditorInputWithOptions {
	group: IEditorGroup;
}

export function isEditorInputWithOptionsAndGroup(editor: unknown): editor is EditorInputWithOptionsAndGroup {
	const candidate = editor as EditorInputWithOptionsAndGroup | undefined;

	return isEditorInputWithOptions(editor) && candidate?.group !== undefined;
}

export const enum EditorsOrder {

	/**
	 * Editors sorted by most recent activity (most recent active first)
	 */
	MOST_RECENTLY_ACTIVE,

	/**
	 * Editors sorted by sequential order
	 */
	SEQUENTIAL
}

class EditorFactoryRegistry implements IEditorFactoryRegistry {

	private instantiationService: IInstantiationService | undefined;

	private readonly editorSerializerConstructors = new Map<string /* Type ID */, IConstructorSignature<IEditorSerializer>>();
	private readonly editorSerializerInstances = new Map<string /* Type ID */, IEditorSerializer>();

	start(accessor: ServicesAccessor): void {
		const instantiationService = this.instantiationService = accessor.get(IInstantiationService);

		for (const [key, ctor] of this.editorSerializerConstructors) {
			this.createEditorSerializer(key, ctor, instantiationService);
		}

		this.editorSerializerConstructors.clear();
	}

	private createEditorSerializer(editorTypeId: string, ctor: IConstructorSignature<IEditorSerializer>, instantiationService: IInstantiationService): void {
		const instance = instantiationService.createInstance(ctor);
		this.editorSerializerInstances.set(editorTypeId, instance);
	}

	registerEditorSerializer(editorTypeId: string, ctor: IConstructorSignature<IEditorSerializer>): IDisposable {
		if (this.editorSerializerConstructors.has(editorTypeId) || this.editorSerializerInstances.has(editorTypeId)) {
			throw new Error(`A editor serializer with type ID '${editorTypeId}' was already registered.`);
		}

		if (!this.instantiationService) {
			this.editorSerializerConstructors.set(editorTypeId, ctor);
		} else {
			this.createEditorSerializer(editorTypeId, ctor, this.instantiationService);
		}

		return toDisposable(() => {
			this.editorSerializerConstructors.delete(editorTypeId);
			this.editorSerializerInstances.delete(editorTypeId);
		});
	}

	getEditorSerializer(editor: EditorInput): IEditorSerializer | undefined;
	getEditorSerializer(editorTypeId: string): IEditorSerializer | undefined;
	getEditorSerializer(arg1: string | EditorInput): IEditorSerializer | undefined {
		return this.editorSerializerInstances.get(typeof arg1 === 'string' ? arg1 : arg1.typeId);
	}

}

Registry.add(EditorExtensions.EditorFactory, new EditorFactoryRegistry());
