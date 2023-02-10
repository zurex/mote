/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Color } from 'mote/base/common/color';
import { IDisposable } from 'mote/base/common/lifecycle';
import { IThemable, styleFn } from 'mote/base/common/styler';
import * as themeColors from 'mote/platform/theme/common/themeColors';
import { IColorTheme, IThemeService } from 'mote/platform/theme/common/themeService';
import { asCssVariable, ColorIdentifier, ColorTransform, ColorValue, resolveColorValue } from 'mote/platform/theme/common/colorRegistry';
import { IMenuStyles } from 'mote/base/browser/ui/menu/menu';
import { menuBackground, menuBorder, menuForeground, menuSelectionBackground, menuSelectionForeground, widgetShadow } from 'mote/platform/theme/common/themeColors';
import { IListStyles } from 'mote/base/browser/ui/list/listWidget';
import { IInputBoxStyles } from 'mote/base/browser/ui/inputbox/inputBox';
import { IKeybindingLabelStyles } from 'mote/base/browser/ui/keybindingLabel/keybindingLabel';
import { IButtonStyles } from 'mote/base/browser/ui/button/button';
import { IProgressBarStyles } from 'mote/base/browser/ui/progressbar/progressbar';
import { ICheckboxStyles, IToggleStyles } from 'mote/base/browser/ui/toggle/toggle';
import { IDialogStyles } from 'mote/base/browser/ui/dialog/dialog';
import { IFindWidgetStyles } from 'mote/base/browser/ui/tree/abstractTree';
import { ICountBadgeStyles } from 'mote/base/browser/ui/countBadge/countBadge';

export type IStyleOverride<T> = {
	[P in keyof T]?: ColorIdentifier;
};

export interface IStyleOverrides {
	[color: string]: ColorIdentifier | undefined;
}

export interface IColorMapping {
	[optionsKey: string]: ColorValue | undefined;
}

export interface IComputedStyles {
	[color: string]: Color | undefined;
}

export function computeStyles(theme: IColorTheme, styleMap: IColorMapping): IComputedStyles {
	const styles = Object.create(null) as IComputedStyles;
	for (const key in styleMap) {
		const value = styleMap[key];
		if (value) {
			styles[key] = resolveColorValue(value, theme);
		}
	}

	return styles;
}

export function attachStyler<T extends IColorMapping>(themeService: IThemeService, styleMap: T, widgetOrCallback: IThemable | styleFn): IDisposable {
	function applyStyles(): void {
		const styles = computeStyles(themeService.getColorTheme(), styleMap);

		if (typeof widgetOrCallback === 'function') {
			widgetOrCallback(styles);
		} else {
			widgetOrCallback.style(styles);
		}
	}

	applyStyles();

	return themeService.onDidColorThemeChange(applyStyles);
}

export const defaultKeybindingLabelStyles = getKeybindingLabelStyles({});

export function getKeybindingLabelStyles(override: IStyleOverride<IKeybindingLabelStyles>): IKeybindingLabelStyles {
	return {
		keybindingLabelBackground: asCssVariable(override.keybindingLabelBackground ?? themeColors.keybindingLabelBackground),
		keybindingLabelForeground: asCssVariable(override.keybindingLabelForeground ?? themeColors.keybindingLabelForeground),
		keybindingLabelBorder: asCssVariable(override.keybindingLabelBorder ?? themeColors.keybindingLabelBorder),
		keybindingLabelBottomBorder: asCssVariable(override.keybindingLabelBottomBorder ?? themeColors.keybindingLabelBottomBorder),
		keybindingLabelShadow: asCssVariable(override.keybindingLabelShadow ?? themeColors.widgetShadow)
	};
}
export const defaultButtonStyles: IButtonStyles = getButtonStyles({});

