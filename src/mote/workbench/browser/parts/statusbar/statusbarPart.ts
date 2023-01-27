import 'vs/css!./media/statusbarpart';
import { addDisposableListener, clearNode, createStyleSheet, EventType } from 'mote/base/browser/dom';
import { EventType as TouchEventType, Gesture, GestureEvent } from 'mote/base/browser/touch';
import { IHoverDelegate, IHoverDelegateOptions } from 'mote/base/browser/ui/iconLabel/iconHoverDelegate';
import { coalesce, equals } from 'mote/base/common/arrays';
import { hash } from 'mote/base/common/hash';
import { DisposableStore, dispose, IDisposable, MutableDisposable, toDisposable } from 'mote/base/common/lifecycle';
import { assertIsDefined } from 'mote/base/common/types';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { IContextKeyService } from 'mote/platform/contextkey/common/contextkey';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { isHighContrast } from 'mote/platform/theme/common/theme';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { Part } from 'mote/workbench/browser/part';
import { StatusbarEntryItem } from 'mote/workbench/browser/parts/statusbar/statusbarItem';
import { IStatusbarEntryPriority, IStatusbarViewModelEntry, StatusbarViewModel } from 'mote/workbench/browser/parts/statusbar/statusbarModel';
import { StatusBarFocused } from 'mote/workbench/common/contextkeys';
import { STATUS_BAR_BACKGROUND, STATUS_BAR_BORDER, STATUS_BAR_FOCUS_BORDER, STATUS_BAR_FOREGROUND, STATUS_BAR_ITEM_COMPACT_HOVER_BACKGROUND, STATUS_BAR_ITEM_FOCUS_BORDER, STATUS_BAR_ITEM_HOVER_BACKGROUND } from 'mote/workbench/common/theme';
import { IHoverService, IHoverWidget } from 'mote/workbench/services/hover/browser/hover';
import { IWorkbenchLayoutService, Parts } from 'mote/workbench/services/layout/browser/layoutService';
import { isStatusbarEntryLocation, IStatusbarEntry, IStatusbarEntryAccessor, IStatusbarEntryLocation, IStatusbarService, IStatusbarStyleOverride, StatusbarAlignment } from 'mote/workbench/services/statusbar/browser/statusbar';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { activeContrastBorder, contrastBorder } from 'mote/platform/theme/common/themeColors';
import { IWorkspaceContextService } from 'mote/platform/workspace/common/workspace';

interface IPendingStatusbarEntry {
	readonly id: string;
	readonly alignment: StatusbarAlignment;
	readonly priority: IStatusbarEntryPriority;

	entry: IStatusbarEntry;
	accessor?: IStatusbarEntryAccessor;
}

export class StatusbarPart extends Part implements IStatusbarService {
	declare readonly _serviceBrand: undefined;

	//#region IView

	readonly minimumWidth: number = 0;
	readonly maximumWidth: number = Number.POSITIVE_INFINITY;
	readonly minimumHeight: number = 22;
	readonly maximumHeight: number = 22;

	//#endregion

	private styleElement: HTMLStyleElement | undefined;

	private pendingEntries: IPendingStatusbarEntry[] = [];

	private readonly viewModel = this._register(new StatusbarViewModel(this.storageService));

	readonly onDidChangeEntryVisibility = this.viewModel.onDidChangeEntryVisibility;

	private leftItemsContainer: HTMLElement | undefined;
	private rightItemsContainer: HTMLElement | undefined;

	private readonly hoverDelegate = new class implements IHoverDelegate {

		private lastHoverHideTime = 0;

		readonly placement = 'element';

		get delay() {
			if (Date.now() - this.lastHoverHideTime < 200) {
				return 0; // show instantly when a hover was recently shown
			}

			return this.configurationService.getValue<number>('workbench.hover.delay');
		}

		constructor(
			private readonly configurationService: IConfigurationService,
			private readonly hoverService: IHoverService
		) { }

		showHover(options: IHoverDelegateOptions, focus?: boolean): IHoverWidget | undefined {
			return this.hoverService.showHover({
				...options,
				hideOnKeyDown: true
			}, focus);
		}

		onDidHideHover(): void {
			this.lastHoverHideTime = Date.now();
		}
	}(this.configurationService, this.hoverService);

	private readonly compactEntriesDisposable = this._register(new MutableDisposable<DisposableStore>());
	private readonly styleOverrides = new Set<IStatusbarStyleOverride>();

	constructor(
		@IThemeService themeService: IThemeService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IStorageService private readonly storageService: IStorageService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IHoverService private readonly hoverService: IHoverService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
	) {
		super(Parts.STATUSBAR_PART, { hasTitle: false }, themeService, storageService, layoutService);

		this.registerListeners();
	}

