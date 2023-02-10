import { URI } from 'mote/base/common/uri';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { refineServiceDecorator } from 'mote/platform/instantiation/common/instantiation';

export type ConfigurationKey = { type: 'defaults' | 'user' | 'workspaces' | 'folder'; key: string };

export interface IConfigurationCache {

	needsCaching(resource: URI): boolean;
	read(key: ConfigurationKey): Promise<string>;
	write(key: ConfigurationKey, content: string): Promise<void>;
	remove(key: ConfigurationKey): Promise<void>;

}

export const IWorkbenchConfigurationService = refineServiceDecorator<IConfigurationService, IWorkbenchConfigurationService>(IConfigurationService);
export interface IWorkbenchConfigurationService extends IConfigurationService {

}
