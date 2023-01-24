import { Emitter, Event } from 'mote/base/common/event';
import { Disposable } from 'mote/base/common/lifecycle';
import { IConfigurationChangeEvent, IConfigurationData, IConfigurationOverrides, ConfigurationTarget, IConfigurationValue } from 'mote/platform/configuration/common/configuration';
import { ConfigurationExtensions, IConfigurationRegistry } from 'mote/platform/configuration/common/configurationRegistry';
import { Registry } from 'mote/platform/registry/common/platform';
import { IWorkbenchConfigurationService } from 'mote/workbench/services/configuration/common/workbenchConfiguration';
import { IWorkspaceFolder } from 'vs/platform/workspace/common/workspace';

export class WorkbenchConfigurationService extends Disposable implements IWorkbenchConfigurationService {

	public _serviceBrand: undefined;

	private readonly _onDidChangeConfiguration: Emitter<IConfigurationChangeEvent> = this._register(new Emitter<IConfigurationChangeEvent>());
	public readonly onDidChangeConfiguration: Event<IConfigurationChangeEvent> = this._onDidChangeConfiguration.event;

	private readonly configurationRegistry: IConfigurationRegistry;

	constructor() {
		super();

		this.configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
	}

	getConfigurationData(): IConfigurationData | null {
		throw new Error('Method not implemented.');
	}

	getValue<T>(section?: unknown, overrides?: unknown): T {
		return null as T;
	}

	updateValue(key: unknown, value: unknown, overrides?: unknown, target?: unknown, options?: unknown): Promise<void> {
		throw new Error('Method not implemented.');
	}

	inspect<T>(key: string, overrides?: IConfigurationOverrides | undefined): IConfigurationValue<Readonly<T>> {
		throw new Error('Method not implemented.');
	}

	reloadConfiguration(target?: ConfigurationTarget | IWorkspaceFolder | undefined): Promise<void> {
		throw new Error('Method not implemented.');
	}

	keys(): { default: string[]; user: string[]; workspace: string[]; workspaceFolder: string[]; memory?: string[] | undefined; } {
		throw new Error('Method not implemented.');
	}

}