	private registerListeners(): void {

		// Entry visibility changes
		this._register(this.onDidChangeEntryVisibility(() => this.updateCompactEntries()));

		// Workbench state changes
		//this._register(this.contextService.onDidChangeWorkbenchState(() => this.updateStyles()));
	}

	//#region statusbarService

	addEntry(entry: IStatusbarEntry, id: string, alignment: StatusbarAlignment, priorityOrLocation: number | IStatusbarEntryLocation = 0): IStatusbarEntryAccessor {
		const priority: IStatusbarEntryPriority = {
			primary: priorityOrLocation,
			secondary: hash(id) // derive from identifier to accomplish uniqueness
		};

		// As long as we have not been created into a container yet, record all entries
		// that are pending so that they can get created at a later point
		if (!this.element) {
			return this.doAddPendingEntry(entry, id, alignment, priority);
		}

		// Otherwise add to view
		return this.doAddEntry(entry, id, alignment, priority);
	}

	private doAddPendingEntry(entry: IStatusbarEntry, id: string, alignment: StatusbarAlignment, priority: IStatusbarEntryPriority): IStatusbarEntryAccessor {
		const pendingEntry: IPendingStatusbarEntry = { entry, id, alignment, priority };
		this.pendingEntries.push(pendingEntry);

		const accessor: IStatusbarEntryAccessor = {
			update: (entry: IStatusbarEntry) => {
				if (pendingEntry.accessor) {
					pendingEntry.accessor.update(entry);
				} else {
					pendingEntry.entry = entry;
				}
			},

			dispose: () => {
				if (pendingEntry.accessor) {
					pendingEntry.accessor.dispose();
				} else {
					this.pendingEntries = this.pendingEntries.filter(entry => entry !== pendingEntry);
				}
			}
		};

		return accessor;
	}

	private doAddEntry(entry: IStatusbarEntry, id: string, alignment: StatusbarAlignment, priority: IStatusbarEntryPriority): IStatusbarEntryAccessor {

		// View model item
		const itemContainer = this.doCreateStatusItem(id, alignment, ...coalesce([entry.showBeak ? 'has-beak' : undefined]));
		const item = this.instantiationService.createInstance(StatusbarEntryItem, itemContainer, entry, this.hoverDelegate);

		// View model entry
		const viewModelEntry: IStatusbarViewModelEntry = new class implements IStatusbarViewModelEntry {
			readonly id = id;
			readonly alignment = alignment;
			readonly priority = priority;
			readonly container = itemContainer;
			readonly labelContainer = item.labelContainer;

			get name() { return item.name; }
			get hasCommand() { return item.hasCommand; }
		};

		// Add to view model
		const { needsFullRefresh } = this.doAddOrRemoveModelEntry(viewModelEntry, true);
		if (needsFullRefresh) {
			this.appendStatusbarEntries();
		} else {
			this.appendStatusbarEntry(viewModelEntry);
		}

		return {
			update: entry => {
				item.update(entry);
			},
			dispose: () => {
				const { needsFullRefresh } = this.doAddOrRemoveModelEntry(viewModelEntry, false);
				if (needsFullRefresh) {
					this.appendStatusbarEntries();
				} else {
					itemContainer.remove();
				}
				dispose(item);
			}
		};
	}

	private doCreateStatusItem(id: string, alignment: StatusbarAlignment, ...extraClasses: string[]): HTMLElement {
		const itemContainer = document.createElement('div');
		itemContainer.id = id;

		itemContainer.classList.add('statusbar-item');
		if (extraClasses) {
			itemContainer.classList.add(...extraClasses);
		}

		if (alignment === StatusbarAlignment.RIGHT) {
			itemContainer.classList.add('right');
		} else {
			itemContainer.classList.add('left');
		}

		return itemContainer;
	}

	private doAddOrRemoveModelEntry(entry: IStatusbarViewModelEntry, add: boolean) {

		// Update model but remember previous entries
		const entriesBefore = this.viewModel.entries;
		if (add) {
			this.viewModel.add(entry);
		} else {
			this.viewModel.remove(entry);
		}
		const entriesAfter = this.viewModel.entries;

		// Apply operation onto the entries from before
		if (add) {
			entriesBefore.splice(entriesAfter.indexOf(entry), 0, entry);
		} else {
			entriesBefore.splice(entriesBefore.indexOf(entry), 1);
		}

		// Figure out if a full refresh is needed by comparing arrays
		const needsFullRefresh = !equals(entriesBefore, entriesAfter);

		return { needsFullRefresh };
	}

	focusNextEntry(): void {
		this.viewModel.focusNextEntry();
	}

	focusPreviousEntry(): void {
		this.viewModel.focusPreviousEntry();
	}

	isEntryFocused(): boolean {
		return this.viewModel.isEntryFocused();
	}

