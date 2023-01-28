import { createDecorator } from 'mote/platform/instantiation/common/instantiation';
import { IKeyboardMapper } from 'mote/platform/keyboardLayout/common/keyboardMapper';

export const IKeyboardLayoutService = createDecorator<IKeyboardLayoutService>('keyboardLayoutService');


export interface IKeyboardLayoutService {
	readonly _serviceBrand: undefined;

	getKeyboardMapper(): IKeyboardMapper;
}
