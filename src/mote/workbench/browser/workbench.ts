/* eslint-disable code-no-unexternalized-strings */
import 'mote/workbench/browser/style';
import { getSingletonServiceDescriptors } from 'vs/platform/instantiation/common/extensions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { ILogService } from 'vs/platform/log/common/log';
import { IWorkbenchLayoutService, Parts } from 'mote/workbench/services/layout/browser/layoutService';
import { Layout } from "./layout";
import { onUnexpectedError } from 'mote/base/common/errors';
import { Registry } from 'mote/platform/registry/common/platform';
import { IWorkbenchContributionsRegistry, WorkbenchExtensions } from 'mote/workbench/common/contributions';
import { IWorkbenchOptions } from 'vs/workbench/browser/workbench';
import { isLinux, isWeb, isWindows } from 'mote/base/common/platform';
import { coalesce } from 'mote/base/common/arrays';
import { isChrome, isFirefox, isSafari } from 'mote/base/browser/browser';
import { EditorExtensions, IEditorFactoryRegistry } from 'mote/workbench/common/editor';
import { ILifecycleService, LifecyclePhase } from 'mote/workbench/services/lifecycle/common/lifecycle';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { RunOnceScheduler, runWhenIdle, timeout } from 'mote/base/common/async';
import { mark } from 'vs/base/common/performance';

export class Workbench extends Layout {

	constructor(
		parent: HTMLElement,
		options: IWorkbenchOptions | undefined,
		private readonly serviceCollection: ServiceCollection,
		logService: ILogService
	) {
		super(parent);
		this.logService = logService;
	}

	startup() {
		this.logService.info('[Workbench] startup...');

		try {
			// Services
			const instantiationService = this.initServices(this.serviceCollection);

			instantiationService.invokeFunction(accessor => {
				// Init the logService at first
				this.logService = accessor.get(ILogService);
				const lifecycleService = accessor.get(ILifecycleService);

				// Layout
				this.initLayout(accessor);

				// Registries
				Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).start(accessor);
				Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor);

				// Render Workbench
				this.renderWorkbench(instantiationService);

				// Workbench Layout
				this.createWorkbenchLayout();

				// Layout
				this.layout();

				// Restore
				this.restore(lifecycleService);
			});

			return instantiationService;
		} catch (error) {
			throw error; // rethrow because this is a critical issue we cannot handle properly here
		}

	}

	private initServices(serviceCollection: ServiceCollection) {

		// Layout Service
		serviceCollection.set(IWorkbenchLayoutService, this);

		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
		//
		// NOTE: Please do NOT register services here. Use `registerSingleton()`
		//       from `workbench.common.main.ts` if the service is shared between
		//       native and web or `workbench.desktop.main.ts` if the service
		//       is native only.
		//
		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

		// All Contributed Services which register by registerSingleton
		const contributedServices = getSingletonServiceDescriptors();
		for (const [id, descriptor] of contributedServices) {
			this.logService.debug('[Workbench] init service:', descriptor.ctor.name);
			serviceCollection.set(id, descriptor);
		}

		// Add mock service
		//serviceCollection.set(IThemeService, new BrowserThemeService());

		const instantiationService = new InstantiationService(serviceCollection, true);

		// Wrap up
		instantiationService.invokeFunction(accessor => {
			const lifecycleService = accessor.get(ILifecycleService);

			// TODO@Sandeep debt around cyclic dependencies
			const configurationService = accessor.get(IConfigurationService) as any;
			if (typeof configurationService.acquireInstantiationService === 'function') {
				configurationService.acquireInstantiationService(instantiationService);
			}

			// Signal to lifecycle that services are set
			lifecycleService.phase = LifecyclePhase.Ready;
		});

		return instantiationService;
	}

	private renderWorkbench(instantiationService: IInstantiationService) {

		// State specific classes
		const platformClass = isWindows ? 'windows' : isLinux ? 'linux' : 'mac';
		const workbenchClasses = coalesce([
			'mote-workbench',
			platformClass,
			isWeb ? 'web' : undefined,
			isChrome ? 'chromium' : isFirefox ? 'firefox' : isSafari ? 'safari' : undefined,
			...[],
			...([])
		]);

		this.container.classList.add(...workbenchClasses);
		document.body.classList.add(platformClass); // used by our fonts

		if (isWeb) {
			document.body.classList.add('web');
		}

		// Create Parts
		[
			{ id: Parts.ACTIVITYBAR_PART, role: 'none', classes: ['activitybar', 'left'] },
			{ id: Parts.SIDEBAR_PART, role: 'none', classes: ['sidebar', 'left'], options: {} },
			{ id: Parts.EDITOR_PART, role: 'main', classes: ['editor'], options: {} }
		].forEach(({ id, role, classes, options }) => {
			const partContainer = this.createPart(id, role, classes);
			console.log(`[Workbench] create part: ${id}`);
			this.getPart(id).create(partContainer, options);
		});

		// Add Workbench to DOM
		this.parent.appendChild(this.container);
	}

	private createPart(id: string, role: string, classes: string[]): HTMLElement {
		const part = document.createElement(role === 'status' ? 'footer' /* Use footer element for status bar #98376 */ : 'div');
		part.classList.add('part', ...classes);
		part.id = id;
		part.setAttribute('role', role);
		if (role === 'status') {
			part.setAttribute('aria-live', 'off');
		}

		return part;
	}

	private restore(lifecycleService: ILifecycleService): void {
		// Ask each part to restore
		try {
			this.restoreParts();
		} catch (error) {
			onUnexpectedError(error);
		}

		// Transition into restored phase after layout has restored
		// but do not wait indefinitely on this to account for slow
		// editors restoring. Since the workbench is fully functional
		// even when the visible editors have not resolved, we still
		// want contributions on the `Restored` phase to work before
		// slow editors have resolved. But we also do not want fast
		// editors to resolve slow when too many contributions get
		// instantiated, so we find a middle ground solution via
		// `Promise.race`
		this.whenReady.finally(() =>
			Promise.race([
				this.whenRestored,
				timeout(2000)
			]).finally(() => {

				// Set lifecycle phase to `Restored`
				lifecycleService.phase = LifecyclePhase.Restored;

				// Set lifecycle phase to `Eventually` after a short delay and when idle (min 2.5sec, max 5sec)
				const eventuallyPhaseScheduler = this._register(new RunOnceScheduler(() => {
					this._register(runWhenIdle(() => lifecycleService.phase = LifecyclePhase.Eventually, 2500));
				}, 2500));
				eventuallyPhaseScheduler.schedule();

				// Update perf marks only when the layout is fully
				// restored. We want the time it takes to restore
				// editors to be included in these numbers

				function markDidStartWorkbench() {
					mark('mote/didStartWorkbench');
					performance.measure('perf: workbench create & restore', 'mote/didLoadWorkbenchMain', 'mote/didStartWorkbench');
				}

				if (this.isRestored()) {
					markDidStartWorkbench();
				} else {
					this.whenRestored.finally(() => markDidStartWorkbench());
				}
			})
		);
	}
}