export function getButtonStyles(override: IStyleOverride<IButtonStyles>): IButtonStyles {
	return {
		buttonForeground: asCssVariable(override.buttonForeground ?? themeColors.buttonForeground),
		buttonSeparator: asCssVariable(override.buttonSeparator ?? themeColors.buttonSeparator),
		buttonBackground: asCssVariable(override.buttonBackground ?? themeColors.buttonBackground),
		buttonHoverBackground: asCssVariable(override.buttonHoverBackground ?? themeColors.buttonHoverBackground),
		buttonSecondaryForeground: asCssVariable(override.buttonSecondaryForeground ?? themeColors.buttonSecondaryForeground),
		buttonSecondaryBackground: asCssVariable(override.buttonSecondaryBackground ?? themeColors.buttonSecondaryBackground),
		buttonSecondaryHoverBackground: asCssVariable(override.buttonSecondaryHoverBackground ?? themeColors.buttonSecondaryHoverBackground),
		buttonBorder: asCssVariable(override.buttonBorder ?? themeColors.buttonBorder),
	};
}

export const defaultProgressBarStyles: IProgressBarStyles = getProgressBarStyles({});

export function getProgressBarStyles(override: IStyleOverride<IProgressBarStyles>): IProgressBarStyles {
	return {
		progressBarBackground: asCssVariable(override.progressBarBackground ?? themeColors.progressBarBackground)
	};
}

export const defaultToggleStyles: IToggleStyles = getToggleStyles({});

export function getToggleStyles(override: IStyleOverride<IToggleStyles>): IToggleStyles {
	return {
		inputActiveOptionBorder: asCssVariable(override.inputActiveOptionBorder ?? themeColors.inputActiveOptionBorder),
		inputActiveOptionForeground: asCssVariable(override.inputActiveOptionForeground ?? themeColors.inputActiveOptionForeground),
		inputActiveOptionBackground: asCssVariable(override.inputActiveOptionBackground ?? themeColors.inputActiveOptionBackground)
	};
}

export const defaultCheckboxStyles: ICheckboxStyles = getCheckboxStyles({});

export function getCheckboxStyles(override: IStyleOverride<ICheckboxStyles>): ICheckboxStyles {
	return {
		checkboxBackground: asCssVariable(override.checkboxBackground ?? themeColors.checkboxBackground),
		checkboxBorder: asCssVariable(override.checkboxBorder ?? themeColors.checkboxBorder),
		checkboxForeground: asCssVariable(override.checkboxForeground ?? themeColors.checkboxForeground)
	};
}

export const defaultDialogStyles = getDialogStyle({});

export function getDialogStyle(override: IStyleOverride<IDialogStyles>): IDialogStyles {
	return {
		dialogBackground: asCssVariable(override.dialogBackground ?? themeColors.editorWidgetBackground),
		dialogForeground: asCssVariable(override.dialogForeground ?? themeColors.editorWidgetForeground),
		dialogShadow: asCssVariable(override.dialogShadow ?? widgetShadow),
		dialogBorder: asCssVariable(override.dialogBorder ?? themeColors.contrastBorder),
		errorIconForeground: asCssVariable(override.errorIconForeground ?? themeColors.problemsErrorIconForeground),
		warningIconForeground: asCssVariable(override.warningIconForeground ?? themeColors.problemsWarningIconForeground),
		infoIconForeground: asCssVariable(override.infoIconForeground ?? themeColors.problemsInfoIconForeground),
		textLinkForeground: asCssVariable(override.textLinkForeground ?? themeColors.textLinkForeground)
	};
}

export const defaultInputBoxStyles = getInputBoxStyle({});

