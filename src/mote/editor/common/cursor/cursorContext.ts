/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITextModel } from 'mote/editor/common/model';
import { ICoordinatesConverter } from 'mote/editor/common/viewModel';
import { CursorConfiguration, ICursorSimpleModel } from 'mote/editor/common/cursorCommon';

export class CursorContext {
	_cursorContextBrand: void = undefined;

	constructor(
		public readonly model: ITextModel,
		public readonly viewModel: ICursorSimpleModel,
		public readonly coordinatesConverter: ICoordinatesConverter,
		public readonly cursorConfig: CursorConfiguration
	) {
	}
}
