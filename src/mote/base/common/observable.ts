/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export {
	IObservable,
	IObserver,
	IReader,
	ISettable,
	ISettableObservable,
	ITransaction,
	observableValue,
	transaction,
} from 'mote/base/common/observableImpl/base';
export { derived } from 'mote/base/common/observableImpl/derived';
export {
	autorun,
	autorunDelta,
	autorunHandleChanges,
	autorunWithStore,
} from 'mote/base/common/observableImpl/autorun';
export * from 'mote/base/common/observableImpl/utils';

import { ConsoleObservableLogger, setLogger } from 'mote/base/common/observableImpl/logging';

const enableLogging = false;
if (enableLogging) {
	setLogger(new ConsoleObservableLogger());
}
