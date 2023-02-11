import { ITextResourceConfigurationService } from 'mote/editor/common/services/textResourceConfiguration';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { IStorageService } from 'mote/platform/storage/common/storage';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { EditorPane } from 'mote/workbench/browser/parts/editor/editorPane';
import { IEditorGroupsService } from 'mote/workbench/services/editor/common/editorGroupsService';

/**
 * Base class of editors that want to store and restore view state.
 */
export abstract class AbstractEditorWithViewState<T extends object> extends EditorPane {
	constructor(
		id: string,
		viewStateStorageKey: string,
		@IInstantiationService protected readonly instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@IThemeService themeService: IThemeService,
		@ITextResourceConfigurationService protected readonly textResourceConfigurationService: ITextResourceConfigurationService,
		@IEditorGroupsService protected readonly editorGroupService: IEditorGroupsService
	) {
		super(id, themeService, storageService);
	}
}
