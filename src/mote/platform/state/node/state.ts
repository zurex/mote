/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'mote/platform/instantiation/common/instantiation';

export const IStateService = createDecorator<IStateService>('stateService');

export interface IStateService {

	readonly _serviceBrand: undefined;

	getItem<T>(key: string, defaultValue: T): T;
	getItem<T>(key: string, defaultValue?: T): T | undefined;

}