export function getInputBoxStyle(override: IStyleOverride<IInputBoxStyles>): IInputBoxStyles {
	return {
		inputBackground: asCssVariable(override.inputBackground ?? themeColors.inputBackground),
		inputForeground: asCssVariable(override.inputForeground ?? themeColors.inputForeground),
		inputBorder: asCssVariable(override.inputBorder ?? themeColors.inputBorder),
		inputValidationInfoBorder: asCssVariable(override.inputValidationInfoBorder ?? themeColors.inputValidationInfoBorder),
		inputValidationInfoBackground: asCssVariable(override.inputValidationInfoBackground ?? themeColors.inputValidationInfoBackground),
		inputValidationInfoForeground: asCssVariable(override.inputValidationInfoForeground ?? themeColors.inputValidationInfoForeground),
		inputValidationWarningBorder: asCssVariable(override.inputValidationWarningBorder ?? themeColors.inputValidationWarningBorder),
		inputValidationWarningBackground: asCssVariable(override.inputValidationWarningBackground ?? themeColors.inputValidationWarningBackground),
		inputValidationWarningForeground: asCssVariable(override.inputValidationWarningForeground ?? themeColors.inputValidationWarningForeground),
		inputValidationErrorBorder: asCssVariable(override.inputValidationErrorBorder ?? themeColors.inputValidationErrorBorder),
		inputValidationErrorBackground: asCssVariable(override.inputValidationErrorBackground ?? themeColors.inputValidationErrorBackground),
		inputValidationErrorForeground: asCssVariable(override.inputValidationErrorForeground ?? themeColors.inputValidationErrorForeground)
	};
}

export const defaultFindWidgetStyles: IFindWidgetStyles = {
	listFilterWidgetBackground: asCssVariable(themeColors.listFilterWidgetBackground),
	listFilterWidgetOutline: asCssVariable(themeColors.listFilterWidgetOutline),
	listFilterWidgetNoMatchesOutline: asCssVariable(themeColors.listFilterWidgetNoMatchesOutline),
	listFilterWidgetShadow: asCssVariable(themeColors.listFilterWidgetShadow),
	inputBoxStyles: defaultInputBoxStyles,
	toggleStyles: defaultToggleStyles
};

export const defaultCountBadgeStyles = getCountBadgeStyle({});

export function getCountBadgeStyle(override: IStyleOverride<ICountBadgeStyles>): ICountBadgeStyles {
	return {
		badgeBackground: asCssVariable(override.badgeBackground ?? themeColors.badgeBackground),
		badgeForeground: asCssVariable(override.badgeForeground ?? themeColors.badgeForeground),
		badgeBorder: asCssVariable(themeColors.contrastBorder)
	};
}

export interface IToggleStyleOverrides extends IStyleOverrides {
	inputActiveOptionBorderColor?: ColorIdentifier;
	inputActiveOptionForegroundColor?: ColorIdentifier;
	inputActiveOptionBackgroundColor?: ColorIdentifier;
}

export interface IBadgeStyleOverrides extends IStyleOverrides {
	badgeBackground?: ColorIdentifier;
	badgeForeground?: ColorIdentifier;
}

export interface IInputBoxStyleOverrides extends IStyleOverrides {
	inputBackground?: ColorIdentifier;
	inputForeground?: ColorIdentifier;
	inputBorder?: ColorIdentifier;
	inputActiveOptionBorder?: ColorIdentifier;
	inputActiveOptionForeground?: ColorIdentifier;
	inputActiveOptionBackground?: ColorIdentifier;
	inputValidationInfoBorder?: ColorIdentifier;
	inputValidationInfoBackground?: ColorIdentifier;
	inputValidationInfoForeground?: ColorIdentifier;
	inputValidationWarningBorder?: ColorIdentifier;
	inputValidationWarningBackground?: ColorIdentifier;
	inputValidationWarningForeground?: ColorIdentifier;
	inputValidationErrorBorder?: ColorIdentifier;
	inputValidationErrorBackground?: ColorIdentifier;
	inputValidationErrorForeground?: ColorIdentifier;
}

export interface ISelectBoxStyleOverrides extends IStyleOverrides, IListStyleOverrides {
	selectBackground?: ColorIdentifier;
	selectListBackground?: ColorIdentifier;
	selectForeground?: ColorIdentifier;
	decoratorRightForeground?: ColorIdentifier;
	selectBorder?: ColorIdentifier;
	focusBorder?: ColorIdentifier;
}

