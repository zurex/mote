/* eslint-disable code-no-unexternalized-strings */
import { CommandsRegistry, ICommandEvent, ICommandService } from "mote/platform/commands/common/commands";
import { Emitter, Event } from "mote/base/common/event";
import { Disposable } from "mote/base/common/lifecycle";
import { registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { IInstantiationService } from "mote/platform/instantiation/common/instantiation";
import { ILogService } from "mote/platform/log/common/log";

export class CommandService extends Disposable implements ICommandService {

	declare readonly _serviceBrand: undefined;

	private readonly _onWillExecuteCommand: Emitter<ICommandEvent> = this._register(new Emitter<ICommandEvent>());
	public readonly onWillExecuteCommand: Event<ICommandEvent> = this._onWillExecuteCommand.event;

	private readonly _onDidExecuteCommand: Emitter<ICommandEvent> = new Emitter<ICommandEvent>();
	public readonly onDidExecuteCommand: Event<ICommandEvent> = this._onDidExecuteCommand.event;

	constructor(
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService
	) {
		super();
	}

	executeCommand<T = any>(commandId: string, ...args: any[]): Promise<T | undefined> {
		this.logService.trace('CommandService#executeCommand', commandId);
		return this.tryExecuteCommand(commandId, args);
	}

	private tryExecuteCommand(id: string, args: any[]): Promise<any> {
		const command = CommandsRegistry.getCommand(id);
		if (!command) {
			return Promise.reject(new Error(`command '${id}' not found`));
		}
		try {
			this._onWillExecuteCommand.fire({ commandId: id, args });
			const result = this._instantiationService.invokeFunction(command.handler, ...args);
			this._onDidExecuteCommand.fire({ commandId: id, args });
			return Promise.resolve(result);
		} catch (err) {
			return Promise.reject(err);
		}
	}

}

registerSingleton(ICommandService, CommandService, true);
