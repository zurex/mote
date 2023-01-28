import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { IMoteEditorService } from 'mote/editor/browser/services/moteEditorService';
import { IEditorContribution } from 'mote/editor/common/editorCommon';
import { CommandsRegistry, ICommandHandlerDescription } from 'mote/platform/commands/common/commands';
import { IKeybindings, KeybindingsRegistry } from 'mote/platform/keybinding/common/keybindingsRegistry';
import { ThemeIcon } from 'mote/platform/theme/common/themeService';
import { withNullAsUndefined } from 'vs/base/common/types';
import { MenuId } from 'vs/platform/actions/common/actions';
import { ContextKeyExpr, ContextKeyExpression, IContextKeyService } from 'mote/platform/contextkey/common/contextkey';
import { BrandedService, IConstructorSignature, ServicesAccessor as InstantiationServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { Registry } from 'mote/platform/registry/common/platform';

export type ServicesAccessor = InstantiationServicesAccessor;
export type IEditorContributionCtor = IConstructorSignature<IEditorContribution, [IMoteEditor]>;

export interface IEditorContributionDescription {
	id: string;
	ctor: IEditorContributionCtor;
}

//#region Command

export interface ICommandKeybindingsOptions extends IKeybindings {
	kbExpr?: ContextKeyExpression | null;
	weight: number;
	/**
	 * the default keybinding arguments
	 */
	args?: any;
}

export interface ICommandMenuOptions {
	menuId: MenuId;
	group: string;
	order: number;
	when?: ContextKeyExpression;
	title: string;
	icon?: ThemeIcon;
}

export interface ICommandOptions {
	id: string;
	precondition: ContextKeyExpression | undefined;
	kbOpts?: ICommandKeybindingsOptions | ICommandKeybindingsOptions[];
	description?: ICommandHandlerDescription;
	menuOpts?: ICommandMenuOptions | ICommandMenuOptions[];
}

export abstract class Command {

	public readonly id: string;
	public readonly precondition: ContextKeyExpression | undefined;
	private readonly kbOpts: ICommandKeybindingsOptions | ICommandKeybindingsOptions[] | undefined;
	//private readonly menuOpts: ICommandMenuOptions | ICommandMenuOptions[] | undefined;
	private readonly description: ICommandHandlerDescription | undefined;

	constructor(opts: ICommandOptions) {
		this.id = opts.id;
		this.precondition = opts.precondition;
		this.kbOpts = opts.kbOpts;
		//this.menuOpts = opts.menuOpts;
		this.description = opts.description;
	}

	public register(): void {
		if (this.kbOpts) {
			const kbOptsArr = Array.isArray(this.kbOpts) ? this.kbOpts : [this.kbOpts];
			for (const kbOpts of kbOptsArr) {
				let kbWhen = kbOpts.kbExpr;
				if (this.precondition) {
					if (kbWhen) {
						kbWhen = ContextKeyExpr.and(kbWhen, this.precondition);
					} else {
						kbWhen = this.precondition;
					}
				}

				const desc = {
					id: this.id,
					weight: kbOpts.weight,
					args: kbOpts.args,
					when: kbWhen,
					primary: kbOpts.primary,
					secondary: kbOpts.secondary,
					win: kbOpts.win,
					linux: kbOpts.linux,
					mac: kbOpts.mac,
				};

				KeybindingsRegistry.registerKeybindingRule(desc);
			}
		}

		CommandsRegistry.registerCommand({
			id: this.id,
			handler: (accessor, args) => this.runCommand(accessor, args),
			description: this.description
		});
	}

	public abstract runCommand(accessor: ServicesAccessor, args: any): void | Promise<void>;
}

//#endregion


//#region EditorCommand

export interface IContributionCommandOptions<T> extends ICommandOptions {
	handler: (controller: T, args: any) => void;
}
export interface EditorControllerCommand<T extends IEditorContribution> {
	new(opts: IContributionCommandOptions<T>): EditorCommand;
}

export abstract class EditorCommand extends Command {

	/**
	 * Create a command class that is bound to a certain editor contribution.
	 */
	public static bindToContribution<T extends IEditorContribution>(controllerGetter: (editor: IMoteEditor) => T | null): EditorControllerCommand<T> {
		return class EditorControllerCommandImpl extends EditorCommand {
			private readonly _callback: (controller: T, args: any) => void;

			constructor(opts: IContributionCommandOptions<T>) {
				super(opts);

				this._callback = opts.handler;
			}

			public runEditorCommand(accessor: ServicesAccessor, editor: IMoteEditor, args: any): void {
				const controller = controllerGetter(editor);
				if (controller) {
					this._callback(controller, args);
				}
			}
		};
	}

	public static runEditorCommand(
		accessor: ServicesAccessor,
		args: any,
		precondition: ContextKeyExpression | undefined,
		runner: (accessor: ServicesAccessor | null, editor: IMoteEditor, args: any) => void | Promise<void>
	): void | Promise<void> {
		const moteEditorService = accessor.get(IMoteEditorService);

		// Find the editor with text focus or active
		const editor = moteEditorService.getFocusedMoteEditor() || moteEditorService.getActiveMoteEditor();
		if (!editor) {
			// well, at least we tried...
			return;
		}

		return editor.invokeWithinContext((editorAccessor) => {
			const kbService = editorAccessor.get(IContextKeyService);
			if (!kbService.contextMatchesRules(withNullAsUndefined(precondition))) {
				// precondition does not hold
				return;
			}

			return runner(editorAccessor, editor, args);
		});
	}

	public runCommand(accessor: ServicesAccessor, args: any): void | Promise<void> {
		return EditorCommand.runEditorCommand(accessor, args, this.precondition, (accessor, editor, args) => this.runEditorCommand(accessor, editor, args));
	}

	public abstract runEditorCommand(accessor: ServicesAccessor | null, editor: IMoteEditor, args: any): void | Promise<void>;
}

//#endregion

//#region EditorAction

export interface IEditorActionContextMenuOptions {
	group: string;
	order: number;
	when?: ContextKeyExpression;
	menuId?: MenuId;
}

export interface IActionOptions extends ICommandOptions {
	label: string;
	alias: string;
	contextMenuOpts?: IEditorActionContextMenuOptions | IEditorActionContextMenuOptions[];
}

export abstract class EditorAction extends EditorCommand {
	public readonly label: string;
	public readonly alias: string;

	constructor(opts: IActionOptions) {
		super(EditorAction.convertOptions(opts));
		this.label = opts.label;
		this.alias = opts.alias;
	}

	public runEditorCommand(accessor: ServicesAccessor, editor: IMoteEditor, args: any): void | Promise<void> {
		//this.reportTelemetry(accessor, editor);
		return this.run(accessor, editor, args || {});
	}

	public abstract run(accessor: ServicesAccessor, editor: IMoteEditor, args: any): void | Promise<void>;

	private static convertOptions(opts: IActionOptions): ICommandOptions {

		let menuOpts: ICommandMenuOptions[];
		if (Array.isArray(opts.menuOpts)) {
			menuOpts = opts.menuOpts;
		} else if (opts.menuOpts) {
			menuOpts = [opts.menuOpts];
		} else {
			menuOpts = [];
		}

		function withDefaults(item: Partial<ICommandMenuOptions>): ICommandMenuOptions {
			if (!item.menuId) {
				item.menuId = MenuId.EditorContext;
			}
			if (!item.title) {
				item.title = opts.label;
			}
			item.when = ContextKeyExpr.and(opts.precondition, item.when);
			return <ICommandMenuOptions>item;
		}

		if (Array.isArray(opts.contextMenuOpts)) {
			menuOpts.push(...opts.contextMenuOpts.map(withDefaults));
		} else if (opts.contextMenuOpts) {
			menuOpts.push(withDefaults(opts.contextMenuOpts));
		}

		opts.menuOpts = menuOpts;
		return <ICommandOptions>opts;
	}
}

//#endregion

//#region Registration of commands and actions

export function registerEditorCommand<T extends EditorCommand>(editorCommand: T): T {
	EditorContributionRegistry.INSTANCE.registerEditorCommand(editorCommand);
	return editorCommand;
}

export function registerEditorAction<T extends EditorAction>(ctor: { new(): T }): T {
	const action = new ctor();
	EditorContributionRegistry.INSTANCE.registerEditorAction(action);
	return action;
}

export function registerEditorContribution<Services extends BrandedService[]>(id: string, ctor: { new(editor: IMoteEditor, ...services: Services): IEditorContribution }): void {
	EditorContributionRegistry.INSTANCE.registerEditorContribution(id, ctor);
}

export namespace EditorExtensionsRegistry {

	export function getEditorCommand(commandId: string): EditorCommand {
		return EditorContributionRegistry.INSTANCE.getEditorCommand(commandId);
	}

	export function getEditorActions(): EditorAction[] {
		return EditorContributionRegistry.INSTANCE.getEditorActions();
	}

	export function getEditorContributions(): IEditorContributionDescription[] {
		return EditorContributionRegistry.INSTANCE.getEditorContributions();
	}

	export function getSomeEditorContributions(ids: string[]): IEditorContributionDescription[] {
		return EditorContributionRegistry.INSTANCE.getEditorContributions().filter(c => ids.indexOf(c.id) >= 0);
	}
}

//#endregion

// Editor extension points
const EditorExtensions = {
	EditorCommonContributions: 'editor.contributions'
};

class EditorContributionRegistry {

	public static readonly INSTANCE = new EditorContributionRegistry();

	private readonly editorContributions: IEditorContributionDescription[];
	private readonly editorActions: EditorAction[];
	private readonly editorCommands: { [commandId: string]: EditorCommand };

	constructor() {
		this.editorContributions = [];
		this.editorActions = [];
		this.editorCommands = Object.create(null);
	}

	public registerEditorContribution<Services extends BrandedService[]>(id: string, ctor: { new(editor: IMoteEditor, ...services: Services): IEditorContribution }): void {
		this.editorContributions.push({ id, ctor: ctor as IEditorContributionCtor });
	}

	public getEditorContributions(): IEditorContributionDescription[] {
		return this.editorContributions.slice(0);
	}

	public registerEditorAction(action: EditorAction) {
		action.register();
		this.editorActions.push(action);
	}

	public getEditorActions(): EditorAction[] {
		return this.editorActions.slice(0);
	}

	public registerEditorCommand(editorCommand: EditorCommand) {
		editorCommand.register();
		this.editorCommands[editorCommand.id] = editorCommand;
	}

	public getEditorCommand(commandId: string): EditorCommand {
		return (this.editorCommands[commandId] || null);
	}

}

Registry.add(EditorExtensions.EditorCommonContributions, EditorContributionRegistry.INSTANCE);
