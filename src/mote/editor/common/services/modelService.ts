import { Disposable, DisposableStore, IDisposable } from 'mote/base/common/lifecycle';
import { URI } from 'mote/base/common/uri';
import { ITextBufferFactory, ITextModel } from 'mote/editor/common/model';
import { TextBasedTextModel } from 'mote/editor/common/model/textBasedTextModel';
import { IModelService } from 'mote/editor/common/services/model';
import { ITextResourcePropertiesService } from 'mote/editor/common/services/textResourceConfiguration';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { ILogService } from 'mote/platform/log/common/log';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { IUndoRedoService } from 'mote/platform/undoRedo/common/undoRedo';

function MODEL_ID(resource: URI): string {
	return resource.toString();
}

class ModelData implements IDisposable {
	public readonly model: ITextModel;

	private readonly _modelEventListeners = new DisposableStore();

	constructor(
		model: ITextModel,
		onWillDispose: (model: ITextModel) => void,
	) {
		this.model = model;

		//this._modelEventListeners.add(model.onWillDispose(() => onWillDispose(model)));
	}


	public dispose(): void {
		this._modelEventListeners.dispose();
	}
}

export class ModelService extends Disposable implements IModelService {

	public static MAX_MEMORY_FOR_CLOSED_FILES_UNDO_STACK = 20 * 1024 * 1024;

	public _serviceBrand: undefined;

	/**
	 * All the models known in the system.
	 */
	private readonly _models: { [modelId: string]: ModelData };

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ITextResourcePropertiesService private readonly _resourcePropertiesService: ITextResourcePropertiesService,
		@IThemeService private readonly _themeService: IThemeService,
		@ILogService private readonly _logService: ILogService,
		@IUndoRedoService private readonly undoRedoService: IUndoRedoService
	) {
		super();

		this._models = {};
	}

	public createModel(value: string | ITextBufferFactory, resource?: URI, isForSimpleWidget: boolean = false): ITextModel {

		const modelData = this._createModelData(value, resource, isForSimpleWidget);

		return modelData.model;
	}

	public getModel(resource: URI): ITextModel | null {
		const modelId = MODEL_ID(resource);
		const modelData = this._models[modelId];
		if (!modelData) {
			return null;
		}
		return modelData.model;
	}

	private _createModelData(value: string | ITextBufferFactory, resource: URI | undefined, isForSimpleWidget: boolean): ModelData {

		const model: ITextModel = new TextBasedTextModel(value, {}, resource, this.undoRedoService);
		const modelId = MODEL_ID(model.uri);

		if (this._models[modelId]) {
			// There already exists a model with this id => this is a programmer error
			throw new Error('ModelService: Cannot add model because it already exists!');
		}

		const modelData = new ModelData(
			model,
			(model) => this.onWillDispose(model),
		);
		this._models[modelId] = modelData;

		return modelData;
	}

	private onWillDispose(model: ITextModel): void {

		const modelId = MODEL_ID(model.uri);
		const modelData = this._models[modelId];

		delete this._models[modelId];
		modelData.dispose();
	}
}
