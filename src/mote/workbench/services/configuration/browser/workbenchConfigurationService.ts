import { Emitter, Event } from 'mote/base/common/event';
import { Disposable, DisposableStore } from 'mote/base/common/lifecycle';
import { IConfigurationChangeEvent, IConfigurationData, IConfigurationOverrides, ConfigurationTarget, IConfigurationValue, isConfigurationOverrides, IConfigurationUpdateOverrides, IConfigurationUpdateOptions, isConfigurationUpdateOverrides, IConfigurationChange, ConfigurationTargetToString } from 'mote/platform/configuration/common/configuration';
import { ConfigurationExtensions, ConfigurationScope, IConfigurationRegistry, keyFromOverrideIdentifiers } from 'mote/platform/configuration/common/configurationRegistry';
import { Registry } from 'mote/platform/registry/common/platform';
import { IConfigurationCache, IWorkbenchConfigurationService } from 'mote/workbench/services/configuration/common/workbenchConfiguration';
import { ConfigurationChangeEvent, ConfigurationModel } from 'mote/platform/configuration/common/configurationModels';
import { ResourceMap } from 'mote/base/common/map';
import { DefaultConfiguration, IPolicyConfiguration, NullPolicyConfiguration, PolicyConfiguration } from 'mote/platform/configuration/common/configurations';
import { IPolicyService, NullPolicyService } from 'mote/platform/policy/common/policy';
import { IWorkbenchEnvironmentService } from 'mote/workbench/services/environment/common/environmentService';
import { UserConfiguration, WorkbenchDefaultConfiguration } from 'mote/workbench/services/configuration/browser/workbenchConfiguration';
import { WorkbenchConfiguration } from 'mote/workbench/services/configuration/common/workbenchConfigurationModel';
import { ILogService } from 'mote/platform/log/common/log';
import { IAnyWorkspaceIdentifier, Workspace } from 'mote/platform/workspace/common/workspace';
import { distinct } from 'mote/base/common/arrays';
import { equals } from 'mote/base/common/objects';
import { Promises } from 'mote/base/common/async';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { ConfigurationEditing, EditableConfigurationTarget } from 'mote/workbench/services/configuration/common/configurationEditing';
import { mark } from 'mote/base/common/performance';

export class WorkbenchConfigurationService extends Disposable implements IWorkbenchConfigurationService {

	public _serviceBrand: undefined;

	private readonly _onDidChangeConfiguration: Emitter<IConfigurationChangeEvent> = this._register(new Emitter<IConfigurationChangeEvent>());
	public readonly onDidChangeConfiguration: Event<IConfigurationChangeEvent> = this._onDidChangeConfiguration.event;

	private workspace!: Workspace;
	private _configuration: WorkbenchConfiguration;
	private readonly defaultConfiguration: DefaultConfiguration;
	private readonly policyConfiguration: IPolicyConfiguration;
	private applicationConfiguration: UserConfiguration | null = null;
	private readonly applicationConfigurationDisposables: DisposableStore;

	private readonly configurationRegistry: IConfigurationRegistry;

	private instantiationService: IInstantiationService | undefined;
	private configurationEditing: ConfigurationEditing | undefined;

	constructor(
		{ remoteAuthority, configurationCache }: { remoteAuthority?: string; configurationCache: IConfigurationCache },
		environmentService: IWorkbenchEnvironmentService,
		private readonly logService: ILogService,
		policyService: IPolicyService
	) {
		super();

		this.configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

		this.defaultConfiguration = this._register(new WorkbenchDefaultConfiguration(configurationCache, environmentService));
		this.policyConfiguration = policyService instanceof NullPolicyService ? new NullPolicyConfiguration() : this._register(new PolicyConfiguration(this.defaultConfiguration, policyService, logService));
		this._configuration = new WorkbenchConfiguration(this.defaultConfiguration.configurationModel, this.policyConfiguration.configurationModel, new ConfigurationModel(), new ConfigurationModel(), new ConfigurationModel(), new ConfigurationModel(), new ResourceMap(), new ConfigurationModel(), new ResourceMap<ConfigurationModel>(), this.workspace);
		this.applicationConfigurationDisposables = this._register(new DisposableStore());
	}

	//#region Workspace Configuration Service

	getConfigurationData(): IConfigurationData {
		return this._configuration.toData();
	}

	getValue<T>(): T;
	getValue<T>(section: string): T;
	getValue<T>(overrides: IConfigurationOverrides): T;
	getValue<T>(section: string, overrides: IConfigurationOverrides): T;
	getValue(arg1?: any, arg2?: any): any {
		const section = typeof arg1 === 'string' ? arg1 : undefined;
		const overrides = isConfigurationOverrides(arg1) ? arg1 : isConfigurationOverrides(arg2) ? arg2 : undefined;
		return this._configuration.getValue(section, overrides);
	}

