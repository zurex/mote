/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isMacintosh } from 'mote/base/common/platform';
import { getMachineId } from 'mote/base/node/id';
import { IStateService } from 'mote/platform/state/node/state';
import { machineIdKey } from 'mote/platform/telemetry/common/telemetry';


export async function resolveMachineId(stateService: IStateService) {
	// We cache the machineId for faster lookups
	// and resolve it only once initially if not cached or we need to replace the macOS iBridge device
	let machineId = stateService.getItem<string>(machineIdKey);
	if (typeof machineId !== 'string' || (isMacintosh && machineId === '6c9d2bc8f91b89624add29c0abeae7fb42bf539fa1cdb2e3e57cd668fa9bcead')) {
		machineId = await getMachineId();
	}

	return machineId;
}
