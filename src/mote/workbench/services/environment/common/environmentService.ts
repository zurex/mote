import { URI } from 'mote/base/common/uri';
import { IEnvironmentService } from 'mote/platform/environment/common/environment';
import { refineServiceDecorator } from 'mote/platform/instantiation/common/instantiation';
import { IPath } from 'mote/platform/window/common/window';

export const IWorkbenchEnvironmentService = refineServiceDecorator<IEnvironmentService, IWorkbenchEnvironmentService>(IEnvironmentService);

/**
 * A workbench specific environment service that is only present in workbench
 * layer.
 */
export interface IWorkbenchEnvironmentService extends IEnvironmentService {

	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
	// NOTE: KEEP THIS INTERFACE AS SMALL AS POSSIBLE. AS SUCH:
	//       PUT NON-WEB PROPERTIES INTO THE NATIVE WORKBENCH
	//       ENVIRONMENT SERVICE
	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

	// --- Paths
	readonly logFile: URI;

	// --- Development
	readonly profDurationMarkers?: string[];

	// --- Config
	readonly remoteAuthority?: string;

	// --- Editors to open
	readonly pagesToOpenOrCreate?: IPath[] | undefined;
}
