/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'mote/base/common/uri';
//import { ILanguageConfigurationService } from 'mote/editor/common/languages/languageConfigurationRegistry';
import { IModelService } from 'mote/editor/common/services/model';
import { ModelService } from 'mote/editor/common/services/modelService';
//import { ILanguageService } from 'mote/editor/common/languages/language';
import { ITextResourcePropertiesService } from 'mote/editor/common/services/textResourceConfiguration';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { ILogService } from 'mote/platform/log/common/log';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { IUndoRedoService } from 'mote/platform/undoRedo/common/undoRedo';
import { IPathService } from 'mote/workbench/services/path/common/pathService';
//import { ILanguageFeatureDebounceService } from 'mote/editor/common/services/languageFeatureDebounce';
//import { ILanguageFeaturesService } from 'mote/editor/common/services/languageFeatures';

export class WorkbenchModelService extends ModelService {
	constructor(
		@IConfigurationService configurationService: IConfigurationService,
		@ITextResourcePropertiesService resourcePropertiesService: ITextResourcePropertiesService,
		@IThemeService themeService: IThemeService,
		@ILogService logService: ILogService,
		@IUndoRedoService undoRedoService: IUndoRedoService,
		//@ILanguageConfigurationService languageConfigurationService: ILanguageConfigurationService,
		//@ILanguageService languageService: ILanguageService,
		//@ILanguageFeatureDebounceService languageFeatureDebounceService: ILanguageFeatureDebounceService,
		//@ILanguageFeaturesService languageFeaturesService: ILanguageFeaturesService,
		@IPathService private readonly _pathService: IPathService,
	) {
		super(configurationService, resourcePropertiesService, themeService, logService, undoRedoService);
	}
}

registerSingleton(IModelService, WorkbenchModelService, InstantiationType.Delayed);