	updateValue(key: string, value: any): Promise<void>;
	updateValue(key: string, value: any, overrides: IConfigurationOverrides | IConfigurationUpdateOverrides): Promise<void>;
	updateValue(key: string, value: any, target: ConfigurationTarget): Promise<void>;
	updateValue(key: string, value: any, overrides: IConfigurationOverrides | IConfigurationUpdateOverrides, target: ConfigurationTarget, options?: IConfigurationUpdateOptions): Promise<void>;
	async updateValue(key: string, value: any, arg3?: any, arg4?: any, options?: any): Promise<void> {
		const overrides: IConfigurationUpdateOverrides | undefined = isConfigurationUpdateOverrides(arg3) ? arg3
			: isConfigurationOverrides(arg3) ? { resource: arg3.resource, overrideIdentifiers: arg3.overrideIdentifier ? [arg3.overrideIdentifier] : undefined } : undefined;
		const target: ConfigurationTarget | undefined = overrides ? arg4 : arg3;
		const targets: ConfigurationTarget[] = target ? [target] : [];

		if (overrides?.overrideIdentifiers) {
			overrides.overrideIdentifiers = distinct(overrides.overrideIdentifiers);
			overrides.overrideIdentifiers = overrides.overrideIdentifiers.length ? overrides.overrideIdentifiers : undefined;
		}

		if (!targets.length) {
			if (overrides?.overrideIdentifiers && overrides.overrideIdentifiers.length > 1) {
				throw new Error('Configuration Target is required while updating the value for multiple override identifiers');
			}
			const inspect = this.inspect(key, { resource: overrides?.resource, overrideIdentifier: overrides?.overrideIdentifiers ? overrides.overrideIdentifiers[0] : undefined });
			targets.push(...this.deriveConfigurationTargets(key, value, inspect));

			// Remove the setting, if the value is same as default value and is updated only in user target
			if (equals(value, inspect.defaultValue) && targets.length === 1 && (targets[0] === ConfigurationTarget.USER || targets[0] === ConfigurationTarget.USER_LOCAL)) {
				value = undefined;
			}
		}
		//await Promises.settled(targets.map(target => this.writeConfigurationValue(key, value, target, overrides, options)));
	}

	inspect<T>(key: string, overrides?: IConfigurationOverrides | undefined): IConfigurationValue<Readonly<T>> {
		return this._configuration.inspect<T>(key, overrides);
	}

	reloadConfiguration(target?: ConfigurationTarget | undefined): Promise<void> {
		throw new Error('Method not implemented.');
	}

	keys(): { default: string[]; user: string[]; workspace: string[]; workspaceFolder: string[]; memory?: string[] | undefined; } {
		throw new Error('Method not implemented.');
	}

	//#endregion

	/**
	 * At present, all workspaces (empty, single-folder, multi-root) in local and remote
	 * can be initialized without requiring extension host except following case:
	 *
	 * A multi root workspace with .code-workspace file that has to be resolved by an extension.
	 * Because of readonly `rootPath` property in extension API we have to resolve multi root workspace
	 * before extension host starts so that `rootPath` can be set to first folder.
	 *
	 * This restriction is lifted partially for web in `MainThreadWorkspace`.
	 * In web, we start extension host with empty `rootPath` in this case.
	 *
	 * Related root path issue discussion is being tracked here - https://github.com/microsoft/vscode/issues/69335
	 */
	async initialize(arg: IAnyWorkspaceIdentifier): Promise<void> {
		mark('mote/willInitWorkspaceService');

		//const workspace = await this.createWorkspace(arg);
		//await this.updateWorkspaceAndInitializeConfiguration(workspace);
		//this.checkAndMarkWorkspaceComplete(false);

		mark('mote/didInitWorkspaceService');
	}

	acquireInstantiationService(instantiationService: IInstantiationService): void {
		this.instantiationService = instantiationService;
	}

