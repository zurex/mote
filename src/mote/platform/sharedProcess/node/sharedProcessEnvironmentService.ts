/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { memoize } from 'mote/base/common/decorators';
import { Schemas } from 'mote/base/common/network';
import { URI } from 'mote/base/common/uri';
import { NativeEnvironmentService } from 'mote/platform/environment/node/environmentService';

export class SharedProcessEnvironmentService extends NativeEnvironmentService {

	@memoize
	override get userRoamingDataHome(): URI { return this.appSettingsHome.with({ scheme: Schemas.vscodeUserData }); }

}
