import { localize } from 'mote/nls';
import { Action2, MenuId, registerAction2 } from 'mote/platform/actions/common/actions';
import { ServicesAccessor } from 'mote/platform/instantiation/common/instantiation';
import { AnythingQuickAccessProviderRunOptions } from 'mote/platform/quickinput/common/quickAccess';
import { IQuickInputService } from 'mote/platform/quickinput/common/quickInput';

registerAction2(class QuickAccessAction extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.quickOpenWithModes',
			title: localize('quickOpenWithModes', "Quick Open"),
			menu: {
				id: MenuId.CommandCenter,
				order: 100
			}
		});
	}

	run(accessor: ServicesAccessor): void {
		const quickInputService = accessor.get(IQuickInputService);
		quickInputService.quickAccess.show(undefined, {
			preserveValue: true,
			providerOptions: {
				includeHelp: true,
				from: 'commandCenter',
			} as AnythingQuickAccessProviderRunOptions
		});
	}
});
