import { Event } from 'mote/base/common/event';
import { URI } from 'mote/base/common/uri';
import { ITextBufferFactory, ITextModel, ITextModelCreationOptions } from 'mote/editor/common/model';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';

export const IModelService = createDecorator<IModelService>('modelService');


export interface IModelService {
	readonly _serviceBrand: undefined;

	createModel(value: string | ITextBufferFactory, resource?: URI, isForSimpleWidget?: boolean): ITextModel;

	updateModel(model: ITextModel, value: string | ITextBufferFactory): void;

	setMode(model: ITextModel, source?: string): void;

	destroyModel(resource: URI): void;

	getModels(): ITextModel[];

	getCreationOptions(language: string, resource: URI, isForSimpleWidget: boolean): ITextModelCreationOptions;

	getModel(resource: URI): ITextModel | null;

	onModelAdded: Event<ITextModel>;

	onModelRemoved: Event<ITextModel>;

	onModelLanguageChanged: Event<{ model: ITextModel; oldLanguageId: string }>;
}
