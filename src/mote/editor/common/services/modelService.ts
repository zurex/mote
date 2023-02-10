import { Disposable } from 'mote/base/common/lifecycle';
import { IModelService } from 'mote/editor/common/services/model';
import { ITextResourcePropertiesService } from 'mote/editor/common/services/textResourceConfiguration';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { ILogService } from 'mote/platform/log/common/log';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { IUndoRedoService } from 'mote/platform/undoRedo/common/undoRedo';

export class ModelService extends Disposable implements IModelService {

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ITextResourcePropertiesService private readonly _resourcePropertiesService: ITextResourcePropertiesService,
		@IThemeService private readonly _themeService: IThemeService,
		@ILogService private readonly _logService: ILogService,
		@IUndoRedoService private readonly _undoRedoService: IUndoRedoService
	) {
		super();
	}
}
