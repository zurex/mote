import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { refineServiceDecorator } from 'mote/platform/instantiation/common/instantiation';

export const IWorkbenchConfigurationService = refineServiceDecorator<IConfigurationService, IWorkbenchConfigurationService>(IConfigurationService);
export interface IWorkbenchConfigurationService extends IConfigurationService {

}
