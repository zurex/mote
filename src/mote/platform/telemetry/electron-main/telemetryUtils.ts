/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStateMainService } from 'mote/platform/state/electron-main/state';
import { machineIdKey } from 'mote/platform/telemetry/common/telemetry';
import { resolveMachineId as resolveNodeMachineId } from 'mote/platform/telemetry/node/telemetryUtils';

export async function resolveMachineId(stateService: IStateMainService) {
	// Call the node layers implementation to avoid code duplication
	const machineId = await resolveNodeMachineId(stateService);
	stateService.setItem(machineIdKey, machineId);
	return machineId;
}