export interface IListStyleOverrides extends IStyleOverrides {
	listBackground?: ColorIdentifier;
	listFocusBackground?: ColorIdentifier;
	listFocusForeground?: ColorIdentifier;
	listFocusOutline?: ColorIdentifier;
	listActiveSelectionBackground?: ColorIdentifier;
	listActiveSelectionForeground?: ColorIdentifier;
	listActiveSelectionIconForeground?: ColorIdentifier;
	listFocusAndSelectionOutline?: ColorIdentifier;
	listFocusAndSelectionBackground?: ColorIdentifier;
	listFocusAndSelectionForeground?: ColorIdentifier;
	listInactiveSelectionBackground?: ColorIdentifier;
	listInactiveSelectionIconForeground?: ColorIdentifier;
	listInactiveSelectionForeground?: ColorIdentifier;
	listInactiveFocusBackground?: ColorIdentifier;
	listInactiveFocusOutline?: ColorIdentifier;
	listHoverBackground?: ColorIdentifier;
	listHoverForeground?: ColorIdentifier;
	listDropBackground?: ColorIdentifier;
	listSelectionOutline?: ColorIdentifier;
	listHoverOutline?: ColorIdentifier;
	listFilterWidgetBackground?: ColorIdentifier;
	listFilterWidgetOutline?: ColorIdentifier;
	listFilterWidgetNoMatchesOutline?: ColorIdentifier;
	listMatchesShadow?: ColorIdentifier;
	treeIndentGuidesStroke?: ColorIdentifier;
	tableColumnsBorder?: ColorIdentifier;
	tableOddRowsBackgroundColor?: ColorIdentifier;
}

export function attachListStyler(widget: IThemable, themeService: IThemeService, overrides?: IColorMapping): IDisposable {
	return attachStyler(themeService, { ...defaultListStyles, ...(overrides || {}) }, widget);
}

export const defaultListStyles: IColorMapping = {
	listFocusBackground: themeColors.listFocusBackground
};

export function getListStyles(override: IStyleOverride<IListStyles>): IListStyles {
	return {
		listBackground: override.listBackground ? asCssVariable(override.listBackground) : undefined,
		listInactiveFocusForeground: override.listInactiveFocusForeground ? asCssVariable(override.listInactiveFocusForeground) : undefined,
		listFocusBackground: asCssVariable(override.listFocusBackground ?? themeColors.listFocusBackground),
		listFocusForeground: asCssVariable(override.listFocusForeground ?? themeColors.listFocusForeground),
		listFocusOutline: asCssVariable(override.listFocusOutline ?? themeColors.listFocusOutline),
		listActiveSelectionBackground: asCssVariable(override.listActiveSelectionBackground ?? themeColors.listActiveSelectionBackground),
		listActiveSelectionForeground: asCssVariable(override.listActiveSelectionForeground ?? themeColors.listActiveSelectionForeground),
		listActiveSelectionIconForeground: asCssVariable(override.listActiveSelectionIconForeground ?? themeColors.listActiveSelectionIconForeground),
		listFocusAndSelectionOutline: asCssVariable(override.listFocusAndSelectionOutline ?? themeColors.listFocusAndSelectionOutline),
		listFocusAndSelectionBackground: asCssVariable(override.listFocusAndSelectionBackground ?? themeColors.listActiveSelectionBackground),
		listFocusAndSelectionForeground: asCssVariable(override.listFocusAndSelectionForeground ?? themeColors.listActiveSelectionForeground),
		listInactiveSelectionBackground: asCssVariable(override.listInactiveSelectionBackground ?? themeColors.listInactiveSelectionBackground),
		listInactiveSelectionIconForeground: asCssVariable(override.listInactiveSelectionIconForeground ?? themeColors.listInactiveSelectionIconForeground),
		listInactiveSelectionForeground: asCssVariable(override.listInactiveSelectionForeground ?? themeColors.listInactiveSelectionForeground),
		listInactiveFocusBackground: asCssVariable(override.listInactiveFocusBackground ?? themeColors.listInactiveFocusBackground),
		listInactiveFocusOutline: asCssVariable(override.listInactiveFocusOutline ?? themeColors.listInactiveFocusOutline),
		listHoverBackground: asCssVariable(override.listHoverBackground ?? themeColors.listHoverBackground),
		listHoverForeground: asCssVariable(override.listHoverForeground ?? themeColors.listHoverForeground),
		listDropBackground: asCssVariable(override.listDropBackground ?? themeColors.listDropBackground),
		listSelectionOutline: asCssVariable(override.listSelectionOutline ?? themeColors.activeContrastBorder),
		listHoverOutline: asCssVariable(override.listHoverOutline ?? themeColors.activeContrastBorder),
		treeIndentGuidesStroke: asCssVariable(override.treeIndentGuidesStroke ?? themeColors.treeIndentGuidesStroke),
		treeInactiveIndentGuidesStroke: asCssVariable(override.treeInactiveIndentGuidesStroke ?? themeColors.treeInactiveIndentGuidesStroke),
		tableColumnsBorder: asCssVariable(override.tableColumnsBorder ?? themeColors.tableColumnsBorder),
		tableOddRowsBackgroundColor: asCssVariable(override.tableOddRowsBackgroundColor ?? themeColors.tableOddRowsBackgroundColor),
	};
}

