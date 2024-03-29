/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
'use strict';

// Delete `VSCODE_CWD` very early even before
// importing bootstrap files. We have seen
// reports where `code .` would use the wrong
// current working directory due to our variable
// somehow escaping to the parent shell
// (https://github.com/microsoft/vscode/issues/126399)
delete process.env['MOTE_CWD'];

const bootstrap = require('./bootstrap');
const bootstrapNode = require('./bootstrap-node');
const product = require('../product.json');

// Avoid Monkey Patches from Application Insights
bootstrap.avoidMonkeyPatchFromAppInsights();

// Enable portable support
bootstrapNode.configurePortable(product);

// Enable ASAR support
bootstrap.enableASARSupport();

// Signal processes that we got launched as CLI
process.env['MOTE_CLI'] = '1';

// Load CLI through AMD loader
require('./bootstrap-amd').load('mote/app/node/cli');
