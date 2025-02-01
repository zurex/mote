import { Emitter } from '@mote/base/common/event';
import { IDisposable, DisposableStore } from '@mote/base/common/lifecycle';
import { ServiceCollection } from '@mote/platform/instantiation/common/serviceCollection';
import { InstantiationService } from '@mote/platform/instantiation/common/instantiationService';
import { ServiceIdentifier, IInstantiationService, createDecorator } from '@mote/platform/instantiation/common/instantiation';
import { SyncDescriptor } from '@mote/platform/instantiation/common/descriptors';
import { getSingletonServiceDescriptors } from '@mote/platform/instantiation/common/extensions';
import { LogService } from '@mote/platform/log/common/logService';
import { ConsoleLogger } from '@mote/platform/log/common/log';

export interface IServerOverrideServices {
	[index: string]: any;
}

/**
 * We don't want to eagerly instantiate services because embedders get a one time chance
 * to override services when they create the first editor.
 */
export namespace ServerServices {

	const serviceCollection = new ServiceCollection();
	for (const [id, descriptor] of getSingletonServiceDescriptors()) {
		serviceCollection.set(id, descriptor);
	}

	const instantiationService = new InstantiationService(serviceCollection, true);
	serviceCollection.set(IInstantiationService, instantiationService);

	export function get<T>(serviceId: ServiceIdentifier<T>): T {
		if (!initialized) {
			initialize({});
		}
		const r = serviceCollection.get(serviceId);
		if (!r) {
			throw new Error('Missing service ' + serviceId);
		}
		if (r instanceof SyncDescriptor) {
			return instantiationService.invokeFunction((accessor) => accessor.get(serviceId));
		} else {
			return r;
		}
	}

	let initialized = false;
	const onDidInitialize = new Emitter<void>();
	export function initialize(overrides: IServerOverrideServices): IInstantiationService {
		if (initialized) {
			return instantiationService;
		}
		initialized = true;

		// Add singletons that were registered after this module loaded
		for (const [id, descriptor] of getSingletonServiceDescriptors()) {
			if (!serviceCollection.get(id)) {
				serviceCollection.set(id, descriptor);
			}
		}

		// Initialize the service collection with the overrides, but only if the
		// service was not instantiated in the meantime.
		for (const serviceId in overrides) {
			if (overrides.hasOwnProperty(serviceId)) {
				const serviceIdentifier = createDecorator(serviceId);
				const r = serviceCollection.get(serviceIdentifier);
				if (r instanceof SyncDescriptor) {
					serviceCollection.set(serviceIdentifier, overrides[serviceId]);
				}
			}
		}

		onDidInitialize.fire();

		return instantiationService;
	}

	/**
	 * Executes callback once services are initialized.
	 */
	export function withServices(callback: () => IDisposable): IDisposable {
		if (initialized) {
			return callback();
		}

		const disposable = new DisposableStore();

		const listener = disposable.add(onDidInitialize.event(() => {
			listener.dispose();
			disposable.add(callback());
		}));

		return disposable;
	}

}

export async function setupServerServices(): Promise<void> {
    const services: IServerOverrideServices = {};
    const consoleLogger = new ConsoleLogger();
    const logService = new LogService(consoleLogger);
    services['logService'] = logService;
    ServerServices.initialize(services);
}