export interface IButtonStyleOverrides extends IStyleOverrides {
	buttonForeground?: ColorIdentifier;
	buttonBackground?: ColorIdentifier;
	buttonHoverBackground?: ColorIdentifier;
	buttonSecondaryForeground?: ColorIdentifier;
	buttonSecondaryBackground?: ColorIdentifier;
	buttonSecondaryHoverBackground?: ColorIdentifier;
	buttonBorder?: ColorIdentifier;
}

export interface IKeybindingLabelStyleOverrides extends IStyleOverrides {
	keybindingLabelBackground?: ColorIdentifier;
	keybindingLabelForeground?: ColorIdentifier;
	keybindingLabelBorder?: ColorIdentifier;
	keybindingLabelBottomBorder?: ColorIdentifier;
	keybindingLabelShadow?: ColorIdentifier;
}

export interface IProgressBarStyleOverrides extends IStyleOverrides {
	progressBarBackground?: ColorIdentifier;
}

export function attachStylerCallback(themeService: IThemeService, colors: { [name: string]: ColorIdentifier }, callback: styleFn): IDisposable {
	return attachStyler(themeService, colors, callback);
}

export interface IBreadcrumbsWidgetStyleOverrides extends IColorMapping {
	breadcrumbsBackground?: ColorIdentifier | ColorTransform;
	breadcrumbsForeground?: ColorIdentifier;
	breadcrumbsHoverForeground?: ColorIdentifier;
	breadcrumbsFocusForeground?: ColorIdentifier;
	breadcrumbsFocusAndSelectionForeground?: ColorIdentifier;
}

export const defaultBreadcrumbsStyles = <IBreadcrumbsWidgetStyleOverrides>{
};

export function attachBreadcrumbsStyler(widget: IThemable, themeService: IThemeService, style?: IBreadcrumbsWidgetStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultBreadcrumbsStyles, ...style }, widget);
}

export interface IMenuStyleOverrides extends IColorMapping {
	shadowColor?: ColorIdentifier;
	borderColor?: ColorIdentifier;
	foregroundColor?: ColorIdentifier;
	backgroundColor?: ColorIdentifier;
	selectionForegroundColor?: ColorIdentifier;
	selectionBackgroundColor?: ColorIdentifier;
	selectionBorderColor?: ColorIdentifier;
	separatorColor?: ColorIdentifier;
}

export const defaultMenuStyles = getMenuStyles({});

