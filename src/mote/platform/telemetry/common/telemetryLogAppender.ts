/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'mote/base/common/lifecycle';
import { localize } from 'mote/nls';
import { IEnvironmentService } from 'mote/platform/environment/common/environment';
import { ILogService, ILogger, ILoggerService, LogLevel } from 'mote/platform/log/common/log';
import { IProductService } from 'mote/platform/product/common/productService';
import { ITelemetryAppender, isLoggingOnly, supportsTelemetry, telemetryLogChannelId, validateTelemetryData } from 'mote/platform/telemetry/common/telemetryUtils';

export class TelemetryLogAppender extends Disposable implements ITelemetryAppender {

	private readonly logger: ILogger;

	constructor(
		@ILogService logService: ILogService,
		@ILoggerService loggerService: ILoggerService,
		@IEnvironmentService environmentService: IEnvironmentService,
		@IProductService productService: IProductService,
		private readonly prefix: string = '',
	) {
		super();

		const logger = loggerService.getLogger(environmentService.telemetryLogResource);
		if (logger) {
			this.logger = this._register(logger);
		} else {
			// Not a perfect check, but a nice way to indicate if we only have logging enabled for debug purposes and nothing is actually being sent
			const justLoggingAndNotSending = isLoggingOnly(productService, environmentService);
			const logSuffix = justLoggingAndNotSending ? ' (Not Sent)' : '';
			const telemetryLogResource = environmentService.telemetryLogResource;
			const isVisible = () => supportsTelemetry(productService, environmentService) && logService.getLevel() === LogLevel.Trace;
			this.logger = this._register(loggerService.createLogger(telemetryLogResource, { id: telemetryLogChannelId, name: localize('telemetryLog', "Telemetry{0}", logSuffix), hidden: !isVisible() }));
			this._register(logService.onDidChangeLogLevel(() => loggerService.setVisibility(telemetryLogResource, isVisible())));

			this.logger.info('Below are logs for every telemetry event sent from VS Code once the log level is set to trace.');
			this.logger.info('===========================================================');
		}
	}

	flush(): Promise<any> {
		return Promise.resolve(undefined);
	}

	log(eventName: string, data: any): void {
		this.logger.trace(`${this.prefix}telemetry/${eventName}`, validateTelemetryData(data));
	}
}

