import { URI } from 'mote/base/common/uri';
import { AbstractLoggerService, ConsoleMainLogger, ILogger, ILoggerOptions, ILoggerService, ILogService, LogLevel } from 'mote/platform/log/common/log';

export class ConsoleLoggerService extends AbstractLoggerService implements ILoggerService {
	constructor(
		@ILogService logService: ILogService,
	) {
		super(logService.getLevel());
	}

	protected doCreateLogger(resource: URI, logLevel: LogLevel, options?: ILoggerOptions): ILogger {
		return new ConsoleMainLogger();
	}

}
