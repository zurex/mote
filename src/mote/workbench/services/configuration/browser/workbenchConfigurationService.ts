import { Emitter, Event } from 'mote/base/common/event';
import { Disposable } from 'mote/base/common/lifecycle';
import { IConfigurationChangeEvent, IConfigurationData, IConfigurationOverrides, ConfigurationTarget, IConfigurationValue, isConfigurationOverrides } from 'mote/platform/configuration/common/configuration';
import { ConfigurationExtensions, IConfigurationRegistry } from 'mote/platform/configuration/common/configurationRegistry';
import { Registry } from 'mote/platform/registry/common/platform';
import { IConfigurationCache, IWorkbenchConfigurationService } from 'mote/workbench/services/configuration/common/workbenchConfiguration';
import { ConfigurationModel } from 'mote/platform/configuration/common/configurationModels';
import { ResourceMap } from 'mote/base/common/map';
import { DefaultConfiguration, IPolicyConfiguration, NullPolicyConfiguration, PolicyConfiguration } from 'mote/platform/configuration/common/configurations';
import { IPolicyService, NullPolicyService } from 'mote/platform/policy/common/policy';
import { IWorkbenchEnvironmentService } from 'mote/workbench/services/environment/common/environmentService';
import { WorkbenchDefaultConfiguration } from 'mote/workbench/services/configuration/browser/workbenchConfiguration';
import { WorkbenchConfiguration } from 'mote/workbench/services/configuration/common/workbenchConfigurationModel';
import { ILogService } from 'mote/platform/log/common/log';
import { Workspace } from 'mote/platform/workspace/common/workspace';

export class WorkbenchConfigurationService extends Disposable implements IWorkbenchConfigurationService {

	public _serviceBrand: undefined;

	private readonly _onDidChangeConfiguration: Emitter<IConfigurationChangeEvent> = this._register(new Emitter<IConfigurationChangeEvent>());
	public readonly onDidChangeConfiguration: Event<IConfigurationChangeEvent> = this._onDidChangeConfiguration.event;

	private workspace!: Workspace;
	private _configuration: WorkbenchConfiguration;
	private readonly defaultConfiguration: DefaultConfiguration;
	private readonly policyConfiguration: IPolicyConfiguration;

	private readonly configurationRegistry: IConfigurationRegistry;

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

	updateValue(key: unknown, value: unknown, overrides?: unknown, target?: unknown, options?: unknown): Promise<void> {
		throw new Error('Method not implemented.');
	}

	inspect<T>(key: string, overrides?: IConfigurationOverrides | undefined): IConfigurationValue<Readonly<T>> {
		throw new Error('Method not implemented.');
	}

	reloadConfiguration(target?: ConfigurationTarget | undefined): Promise<void> {
		throw new Error('Method not implemented.');
	}

	keys(): { default: string[]; user: string[]; workspace: string[]; workspaceFolder: string[]; memory?: string[] | undefined; } {
		throw new Error('Method not implemented.');
	}

	//#endregion
}
