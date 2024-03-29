import { Event } from 'mote/base/common/event';
import { ScanCode, ScanCodeUtils } from 'mote/base/common/keyCodes';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';
import { IKeyboardEvent } from 'mote/platform/keybinding/common/keybinding';
import { IKeyboardMapper } from 'mote/platform/keyboardLayout/common/keyboardMapper';

export const IKeyboardLayoutService = createDecorator<IKeyboardLayoutService>('keyboardLayoutService');

export interface IWindowsKeyMapping {
	vkey: string;
	value: string;
	withShift: string;
	withAltGr: string;
	withShiftAltGr: string;
}
export interface IWindowsKeyboardMapping {
	[code: string]: IWindowsKeyMapping;
}
export interface ILinuxKeyMapping {
	value: string;
	withShift: string;
	withAltGr: string;
	withShiftAltGr: string;
}
export interface ILinuxKeyboardMapping {
	[code: string]: ILinuxKeyMapping;
}
export interface IMacKeyMapping {
	value: string;
	valueIsDeadKey: boolean;
	withShift: string;
	withShiftIsDeadKey: boolean;
	withAltGr: string;
	withAltGrIsDeadKey: boolean;
	withShiftAltGr: string;
	withShiftAltGrIsDeadKey: boolean;
}
export interface IMacKeyboardMapping {
	[code: string]: IMacKeyMapping;
}

export type IMacLinuxKeyMapping = IMacKeyMapping | ILinuxKeyMapping;
export type IMacLinuxKeyboardMapping = IMacKeyboardMapping | ILinuxKeyboardMapping;
export type IKeyboardMapping = IWindowsKeyboardMapping | ILinuxKeyboardMapping | IMacKeyboardMapping;

export interface IWindowsKeyboardLayoutInfo {
	name: string;
	id: string;
	text: string;
}

export interface ILinuxKeyboardLayoutInfo {
	model: string;
	group: number;
	layout: string;
	variant: string;
	options: string;
	rules: string;
}

export interface IMacKeyboardLayoutInfo {
	id: string;
	lang: string;
	localizedName?: string;
}

export type IKeyboardLayoutInfo = (IWindowsKeyboardLayoutInfo | ILinuxKeyboardLayoutInfo | IMacKeyboardLayoutInfo) & { isUserKeyboardLayout?: boolean; isUSStandard?: true };

export interface IKeyboardLayoutService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeKeyboardLayout: Event<void>;

	getRawKeyboardMapping(): IKeyboardMapping | null;
	getCurrentKeyboardLayout(): IKeyboardLayoutInfo | null;
	getAllKeyboardLayouts(): IKeyboardLayoutInfo[];
	getKeyboardMapper(): IKeyboardMapper;
	validateCurrentKeyboardMapping(keyboardEvent: IKeyboardEvent): void;
}

export function getKeyboardLayoutId(layout: IKeyboardLayoutInfo): string {
	if ((<IWindowsKeyboardLayoutInfo>layout).name) {
		return (<IWindowsKeyboardLayoutInfo>layout).name;
	}

	if ((<IMacKeyboardLayoutInfo>layout).id) {
		return (<IMacKeyboardLayoutInfo>layout).id;
	}

	return (<ILinuxKeyboardLayoutInfo>layout).layout;
}

function macLinuxKeyMappingEquals(a: IMacLinuxKeyMapping, b: IMacLinuxKeyMapping): boolean {
	if (!a && !b) {
		return true;
	}
	if (!a || !b) {
		return false;
	}
	return (
		a.value === b.value
		&& a.withShift === b.withShift
		&& a.withAltGr === b.withAltGr
		&& a.withShiftAltGr === b.withShiftAltGr
	);
}

function windowsKeyMappingEquals(a: IWindowsKeyMapping, b: IWindowsKeyMapping): boolean {
	if (!a && !b) {
		return true;
	}
	if (!a || !b) {
		return false;
	}
	return (
		a.vkey === b.vkey
		&& a.value === b.value
		&& a.withShift === b.withShift
		&& a.withAltGr === b.withAltGr
		&& a.withShiftAltGr === b.withShiftAltGr
	);
}

export function windowsKeyboardMappingEquals(a: IWindowsKeyboardMapping | null, b: IWindowsKeyboardMapping | null): boolean {
	if (!a && !b) {
		return true;
	}
	if (!a || !b) {
		return false;
	}
	for (let scanCode = 0; scanCode < ScanCode.MAX_VALUE; scanCode++) {
		const strScanCode = ScanCodeUtils.toString(scanCode);
		const aEntry = a[strScanCode];
		const bEntry = b[strScanCode];
		if (!windowsKeyMappingEquals(aEntry, bEntry)) {
			return false;
		}
	}
	return true;
}

export function macLinuxKeyboardMappingEquals(a: IMacLinuxKeyboardMapping | null, b: IMacLinuxKeyboardMapping | null): boolean {
	if (!a && !b) {
		return true;
	}
	if (!a || !b) {
		return false;
	}
	for (let scanCode = 0; scanCode < ScanCode.MAX_VALUE; scanCode++) {
		const strScanCode = ScanCodeUtils.toString(scanCode);
		const aEntry = a[strScanCode];
		const bEntry = b[strScanCode];
		if (!macLinuxKeyMappingEquals(aEntry, bEntry)) {
			return false;
		}
	}
	return true;
}