	focus(preserveEntryFocus = true): void {
		this.getContainer()?.focus();
		const lastFocusedEntry = this.viewModel.lastFocusedEntry;
		if (preserveEntryFocus && lastFocusedEntry) {
			setTimeout(() => lastFocusedEntry.labelContainer.focus(), 0); // Need a timeout, for some reason without it the inner label container will not get focused
		}
	}

	isEntryVisible(id: string): boolean {
		return !this.viewModel.isHidden(id);
	}

	updateEntryVisibility(id: string, visible: boolean): void {
		if (visible) {
			this.viewModel.show(id);
		} else {
			this.viewModel.hide(id);
		}
	}

	private createInitialStatusbarEntries(): void {

		// Add items in order according to alignment
		this.appendStatusbarEntries();

		// Fill in pending entries if any
		while (this.pendingEntries.length) {
			const pending = this.pendingEntries.shift();
			if (pending) {
				pending.accessor = this.addEntry(pending.entry, pending.id, pending.alignment, pending.priority.primary);
			}
		}
	}

	private appendStatusbarEntries(): void {
		const leftItemsContainer = assertIsDefined(this.leftItemsContainer);
		const rightItemsContainer = assertIsDefined(this.rightItemsContainer);

		// Clear containers
		clearNode(leftItemsContainer);
		clearNode(rightItemsContainer);

		// Append all
		for (const entry of [
			...this.viewModel.getEntries(StatusbarAlignment.LEFT),
			...this.viewModel.getEntries(StatusbarAlignment.RIGHT).reverse() // reversing due to flex: row-reverse
		]) {
			const target = entry.alignment === StatusbarAlignment.LEFT ? leftItemsContainer : rightItemsContainer;

			target.appendChild(entry.container);
		}

		// Update compact entries
		this.updateCompactEntries();
	}

	private appendStatusbarEntry(entry: IStatusbarViewModelEntry): void {
		const entries = this.viewModel.getEntries(entry.alignment);

		if (entry.alignment === StatusbarAlignment.RIGHT) {
			entries.reverse(); // reversing due to flex: row-reverse
		}

		const target = assertIsDefined(entry.alignment === StatusbarAlignment.LEFT ? this.leftItemsContainer : this.rightItemsContainer);

		const index = entries.indexOf(entry);
		if (index + 1 === entries.length) {
			target.appendChild(entry.container); // append at the end if last
		} else {
			target.insertBefore(entry.container, entries[index + 1].container); // insert before next element otherwise
		}

		// Update compact entries
		this.updateCompactEntries();
	}

	private updateCompactEntries(): void {
		const entries = this.viewModel.entries;

		// Find visible entries and clear compact related CSS classes if any
		const mapIdToVisibleEntry = new Map<string, IStatusbarViewModelEntry>();
		for (const entry of entries) {
			if (!this.viewModel.isHidden(entry.id)) {
				mapIdToVisibleEntry.set(entry.id, entry);
			}

			entry.container.classList.remove('compact-left', 'compact-right');
		}

		// Figure out groups of entries with `compact` alignment
		const compactEntryGroups = new Map<string, Set<IStatusbarViewModelEntry>>();
		for (const entry of mapIdToVisibleEntry.values()) {
			if (
				isStatusbarEntryLocation(entry.priority.primary) && // entry references another entry as location
				entry.priority.primary.compact						// entry wants to be compact
			) {
				const locationId = entry.priority.primary.id;
				const location = mapIdToVisibleEntry.get(locationId);
				if (!location) {
					continue; // skip if location does not exist
				}

				// Build a map of entries that are compact among each other
				let compactEntryGroup = compactEntryGroups.get(locationId);
				if (!compactEntryGroup) {
					compactEntryGroup = new Set<IStatusbarViewModelEntry>([entry, location]);
					compactEntryGroups.set(locationId, compactEntryGroup);
				} else {
					compactEntryGroup.add(entry);
				}

				// Adjust CSS classes to move compact items closer together
				if (entry.priority.primary.alignment === StatusbarAlignment.LEFT) {
					location.container.classList.add('compact-left');
					entry.container.classList.add('compact-right');
				} else {
					location.container.classList.add('compact-right');
					entry.container.classList.add('compact-left');
				}
			}
		}


		// Install mouse listeners to update hover feedback for
		// all compact entries that belong to each other
		const statusBarItemHoverBackground = this.getColor(STATUS_BAR_ITEM_HOVER_BACKGROUND)?.toString();
		const statusBarItemCompactHoverBackground = this.getColor(STATUS_BAR_ITEM_COMPACT_HOVER_BACKGROUND)?.toString();
		this.compactEntriesDisposable.value = new DisposableStore();
		if (statusBarItemHoverBackground && statusBarItemCompactHoverBackground && !isHighContrast(this.theme.type)) {
			for (const [, compactEntryGroup] of compactEntryGroups) {
				for (const compactEntry of compactEntryGroup) {
					if (!compactEntry.hasCommand) {
						continue; // only show hover feedback when we have a command
					}

					this.compactEntriesDisposable.value.add(addDisposableListener(compactEntry.labelContainer, EventType.MOUSE_OVER, () => {
						compactEntryGroup.forEach(compactEntry => compactEntry.labelContainer.style.backgroundColor = statusBarItemHoverBackground);
						compactEntry.labelContainer.style.backgroundColor = statusBarItemCompactHoverBackground;
					}));

					this.compactEntriesDisposable.value.add(addDisposableListener(compactEntry.labelContainer, EventType.MOUSE_OUT, () => {
						compactEntryGroup.forEach(compactEntry => compactEntry.labelContainer.style.backgroundColor = '');
					}));
				}
			}
		}
	}