	private async writeConfigurationValue(key: string, value: any, target: ConfigurationTarget, overrides: IConfigurationUpdateOverrides | undefined, options?: IConfigurationUpdateOverrides): Promise<void> {
		if (!this.instantiationService) {
			throw new Error('Cannot write configuration because the configuration service is not yet ready to accept writes.');
		}

		if (target === ConfigurationTarget.DEFAULT) {
			throw new Error('Invalid configuration target');
		}

		if (target === ConfigurationTarget.MEMORY) {
			const previous = { data: this._configuration.toData(), workspace: this.workspace };
			this._configuration.updateValue(key, value, overrides);
			this.triggerConfigurationChange({ keys: overrides?.overrideIdentifiers?.length ? [keyFromOverrideIdentifiers(overrides.overrideIdentifiers), key] : [key], overrides: overrides?.overrideIdentifiers?.length ? overrides.overrideIdentifiers.map(overrideIdentifier => ([overrideIdentifier, [key]])) : [] }, previous, target);
			return;
		}

		const editableConfigurationTarget = this.toEditableConfigurationTarget(target, key);
		if (!editableConfigurationTarget) {
			throw new Error('Invalid configuration target');
		}

		if (editableConfigurationTarget === EditableConfigurationTarget.USER_REMOTE && !this.remoteUserConfiguration) {
			throw new Error('Invalid configuration target');
		}

		// Use same instance of ConfigurationEditing to make sure all writes go through the same queue
		this.configurationEditing = this.configurationEditing ?? this.instantiationService.createInstance(ConfigurationEditing, null);
		await this.configurationEditing.writeConfiguration(editableConfigurationTarget, { key, value }, { scopes: overrides, ...options });
		switch (editableConfigurationTarget) {
			case EditableConfigurationTarget.USER_LOCAL:
				if (this.applicationConfiguration && this.configurationRegistry.getConfigurationProperties()[key].scope === ConfigurationScope.APPLICATION) {
					await this.reloadApplicationConfiguration();
				} else {
					await this.reloadLocalUserConfiguration();
				}
				return;
			case EditableConfigurationTarget.USER_REMOTE:
				return this.reloadRemoteUserConfiguration().then(() => undefined);
			case EditableConfigurationTarget.WORKSPACE:
				return this.reloadWorkspaceConfiguration();
			case EditableConfigurationTarget.WORKSPACE_FOLDER: {
				const workspaceFolder = overrides && overrides.resource ? this.workspace.getFolder(overrides.resource) : null;
				if (workspaceFolder) {
					return this.reloadWorkspaceFolderConfiguration(workspaceFolder);
				}
			}
		}
	}

	private deriveConfigurationTargets(key: string, value: any, inspect: IConfigurationValue<any>): ConfigurationTarget[] {
		if (equals(value, inspect.value)) {
			return [];
		}

		const definedTargets: ConfigurationTarget[] = [];
		if (inspect.workspaceFolderValue !== undefined) {
			definedTargets.push(ConfigurationTarget.WORKSPACE_FOLDER);
		}
		if (inspect.workspaceValue !== undefined) {
			definedTargets.push(ConfigurationTarget.WORKSPACE);
		}
		if (inspect.userRemoteValue !== undefined) {
			definedTargets.push(ConfigurationTarget.USER_REMOTE);
		}
		if (inspect.userLocalValue !== undefined) {
			definedTargets.push(ConfigurationTarget.USER_LOCAL);
		}

		if (value === undefined) {
			// Remove the setting in all defined targets
			return definedTargets;
		}

		return [definedTargets[0] || ConfigurationTarget.USER];
	}

	private triggerConfigurationChange(change: IConfigurationChange, previous: { data: IConfigurationData; workspace?: Workspace } | undefined, target: ConfigurationTarget): void {
		if (change.keys.length) {
			if (target !== ConfigurationTarget.DEFAULT) {
				this.logService.debug(`Configuration keys changed in ${ConfigurationTargetToString(target)} target`, ...change.keys);
			}
			const configurationChangeEvent = new ConfigurationChangeEvent(change, previous, this._configuration, this.workspace);
			configurationChangeEvent.source = target;
			configurationChangeEvent.sourceConfig = this.getTargetConfiguration(target);
			this._onDidChangeConfiguration.fire(configurationChangeEvent);
		}
	}

	private getTargetConfiguration(target: ConfigurationTarget): any {
		switch (target) {
			case ConfigurationTarget.DEFAULT:
				return this._configuration.defaults.contents;
			case ConfigurationTarget.USER:
				return this._configuration.userConfiguration.contents;
			case ConfigurationTarget.WORKSPACE:
				return this._configuration.workspaceConfiguration.contents;
		}
		return {};
	}

	private toEditableConfigurationTarget(target: ConfigurationTarget, key: string): EditableConfigurationTarget | null {
		if (target === ConfigurationTarget.USER) {
			return EditableConfigurationTarget.USER_LOCAL;
		}
		if (target === ConfigurationTarget.USER_LOCAL) {
			return EditableConfigurationTarget.USER_LOCAL;
		}
		if (target === ConfigurationTarget.USER_REMOTE) {
			return EditableConfigurationTarget.USER_REMOTE;
		}
		if (target === ConfigurationTarget.WORKSPACE) {
			return EditableConfigurationTarget.WORKSPACE;
		}
		if (target === ConfigurationTarget.WORKSPACE_FOLDER) {
			return EditableConfigurationTarget.WORKSPACE_FOLDER;
		}
		return null;
	}
}