export function getMenuStyles(override: IStyleOverride<IMenuStyles>): IMenuStyles {
	return {
		shadowColor: asCssVariable(override.shadowColor ?? widgetShadow),
		borderColor: asCssVariable(override.borderColor ?? menuBorder),
		foregroundColor: asCssVariable(override.foregroundColor ?? menuForeground),
		backgroundColor: asCssVariable(override.backgroundColor ?? menuBackground),
		selectionForegroundColor: asCssVariable(override.selectionForegroundColor ?? menuSelectionForeground),
		selectionBackgroundColor: asCssVariable(override.selectionBackgroundColor ?? menuSelectionBackground),
		selectionBorderColor: asCssVariable(override.selectionBorderColor ?? themeColors.menuSelectionBorder),
		separatorColor: asCssVariable(override.separatorColor ?? themeColors.menuSeparatorBackground),
		scrollbarShadow: asCssVariable(override.scrollbarShadow ?? themeColors.scrollbarShadow),
		scrollbarSliderBackground: asCssVariable(override.scrollbarSliderBackground ?? themeColors.scrollbarSliderBackground),
		scrollbarSliderHoverBackground: asCssVariable(override.scrollbarSliderHoverBackground ?? themeColors.scrollbarSliderHoverBackground),
		scrollbarSliderActiveBackground: asCssVariable(override.scrollbarSliderActiveBackground ?? themeColors.scrollbarSliderActiveBackground)
	};
}

export function attachMenuStyler(widget: IThemable, themeService: IThemeService, style?: IMenuStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultMenuStyles, ...style }, widget);
}

export interface IDialogStyleOverrides extends IButtonStyleOverrides {
	dialogForeground?: ColorIdentifier;
	dialogBackground?: ColorIdentifier;
	dialogShadow?: ColorIdentifier;
	dialogBorder?: ColorIdentifier;
	checkboxBorder?: ColorIdentifier;
	checkboxBackground?: ColorIdentifier;
	checkboxForeground?: ColorIdentifier;
	errorIconForeground?: ColorIdentifier;
	warningIconForeground?: ColorIdentifier;
	infoIconForeground?: ColorIdentifier;
	inputBackground?: ColorIdentifier;
	inputForeground?: ColorIdentifier;
	inputBorder?: ColorIdentifier;
}


export function attachDialogStyler(widget: IThemable, themeService: IThemeService, style?: IDialogStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultDialogStyles, ...style }, widget);
}

interface IItemContainerStyleOverrides {
	lightTextColor: ColorIdentifier;
	mediumTextColor: ColorIdentifier;
	regularTextColor: ColorIdentifier;
}

export const defaultItemContainerStyles = <IItemContainerStyleOverrides>{
	lightTextColor: themeColors.lightTextColor,
	mediumTextColor: themeColors.mediumTextColor,
	regularTextColor: themeColors.regularTextColor,
};

export function attachItemContainerStyler(widget: IThemable, themeService: IThemeService, style?: IItemContainerStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultItemContainerStyles, ...style }, widget);
}

interface ISwitchButtonStyleOverrides extends IButtonStyleOverrides {
	switchTurnOnBackground?: ColorIdentifier;
	switchTurnOffBackground?: ColorIdentifier;
	switchShadow?: ColorIdentifier;
	circleBackground?: ColorIdentifier;
	circleShadow?: ColorIdentifier;
	switchBoxShadow?: ColorIdentifier;
}

export const defaultSwitchButtonStyles = <ISwitchButtonStyleOverrides>{
	switchBoxShadow: themeColors.darkDividerColor,
	switchTurnOnBackground: themeColors.switcherOnBackground,
	switchTurnOffBackground: themeColors.switcherOffBackground
};

export function attachSwitchButtonStyler(widget: IThemable, themeService: IThemeService, style?: ISwitchButtonStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultSwitchButtonStyles, ...style }, widget);
}