	private showContextMenu(e: MouseEvent | GestureEvent): void {

	}


	//#endregion

	protected override createContentArea(parent: HTMLElement): HTMLElement {
		this.element = parent;

		// Track focus within container
		const scopedContextKeyService = this.contextKeyService.createScoped(this.element);
		StatusBarFocused.bindTo(scopedContextKeyService).set(true);

		// Left items container
		this.leftItemsContainer = document.createElement('div');
		this.leftItemsContainer.classList.add('left-items', 'items-container');
		this.element.appendChild(this.leftItemsContainer);
		this.element.tabIndex = 0;

		// Right items container
		this.rightItemsContainer = document.createElement('div');
		this.rightItemsContainer.classList.add('right-items', 'items-container');
		this.element.appendChild(this.rightItemsContainer);

		// Context menu support
		this._register(addDisposableListener(parent, EventType.CONTEXT_MENU, e => this.showContextMenu(e)));
		this._register(Gesture.addTarget(parent));
		this._register(addDisposableListener(parent, TouchEventType.Contextmenu, e => this.showContextMenu(e)));

		// Initial status bar entries
		this.createInitialStatusbarEntries();

		return this.element;
	}

	override updateStyles(): void {
		super.updateStyles();

		const container = assertIsDefined(this.getContainer());
		const styleOverride: IStatusbarStyleOverride | undefined = [...this.styleOverrides].sort((a, b) => a.priority - b.priority)[0];

		// Background / foreground colors
		const backgroundColor = this.getColor(styleOverride?.background ?? STATUS_BAR_BACKGROUND) || '';
		container.style.backgroundColor = backgroundColor;
		const foregroundColor = this.getColor(styleOverride?.foreground ?? STATUS_BAR_FOREGROUND) || '';
		container.style.color = foregroundColor;
		const itemBorderColor = this.getColor(STATUS_BAR_ITEM_FOCUS_BORDER);

		// Border color
		const borderColor = this.getColor(styleOverride?.border ?? STATUS_BAR_BORDER) || this.getColor(contrastBorder);
		if (borderColor) {
			container.classList.add('status-border-top');
			container.style.setProperty('--status-border-top-color', borderColor.toString());
		} else {
			container.classList.remove('status-border-top');
			container.style.removeProperty('--status-border-top-color');
		}

		// Colors and focus outlines via dynamic stylesheet

		const statusBarFocusColor = this.getColor(STATUS_BAR_FOCUS_BORDER);

		if (!this.styleElement) {
			this.styleElement = createStyleSheet(container);
		}

		this.styleElement.textContent = `

				/* Status bar focus outline */
				.mote-workbench .part.statusbar:focus {
					outline-color: ${statusBarFocusColor};
				}

				/* Status bar item focus outline */
				.mote-workbench .part.statusbar > .items-container > .statusbar-item a:focus-visible:not(.disabled) {
					outline: 1px solid ${this.getColor(activeContrastBorder) ?? itemBorderColor};
					outline-offset: ${borderColor ? '-2px' : '-1px'};
				}

				/* Notification Beak */
				.mote-workbench .part.statusbar > .items-container > .statusbar-item.has-beak > .status-bar-item-beak-container:before {
					border-bottom-color: ${backgroundColor};
				}
			`;
	}

	override layout(width: number, height: number, top: number, left: number): void {
		super.layout(width, height, top, left);
		super.layoutContents(width, height);
	}

	overrideStyle(style: IStatusbarStyleOverride): IDisposable {
		this.styleOverrides.add(style);
		this.updateStyles();

		return toDisposable(() => {
			this.styleOverrides.delete(style);
			this.updateStyles();
		});
	}

	toJSON(): object {
		return {
			type: Parts.STATUSBAR_PART
		};
	}
}

registerSingleton(IStatusbarService, StatusbarPart);
